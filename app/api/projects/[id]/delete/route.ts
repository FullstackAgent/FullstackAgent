import type { ProjectStatus } from '@prisma/client'
import { NextResponse } from 'next/server'

import { withAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { updateProjectStatus } from '@/lib/repo/project'
import { canDeleteProject } from '@/lib/util/action'

type DeleteProjectResponse =
  | { error: string }
  | { message: string; project: { id: string; status: ProjectStatus; updatedAt: Date } }

/**
 * POST /api/projects/[id]/delete
 *
 * Delete a project and all its resources
 * - Updates all databases and sandboxes to TERMINATING status
 * - Reconcile job will handle the actual K8s resource deletion
 * - After all resources are deleted, the project will be automatically removed
 */
export const POST = withAuth<DeleteProjectResponse>(async (_req, context, session) => {
  const resolvedParams = await context.params
  const projectId = Array.isArray(resolvedParams.id) ? resolvedParams.id[0] : resolvedParams.id

  // Get project with resources to check if delete is allowed
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

  // Check if delete action is allowed
  const actionCheck = canDeleteProject(project)
  if (!actionCheck.allowed) {
    return NextResponse.json(
      { error: actionCheck.reason || 'Cannot delete project' },
      { status: 400 }
    )
  }

  // Update all resources to TERMINATING
  const updatedProject = await updateProjectStatus(projectId, 'TERMINATING')

  return NextResponse.json({
    message:
      'Project deletion requested - reconcile job will handle resource cleanup and project removal',
    project: {
      id: updatedProject.id,
      status: updatedProject.status,
      updatedAt: updatedProject.updatedAt,
    },
  })
})
