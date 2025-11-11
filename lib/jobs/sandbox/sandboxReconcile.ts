import { Cron } from 'croner'

import { emit, Events } from '@/lib/events/sandbox'
import { logger as baseLogger } from '@/lib/logger'
import { acquireAndLockSandboxes, LOCK_DURATION_SECONDS } from '@/lib/repo/sandbox'

const logger = baseLogger.child({ module: 'lib/jobs/sandbox/sandboxReconcile' })

// Maximum number of sandboxes to process per reconcile cycle
const MAX_SANDBOXES_PER_CYCLE = parseInt(process.env.MAX_SANDBOXES_PER_RECONCILE || '10', 10)

/**
 * Sandbox reconciliation job
 * Runs every 3 seconds to find sandboxes in transition states and emit events
 */
export function startSandboxReconcileJob() {
  logger.info('Starting sandbox reconcile job')
  logger.info(`Lock duration: ${LOCK_DURATION_SECONDS} seconds`)
  logger.info(`Max sandboxes per cycle: ${MAX_SANDBOXES_PER_CYCLE}`)

  // Run every 3 seconds
  const job = new Cron('*/3 * * * * *', async () => {
    try {
      await reconcileSandboxes()
    } catch (error) {
      logger.error(`Sandbox reconcile job error: ${error}`)
    }
  })

  logger.info('✅ Sandbox reconcile job started (every 3 seconds)')

  return job
}

/**
 * Find sandboxes in transition states and emit appropriate events
 * Uses atomic query+lock to prevent thundering herd
 * Each reconcile instance gets exclusive access to different records
 */
async function reconcileSandboxes() {
  // Atomically acquire and lock sandboxes in a single operation
  // This prevents multiple instances from competing for the same records
  const sandboxes = await acquireAndLockSandboxes(MAX_SANDBOXES_PER_CYCLE)

  if (sandboxes.length === 0) {
    return
  }

  logger.info(`Atomically acquired ${sandboxes.length} sandboxes for processing`)

  let processedCount = 0

  for (const sandbox of sandboxes) {
    try {
      // Sandbox is already locked, directly emit event
      const payload = {
        user: sandbox.project.user,
        project: sandbox.project,
        sandbox,
      }

      switch (sandbox.status) {
        case 'CREATING':
          logger.info(`Emitting CreateSandbox event for sandbox ${sandbox.id}`)
          emit(Events.CreateSandbox, payload)
          processedCount++
          break

        case 'STARTING':
          logger.info(`Emitting StartSandbox event for sandbox ${sandbox.id}`)
          emit(Events.StartSandbox, payload)
          processedCount++
          break

        case 'STOPPING':
          logger.info(`Emitting StopSandbox event for sandbox ${sandbox.id}`)
          emit(Events.StopSandbox, payload)
          processedCount++
          break

        case 'TERMINATING':
          logger.info(`Emitting DeleteSandbox event for sandbox ${sandbox.id}`)
          emit(Events.DeleteSandbox, payload)
          processedCount++
          break

        case 'UPDATING':
          logger.info(`Emitting UpdateSandbox event for sandbox ${sandbox.id}`)
          emit(Events.UpdateSandbox, payload)
          processedCount++
          break

        default:
          logger.warn(`Unknown sandbox status: ${sandbox.status}`)
      }
    } catch (error) {
      logger.error(`Failed to process sandbox ${sandbox.id}: ${error}`)
    }
  }

  logger.info(`Reconcile cycle completed: ${processedCount} sandboxes processed`)
}

export { LOCK_DURATION_SECONDS, MAX_SANDBOXES_PER_CYCLE }
