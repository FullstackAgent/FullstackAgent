import type { Database, Environment, Prisma, Project, Sandbox } from '@prisma/client'
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

/**
 * Validate project name format
 * Rules:
 * - Only letters, numbers, spaces, and hyphens allowed
 * - Must start with a letter
 * - Must end with a letter
 */
function validateProjectName(name: string): { valid: boolean; error?: string } {
  // Check if name is empty or only whitespace
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Project name cannot be empty' }
  }

  // Check if name contains only allowed characters (letters, numbers, spaces, hyphens)
  const allowedPattern = /^[a-zA-Z0-9\s-]+$/
  if (!allowedPattern.test(name)) {
    return {
      valid: false,
      error: 'Project name can only contain letters, numbers, spaces, and hyphens',
    }
  }

  // Check if name starts with a letter
  const trimmedName = name.trim()
  if (!/^[a-zA-Z]/.test(trimmedName)) {
    return { valid: false, error: 'Project name must start with a letter' }
  }

  // Check if name ends with a letter
  if (!/[a-zA-Z]$/.test(trimmedName)) {
    return { valid: false, error: 'Project name must end with a letter' }
  }

  return { valid: true }
}

type ProjectWithRelations = Project & {
  databases: Database[]
  sandboxes: Sandbox[]
  environments: Environment[]
}

type GetProjectsResponse = ProjectWithRelations[]

export const GET = withAuth<GetProjectsResponse>(async (req, _context, session) => {
  // Get query parameters for filtering
  const { searchParams } = new URL(req.url)
  const allParam = searchParams.get('all')
  const keywordParam = searchParams.get('keyword')
  const createdFromParam = searchParams.get('createdFrom')
  const createdToParam = searchParams.get('createdTo')

  // Build where clause
  const whereClause: Prisma.ProjectWhereInput = {
    userId: session.user.id,
  }

  // Add keyword filter if provided (searches in both name and description)
  if (keywordParam) {
    whereClause.OR = [
      {
        name: {
          contains: keywordParam,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: keywordParam,
          mode: 'insensitive',
        },
      },
    ]
  }

  // Add createdAt date filters if provided
  const createdAtFilter: { gte?: Date; lte?: Date } = {}
  if (createdFromParam) {
    const createdFrom = new Date(createdFromParam)
    if (!isNaN(createdFrom.getTime())) {
      createdAtFilter.gte = createdFrom
    }
  }
  if (createdToParam) {
    const createdTo = new Date(createdToParam)
    if (!isNaN(createdTo.getTime())) {
      createdAtFilter.lte = createdTo
    }
  }
  if (Object.keys(createdAtFilter).length > 0) {
    whereClause.createdAt = createdAtFilter
  }

  // Add namespace filter from user's kubeconfig (unless 'all' parameter is provided)
  if (allParam !== 'true') {
    try {
      const k8sService = await getK8sServiceForUser(session.user.id)
      const namespace = k8sService.getDefaultNamespace()
      whereClause.sandboxes = {
        some: {
          k8sNamespace: namespace,
        },
      }
    } catch {
      // If user doesn't have kubeconfig configured, log warning but don't fail
      // Skip namespace filtering and return all projects for the user
      logger.warn(
        `User ${session.user.id} does not have KUBECONFIG configured, returning all projects`
      )
    }
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      databases: true,
      sandboxes: true,
      environments: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  logger.info(
    `Fetched ${projects.length} projects for user ${session.user.id}${allParam === 'true' ? ' (all namespaces)' : ''}`
  )

  return NextResponse.json(projects)
})

type PostProjectResponse = { error: string; errorCode?: string; message?: string } | Project

export const POST = withAuth<PostProjectResponse>(async (req, _context, session) => {
  const body = await req.json()
  const { name, description } = body

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
  }

  // Validate project name format
  const nameValidation = validateProjectName(name)
  if (!nameValidation.valid) {
    return NextResponse.json(
      {
        error: nameValidation.error || 'Invalid project name format',
        errorCode: 'INVALID_PROJECT_NAME',
      },
      { status: 400 }
    )
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
  const fileBrowserUsername = `fb-${randomSuffix}` // filebrowser username
  const fileBrowserPassword = generateRandomString(16) // 16 char random password
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
    const ttydEnv = await tx.environment.create({
      data: {
        projectId: project.id,
        key: 'TTYD_ACCESS_TOKEN',
        value: ttydAuthToken,
        category: EnvironmentCategory.TTYD,
        isSecret: true, // Mark as secret since it's an access token
      },
    })

    // 5. Create Environment records for filebrowser credentials
    const fileBrowserUsernameEnv = await tx.environment.create({
      data: {
        projectId: project.id,
        key: 'FILE_BROWSER_USERNAME',
        value: fileBrowserUsername,
        category: EnvironmentCategory.FILE_BROWSER,
        isSecret: false,
      },
    })

    const fileBrowserPasswordEnv = await tx.environment.create({
      data: {
        projectId: project.id,
        key: 'FILE_BROWSER_PASSWORD',
        value: fileBrowserPassword,
        category: EnvironmentCategory.FILE_BROWSER,
        isSecret: true, // Mark as secret since it's a password
      },
    })

    return {
      project,
      database,
      sandbox,
      ttydEnv,
      fileBrowserUsernameEnv,
      fileBrowserPasswordEnv,
    }
  })

  logger.info(
    `Project created: ${result.project.id} with database: ${result.database.id}, sandbox: ${result.sandbox.id}, ttyd env: ${result.ttydEnv.id}, filebrowser username env: ${result.fileBrowserUsernameEnv.id}, filebrowser password env: ${result.fileBrowserPasswordEnv.id}`
  )

  return NextResponse.json(result.project)
})
