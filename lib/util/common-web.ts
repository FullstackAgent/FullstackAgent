/**
 * Common Web Utilities
 *
 * Browser-specific utility functions that can be used across the application.
 * These functions require browser APIs and cannot be used in server-side contexts.
 */

// ============================================================================
// Clipboard Utilities
// ============================================================================

/**
 * Copy text to clipboard with fallback for older browsers
 *
 * Uses modern Clipboard API when available, with automatic fallback to
 * deprecated execCommand for older browsers or security-restricted contexts.
 *
 * @param text - Text to copy to clipboard
 * @throws Error if copy fails (only in fallback mode)
 *
 * @example
 * ```typescript
 * try {
 *   await copyToClipboard('/path/to/file');
 *   console.log('Copied to clipboard!');
 * } catch (error) {
 *   console.error('Failed to copy:', error);
 * }
 * ```
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try modern Clipboard API first (requires HTTPS or localhost)
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fallback for older browsers or security restrictions
  }

  // Fallback: Create temporary textarea element
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px' // Move out of viewport
  textArea.style.top = '-999999px'
  document.body.appendChild(textArea)
  textArea.select()

  try {
    // Note: document.execCommand is deprecated but needed for fallback
    const successful = document.execCommand('copy')
    if (!successful) {
      throw new Error('execCommand returned false')
    }
  } finally {
    document.body.removeChild(textArea)
  }
}