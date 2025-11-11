import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'
import { logger as baseLogger } from '@/lib/logger'
import {
  deleteDatabase,
  updateDatabaseCredentials,
  updateDatabaseStatus,
} from '@/lib/repo/database'
import { projectStatusReconcile } from '@/lib/repo/project'

import { type DatabaseEventPayload, Events, on } from './bus'

const logger = baseLogger.child({ module: 'lib/events/database/databaseListener' })

/**
 * Handle database creation
 * Only processes CREATING databases
 * On success: changes status to STARTING
 */
async function handleCreateDatabase(payload: DatabaseEventPayload): Promise<void> {
  const { user, project, database } = payload

  // Only process CREATING databases
  if (database.status !== 'CREATING') {
    logger.warn(
      `Skipping create for database ${database.id} - status is ${database.status}, expected CREATING`
    )
    return
  }

  logger.info(`Creating database ${database.id} (${database.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Create database in Kubernetes
    await k8sService.createPostgreSQLDatabase(
      project.name,
      database.databaseName,
      database.k8sNamespace
    )

    logger.info(`Database ${database.id} created in Kubernetes`)

    // Change status to STARTING (with row-level lock)
    const updated = await updateDatabaseStatus(database.id, 'STARTING')

    if (!updated) {
      logger.warn(`Database ${database.id} status not updated - row locked or not found`)
      return
    }
    await projectStatusReconcile(project.id)

    logger.info(`Database ${database.id} status changed to STARTING`)
  } catch (error) {
    logger.error(`Failed to create database ${database.id}: ${error}`)

    // TODO: Require a data design for an error storage table to store errors in the database.
    // Update status to ERROR (with row-level lock)
    await updateDatabaseStatus(database.id, 'ERROR')
    await projectStatusReconcile(project.id)
    // Don't throw - let reconciliation continue for other databases
  }
}

/**
 * Handle database start
 * Only processes STARTING databases
 * Executes startCluster, then checks status
 * If status is RUNNING, changes to RUNNING and fetches credentials
 */
async function handleStartDatabase(payload: DatabaseEventPayload): Promise<void> {
  const { user, project, database } = payload

  // Only process STARTING databases
  if (database.status !== 'STARTING') {
    logger.warn(
      `Skipping start for database ${database.id} - status is ${database.status}, expected STARTING`
    )
    return
  }

  logger.info(`Starting database ${database.id} (${database.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Start database cluster (idempotent operation)
    await k8sService.startDatabaseCluster(database.databaseName, database.k8sNamespace)

    logger.info(`Database ${database.id} start command executed`)

    // Get current status from Kubernetes
    const clusterStatus = await k8sService.getDatabaseClusterStatus(
      database.databaseName,
      database.k8sNamespace
    )

    logger.info(`Database ${database.id} K8s status: ${clusterStatus.status}`)

    // If status is RUNNING, update database with credentials
    if (clusterStatus.status === 'RUNNING') {
      // Fetch database credentials
      const dbInfo = await k8sService.getDatabaseCredentials(
        database.databaseName,
        database.k8sNamespace
      )

      // Check if credentials are ready
      if (!dbInfo) {
        // Secret exists but data not populated yet (KubeBlocks still initializing)
        // Keep status as STARTING and wait for next reconcile cycle
        logger.info(
          `Database ${database.id} cluster is running but credentials not ready yet, waiting...`
        )
        return
      }

      // Build connection URL
      const connectionUrl = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`

      // Update database with credentials
      await updateDatabaseCredentials(database.id, {
        host: dbInfo.host || '',
        port: dbInfo.port || 5432,
        database: dbInfo.database || 'postgres',
        username: dbInfo.username || '',
        password: dbInfo.password || '',
        connectionUrl,
      })

      // Update status to RUNNING
      await updateDatabaseStatus(database.id, 'RUNNING')
      await projectStatusReconcile(project.id)

      logger.info(`Database ${database.id} is now RUNNING`)
    } else {
      logger.info(`Database ${database.id} is still starting (K8s status: ${clusterStatus.status})`)
      // Keep status as STARTING, may need to poll again
    }
  } catch (error) {
    logger.error(`Failed to start database ${database.id}: ${error}`)

    // Update status to ERROR (with row-level lock)
    await updateDatabaseStatus(database.id, 'ERROR')
    await projectStatusReconcile(project.id)

    // Don't throw - let reconciliation continue for other databases
  }
}

/**
 * Handle database stop
 * Only processes STOPPING databases
 * Executes stopCluster, then checks status
 * If status is STOPPED, changes to STOPPED
 */
async function handleStopDatabase(payload: DatabaseEventPayload): Promise<void> {
  const { user, project, database } = payload

  // Only process STOPPING databases
  if (database.status !== 'STOPPING') {
    logger.warn(
      `Skipping stop for database ${database.id} - status is ${database.status}, expected STOPPING`
    )
    return
  }

  logger.info(`Stopping database ${database.id} (${database.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Stop database cluster (idempotent operation)
    await k8sService.stopDatabaseCluster(database.databaseName, database.k8sNamespace)

    logger.info(`Database ${database.id} stop command executed`)

    // Get current status from Kubernetes
    const clusterStatus = await k8sService.getDatabaseClusterStatus(
      database.databaseName,
      database.k8sNamespace
    )

    logger.info(`Database ${database.id} K8s status: ${clusterStatus.status}`)

    // If status is STOPPED, update database (with row-level lock)
    if (clusterStatus.status === 'STOPPED') {
      const updated = await updateDatabaseStatus(database.id, 'STOPPED')
      if (!updated) {
        logger.warn(`Database ${database.id} status not updated - row locked or not found`)
        return
      }
      await projectStatusReconcile(project.id)
      logger.info(`Database ${database.id} is now STOPPED`)
    } else {
      logger.info(`Database ${database.id} is still stopping (K8s status: ${clusterStatus.status})`)
      // Keep status as STOPPING, may need to poll again
    }
  } catch (error) {
    logger.error(`Failed to stop database ${database.id}: ${error}`)

    // Update status to ERROR (with row-level lock)
    await updateDatabaseStatus(database.id, 'ERROR')
    await projectStatusReconcile(project.id)

    // Don't throw - let reconciliation continue for other databases
  }
}

/**
 * Handle database deletion
 * Only processes TERMINATING databases
 * Executes deleteCluster, then checks status
 * If status is TERMINATED, changes to TERMINATED
 */
async function handleDeleteDatabase(payload: DatabaseEventPayload): Promise<void> {
  const { user, project, database } = payload

  // Only process TERMINATING databases
  if (database.status !== 'TERMINATING') {
    logger.warn(
      `Skipping delete for database ${database.id} - status is ${database.status}, expected TERMINATING`
    )
    return
  }

  logger.info(`Deleting database ${database.id} (${database.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Delete database cluster (idempotent operation)
    await k8sService.deleteDatabaseCluster(database.databaseName, database.k8sNamespace)

    logger.info(`Database ${database.id} delete command executed`)

    // Get current status from Kubernetes
    const clusterStatus = await k8sService.getDatabaseClusterStatus(
      database.databaseName,
      database.k8sNamespace
    )

    logger.info(`Database ${database.id} K8s status: ${clusterStatus.status}`)

    // If status is TERMINATED, update database (with row-level lock)
    if (clusterStatus.status === 'TERMINATED') {
      const updated = await updateDatabaseStatus(database.id, 'TERMINATED')
      if (!updated) {
        logger.warn(`Database ${database.id} status not updated - row locked or not found`)
        return
      }
      await deleteDatabase(database.id)
      await projectStatusReconcile(project.id)
      logger.info(`Database ${database.id} is now TERMINATED`)
    } else {
      logger.info(
        `Database ${database.id} is still terminating (K8s status: ${clusterStatus.status})`
      )
      // Keep status as TERMINATING, may need to poll again
    }
  } catch (error) {
    logger.error(`Failed to delete database ${database.id}: ${error}`)

    // Update status to ERROR (with row-level lock)
    await updateDatabaseStatus(database.id, 'ERROR')
    await projectStatusReconcile(project.id)
    // Don't throw - let reconciliation continue for other databases
  }
}

/**
 * Register all database event listeners
 * Call this function once during application startup
 */
export function registerDatabaseListeners(): void {
  logger.info('Registering database event listeners')

  on(Events.CreateDatabase, handleCreateDatabase)
  on(Events.StartDatabase, handleStartDatabase)
  on(Events.StopDatabase, handleStopDatabase)
  on(Events.DeleteDatabase, handleDeleteDatabase)

  logger.info('Database event listeners registered')
}

// Auto-register listeners when module is imported
registerDatabaseListeners()
