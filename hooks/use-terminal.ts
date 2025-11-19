/**
 * useTerminal Hook
 *
 * Manages terminal WebSocket connection state and reconnection logic
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseTerminalOptions {
  /** ttyd URL with authentication token */
  ttydUrl: string | null | undefined
  /** Enable auto-reconnect on disconnect */
  autoReconnect?: boolean
  /** Reconnect delay in milliseconds */
  reconnectDelay?: number
  /** Callback when connected */
  onConnected?: () => void
  /** Callback when disconnected */
  onDisconnected?: () => void
  /** Callback when error occurs */
  onError?: (error: Error) => void
}

export interface UseTerminalReturn {
  /** Current connection status */
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  /** Whether terminal is ready to use */
  isReady: boolean
  /** WebSocket URL for xterm component */
  wsUrl: string | null
  /** Manually trigger reconnection */
  reconnect: () => void
  /** Disconnect and stop auto-reconnect */
  disconnect: () => void
  /** Callback to handle connected event from XtermTerminal */
  handleConnected: () => void
  /** Callback to handle disconnected event from XtermTerminal */
  handleDisconnected: () => void
}

export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const {
    ttydUrl,
    autoReconnect = true,
    reconnectDelay = 3000,
    onConnected,
    onDisconnected,
    onError,
  } = options

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>(
    'disconnected'
  )
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shouldReconnectRef = useRef(true)

  // Parse ttyd URL and prepare WebSocket URL
  useEffect(() => {
    if (!ttydUrl) {
      setWsUrl(null)
      setStatus('disconnected')
      return
    }

    try {
      // ttydUrl already includes the token as query parameter
      setWsUrl(ttydUrl)
      setStatus('connecting')
    } catch (error) {
      console.error('[useTerminal] Invalid ttyd URL:', error)
      setStatus('error')
      onError?.(error as Error)
    }
  }, [ttydUrl, onError])

  // Handle connection status callbacks
  const handleConnected = useCallback(() => {
    setStatus('connected')
    shouldReconnectRef.current = autoReconnect
    onConnected?.()
  }, [autoReconnect, onConnected])

  const handleDisconnected = useCallback(() => {
    setStatus('disconnected')
    onDisconnected?.()

    // Schedule reconnection if enabled
    if (shouldReconnectRef.current && wsUrl) {
      console.log(`[useTerminal] Reconnecting in ${reconnectDelay}ms...`)
      reconnectTimeoutRef.current = setTimeout(() => {
        setStatus('connecting')
        // Trigger re-render to reconnect
        setWsUrl((prev) => (prev ? `${prev}` : null))
      }, reconnectDelay)
    }
  }, [wsUrl, reconnectDelay, onDisconnected])

  // Manual reconnection
  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    shouldReconnectRef.current = true
    setStatus('connecting')

    // Force reconnection by updating wsUrl
    if (ttydUrl) {
      setWsUrl(`${ttydUrl}`)
    }
  }, [ttydUrl])

  // Manual disconnection
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    setStatus('disconnected')
    setWsUrl(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return {
    status,
    isReady: status === 'connected',
    wsUrl,
    reconnect,
    disconnect,
    handleConnected,
    handleDisconnected,
  }
}
