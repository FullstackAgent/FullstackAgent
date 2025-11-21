/**
 * useFileDrop Hook
 *
 * Custom hook for handling file drag-and-drop and clipboard paste events.
 * Monitors the entire window for file drops and pastes, making it work
 * seamlessly even when xterm has focus.
 *
 * Features:
 * - Global drag and drop support
 * - Global paste event handling (works with xterm focus)
 * - Folder and file extraction
 * - Visual drag feedback state
 * - Automatic event cleanup
 *
 * @example
 * ```tsx
 * const { isDragging } = useFileDrop({
 *   enabled: true,
 *   onFilesDropped: (files) => console.log(files),
 *   onFilesPasted: (files) => console.log(files),
 * });
 * ```
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface FileDropConfig {
  /** Enable/disable file drop and paste handling */
  enabled?: boolean
  /** Callback when files are dropped */
  onFilesDropped?: (files: File[]) => void
  /** Callback when files are pasted */
  onFilesPasted?: (files: File[]) => void
  /** Container element to attach events to (defaults to window) */
  containerRef?: React.RefObject<HTMLElement | null>
}

// ============================================================================
// Hook
// ============================================================================

export function useFileDrop(config: FileDropConfig) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  /**
   * Extract files from clipboard data
   */
  const extractFilesFromClipboard = useCallback(
    async (clipboardData: DataTransfer): Promise<File[]> => {
      const files: File[] = []
      const items = clipboardData.items

      if (!items) return files

      // Extract files from clipboard items
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
        }
      }

      return files
    },
    []
  )

  /**
   * Extract files from DataTransfer (supports folders)
   */
  const extractFilesFromDataTransfer = useCallback(
    async (dataTransfer: DataTransfer): Promise<File[]> => {
      const { extractFilesFromDataTransfer: extractFiles } = await import('@/lib/util/filebrowser')
      return extractFiles(dataTransfer)
    },
    []
  )

  /**
   * Handle drag enter event
   */
  const handleDragEnter = useCallback(
    (evt: Event) => {
      if (!config.enabled) return

      const e = evt as DragEvent
      e.preventDefault()
      e.stopPropagation()

      dragCounterRef.current++

      // Check if drag contains files
      const hasFiles = Array.from(e.dataTransfer?.items || []).some((item) => item.kind === 'file')

      if (hasFiles && dragCounterRef.current === 1) {
        setIsDragging(true)
      }
    },
    [config.enabled]
  )

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback(
    (evt: Event) => {
      if (!config.enabled) return

      const e = evt as DragEvent
      e.preventDefault()
      e.stopPropagation()
    },
    [config.enabled]
  )

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback(
    (evt: Event) => {
      if (!config.enabled) return

      const e = evt as DragEvent
      e.preventDefault()
      e.stopPropagation()

      dragCounterRef.current--

      if (dragCounterRef.current === 0) {
        setIsDragging(false)
      }
    },
    [config.enabled]
  )

  /**
   * Handle drop event
   */
  const handleDrop = useCallback(
    async (evt: Event) => {
      if (!config.enabled) return

      const e = evt as DragEvent
      e.preventDefault()
      e.stopPropagation()

      // Reset drag state
      dragCounterRef.current = 0
      setIsDragging(false)

      if (!e.dataTransfer) return

      try {
        const files = await extractFilesFromDataTransfer(e.dataTransfer)

        if (files.length > 0) {
          config.onFilesDropped?.(files)
        }
      } catch (error) {
        console.error('[useFileDrop] Failed to extract files from drop:', error)
      }
    },
    [config, extractFilesFromDataTransfer]
  )

  /**
   * Handle paste event
   */
  const handlePaste = useCallback(
    async (evt: Event) => {
      if (!config.enabled) return

      const e = evt as ClipboardEvent
      const clipboardData = e.clipboardData
      if (!clipboardData) return

      try {
        const files = await extractFilesFromClipboard(clipboardData)

        if (files.length > 0) {
          // Prevent default paste behavior when files are detected
          e.preventDefault()
          e.stopPropagation()

          config.onFilesPasted?.(files)
        }
      } catch (error) {
        console.error('[useFileDrop] Failed to extract files from paste:', error)
      }
    },
    [config, extractFilesFromClipboard]
  )

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!config.enabled) return

    // Use provided container or default to window
    const target = config.containerRef?.current || window
    if (!target) return

    // Add event listeners
    // Note: drag events use bubble phase (default)
    target.addEventListener('dragenter', handleDragEnter)
    target.addEventListener('dragover', handleDragOver)
    target.addEventListener('dragleave', handleDragLeave)
    target.addEventListener('drop', handleDrop)

    // CRITICAL: Use capture phase for paste to intercept before xterm!
    // xterm blocks paste event propagation, so we must listen in capture phase
    target.addEventListener('paste', handlePaste, true)

    // Cleanup
    return () => {
      target.removeEventListener('dragenter', handleDragEnter)
      target.removeEventListener('dragover', handleDragOver)
      target.removeEventListener('dragleave', handleDragLeave)
      target.removeEventListener('drop', handleDrop)
      // Must match the addEventListener call (with capture=true)
      target.removeEventListener('paste', handlePaste, true)

      // Reset state
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }, [
    config.enabled,
    config.containerRef,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
  ])

  return {
    isDragging,
  }
}
