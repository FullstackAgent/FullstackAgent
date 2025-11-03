import { Cron } from 'croner'

import { emit, Events } from '@/lib/events/database'
import { logger as baseLogger } from '@/lib/logger'
import { acquireAndLockDatabases, LOCK_DURATION_SECONDS } from '@/lib/repo/database'

const logger = baseLogger.child({ module: 'lib/jobs/database/databaseReconcile' })

// Maximum number of databases to process per reconcile cycle
const MAX_DATABASES_PER_CYCLE = parseInt(process.env.MAX_DATABASES_PER_RECONCILE || '10', 10)

/**
 * Database reconciliation job
 * Runs every 3 seconds to find databases in transition states and emit events
 */
export function startDatabaseReconcileJob() {
  logger.info('Starting database reconcile job')
  logger.info(`Lock duration: ${LOCK_DURATION_SECONDS} seconds`)
  logger.info(`Max databases per cycle: ${MAX_DATABASES_PER_CYCLE}`)

  // Run every 3 seconds
  const job = new Cron('*/3 * * * * *', async () => {
    try {
      await reconcileDatabases()
    } catch (error) {
      logger.error(`Database reconcile job error: ${error}`)
    }
  })

  logger.info(' Database reconcile job started (every 3 seconds)')

  return job
}

/**
 * Find databases in transition states and emit appropriate events
 * Uses atomic query+lock to prevent thundering herd
 * Each reconcile instance gets exclusive access to different records
 */
async function reconcileDatabases() {
  // Atomically acquire and lock databases in a single operation
  // This prevents multiple instances from competing for the same records
  const databases = await acquireAndLockDatabases(MAX_DATABASES_PER_CYCLE)

  if (databases.length === 0) {
    return
  }

  logger.info(`Atomically acquired ${databases.length} databases for processing`)

  let processedCount = 0

  for (const database of databases) {
    try {
      // Database is already locked, directly emit event
      const payload = {
        user: database.project.user,
        project: database.project,
        database,
      }

      switch (database.status) {
        case 'CREATING':
          logger.info(`Emitting CreateDatabase event for database ${database.id}`)
          emit(Events.CreateDatabase, payload)
          processedCount++
          break

        case 'STARTING':
          logger.info(`Emitting StartDatabase event for database ${database.id}`)
          emit(Events.StartDatabase, payload)
          processedCount++
          break

        case 'STOPPING':
          logger.info(`Emitting StopDatabase event for database ${database.id}`)
          emit(Events.StopDatabase, payload)
          processedCount++
          break

        case 'TERMINATING':
          logger.info(`Emitting DeleteDatabase event for database ${database.id}`)
          emit(Events.DeleteDatabase, payload)
          processedCount++
          break

        default:
          logger.warn(`Unknown database status: ${database.status}`)
      }
    } catch (error) {
      logger.error(`Failed to process database ${database.id}: ${error}`)
    }
  }

  logger.info(`Reconcile cycle completed: ${processedCount} databases processed`)
}

export { LOCK_DURATION_SECONDS, MAX_DATABASES_PER_CYCLE }
