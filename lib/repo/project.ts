import type { Project, ProjectStatus, ResourceStatus } from '@prisma/client'

import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'
import { aggregateProjectStatus } from '@/lib/util/projectStatus'

const logger = baseLogger.child({ module: 'lib/repo/project' })

/**
 * Reconcile project status based on its resources
 * Queries all databases and sandboxes, then aggregates their status
 *
 * Special behavior:
 * - If no resources exist (TERMINATED state), the project is deleted
 * - This ensures projects are cleaned up after all resources are terminated
 *
 * This function handles errors internally and never throws.
 * If reconciliation fails, it logs the error and returns null.
 *
 * @param projectId - Project ID
 * @returns Updated project with new status, or null if deleted/failed
 */
export async function projectStatusReconcile(projectId: string): Promise<Project | null> {
  try {
    logger.info(`Reconciling status for project ${projectId}`)

    // Fetch project with all resources
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        databases: {
          select: { status: true },
        },
        sandboxes: {
          select: { status: true },
        },
      },
    })

    if (!project) {
      logger.error(`Project ${projectId} not found - cannot reconcile status`)
      return null
    }

    // Collect all resource statuses
    const resourceStatuses: ResourceStatus[] = [
      ...project.databases.map((db) => db.status),
      ...project.sandboxes.map((sb) => sb.status),
    ]

    // Calculate aggregated status
    const newStatus = aggregateProjectStatus(resourceStatuses)

    logger.info(
      `Project ${projectId} status reconciliation: ${project.status} -> ${newStatus} (${resourceStatuses.length} resources)`
    )

    // Special case: If no resources exist (TERMINATED), delete the project
    if (resourceStatuses.length === 0 && newStatus === 'TERMINATED') {
      logger.info(`Project ${projectId} has no resources - deleting project and its environments`)
      await prisma.$transaction(async (tx) => {
        const deletedEnvs = await tx.environment.deleteMany({
          where: { projectId },
        })
        logger.info(`Deleted ${deletedEnvs.count} environment records for project ${projectId}`)
        await tx.project.delete({
          where: { id: projectId },
        })
      })
      logger.info(`Project ${projectId} deleted successfully`)
      return null
    }

    // Update project status if changed
    if (project.status !== newStatus) {
      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      })

      logger.info(`Project ${projectId} status updated to ${newStatus}`)
      return updatedProject
    }

    logger.info(`Project ${projectId} status unchanged: ${project.status}`)
    return project
  } catch (error) {
    // Log error but don't throw - reconciliation failure should not affect resource operations
    logger.error(`Failed to reconcile project ${projectId} status: ${error}`)
    return null
  }
}

/**
 * Update all resources of a project to a target status
 * Used for project-level operations (start-all, stop-all, terminate-all)
 *
 * @param projectId - Project ID
 * @param targetStatus - Target status for all resources (STARTING, STOPPING, or TERMINATING)
 * @returns Updated project
 */
export async function updateProjectStatus(
  projectId: string,
  targetStatus: Extract<ResourceStatus, 'STARTING' | 'STOPPING' | 'TERMINATING'>
): Promise<Project> {
  // Validate target status
  if (!['STARTING', 'STOPPING', 'TERMINATING'].includes(targetStatus)) {
    throw new Error(
      `Invalid target status: ${targetStatus}. Must be STARTING, STOPPING, or TERMINATING`
    )
  }

  logger.info(`Updating all resources of project ${projectId} to ${targetStatus}`)

  // Update all databases and sandboxes in a transaction
  await prisma.$transaction(async (tx) => {
    // Update all databases
    const databaseResult = await tx.database.updateMany({
      where: { projectId },
      data: {
        status: targetStatus,
        updatedAt: new Date(),
      },
    })

    // Update all sandboxes
    const sandboxResult = await tx.sandbox.updateMany({
      where: { projectId },
      data: {
        status: targetStatus,
        updatedAt: new Date(),
      },
    })

    logger.info(
      `Updated ${databaseResult.count} databases and ${sandboxResult.count} sandboxes to ${targetStatus}`
    )
  })

  // Update project status to match
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: targetStatus as ProjectStatus,
      updatedAt: new Date(),
    },
  })

  logger.info(`Project ${projectId} status updated to ${targetStatus}`)

  return updatedProject
}

/**
 * Get project with all resources
 *
 * @param projectId - Project ID
 * @returns Project with databases and sandboxes
 */
export async function getProjectWithResources(projectId: string) {
  return await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      databases: true,
      sandboxes: true,
      user: true,
    },
  })
}

/*
// Debounce project status updates to prevent thundering herd
const projectStatusQueue = new Map<string, NodeJS.Timeout>()

async function scheduleProjectReconcile(projectId: string) {
  clearTimeout(projectStatusQueue.get(projectId))
  const timer = setTimeout(() => {
    projectStatusReconcile(projectId)
    projectStatusQueue.delete(projectId)
  }, 1000) // 1 second debounce timeout
  projectStatusQueue.set(projectId, timer)
}
*/
