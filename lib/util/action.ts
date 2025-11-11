/**
 * Project and Resource Action Definitions
 *
 * This module defines which operations are allowed for each project/resource status.
 * It also provides utility functions to check permissions and get available actions.
 */

import type { ProjectStatus, ResourceStatus } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

/**
 * Available actions for projects
 */
export type ProjectAction = 'START' | 'STOP' | 'DELETE'

/**
 * Available actions for resources (Database, Sandbox)
 */
export type ResourceAction = 'START' | 'STOP' | 'DELETE' | 'UPDATE'

/**
 * Project with resources (minimal fields needed for action checks)
 */
export interface ProjectWithResources {
  status: ProjectStatus
  databases: Array<{ status: ResourceStatus }>
  sandboxes: Array<{ status: ResourceStatus }>
}

/**
 * Action check result
 */
export interface ActionCheckResult {
  allowed: boolean
  reason?: string
}

// ============================================================================
// Project Status Allowed Actions
// ============================================================================

/**
 * Map of project status to allowed actions
 *
 * Rules:
 * - RUNNING: Can stop or delete
 * - STOPPED: Can start or delete
 * - PARTIAL: Can start, stop, or delete
 * - STARTING: Can stop or delete
 * - STOPPING: Can start or delete
 * - ERROR: Can start, stop, or delete
 * - CREATING: Can only delete
 * - UPDATING: Can only delete
 * - TERMINATING: No actions allowed (deletion in progress)
 * - TERMINATED: No actions allowed (already deleted)
 */
export const PROJECT_ALLOWED_ACTIONS: Record<ProjectStatus, ProjectAction[]> = {
  RUNNING: ['STOP', 'DELETE'],
  STOPPED: ['START', 'DELETE'],
  PARTIAL: ['START', 'STOP', 'DELETE'],
  STARTING: ['STOP', 'DELETE'],
  STOPPING: ['START', 'DELETE'],
  ERROR: ['START', 'STOP', 'DELETE'],
  CREATING: ['DELETE'],
  UPDATING: ['DELETE'],
  TERMINATING: [],
  TERMINATED: [],
}

// ============================================================================
// Resource Status  Allowed Actions
// ============================================================================

/**
 * Map of resource status to allowed actions
 *
 * Rules:
 * - CREATING: Can only delete
 * - STARTING: Can stop or delete
 * - RUNNING: Can stop, delete, or update (change environment variables)
 * - STOPPING: Can start or delete
 * - STOPPED: Can start or delete
 * - ERROR: Can start, stop, or delete
 * - UPDATING: Can only delete
 * - TERMINATING: No actions allowed (deletion in progress)
 * - TERMINATED: No actions allowed (already deleted)
 */
