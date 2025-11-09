import type { Database, Environment, Project, Sandbox } from '@prisma/client'
import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/api-auth'
import { EnvironmentCategory } from '@/lib/const'
import { prisma } from '@/lib/db'
import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'
import { KubernetesUtils } from '@/lib/k8s/kubernetes-utils'
import { VERSIONS } from '@/lib/k8s/versions'
import { logger as baseLogger } from '@/lib/logger'
import { generateRandomString } from '@/lib/util/common'

const logger = baseLogger.child({ module: 'api/projects' })

type ProjectWithRelations = Project & {
  databases: Database[]
  sandboxes: Sandbox[]
  environments: Environment[]
}

type GetProjectsResponse = ProjectWithRelations[]

export const GET = withAuth<GetProjectsResponse>(async (_req, _context, session) => {
  const projects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      databases: true,
      sandboxes: true,
      environments: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return NextResponse.json(projects)
})

type PostProjectResponse = { error: string; errorCode?: string; message?: string } | Project

export const POST = withAuth<PostProjectResponse>(async (req, _context, session) => {
  const body = await req.json()
  const { name, description } = body

  if (!name || typeof name !== 'string') {
    throw NextResponse.json({ error: 'Project name is required' }, { status: 400 })
  }

  logger.info(`Creating project: ${name} for user: ${session.user.id}`)

  // Get K8s service for user - will throw if KUBECONFIG is missing
  let k8sService
  let namespace
  try {
    k8sService = await getK8sServiceForUser(session.user.id)
    namespace = k8sService.getDefaultNamespace()
  } catch (error) {
    // Check if error is due to missing kubeconfig
    if (error instanceof Error && error.message.includes('does not have KUBECONFIG configured')) {
      logger.warn(`Project creation failed - missing kubeconfig for user: ${session.user.id}`)
      return NextResponse.json(
        {
          error: 'Kubeconfig not configured',
          errorCode: 'KUBECONFIG_MISSING',
          message: 'Please configure your kubeconfig before creating a project',
        },
        { status: 400 }
      )
    }
    // Re-throw other errors
    throw error
  }

  // Generate K8s compatible names
  const k8sProjectName = KubernetesUtils.toK8sProjectName(name)
  const randomSuffix = KubernetesUtils.generateRandomString()
  const ttydAuthToken = generateRandomString()
  const databaseName = `${k8sProjectName}-${randomSuffix}`
  const sandboxName = `${k8sProjectName}-${randomSuffix}`

  // Create project with database and sandbox in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Project with status CREATING
    const project = await tx.project.create({
      data: {
        name,
        description,
        userId: session.user.id,
        status: 'CREATING',
      },
    })

    // 2. Create Database record - lockedUntil is null so reconcile job can process immediately
    const database = await tx.database.create({
      data: {
        projectId: project.id,
        name: databaseName,
        k8sNamespace: namespace,
        databaseName: databaseName,
        status: 'CREATING',
        lockedUntil: null, // Unlocked - ready for reconcile job to process
        // Resource configuration from versions
        storageSize: VERSIONS.STORAGE.DATABASE_SIZE,
        cpuRequest: VERSIONS.RESOURCES.DATABASE.requests.cpu,
        cpuLimit: VERSIONS.RESOURCES.DATABASE.limits.cpu,
        memoryRequest: VERSIONS.RESOURCES.DATABASE.requests.memory,
        memoryLimit: VERSIONS.RESOURCES.DATABASE.limits.memory,
      },
    })

    // 3. Create Sandbox record - lockedUntil is null so reconcile job can process immediately
    const sandbox = await tx.sandbox.create({
      data: {
        projectId: project.id,
        name: sandboxName,
        k8sNamespace: namespace,
        sandboxName: sandboxName,
        status: 'CREATING',
        lockedUntil: null, // Unlocked - ready for reconcile job to process
        // Resource configuration from versions
        runtimeImage: VERSIONS.RUNTIME_IMAGE,
        cpuRequest: VERSIONS.RESOURCES.SANDBOX.requests.cpu,
        cpuLimit: VERSIONS.RESOURCES.SANDBOX.limits.cpu,
        memoryRequest: VERSIONS.RESOURCES.SANDBOX.requests.memory,
        memoryLimit: VERSIONS.RESOURCES.SANDBOX.limits.memory,
      },
    })

    // 4. Create Environment record for ttyd access token
    const environment = await tx.environment.create({
      data: {
        projectId: project.id,
        key: 'TTYD_ACCESS_TOKEN',
        value: ttydAuthToken,
        category: EnvironmentCategory.TTYD,
        isSecret: true, // Mark as secret since it's an access token
      },
    })

    return { project, database, sandbox, environment }
  })

  logger.info(
    `Project created: ${result.project.id} with database: ${result.database.id}, sandbox: ${result.sandbox.id}, and environment: ${result.environment.id}`
  )

  return NextResponse.json(result.project)
})
