import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'
import { logger as baseLogger } from '@/lib/logger'
import { getProjectEnvironments } from '@/lib/repo/environment'
import { projectStatusReconcile } from '@/lib/repo/project'
import { deleteSandbox, updateSandboxStatus, updateSandboxUrls } from '@/lib/repo/sandbox'
import { loadEnvVarsForSandbox } from '@/lib/services/aiproxy'

import { Events, on, type SandboxEventPayload } from './bus'

const logger = baseLogger.child({ module: 'lib/events/sandbox/sandboxListener' })

/**
 * Handle sandbox creation
 * Only processes CREATING sandboxes
 * On success: changes status to STARTING
 */
async function handleCreateSandbox(payload: SandboxEventPayload): Promise<void> {
  const { user, project, sandbox } = payload

  // Only process CREATING sandboxes
  if (sandbox.status !== 'CREATING') {
    logger.warn(
      `Skipping create for sandbox ${sandbox.id} - status is ${sandbox.status}, expected CREATING`
    )
    return
  }

  logger.info(`Creating sandbox ${sandbox.id} (${sandbox.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Load project environment variables
    const projectEnvVars = await getProjectEnvironments(project.id)

    // Load anthropic variables for sandbox
    const anthropicEnvVars = await loadEnvVarsForSandbox(user.id)

    // Merge environment variables: project env vars first, then anthropic (anthropic can override)
    const mergedEnvVars = {
      ...projectEnvVars,
      ...anthropicEnvVars,
    }

    // Create sandbox in Kubernetes
    const sandboxInfo = await k8sService.createSandbox(
      project.name,
      sandbox.k8sNamespace,
      sandbox.sandboxName,
      mergedEnvVars
    )

    logger.info(
      `Sandbox ${sandbox.id} created in Kubernetes: ${sandboxInfo.publicUrl}, ${sandboxInfo.ttydUrl}, ${sandboxInfo.fileBrowserUrl}`
    )

    // Update sandbox with URLs
    await updateSandboxUrls(
      sandbox.id,
      sandboxInfo.publicUrl,
      sandboxInfo.ttydUrl,
      sandboxInfo.fileBrowserUrl
    )

    // Change status to STARTING
    await updateSandboxStatus(sandbox.id, 'STARTING')
    await projectStatusReconcile(project.id)

    logger.info(`Sandbox ${sandbox.id} status changed to STARTING`)
  } catch (error) {
    logger.error(`Failed to create sandbox ${sandbox.id}: ${error}`)

    // Update status to ERROR
    await updateSandboxStatus(sandbox.id, 'ERROR')
    await projectStatusReconcile(project.id)

    // Don't throw - let reconciliation continue for other sandboxes
  }
}

/**
 * Handle sandbox start
 * Only processes STARTING sandboxes
 * Executes startSandbox, then checks status
 * If status is RUNNING, changes to RUNNING
 */
async function handleStartSandbox(payload: SandboxEventPayload): Promise<void> {
  const { user, project, sandbox } = payload

  // Only process STARTING sandboxes
  if (sandbox.status !== 'STARTING') {
    logger.warn(
      `Skipping start for sandbox ${sandbox.id} - status is ${sandbox.status}, expected STARTING`
    )
    return
  }

  logger.info(`Starting sandbox ${sandbox.id} (${sandbox.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Start sandbox (idempotent operation)
    await k8sService.startSandbox(sandbox.k8sNamespace, sandbox.sandboxName)

    logger.info(`Sandbox ${sandbox.id} start command executed`)

    // Get current status from Kubernetes
    const k8sStatus = await k8sService.getSandboxStatus(sandbox.k8sNamespace, sandbox.sandboxName)

    logger.info(`Sandbox ${sandbox.id} K8s status: ${k8sStatus}`)

    // If status is RUNNING, update database
    if (k8sStatus === 'RUNNING') {
      await updateSandboxStatus(sandbox.id, 'RUNNING')
      await projectStatusReconcile(project.id)
      logger.info(`Sandbox ${sandbox.id} is now RUNNING`)
    } else {
      logger.info(`Sandbox ${sandbox.id} is still starting (K8s status: ${k8sStatus})`)
      // Keep status as STARTING, may need to poll again
    }
  } catch (error) {
    logger.error(`Failed to start sandbox ${sandbox.id}: ${error}`)

    // Update status to ERROR
    await updateSandboxStatus(sandbox.id, 'ERROR')
    await projectStatusReconcile(project.id)

    // Don't throw - let reconciliation continue for other sandboxes
  }
}

/**
 * Handle sandbox stop
 * Only processes STOPPING sandboxes
 * Executes stopSandbox, then checks status
 * If status is STOPPED, changes to STOPPED
 */
async function handleStopSandbox(payload: SandboxEventPayload): Promise<void> {
  const { user, project, sandbox } = payload

  // Only process STOPPING sandboxes
  if (sandbox.status !== 'STOPPING') {
    logger.warn(
      `Skipping stop for sandbox ${sandbox.id} - status is ${sandbox.status}, expected STOPPING`
    )
    return
  }

  logger.info(`Stopping sandbox ${sandbox.id} (${sandbox.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Stop sandbox (idempotent operation)
    await k8sService.stopSandbox(sandbox.k8sNamespace, sandbox.sandboxName)

    logger.info(`Sandbox ${sandbox.id} stop command executed`)

    // Get current status from Kubernetes
    const k8sStatus = await k8sService.getSandboxStatus(sandbox.k8sNamespace, sandbox.sandboxName)

    logger.info(`Sandbox ${sandbox.id} K8s status: ${k8sStatus}`)

    // If status is STOPPED, update database
    if (k8sStatus === 'STOPPED') {
      await updateSandboxStatus(sandbox.id, 'STOPPED')
      await projectStatusReconcile(project.id)
      logger.info(`Sandbox ${sandbox.id} is now STOPPED`)
    } else {
      logger.info(`Sandbox ${sandbox.id} is still stopping (K8s status: ${k8sStatus})`)
      // Keep status as STOPPING, may need to poll again
    }
  } catch (error) {
    logger.error(`Failed to stop sandbox ${sandbox.id}: ${error}`)

    // Update status to ERROR
    await updateSandboxStatus(sandbox.id, 'ERROR')
    await projectStatusReconcile(project.id)

    // Don't throw - let reconciliation continue for other sandboxes
  }
}

/**
 * Handle sandbox deletion
 * Only processes TERMINATING sandboxes
 * Executes deleteSandbox, then checks status
 * If status is TERMINATED, changes to TERMINATED
 */
async function handleDeleteSandbox(payload: SandboxEventPayload): Promise<void> {
  const { user, project, sandbox } = payload

  // Only process TERMINATING sandboxes
  if (sandbox.status !== 'TERMINATING') {
    logger.warn(
      `Skipping delete for sandbox ${sandbox.id} - status is ${sandbox.status}, expected TERMINATING`
    )
    return
  }

  logger.info(`Deleting sandbox ${sandbox.id} (${sandbox.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Delete sandbox (idempotent operation)
    await k8sService.deleteSandbox(sandbox.k8sNamespace, sandbox.sandboxName)

    logger.info(`Sandbox ${sandbox.id} delete command executed`)

    // Get current status from Kubernetes
    const k8sStatus = await k8sService.getSandboxStatus(sandbox.k8sNamespace, sandbox.sandboxName)

    logger.info(`Sandbox ${sandbox.id} K8s status: ${k8sStatus}`)

    // If status is TERMINATED, update database
    if (k8sStatus === 'TERMINATED') {
      const updated = await updateSandboxStatus(sandbox.id, 'TERMINATED')
      if (!updated) {
        logger.warn(`Sandbox ${sandbox.id} status not updated - row locked or not found`)
        return
      }
      await deleteSandbox(sandbox.id)
      await projectStatusReconcile(project.id)
      logger.info(`Sandbox ${sandbox.id} is now TERMINATED`)
    } else {
      logger.info(`Sandbox ${sandbox.id} is still terminating (K8s status: ${k8sStatus})`)
      // Keep status as TERMINATING, may need to poll again
    }
  } catch (error) {
    logger.error(`Failed to delete sandbox ${sandbox.id}: ${error}`)

    // Update status to ERROR
    await updateSandboxStatus(sandbox.id, 'ERROR')
    await projectStatusReconcile(project.id)

    // Don't throw - let reconciliation continue for other sandboxes
  }
}

/**
 * Handle sandbox update (environment variables)
 * Only processes UPDATING sandboxes
 * Updates environment variables, then monitors status
 * Status transitions: UPDATING → STARTING (pod restart) → RUNNING
 */
async function handleUpdateSandbox(payload: SandboxEventPayload): Promise<void> {
  const { user, project, sandbox } = payload

  // Only process UPDATING sandboxes
  if (sandbox.status !== 'UPDATING') {
    logger.warn(
      `Skipping update for sandbox ${sandbox.id} - status is ${sandbox.status}, expected UPDATING`
    )
    return
  }

  logger.info(`Updating sandbox ${sandbox.id} (${sandbox.name}) for project ${project.name}`)

  try {
    // Get Kubernetes service for user
    const k8sService = await getK8sServiceForUser(user.id)

    // Load project environment variables
    const projectEnvVars = await getProjectEnvironments(project.id)

    // Load anthropic variables for sandbox
    const anthropicEnvVars = await loadEnvVarsForSandbox(user.id)

    // Merge environment variables: project env vars first, then anthropic (anthropic can override)
    const mergedEnvVars = {
      ...projectEnvVars,
      ...anthropicEnvVars,
    }

    // Update sandbox environment variables
    const updated = await k8sService.updateSandboxEnvVars(
      sandbox.k8sNamespace,
      sandbox.sandboxName,
      mergedEnvVars
    )

    if (!updated) {
      // StatefulSet not found - sandbox may have been deleted
      logger.error(`Sandbox ${sandbox.id} StatefulSet not found in Kubernetes`)
      await updateSandboxStatus(sandbox.id, 'ERROR')
      await projectStatusReconcile(project.id)
      return
    }

    logger.info(`Sandbox ${sandbox.id} environment variables update command executed`)

    // Get current status from Kubernetes
    // Note: After env var update, Pod will restart, so status may be STARTING
    const k8sStatus = await k8sService.getSandboxStatus(sandbox.k8sNamespace, sandbox.sandboxName)

    logger.info(`Sandbox ${sandbox.id} K8s status after update: ${k8sStatus}`)

    if (k8sStatus === 'RUNNING') {
      // Pod is already running (either env vars didn't change, or restart completed quickly)
      await updateSandboxStatus(sandbox.id, 'RUNNING')
      await projectStatusReconcile(project.id)
      logger.info(`Sandbox ${sandbox.id} is now RUNNING`)
    } else if (k8sStatus === 'STARTING') {
      // Pod is restarting due to env var changes - change status to STARTING
      await updateSandboxStatus(sandbox.id, 'STARTING')
      await projectStatusReconcile(project.id)
      logger.info(`Sandbox ${sandbox.id} is STARTING (pod restarting after env var update)`)
    } else if (k8sStatus === 'ERROR' || k8sStatus === 'TERMINATED') {
      // Unexpected error or deletion
      await updateSandboxStatus(sandbox.id, k8sStatus)
      await projectStatusReconcile(project.id)
      logger.error(`Sandbox ${sandbox.id} in unexpected state: ${k8sStatus}`)
    } else {
      // Other transient states (STOPPING, STOPPED) - keep monitoring
      logger.info(`Sandbox ${sandbox.id} in transient state: ${k8sStatus}, keeping UPDATING status`)
      // Keep status as UPDATING, reconciliation will check again in next cycle
    }
  } catch (error) {
    logger.error(`Failed to update sandbox ${sandbox.id}: ${error}`)

    // Update status to ERROR
    await updateSandboxStatus(sandbox.id, 'ERROR')
    await projectStatusReconcile(project.id)

    // Don't throw - let reconciliation continue for other sandboxes
  }
}

/**
 * Register all sandbox event listeners
 * Call this function once during application startup
 */
export function registerSandboxListeners(): void {
  logger.info('Registering sandbox event listeners')
  on(Events.UpdateSandbox, handleUpdateSandbox)
  on(Events.CreateSandbox, handleCreateSandbox)
  on(Events.StartSandbox, handleStartSandbox)
  on(Events.StopSandbox, handleStopSandbox)
  on(Events.DeleteSandbox, handleDeleteSandbox)

  logger.info('✅ Sandbox event listeners registered')
}

// Auto-register listeners when module is imported
registerSandboxListeners()
