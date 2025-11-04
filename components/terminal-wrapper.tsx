"use client";

import dynamic from "next/dynamic";

const Terminal = dynamic(() => import("./terminal"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-black rounded-lg p-4 flex items-center justify-center">
      <p className="text-gray-500">Loading terminal...</p>
    </div>
  ),
});

interface TerminalWrapperProps {
  sandboxUrl?: string;
  terminalId?: string;
  ttydUrl?: string;
  sandboxStatus?: string;
}

export default function TerminalWrapper({ sandboxUrl, terminalId, ttydUrl, sandboxStatus }: TerminalWrapperProps) {
  return <Terminal sandboxUrl={sandboxUrl} terminalId={terminalId} ttydUrl={ttydUrl} sandboxStatus={sandboxStatus} />;
}