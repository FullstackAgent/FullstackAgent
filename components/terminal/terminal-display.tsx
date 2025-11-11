/**
 * TerminalDisplay Component
 *
 * Pure display component for terminal iframe
 * VSCode Dark Modern theme style
 *
 * Auto-scroll implementation:
 * 1. ttyd serves custom HTML with injected autoscroll script
 * 2. Script monitors xterm.js write events and forces scroll to bottom
 * 3. Script sends status updates via postMessage
 * 4. This component listens to postMessage for debugging/monitoring
 */

'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertCircle, Terminal as TerminalIcon } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import {
  getStatusIconColor,
  getStatusMessage,
  isErrorStatus,
  shouldShowSpinner,
} from '@/lib/util/status-colors';
import { cn } from '@/lib/utils';

export interface TerminalDisplayProps {
  /** ttyd URL */
  ttydUrl?: string | null;
  /** Sandbox status */
  status: string;
  /** Unique tab ID for this terminal instance */
  tabId: string;
}

/**
 * Display terminal iframe or status message
 * Each terminal tab gets its own iframe with unique key to ensure separate WebSocket connections
 */
export function TerminalDisplay({ ttydUrl, status, tabId }: TerminalDisplayProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [scrollStatus, setScrollStatus] = useState<'ready' | 'streaming' | 'idle'>('idle');

  // Listen to postMessage from ttyd iframe (autoscroll status updates)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Verify message format
      if (typeof event.data !== 'object' || !event.data) return;

      // Handle autoscroll status updates
      if (event.data.type === 'ttyd-scroll-status') {
        const newStatus = event.data.status;
        setScrollStatus(newStatus);

        // Debug logging (disable in production)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Terminal ${tabId}] Auto-scroll status:`, newStatus);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tabId]);

  // Only show terminal iframe if status is RUNNING and URL is available
  if (status === 'RUNNING' && ttydUrl) {
    return (
      <div className="h-full w-full bg-[#1e1e1e] flex flex-col relative">
        {/* Loading overlay */}
        {!iframeLoaded && (
          <div className="absolute inset-0 bg-[#1e1e1e] flex items-center justify-center z-10">
            <div className="flex items-center gap-3">
              <Spinner className="h-5 w-5 text-[#3794ff]" />
              <span className="text-sm text-[#cccccc]">Connecting to terminal...</span>
            </div>
          </div>
        )}

        {/* Auto-scroll status indicator (optional, only in development) */}
        {process.env.NODE_ENV === 'development' && scrollStatus === 'streaming' && (
          <div className="absolute top-3 right-3 z-20">
            <div className="flex items-center gap-2 bg-[#3794ff]/20 text-[#3794ff] px-2 py-1 rounded text-xs backdrop-blur-sm">
              <Activity className="h-3 w-3 animate-pulse" />
              <span>Auto-scrolling</span>
            </div>
          </div>
        )}

        {/* Terminal iframe - unique key per tab ensures separate WebSocket connection */}
        <iframe
          key={`terminal-${tabId}`}
          src={ttydUrl}
          className="flex-1 w-full bg-[#1e1e1e]"
          style={{
            border: 'none',
            minHeight: '100%',
            height: '100%',
          }}
          title={`Terminal ${tabId}`}
          onLoad={() => setIframeLoaded(true)}
          allow="clipboard-read; clipboard-write"
        />
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
