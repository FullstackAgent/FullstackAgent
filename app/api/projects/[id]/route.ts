import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

type ProjectWithFullRelations = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true
    databases: true
    environments: true
  }
}>

type GetProjectResponse = { error: string } | ProjectWithFullRelations

/**
 * GET /api/projects/[id]
 * Get project details with sandboxes and databases
 */
export const GET = withAuth<GetProjectResponse>(async (_req, context, session) => {
  const resolvedParams = await context.params
  const projectId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  try {
    // Verify project access and get full project data
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: session.user.id,
      },
      include: {
        sandboxes: {
          orderBy: { createdAt: 'asc' },
        },
        databases: {
          orderBy: { createdAt: 'asc' },
        },
        environments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 })
  }
})