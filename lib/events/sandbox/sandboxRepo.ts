import type { ResourceStatus, Sandbox } from '@prisma/client'

import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/events/sandbox/sandboxRepo' })

/**
 * Update sandbox status in database
 *
 * @param sandboxId - Sandbox ID
 * @param status - New status
 * @returns Updated sandbox
 */
export async function updateSandboxStatus(
  sandboxId: string,
  status: ResourceStatus
): Promise<Sandbox> {
  logger.info(`Updating sandbox ${sandboxId} status to ${status}`)

  const sandbox = await prisma.sandbox.update({
    where: { id: sandboxId },
    data: {
      status,
      updatedAt: new Date(),
    },
  })

  logger.info(` Sandbox ${sandboxId} status updated to ${status}`)

  return sandbox
}

/**
 * Get sandbox with project and user information
 *
 * @param sandboxId - Sandbox ID
 * @returns Sandbox with project and user
 */
export async function getSandboxWithRelations(sandboxId: string) {
  return await prisma.sandbox.findUnique({
    where: { id: sandboxId },
    include: {
      project: {
        include: {
          user: true,
        },
      },
    },
  })
}

/**
 * Update sandbox URLs after creation
 *
 * @param sandboxId - Sandbox ID
 * @param publicUrl - Public application URL
 * @param ttydUrl - Terminal URL
 * @returns Updated sandbox
 */
export async function updateSandboxUrls(
  sandboxId: string,
  publicUrl: string,
  ttydUrl: string
): Promise<Sandbox> {
  logger.info(`Updating sandbox ${sandboxId} URLs`)

  const sandbox = await prisma.sandbox.update({
    where: { id: sandboxId },
    data: {
      publicUrl,
      ttydUrl,
      updatedAt: new Date(),
    },
  })

  logger.info(` Sandbox ${sandboxId} URLs updated`)

  return sandbox
}