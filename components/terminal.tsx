'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Terminal as TerminalIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

interface TerminalComponentProps {
  sandboxUrl?: string;
  terminalId?: string;
  ttydUrl?: string;
  sandboxStatus?: string;
}

export default function TerminalComponent({
  ttydUrl: initialTtydUrl,
  sandboxStatus: initialStatus,
}: TerminalComponentProps) {
  const [ttydUrl, setTtydUrl] = useState<string | null>(initialTtydUrl || null);
  const [sandboxStatus, setSandboxStatus] = useState<string>(initialStatus || 'checking');
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    // Update state when props change (e.g., after page refresh)
    if (initialTtydUrl) {
      setTtydUrl(initialTtydUrl);
      setIframeLoaded(false); // Reset loading state when URL changes
    }
    if (initialStatus) {
      setSandboxStatus(initialStatus);
    }
  }, [initialTtydUrl, initialStatus]);

  // If sandbox is running, show terminal iframe
  if (sandboxStatus === 'RUNNING' && ttydUrl) {
    return (
      <div className="h-full w-full bg-black flex flex-col relative">
        {/* Loading overlay */}
        {!iframeLoaded && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
              <p className="text-xs text-gray-500">Connecting to terminal...</p>
            </div>
          </div>
        )}

        <iframe
          src={ttydUrl}
          className="flex-1 w-full bg-black"
          style={{
            border: 'none',
            minHeight: '100%',
            height: '100%',
          }}
          title="Terminal"
          onLoad={() => setIframeLoaded(true)}
        />
      </div>
    );
  }

  // Show status message for non-running states
  return (
    <div className="h-full w-full bg-black rounded-lg p-4">
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                {sandboxStatus === 'CREATING' || sandboxStatus === 'STARTING' ? (
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                ) : sandboxStatus === 'ERROR' ? (
                  <AlertCircle className="h-8 w-8 text-red-500" />
                ) : (
                  <TerminalIcon className="h-8 w-8 text-gray-500" />
                )}
                <h3 className="text-xl font-semibold text-white">Sandbox Environment</h3>
              </div>
              <p className="text-gray-400">
                {sandboxStatus === 'CREATING' && 'Sandbox is being created...'}
                {sandboxStatus === 'STARTING' && 'Sandbox is starting up...'}
                {sandboxStatus === 'STOPPED' && 'Sandbox is currently stopped.'}
                {sandboxStatus === 'STOPPING' && 'Sandbox is stopping...'}
                {sandboxStatus === 'TERMINATED' && 'Sandbox has been terminated.'}
                {sandboxStatus === 'TERMINATING' && 'Sandbox is being terminated...'}
                {sandboxStatus === 'ERROR' && 'Sandbox encountered an error.'}
                {sandboxStatus === 'PARTIAL' && 'Some sandbox resources are not ready.'}
                {!sandboxStatus || sandboxStatus === 'checking' ? 'Checking sandbox status...' : ''}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Use project-level operations to control the sandbox.
              </p>
            </div>

            <div className="mt-4 p-4 bg-gray-800 rounded-lg max-w-2xl">
              <p className="text-sm text-gray-300 mb-2">
                <strong>What is a Sandbox?</strong>
              </p>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Isolated Kubernetes pod with full development environment</li>
                <li>Pre-installed with Node.js, Next.js, PostgreSQL client, and Claude Code CLI</li>
                <li>Web-based terminal powered by ttyd for remote development</li>
                <li>Dedicated PostgreSQL database for your project</li>
                <li>Persistent workspace for your project files</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
