/**
 * TerminalDisplay Component
 *
 * Wrapper component for XtermTerminal that manages connection states and loading UI.
 * Displays appropriate status messages when terminal is not ready or sandbox is not running.
 *
 * Features:
 * - Loading overlays during initialization and connection
 * - Status-based conditional rendering
 * - Connection status indicators
 * - Automatic reconnection feedback
 */

'use client';

import { useCallback, useState } from 'react';
import { AlertCircle, Terminal as TerminalIcon } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import {
  getStatusIconColor,
  getStatusMessage,
  isErrorStatus,
  shouldShowSpinner,
} from '@/lib/util/status-colors';
import { cn } from '@/lib/utils';

import { XtermTerminal } from './xterm-terminal';

// ============================================================================
// Types
// ============================================================================

export interface TerminalDisplayProps {
  sandboxId: string;
  ttydUrl?: string | null;
  status: string;
  tabId: string;
  fileBrowserUrl?: string | null;
  fileBrowserUsername?: string;
  fileBrowserPassword?: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'error';

// ============================================================================
// Component
// ============================================================================

export function TerminalDisplay({
  sandboxId,
  ttydUrl,
  status,
  tabId,
  fileBrowserUrl,
  fileBrowserUsername,
  fileBrowserPassword,
}: TerminalDisplayProps) {
  // =========================================================================
  // State Management
  // =========================================================================

  const [terminalReady, setTerminalReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  // =========================================================================
  // Event Handlers
  // =========================================================================

  const handleReady = useCallback(() => {
    console.log('[TerminalDisplay] Terminal initialized successfully');
    setTerminalReady(true);
  }, []);

  const handleConnected = useCallback(() => {
    console.log('[TerminalDisplay] WebSocket connection established');
    setConnectionStatus('connected');
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('[TerminalDisplay] WebSocket connection closed');
    setConnectionStatus('connecting');
  }, []);

  // =========================================================================
  // Conditional Rendering Logic
  // =========================================================================

  // Only render terminal when sandbox is running and ttyd URL is available
  if (status === 'RUNNING' && ttydUrl) {
    const isLoading = connectionStatus === 'connecting' || !terminalReady;
    const showReconnectIndicator = connectionStatus === 'connecting' && terminalReady;
    const showErrorIndicator = connectionStatus === 'error' && terminalReady;

    return (
      <div className="h-full w-full bg-[#1e1e1e] flex flex-col relative">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#1e1e1e] flex items-center justify-center z-10">
            <div className="flex items-center gap-3">
              <Spinner className="h-5 w-5 text-[#3794ff]" />
              <span className="text-sm text-[#cccccc]">
                {!terminalReady ? 'Initializing terminal...' : 'Establishing connection...'}
              </span>
            </div>
          </div>
        )}

        {/* Terminal Instance */}
        <div className="flex-1 w-full">
          <XtermTerminal
            key={`xterm-${tabId}`}
            wsUrl={ttydUrl}
            sandboxId={sandboxId}
            theme={{
              foreground: '#d2d2d2',
              background: '#1e1e1e',
              cursor: '#adadad',
              black: '#000000',
              red: '#d81e00',
              green: '#5ea702',
              yellow: '#cfae00',
              blue: '#427ab3',
              magenta: '#89658e',
              cyan: '#00a7aa',
              white: '#dbded8',
              brightBlack: '#686a66',
              brightRed: '#f54235',
              brightGreen: '#99e343',
              brightYellow: '#fdeb61',
              brightBlue: '#84b0d8',
              brightMagenta: '#bc94b7',
              brightCyan: '#37e6e8',
              brightWhite: '#f1f1f0',
            }}
            fontSize={14}
            fontFamily="Consolas, Liberation Mono, Menlo, Courier, monospace"
            rendererType="webgl"
            onReady={handleReady}
            onConnected={handleConnected}
            onDisconnected={handleDisconnected}
            fileBrowserUrl={fileBrowserUrl || undefined}
            fileBrowserUsername={fileBrowserUsername}
            fileBrowserPassword={fileBrowserPassword}
            enableFileUpload={true}
          />
        </div>

        {/* Connection Status Indicators */}
        {showReconnectIndicator && (
          <div className="absolute top-2 right-2 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1 flex items-center gap-2">
            <Spinner className="h-3 w-3 text-yellow-500" />
            <span className="text-xs text-yellow-500">Reconnecting...</span>
          </div>
        )}

        {showErrorIndicator && (
          <div className="absolute top-2 right-2 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-red-500" />
            <span className="text-xs text-red-500">Connection failed</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // Status Message Display
  // =========================================================================

  // Show appropriate status message when terminal is not available
  const StatusIcon = shouldShowSpinner(status)
    ? Spinner
    : isErrorStatus(status)
      ? AlertCircle
      : TerminalIcon;

  return (
    <div className="h-full w-full bg-[#1e1e1e] flex items-center justify-center">
      <div className="flex items-center gap-3">
        <StatusIcon className={cn('h-5 w-5', getStatusIconColor(status))} />
        <span className="text-sm text-[#cccccc]">{getStatusMessage(status)}</span>
      </div>
    </div>
  );
}