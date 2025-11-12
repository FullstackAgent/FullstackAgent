/**
 * TerminalDisplay Component
 *
 * Display component for xterm.js terminal (no iframe)
 * Direct WebSocket connection to ttyd backend
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

export interface TerminalDisplayProps {
  /** ttyd URL with authentication token */
  ttydUrl?: string | null;
  /** Sandbox status */
  status: string;
  /** Unique tab ID for this terminal instance */
  tabId: string;
}

/**
 * Display xterm.js terminal with direct WebSocket connection
 * Each terminal tab gets independent WebSocket connection
 */
export function TerminalDisplay({ ttydUrl, status, tabId }: TerminalDisplayProps) {
  const [terminalReady, setTerminalReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting'
  );

  // Stable callback functions to prevent unnecessary re-renders of XtermTerminal
  const handleReady = useCallback(() => {
    console.log('[TerminalDisplay] Terminal ready');
    setTerminalReady(true);
  }, []);

  const handleConnected = useCallback(() => {
    console.log('[TerminalDisplay] Terminal WebSocket connected');
    setConnectionStatus('connected');
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('[TerminalDisplay] Terminal WebSocket disconnected');
    setConnectionStatus('connecting');
  }, []);

  // Only show terminal if status is RUNNING and ttyd URL is available
  if (status === 'RUNNING' && ttydUrl) {
    return (
      <div className="h-full w-full bg-[#1e1e1e] flex flex-col relative">
        {/* Loading overlay - show until terminal is ready and connected */}
        {(connectionStatus === 'connecting' || !terminalReady) && (
          <div className="absolute inset-0 bg-[#1e1e1e] flex items-center justify-center z-10">
            <div className="flex items-center gap-3">
              <Spinner className="h-5 w-5 text-[#3794ff]" />
              <span className="text-sm text-[#cccccc]">
                {!terminalReady ? 'Loading terminal...' : 'Connecting to terminal...'}
              </span>
            </div>
          </div>
        )}

        {/* XTerm Terminal Component */}
        <div className="flex-1 w-full">
          <XtermTerminal
            key={`xterm-${tabId}`}
            wsUrl={ttydUrl}
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
          />
        </div>

        {/* Connection status indicator (optional, can be removed) */}
        {connectionStatus === 'connecting' && terminalReady && (
          <div className="absolute top-2 right-2 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1 flex items-center gap-2">
            <Spinner className="h-3 w-3 text-yellow-500" />
            <span className="text-xs text-yellow-500">Reconnecting...</span>
          </div>
        )}
        {connectionStatus === 'error' && terminalReady && (
          <div className="absolute top-2 right-2 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-red-500" />
            <span className="text-xs text-red-500">Connection error</span>
          </div>
        )}
      </div>
    );
  }

  // Show status message for non-running states
  return (
    <div className="h-full w-full bg-[#1e1e1e] flex items-center justify-center">
      <div className="flex items-center gap-3">
        {shouldShowSpinner(status) ? (
          <Spinner className={cn('h-5 w-5', getStatusIconColor(status))} />
        ) : isErrorStatus(status) ? (
          <AlertCircle className={cn('h-5 w-5', getStatusIconColor(status))} />
        ) : (
          <TerminalIcon className={cn('h-5 w-5', getStatusIconColor(status))} />
        )}
        <span className="text-sm text-[#cccccc]">{getStatusMessage(status)}</span>
      </div>
    </div>
  );
}
