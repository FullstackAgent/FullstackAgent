import type { Database, ResourceStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/repo/database' })

// Get lock duration from environment variable, default to 5 seconds
const LOCK_DURATION_SECONDS = parseInt(process.env.DATABASE_LOCK_DURATION_SECONDS || '5', 10)

// Define include structure for database with relations (reusable)
const databaseWithRelationsInclude = {
  project: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.DatabaseInclude

// Type inference from include structure
type DatabaseWithRelations = Prisma.DatabaseGetPayload<{
  include: typeof databaseWithRelationsInclude
}>

/**
 * Get databases with project and user relations
 * Supports custom where clause
 */
export async function getDatabaseWithRelations(args?: {
  where?: Prisma.DatabaseWhereInput
  orderBy?: Prisma.DatabaseOrderByWithRelationInput
  take?: number
  skip?: number
}) {
  return await prisma.database.findMany({
    where: args?.where,
    orderBy: args?.orderBy,
    take: args?.take,
    skip: args?.skip,
    include: databaseWithRelationsInclude,
  })
}

/**
 * Atomically acquire and lock databases for processing
 * Uses PostgreSQL's FOR UPDATE SKIP LOCKED to prevent thundering herd
 *
 * This is the preferred method for reconcile jobs as it:
 * 1. Atomically queries and locks in a single operation
 * 2. Each instance gets different records (no competition)
 * 3. Adds random offset to lock expiry to prevent thundering herd
 *
 * @param limit - Maximum number of databases to acquire
 * @param baseLockSeconds - Base lock duration in seconds
 * @param randomOffsetSeconds - Random offset range (0 to this value)
 * @returns Array of locked databases with relations
 */
export async function acquireAndLockDatabases(
  limit: number = 10,
  baseLockSeconds: number = LOCK_DURATION_SECONDS,
  randomOffsetSeconds: number = 2
): Promise<DatabaseWithRelations[]> {
  try {
    const now = new Date()
    const randomSeconds = Math.random() * randomOffsetSeconds

    // Calculate lock expiry time in application layer to avoid SQL injection
    const lockExpiryMs = (baseLockSeconds + randomSeconds) * 1000
    const lockUntil = new Date(now.getTime() + lockExpiryMs)

    // Use raw SQL with FOR UPDATE SKIP LOCKED for atomic query+lock
    // This ensures multiple instances don't compete for the same records
    // Wrapped in transaction for better isolation
    const lockedDatabases = await prisma.$transaction(async (tx) => {
      return await tx.$queryRaw<Database[]>`
        UPDATE "Database"
        SET
          "lockedUntil" = ${lockUntil},
          "updatedAt" = NOW()
        WHERE "id" IN (
          SELECT "id"
          FROM "Database"
          WHERE "status" IN ('CREATING', 'STARTING', 'STOPPING', 'TERMINATING')
            AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now})
          ORDER BY "updatedAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `
    })
    // After a transaction commits, the for update lock is released.

    if (lockedDatabases.length === 0) {
      return []
    }

    logger.info(
      `Atomically acquired and locked ${lockedDatabases.length} databases (limit: ${limit}, lock until: ${lockUntil.toISOString()})`
    )

    // Fetch full relations for the locked databases
    const databasesWithRelations = await prisma.database.findMany({
      where: {
        id: {
          in: lockedDatabases.map((db) => db.id),
        },
      },
      include: databaseWithRelationsInclude,
    })

    return databasesWithRelations
  } catch (error) {
    logger.error(`Error acquiring and locking databases: ${error}`)
    // For database errors, we return empty array to allow the reconcile job to continue
    // The next cycle will retry
    return []
  }
}

/**
 * Update database status with row-level locking
 * Uses PostgreSQL's SELECT FOR UPDATE SKIP LOCKED for atomic operation
 *
 * @param databaseId - Database ID
 * @param newStatus - New status to set
 * @returns True if updated, false if row is locked or not found
 */
export async function updateDatabaseStatus(
  databaseId: string,
  newStatus: ResourceStatus
): Promise<boolean> {
  try {
    logger.info(`Attempting to update database ${databaseId} status to ${newStatus}`)

    // Use transaction with row-level lock
    const result = await prisma.$transaction(async (tx) => {
      // Try to lock the row, skip if already locked
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status
        FROM "Database"
        WHERE id = ${databaseId}
        FOR UPDATE SKIP LOCKED
      `

      if (locked.length === 0) {
        // Row is locked by another transaction or doesn't exist
        return { success: false, previousStatus: null }
      }

      const previousStatus = locked[0].status

      // Update the status
      await tx.database.update({
        where: { id: databaseId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
        },
      })

      return { success: true, previousStatus }
    })

    if (!result.success) {
      logger.warn(`Cannot update database ${databaseId} status - row is locked or not found`)
      return false
    }

    logger.info(`Database ${databaseId} status updated: ${result.previousStatus} -> ${newStatus}`)
    return true
  } catch (error) {
    logger.error(`Failed to update database ${databaseId} status: ${error}`)
    throw error
  }
}

/**
 * Update database connection information
 *
 * @param databaseId - Database ID
 * @param credentials - Database credentials
 * @returns Updated database
 */
export async function updateDatabaseCredentials(
  databaseId: string,
  credentials: {
    host: string
    port: number
    database: string
    username: string
    password: string
    connectionUrl: string
  }
): Promise<Database> {
  logger.info(`Updating database ${databaseId} credentials`)

  const updatedDatabase = await prisma.database.update({
    where: { id: databaseId },
    data: {
      host: credentials.host,
      port: credentials.port,
      database: credentials.database,
      username: credentials.username,
      password: credentials.password,
      connectionUrl: credentials.connectionUrl,
      updatedAt: new Date(),
    },
  })

  logger.info(`Database ${databaseId} credentials updated`)

  return updatedDatabase
}

/**
 * Delete database record from the database
 * This performs a hard delete (removes the record from the database)
 * Note: K8s resources should be deleted separately by the event handler
 *
 * @param databaseId - Database ID
 * @returns Deleted database record
 */
export async function deleteDatabase(databaseId: string): Promise<Database> {
  logger.info(`Deleting database record ${databaseId}`)

  const deletedDatabase = await prisma.database.delete({
    where: { id: databaseId },
  })

  logger.info(`Database record ${databaseId} deleted`)

  return deletedDatabase
}

export { LOCK_DURATION_SECONDS }
