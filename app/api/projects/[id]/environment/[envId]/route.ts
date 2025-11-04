import { NextResponse } from 'next/server'

import { verifyProjectAccess, withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const PUT = withAuth(async (req, context, session) => {
  const params = await context.params
  const { id: projectId, envId } = params

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

    const body = await req.json()
    const { value } = body

    if (value === undefined) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    }

    // Update the environment variable in database only
    const updated = await prisma.environment.update({
      where: { id: envId },
      data: { value },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating environment variable:', error)
    return NextResponse.json({ error: 'Failed to update environment variable' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (req, context, session) => {
  const params = await context.params
  const { id: projectId, envId } = params

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

    // Delete the environment variable from database only
    await prisma.environment.delete({
      where: { id: envId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting environment variable:', error)
    return NextResponse.json({ error: 'Failed to delete environment variable' }, { status: 500 })
  }
})
