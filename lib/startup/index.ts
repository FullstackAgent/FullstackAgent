/**
 * Application Startup Module
 *
 * Handles initialization of event listeners and background jobs
 * Called from instrumentation.ts when the Next.js server starts
 */

import type { Cron } from 'croner'

import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/startup' })

/**
 * Initialize the application
 * Registers event listeners and starts background jobs
 */
export async function initializeApp() {
  logger.info('Initializing application...')

  // Step 1: Register event listeners
  // Event listeners are registered by importing the event modules
  // The import statements execute the listener registration code
  await registerEventListeners()

  // Step 2: Start background jobs
  // Jobs run on cron schedules to reconcile resources
  await startBackgroundJobs()

  logger.info('Application initialized successfully')
}

/**
 * Register all event listeners
 * Importing the event modules automatically registers the listeners
 */
async function registerEventListeners() {
  logger.info('Registering event listeners...')

  try {
    // Import database event listeners
    // This imports lib/events/database/index.ts which imports ./databaseListener
    // The databaseListener file registers event handlers on import
    await import('@/lib/events/database')
    logger.info('✅ Database event listeners registered')

    // Import sandbox event listeners
    // This imports lib/events/sandbox/index.ts which imports ./sandboxListener
    // The sandboxListener file registers event handlers on import
    await import('@/lib/events/sandbox')
    logger.info('✅ Sandbox event listeners registered')

    logger.info('All event listeners registered successfully')
  } catch (error) {
    logger.error(`Failed to register event listeners: ${error}`)
    throw error
  }
}

/**
 * Start all background jobs
 * Jobs run on schedules to find and process resources in transition states
 */
async function startBackgroundJobs() {
  logger.info('Starting background jobs...')

  try {
    // Start database reconciliation job
    // Runs every 3 seconds to find databases in CREATING/STARTING/STOPPING/TERMINATING states
    const { startDatabaseReconcileJob } = await import('@/lib/jobs/database')
    const databaseJob = startDatabaseReconcileJob()
    logger.info('✅ Database reconcile job started')

    // Start sandbox reconciliation job
    // Runs every 3 seconds to find sandboxes in CREATING/STARTING/STOPPING/TERMINATING states
    const { startSandboxReconcileJob } = await import('@/lib/jobs/sandbox')
    const sandboxJob = startSandboxReconcileJob()
    logger.info('✅ Sandbox reconcile job started')

    // Store job references for potential cleanup (optional)
    // In most cases, these jobs will run for the lifetime of the server
    globalThis.__databaseReconcileJob = databaseJob
    globalThis.__sandboxReconcileJob = sandboxJob

    logger.info('All background jobs started successfully')
  } catch (error) {
    logger.error(`Failed to start background jobs: ${error}`)
    throw error
  }
}

/**
 * Cleanup function (optional)
 * Can be called on graceful shutdown to stop background jobs
 *
 * This ensures:
 * - No new reconcile cycles are started
 * - Database locks are released properly
 * - Resources are cleaned up before process exit
 */
export function cleanup() {
  logger.info('Cleaning up application...')

  try {
    // Stop database reconcile job if it exists
    if (globalThis.__databaseReconcileJob) {
      globalThis.__databaseReconcileJob.stop()
      globalThis.__databaseReconcileJob = undefined
      logger.info('✅ Database reconcile job stopped')
    }

    // Stop sandbox reconcile job if it exists
    if (globalThis.__sandboxReconcileJob) {
      globalThis.__sandboxReconcileJob.stop()
      globalThis.__sandboxReconcileJob = undefined
      logger.info('✅ Sandbox reconcile job stopped')
    }

    logger.info('✅ Cleanup completed')
  } catch (error) {
    logger.error(`❌ Cleanup failed: ${error}`)
  }
}

// Add type definitions for global job references
declare global {
  var __databaseReconcileJob: Cron | undefined

  var __sandboxReconcileJob: Cron | undefined
}
