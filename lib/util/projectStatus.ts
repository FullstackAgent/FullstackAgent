import type { ProjectStatus, ResourceStatus } from '@prisma/client'

/**
 * Aggregate project status from resource statuses
 *
 * Rules (priority order):
 * 1. ERROR: At least one resource has ERROR status
 * 2. CREATING: At least one resource has CREATING status
 * 3. UPDATING: At least one resource has UPDATING status
 * 4. Pure states: All resources have the same status
 * 5. Transition states:
 *    - STARTING: All resources ∈ {RUNNING, STARTING}
 *    - STOPPING: All resources ∈ {STOPPED, STOPPING}
 *    - TERMINATING: All resources ∈ {TERMINATED, TERMINATING}
 * 6. PARTIAL: Inconsistent mixed states
 *
 * @param resourceStatuses - Array of resource statuses
 * @returns Aggregated project status
 */
export function aggregateProjectStatus(resourceStatuses: ResourceStatus[]): ProjectStatus {
  // Handle empty case
  if (resourceStatuses.length === 0) {
    return 'TERMINATED' // Default to TERMINATED for projects with no resources
  }

  // Rule 1: Check for ERROR - highest priority
  if (resourceStatuses.some((status) => status === 'ERROR')) {
    return 'ERROR'
  }

  // Rule 2: Check for CREATING - at least one resource is being created
  if (resourceStatuses.some((status) => status === 'CREATING')) {
    return 'CREATING'
  }

  // Rule 3: Check for UPDATING - at least one resource is being updated
  if (resourceStatuses.some((status) => status === 'UPDATING')) {
    return 'UPDATING'
  }

  // Get unique statuses
  const uniqueStatuses = new Set(resourceStatuses)

  // Rule 4: Pure states - all resources have the same status
  if (uniqueStatuses.size === 1) {
    const status = resourceStatuses[0]
    // Map resource status to project status (they're the same for these states)
    return status as ProjectStatus
  }

  // Rule 5: Transition states - check if all resources are in consistent transition
  const statusArray = Array.from(uniqueStatuses)

  // STARTING: All resources ∈ {RUNNING, STARTING}
  if (statusArray.every((s) => s === 'RUNNING' || s === 'STARTING')) {
    return 'STARTING'
  }

  // STOPPING: All resources ∈ {STOPPED, STOPPING}
  if (statusArray.every((s) => s === 'STOPPED' || s === 'STOPPING')) {
    return 'STOPPING'
  }

  // TERMINATING: All resources ∈ {TERMINATED, TERMINATING}
  if (statusArray.every((s) => s === 'TERMINATED' || s === 'TERMINATING')) {
    return 'TERMINATING'
  }

  // Rule 6: PARTIAL - inconsistent mixed states
  // Examples:
  // - Some TERMINATING + some STARTING
  // - Some STOPPING + some STARTING
  return 'PARTIAL'
}