export const RESOURCE_ALLOWED_ACTIONS: Record<ResourceStatus, ResourceAction[]> = {
  CREATING: ['DELETE'],
  STARTING: ['STOP', 'DELETE'],
  RUNNING: ['STOP', 'DELETE', 'UPDATE'],
  STOPPING: ['START', 'DELETE'],
  STOPPED: ['START', 'DELETE'],
  ERROR: ['START', 'STOP', 'DELETE'],
  UPDATING: ['DELETE'],
  TERMINATING: [],
  TERMINATED: [],
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a project action is allowed based on status alone
 *
 * @param status - Project status
 * @param action - Action to check
 * @returns true if action is allowed for this status
 */
function isProjectActionAllowed(status: ProjectStatus, action: ProjectAction): boolean {
  return PROJECT_ALLOWED_ACTIONS[status]?.includes(action) ?? false
}

/**
 * Check if a project has any resources in transition states that block START/STOP
 *
 * @param project - Project with databases and sandboxes
 * @returns Object with blocking status information
 */
function hasBlockingResourceStates(project: ProjectWithResources): {
  hasBlocking: boolean
  blockingStates: ResourceStatus[]
} {
  const allStatuses = [
    ...project.databases.map((db) => db.status),
    ...project.sandboxes.map((sb) => sb.status),
  ]

  // States that block START/STOP operations
  const blockingStates = allStatuses.filter(
    (status) =>
      status === 'TERMINATING' ||
      status === 'TERMINATED' ||
      status === 'UPDATING' ||
      status === 'CREATING'
  )

  return {
    hasBlocking: blockingStates.length > 0,
    blockingStates: [...new Set(blockingStates)], // Remove duplicates
  }
}

/**
 * Comprehensive check for project actions (with resource validation)
 *
 * Special rules for START/STOP operations:
 * - Not allowed if any resource is in TERMINATING state (deletion in progress)
 * - Not allowed if any resource is in TERMINATED state (already deleted)
 * - Not allowed if any resource is in UPDATING state (configuration changes in progress)
 * - Not allowed if any resource is in CREATING state (initial creation in progress)
 *
 * Rationale: These transition states require completion before START/STOP can be safely executed.
 * DELETE is always allowed (if status permits) since deletion can happen anytime.
 *
 * @param project - Project with resources
 * @param action - Action to check
 * @returns Action check result with reason if not allowed
 *
 * @example
 * ```typescript
 * const result = checkProjectAction(project, 'START')
 * if (!result.allowed) {
 *   console.log(result.reason)
 *   // "Cannot start project: some resources are in UPDATING state..."
 * }
 * ```
 */
export function checkProjectAction(
  project: ProjectWithResources,
  action: ProjectAction
): ActionCheckResult {
  // Check if action is allowed for this status
  if (!isProjectActionAllowed(project.status, action)) {
    return {
      allowed: false,
      reason: `Action '${action}' is not allowed for project status '${project.status}'`,
    }
  }

  // Special check for START/STOP: cannot execute if resources are in blocking states
  if (action === 'START' || action === 'STOP') {
    const { hasBlocking, blockingStates } = hasBlockingResourceStates(project)

    if (hasBlocking) {
      const statesStr = blockingStates.join(', ')
      return {
        allowed: false,
        reason: `Cannot ${action.toLowerCase()} project: some resources are in ${statesStr} state. Please wait for these operations to complete before starting or stopping the project.`,
      }
    }
  }

  return { allowed: true }
}

/**
 * Get all currently available actions for a project
 *
 * This filters the status-allowed actions by also checking resource constraints.
 *
 * @param project - Project with resources
 * @returns Array of available actions
 *
 * @example
 * ```typescript
 * const actions = getAvailableProjectActions(project)
 * // Returns: ['STOP', 'DELETE'] (START removed if resources are TERMINATING)
 * ```
 */
export function getAvailableProjectActions(project: ProjectWithResources): ProjectAction[] {
  const statusActions = PROJECT_ALLOWED_ACTIONS[project.status] || []

  return statusActions.filter((action) => {
    const check = checkProjectAction(project, action)
    return check.allowed
  })
}

/**
 * Check if a project can be started
 */
export function canStartProject(project: ProjectWithResources): ActionCheckResult {
  return checkProjectAction(project, 'START')
}

/**
 * Check if a project can be stopped
 */
export function canStopProject(project: ProjectWithResources): ActionCheckResult {
  return checkProjectAction(project, 'STOP')
}

/**
 * Check if a project can be deleted
 */
export function canDeleteProject(project: ProjectWithResources): ActionCheckResult {
  return checkProjectAction(project, 'DELETE')
}

// ============================================================================
// Resource Action Utilities
// ============================================================================

/**
 * Get allowed actions for a resource status
 *
 * @param status - Resource status
 * @returns Array of allowed actions
 *
 * @example
 * ```typescript
 * const actions = getResourceActions('STOPPED')
 * // Returns: ['START', 'DELETE']
 * ```
 */
export function getResourceActions(status: ResourceStatus): ResourceAction[] {
  return RESOURCE_ALLOWED_ACTIONS[status] || []
}

/**
 * Check if a resource action is allowed
 *
 * @param status - Resource status
 * @param action - Action to check
 * @returns true if action is allowed
 *
 * @example
 * ```typescript
 * const canStart = isResourceActionAllowed('STOPPED', 'START')
 * // Returns: true
 * ```
 */
export function isResourceActionAllowed(status: ResourceStatus, action: ResourceAction): boolean {
  return RESOURCE_ALLOWED_ACTIONS[status]?.includes(action) ?? false
}

/**
 * Check if a resource can be started
 */
export function canStartResource(status: ResourceStatus): boolean {
  return isResourceActionAllowed(status, 'START')
}

/**
 * Check if a resource can be stopped
 */
export function canStopResource(status: ResourceStatus): boolean {
  return isResourceActionAllowed(status, 'STOP')
}

/**
 * Check if a resource can be deleted
 */
export function canDeleteResource(status: ResourceStatus): boolean {
  return isResourceActionAllowed(status, 'DELETE')
}

/**
 * Check if a resource can be updated
 */
export function canUpdateResource(status: ResourceStatus): boolean {
  return isResourceActionAllowed(status, 'UPDATE')
}
