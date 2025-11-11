import type { Environment } from '@prisma/client'
import { NextResponse } from 'next/server'

import { verifyProjectAccess, withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'
import { canUpdateResource } from '@/lib/util/action'

const logger = baseLogger.child({ module: 'api/projects/[id]/environment/[envId]' })

type PutEnvironmentResponse = { error: string } | Environment

export const PUT = withAuth<PutEnvironmentResponse>(async (req, context, session) => {
  const params = await context.params
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id
  const envId = Array.isArray(params.envId) ? params.envId[0] : params.envId

  try {
    // Verify project access
    await verifyProjectAccess(projectId, session.user.id)

    // Verify the environment variable belongs to the project
    const envVar = await prisma.environment.findFirst({
      where: {
        id: envId,
        projectId: projectId,
      },
    })

    if (!envVar) {
      return NextResponse.json({ error: 'Environment variable not found' }, { status: 404 })
    }

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

    // Check if all sandboxes can be updated
    const nonUpdatableSandboxes = project.sandboxes.filter((sb) => !canUpdateResource(sb.status))

    if (nonUpdatableSandboxes.length > 0) {
      const statusList = nonUpdatableSandboxes.map((sb) => `${sb.name}: ${sb.status}`).join(', ')
      logger.warn(
        `Cannot update environment variable for project ${projectId}: some sandboxes cannot be updated (${statusList})`
      )
      return NextResponse.json(
        {
          error: `Cannot update environment variable: some sandboxes are not in a state that allows updates. Only RUNNING sandboxes can be updated. Non-updatable sandboxes: ${statusList}`,
        },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { value } = body

    if (value === undefined) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    }

    // Update the environment variable in database
    const updated = await prisma.environment.update({
      where: { id: envId },
      data: { value },
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

    return NextResponse.json(updated)
  } catch (error) {
    logger.error(`Error updating environment variable: ${error}`)
    return NextResponse.json({ error: 'Failed to update environment variable' }, { status: 500 })
  }
})

type DeleteEnvironmentResponse = { error: string } | { success: true }

export const DELETE = withAuth<DeleteEnvironmentResponse>(async (_req, context, session) => {
  const params = await context.params
  const projectId = Array.isArray(params.id) ? params.id[0] : params.id
  const envId = Array.isArray(params.envId) ? params.envId[0] : params.envId

  try {
    // Verify project access
    await verifyProjectAccess(projectId, session.user.id)

    // Verify the environment variable belongs to the project
    const envVar = await prisma.environment.findFirst({
      where: {
        id: envId,
        projectId: projectId,
      },
    })

    if (!envVar) {
      return NextResponse.json({ error: 'Environment variable not found' }, { status: 404 })
    }

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

    // Check if all sandboxes can be updated
    const nonUpdatableSandboxes = project.sandboxes.filter((sb) => !canUpdateResource(sb.status))

    if (nonUpdatableSandboxes.length > 0) {
      const statusList = nonUpdatableSandboxes.map((sb) => `${sb.name}: ${sb.status}`).join(', ')
      logger.warn(
        `Cannot delete environment variable for project ${projectId}: some sandboxes cannot be updated (${statusList})`
      )
      return NextResponse.json(
        {
          error: `Cannot delete environment variable: some sandboxes are not in a state that allows updates. Only RUNNING sandboxes can be updated. Non-updatable sandboxes: ${statusList}`,
        },
        { status: 400 }
      )
    }

    // Delete the environment variable from database
    await prisma.environment.delete({
      where: { id: envId },
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

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error(`Error deleting environment variable: ${error}`)
    return NextResponse.json({ error: 'Failed to delete environment variable' }, { status: 500 })
  }
})
