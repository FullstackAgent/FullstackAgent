import type { Environment } from '@prisma/client'
import { NextResponse } from 'next/server'

import { verifyProjectAccess, withAuth } from '@/lib/api-auth'
import { EnvironmentCategory } from '@/lib/const'
import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'api/projects/[id]/environment' })

type GroupedEnvironments = Record<string, Environment[]>

type GetEnvironmentsResponse = { error: string } | GroupedEnvironments

export const GET = withAuth<GetEnvironmentsResponse>(async (_req, context, session) => {
  const resolvedParams = await context.params
  const projectId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  try {
    await verifyProjectAccess(projectId, session.user.id)

    // Fetch environment variables
    const environments = await prisma.environment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    // Group environment variables by category (dynamically based on EnvironmentCategory enum)
    const grouped: GroupedEnvironments = {}

    // Initialize all categories from enum
    Object.values(EnvironmentCategory).forEach((category) => {
      grouped[category] = environments.filter((e) => e.category === category)
    })

    // Add general category for 'general' and null/undefined categories
    grouped.general = environments.filter((e) => e.category === 'general' || !e.category)

    return NextResponse.json(grouped)
  } catch (error) {
    console.error('Error fetching environment variables:', error)
    return NextResponse.json({ error: 'Failed to fetch environment variables' }, { status: 500 })
  }
})

interface EnvironmentVariableInput {
  key: string
  value: string
  category?: string
  isSecret?: boolean
}

type PostEnvironmentResponse = { error: string } | Environment | { success: true; count: number }

export const POST = withAuth<PostEnvironmentResponse>(async (req, context, session) => {
  const resolvedParams = await context.params
  const projectId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  try {
    await verifyProjectAccess(projectId, session.user.id)

    // Parse request body first (before any validation that might return early)
    const body = await req.json()

    // Check if project sandboxes can be updated
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sandboxes: {
          select: { id: true, status: true, name: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if project status is RUNNING
    if (project.status !== 'RUNNING') {
      logger.warn(
        `Cannot update environment variables for project ${projectId}: project status is ${project.status}, not RUNNING`
      )
      return NextResponse.json(
        {
          error: 'Environment variables can only be updated when the project is running.',
        },
        { status: 400 }
      )
    }

    // Require all sandboxes to be RUNNING
    if (project.sandboxes.length === 0) {
      logger.warn(
        `Cannot update environment variables for project ${projectId}: project has no sandboxes`
      )
      return NextResponse.json(
        {
          error: 'Environment variables can only be updated when the project is running.',
        },
        { status: 400 }
      )
    }

    // Check if ALL sandboxes are RUNNING
    const nonRunningSandboxes = project.sandboxes.filter((sb) => sb.status !== 'RUNNING')

    if (nonRunningSandboxes.length > 0) {
      logger.warn(
        `Cannot update environment variables for project ${projectId}: not all sandboxes are RUNNING`
      )
      return NextResponse.json(
        {
          error: 'Environment variables can only be updated when the project is running.',
        },
        { status: 400 }
      )
    }

    // Check if this is a single variable creation or batch update
    if (body.key && body.value !== undefined) {
      // Single variable creation
      const newVar = await prisma.environment.create({
        data: {
          projectId,
          key: body.key,
          value: body.value,
          category: body.category || 'general',
          isSecret: body.isSecret || false,
        },
      })

      // Set all sandboxes to UPDATING status
      if (project.sandboxes.length > 0) {
        await prisma.sandbox.updateMany({
          where: {
            projectId,
            status: 'RUNNING', // Only update RUNNING sandboxes
          },
          data: {
            status: 'UPDATING',
          },
        })
        logger.info(
          `Set ${project.sandboxes.length} sandboxes to UPDATING status for project ${projectId}`
        )
      }

      return NextResponse.json(newVar)
    } else if (body.variables) {
      // Batch update (replace variables by category)
      const { variables } = body

      // Determine the primary category for this batch update
      // If all variables have the same category, only delete that category
      // Otherwise, delete all to maintain backward compatibility
      const categories = new Set(
        (variables as EnvironmentVariableInput[]).map((v) => v.category || 'general')
      )
      const deleteByCategory = categories.size === 1

      if (deleteByCategory) {
        // Delete only environment variables of the same category
        const targetCategory = Array.from(categories)[0]
        await prisma.environment.deleteMany({
          where: {
            projectId,
            category: targetCategory,
          },
        })
      } else {
        // Mixed categories - delete all (fallback behavior)
        await prisma.environment.deleteMany({
          where: { projectId },
        })
      }

      // Create new environment variables
      const envPromises = (variables as EnvironmentVariableInput[])
        .filter((v) => v.key && v.value !== undefined)
        .map((v) =>
          prisma.environment.create({
            data: {
              projectId,
              key: v.key,
              value: v.value,
              category: v.category || 'general',
              isSecret: v.isSecret || false,
            },
          })
        )

      const created = await Promise.all(envPromises)

      // Set all sandboxes to UPDATING status
      if (project.sandboxes.length > 0) {
        await prisma.sandbox.updateMany({
          where: {
            projectId,
            status: 'RUNNING', // Only update RUNNING sandboxes
          },
          data: {
            status: 'UPDATING',
          },
        })
        logger.info(
          `Set ${project.sandboxes.length} sandboxes to UPDATING status for project ${projectId}`
        )
      }

      return NextResponse.json({ success: true, count: created.length })
    } else {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
  } catch (error) {
    logger.error(`Error saving environment variables: ${error}`)
    return NextResponse.json({ error: 'Failed to save environment variables' }, { status: 500 })
  }
})
