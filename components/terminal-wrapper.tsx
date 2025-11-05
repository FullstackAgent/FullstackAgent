'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const Terminal = dynamic(() => import('./terminal'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
        <p className="text-xs text-gray-500">Loading terminal...</p>
      </div>
    </div>
  ),
});

interface TerminalWrapperProps {
  sandboxUrl?: string;
  terminalId?: string;
  ttydUrl?: string;
  sandboxStatus?: string;
}

export default function TerminalWrapper({
  sandboxUrl,
  terminalId,
  ttydUrl,
  sandboxStatus,
}: TerminalWrapperProps) {
  return (
    <Terminal
      sandboxUrl={sandboxUrl}
      terminalId={terminalId}
      ttydUrl={ttydUrl}
      sandboxStatus={sandboxStatus}
    />
  );
}
