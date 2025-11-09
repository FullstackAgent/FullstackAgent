import type { ProjectStatus } from '@prisma/client'
import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { updateProjectStatus } from '@/lib/repo/project'
import { canStartProject } from '@/lib/util/action'

type StartProjectResponse =
  | { error: string }
  | { message: string; project: { id: string; status: ProjectStatus; updatedAt: Date } }

/**
 * POST /api/projects/[id]/start
 *
 * Start all resources of a project
 * - Updates all databases and sandboxes to STARTING status
 * - Reconcile job will handle the actual K8s operations
 */
export const POST = withAuth<StartProjectResponse>(async (_req, context, session) => {
  const resolvedParams = await context.params
  const projectId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  // Get project with resources to check if start is allowed
  const project = await prisma.project.findUnique({
    where: { id: projectId, userId: session.user.id },
    include: {
      databases: { select: { status: true } },
      sandboxes: { select: { status: true } },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Check if start action is allowed
  const actionCheck = canStartProject(project)
  if (!actionCheck.allowed) {
    return NextResponse.json(
      { error: actionCheck.reason || 'Cannot start project' },
      { status: 400 }
    )
  }

  // Update all resources to STARTING
  const updatedProject = await updateProjectStatus(projectId, 'STARTING')

  return NextResponse.json({
    message: 'Project start requested - reconcile job will handle resource operations',
    project: {
      id: updatedProject.id,
      status: updatedProject.status,
      updatedAt: updatedProject.updatedAt,
    },
  })
})
