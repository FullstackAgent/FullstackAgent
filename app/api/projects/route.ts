import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'
import { KubernetesUtils } from '@/lib/k8s/kubernetes-utils'
import { VERSIONS } from '@/lib/k8s/versions'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'api/projects' })

export const GET = withAuth(async (_req, _context, session) => {
  const projects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      databases: true,
      sandboxes: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return NextResponse.json(projects)
})

export const POST = withAuth(async (req, _context, session) => {
  const body = await req.json()
  const { name, description } = body

  if (!name || typeof name !== 'string') {
    throw NextResponse.json({ error: 'Project name is required' }, { status: 400 })
  }

  logger.info(`Creating project: ${name} for user: ${session.user.id}`)

  // Get K8s service for user
  const k8sService = await getK8sServiceForUser(session.user.id)
  const namespace = k8sService.getDefaultNamespace()

  // Generate K8s compatible names
  const k8sProjectName = KubernetesUtils.toK8sProjectName(name)
  const randomSuffix = KubernetesUtils.generateRandomString(8)
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
        name: 'main',
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
        name: 'dev',
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

    return { project, database, sandbox }
  })

  logger.info(
    `Project created: ${result.project.id} with database: ${result.database.id} and sandbox: ${result.sandbox.id}`
  )

  return NextResponse.json(result.project)
})
