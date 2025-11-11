import type { ProjectStatus, ResourceStatus } from '@prisma/client'

type Status = ProjectStatus | ResourceStatus | string

/**
 * Get background color classes for a project/resource status
 * Used for status indicators (dots, badges, etc.)
 */
export function getStatusBgColor(status: Status): string {
  switch (status) {
    case 'RUNNING':
      return 'bg-green-600 dark:bg-green-500'
    case 'STOPPED':
      return 'bg-muted-foreground'
    case 'STARTING':
    case 'STOPPING':
      return 'bg-yellow-600 dark:bg-yellow-500'
    case 'CREATING':
      return 'bg-blue-600 dark:bg-blue-500'
    case 'UPDATING':
      return 'bg-cyan-600 dark:bg-cyan-500'
    case 'TERMINATING':
      return 'bg-red-600 dark:bg-red-500'
    case 'ERROR':
      return 'bg-destructive'
    case 'PARTIAL':
      return 'bg-orange-600 dark:bg-orange-500'
    default:
      return 'bg-muted-foreground'
  }
}

/**
 * Get text color classes for a project/resource status
 * Used for text-based status indicators
 */
export function getStatusTextColor(status: Status): string {
  switch (status) {
    case 'RUNNING':
      return 'text-green-600 dark:text-green-500'
    case 'STOPPED':
      return 'text-muted-foreground'
    case 'STARTING':
    case 'STOPPING':
      return 'text-yellow-600 dark:text-yellow-500'
    case 'CREATING':
      return 'text-blue-600 dark:text-blue-500'
    case 'UPDATING':
      return 'text-cyan-600 dark:text-cyan-500'
    case 'TERMINATING':
      return 'text-red-600 dark:text-red-500'
    case 'ERROR':
      return 'text-destructive'
    case 'PARTIAL':
      return 'text-orange-600 dark:text-orange-500'
    default:
      return 'text-muted-foreground'
  }
}

/**
 * Check if a status should have pulse animation
 * Transition states (STARTING, STOPPING, CREATING, UPDATING) should pulse
 */
export function shouldStatusPulse(status: Status): boolean {
  return (
    status === 'STARTING' || status === 'STOPPING' || status === 'CREATING' || status === 'UPDATING'
  )
}

/**
 * Get all status classes (color + animation) for background indicators
 * Combines background color and pulse animation if needed
 */
export function getStatusBgClasses(status: Status): string {
  const color = getStatusBgColor(status)
  const pulse = shouldStatusPulse(status) ? 'animate-pulse' : ''
  return `${color} ${pulse}`.trim()
}

/**
 * Get all status classes (color + animation) for text indicators
 * Combines text color and pulse animation if needed
 */
export function getStatusTextClasses(status: Status): string {
  const color = getStatusTextColor(status)
  const pulse = shouldStatusPulse(status) ? 'animate-pulse' : ''
  return `${color} ${pulse}`.trim()
}

/**
 * Get icon color for status indicators
 * Used for spinner and icon components
 */
export function getStatusIconColor(status: Status): string {
  switch (status) {
    case 'CREATING':
    case 'STARTING':
    case 'UPDATING':
      return 'text-[#3794ff]'
    case 'STOPPING':
    case 'TERMINATING':
    case 'ERROR':
      return 'text-[#f48771]'
    case 'STOPPED':
    case 'TERMINATED':
    default:
      return 'text-[#858585]'
  }
}

/**
 * Check if status should show a spinner (loading state)
 */
export function shouldShowSpinner(status: Status): boolean {
  return (
    status === 'CREATING' ||
    status === 'STARTING' ||
    status === 'UPDATING' ||
    status === 'STOPPING' ||
    status === 'TERMINATING'
  )
}

/**
 * Check if status indicates an error state
 */
export function isErrorStatus(status: Status): boolean {
  return status === 'ERROR'
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(status: Status): string {
  switch (status) {
    case 'CREATING':
      return 'Creating sandbox...'
    case 'STARTING':
      return 'Starting sandbox...'
    case 'UPDATING':
      return 'Updating sandbox configuration...'
    case 'STOPPED':
      return 'Sandbox stopped'
    case 'STOPPING':
      return 'Stopping sandbox...'
    case 'TERMINATED':
      return 'Sandbox terminated'
    case 'TERMINATING':
      return 'Terminating sandbox...'
    case 'ERROR':
      return 'Connection failed'
    case 'PARTIAL':
      return 'Resources not ready...'
    default:
      return 'Checking status...'
  }
}
