/**
 * TerminalDisplay Component
 *
 * Pure display component for terminal iframe
 * VSCode Dark Modern theme style
 */

'use client';

import { useState } from 'react';
import { AlertCircle, Terminal as TerminalIcon } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';

export interface TerminalDisplayProps {
  /** ttyd URL */
  ttydUrl?: string | null;
  /** Sandbox status */
  status: string;
}

/**
 * Display terminal iframe or status message
 */
export function TerminalDisplay({ ttydUrl, status }: TerminalDisplayProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Show terminal iframe if running and URL is available
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

        {/* Terminal iframe */}
        <iframe
          src={ttydUrl}
          className="flex-1 w-full bg-[#1e1e1e]"
          style={{
            border: 'none',
            minHeight: '100%',
            height: '100%',
          }}
          title="Terminal"
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
        {renderStatusIcon(status)}
        <span className="text-sm text-[#cccccc]">{getStatusMessage(status)}</span>
      </div>
    </div>
  );
}

/**
 * Render status icon with animation
 */
function renderStatusIcon(status: string) {
  switch (status) {
    case 'CREATING':
    case 'STARTING':
      return <Spinner className="h-5 w-5 text-[#3794ff]" />;
    case 'STOPPING':
      return <Spinner className="h-5 w-5 text-[#f48771]" />;
    case 'TERMINATING':
      return <Spinner className="h-5 w-5 text-[#f48771]" />;
    case 'ERROR':
      return <AlertCircle className="h-5 w-5 text-[#f48771]" />;
    case 'STOPPED':
    case 'TERMINATED':
      return <TerminalIcon className="h-5 w-5 text-[#858585]" />;
    default:
      return <TerminalIcon className="h-5 w-5 text-[#858585]" />;
  }
}

/**
 * Get human-readable status message
 */
function getStatusMessage(status: string): string {
  switch (status) {
    case 'CREATING':
      return 'Creating sandbox...';
    case 'STARTING':
      return 'Starting sandbox...';
    case 'STOPPED':
      return 'Sandbox stopped';
    case 'STOPPING':
      return 'Stopping sandbox...';
    case 'TERMINATED':
      return 'Sandbox terminated';
    case 'TERMINATING':
      return 'Terminating sandbox...';
    case 'ERROR':
      return 'Connection failed';
    case 'PARTIAL':
      return 'Resources not ready...';
    default:
      return 'Checking status...';
  }
}
