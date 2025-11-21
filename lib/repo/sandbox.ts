import type { ResourceStatus, Sandbox } from '@prisma/client'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/repo/sandbox' })

// Get lock duration from environment variable, default to 5 seconds
const LOCK_DURATION_SECONDS = parseInt(process.env.SANDBOX_LOCK_DURATION_SECONDS || '5', 10)

// Define include structure for sandbox with relations (reusable)
const sandboxWithRelationsInclude = {
  project: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.SandboxInclude

// Type inference from include structure
type SandboxWithRelations = Prisma.SandboxGetPayload<{
  include: typeof sandboxWithRelationsInclude
}>

/**
 * Get sandboxes with project and user relations
 * Supports custom where clause
 */
export async function getSandboxWithRelations(args?: {
  where?: Prisma.SandboxWhereInput
  orderBy?: Prisma.SandboxOrderByWithRelationInput
  take?: number
  skip?: number
}) {
  return await prisma.sandbox.findMany({
    where: args?.where,
    orderBy: args?.orderBy,
    take: args?.take,
    skip: args?.skip,
    include: sandboxWithRelationsInclude,
  })
}

/**
 * Atomically acquire and lock sandboxes for processing
 * Uses PostgreSQL's FOR UPDATE SKIP LOCKED to prevent thundering herd
 *
 * This is the preferred method for reconcile jobs as it:
 * 1. Atomically queries and locks in a single operation
 * 2. Each instance gets different records (no competition)
 * 3. Adds random offset to lock expiry to prevent thundering herd
 *
 * @param limit - Maximum number of sandboxes to acquire
 * @param baseLockSeconds - Base lock duration in seconds
 * @param randomOffsetSeconds - Random offset range (0 to this value)
 * @returns Array of locked sandboxes with relations
 */
export async function acquireAndLockSandboxes(
  limit: number = 10,
  baseLockSeconds: number = LOCK_DURATION_SECONDS,
  randomOffsetSeconds: number = 2
): Promise<SandboxWithRelations[]> {
  try {
    const now = new Date()
    const randomSeconds = Math.random() * randomOffsetSeconds

    // Calculate lock expiry time in application layer to avoid SQL injection
    const lockExpiryMs = (baseLockSeconds + randomSeconds) * 1000
    const lockUntil = new Date(now.getTime() + lockExpiryMs)

    // Use raw SQL with FOR UPDATE SKIP LOCKED for atomic query+lock
    // This ensures multiple instances don't compete for the same records
    // Wrapped in transaction for better isolation
    const lockedSandboxes = await prisma.$transaction(async (tx) => {
      return await tx.$queryRaw<Sandbox[]>`
        UPDATE "Sandbox"
        SET
          "lockedUntil" = ${lockUntil},
          "updatedAt" = NOW()
        WHERE "id" IN (
          SELECT "id"
          FROM "Sandbox"
          WHERE "status" IN ('CREATING', 'STARTING', 'STOPPING', 'TERMINATING','UPDATING')
            AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now})
          ORDER BY "updatedAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `
    })

    if (lockedSandboxes.length === 0) {
      return []
    }

    logger.info(
      `Atomically acquired and locked ${lockedSandboxes.length} sandboxes (limit: ${limit}, lock until: ${lockUntil.toISOString()})`
    )

    // Fetch full relations for the locked sandboxes
    const sandboxesWithRelations = await prisma.sandbox.findMany({
      where: {
        id: {
          in: lockedSandboxes.map((sb) => sb.id),
        },
      },
      include: sandboxWithRelationsInclude,
    })

    return sandboxesWithRelations
  } catch (error) {
    logger.error(`Error acquiring and locking sandboxes: ${error}`)
    // For database errors, we return empty array to allow the reconcile job to continue
    // The next cycle will retry
    return []
  }
}

/**
 * Update sandbox status with row-level locking
 * Uses PostgreSQL's SELECT FOR UPDATE SKIP LOCKED for atomic operation
 *
 * @param sandboxId - Sandbox ID
 * @param newStatus - New status to set
 * @returns True if updated, false if row is locked or not found
 */
export async function updateSandboxStatus(
  sandboxId: string,
  newStatus: ResourceStatus
): Promise<boolean> {
  try {
    logger.info(`Attempting to update sandbox ${sandboxId} status to ${newStatus}`)

    // Use transaction with row-level lock
    const result = await prisma.$transaction(async (tx) => {
      // Try to lock the row, skip if already locked
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status
        FROM "Sandbox"
        WHERE id = ${sandboxId}
        FOR UPDATE SKIP LOCKED
      `

      if (locked.length === 0) {
        // Row is locked by another transaction or doesn't exist
        return { success: false, previousStatus: null }
      }

      const previousStatus = locked[0].status

      // Update the status
      await tx.sandbox.update({
        where: { id: sandboxId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      })

      return { success: true, previousStatus }
    })

    if (!result.success) {
      logger.warn(`Cannot update sandbox ${sandboxId} status - row is locked or not found`)
      return false
    }

    logger.info(`Sandbox ${sandboxId} status updated: ${result.previousStatus} -> ${newStatus}`)
    return true
  } catch (error) {
    logger.error(`Failed to update sandbox ${sandboxId} status: ${error}`)
    throw error
  }
}

/**
 * Update sandbox URLs after creation
 *
 * @param sandboxId - Sandbox ID
 * @param publicUrl - Public application URL
 * @param ttydUrl - Terminal URL
 * @param fileBrowserUrl - File browser URL
 * @returns Updated sandbox
 */
export async function updateSandboxUrls(
  sandboxId: string,
  publicUrl: string,
  ttydUrl: string,
  fileBrowserUrl: string
): Promise<Sandbox> {
  logger.info(`Updating sandbox ${sandboxId} URLs`)

  const sandbox = await prisma.sandbox.update({
    where: { id: sandboxId },
    data: {
      publicUrl,
      ttydUrl,
      fileBrowserUrl,
      updatedAt: new Date(),
    },
  })

  logger.info(`Sandbox ${sandboxId} URLs updated`)

  return sandbox
}

/**
 * Delete sandbox record from the database
 * This performs a hard delete (removes the record from the database)
 * Note: K8s resources should be deleted separately by the event handler
 *
 * @param sandboxId - Sandbox ID
 * @returns Deleted sandbox record
 */
export async function deleteSandbox(sandboxId: string): Promise<Sandbox> {
  logger.info(`Deleting sandbox record ${sandboxId}`)

  const deletedSandbox = await prisma.sandbox.delete({
    where: { id: sandboxId },
  })

  logger.info(`Sandbox record ${sandboxId} deleted`)

  return deletedSandbox
}

export { LOCK_DURATION_SECONDS }
export type { SandboxWithRelations }
