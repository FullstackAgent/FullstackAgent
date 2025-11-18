/**
 * TerminalToolbar Component
 *
 * Toolbar for terminal with tabs, status, and operation controls
 */

'use client';

import { useState } from 'react';
import type { Prisma } from '@prisma/client';
import { Network, Plus, Terminal as TerminalIcon, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getStatusBgClasses } from '@/lib/util/status-colors';
import { cn } from '@/lib/utils';

type Project = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true;
    databases: true;
  };
}>;

type Sandbox = Prisma.SandboxGetPayload<object>;

export interface Tab {
  id: string;
  name: string;
}

export interface TerminalToolbarProps {
  /** Project data */
  project: Project;
  /** Sandbox data */
  sandbox: Sandbox | undefined;
  /** Terminal tabs */
  tabs: Tab[];
  /** Active tab ID */
  activeTabId: string;
  /** Callback when tab is selected */
  onTabSelect: (tabId: string) => void;
  /** Callback when tab is closed */
  onTabClose: (tabId: string) => void;
  /** Callback when new tab is added */
  onTabAdd: () => void;
}

/**
 * Terminal toolbar with tabs and operations
 */
export function TerminalToolbar({
  project,
  sandbox,
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabAdd,
}: TerminalToolbarProps) {
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const networkEndpoints = [
    { domain: sandbox?.publicUrl || '', port: 3000, protocol: 'HTTPS', label: 'Application' },
    { domain: sandbox?.ttydUrl || '', port: 7681, protocol: 'HTTPS', label: 'Terminal' },
  ];

  return (
    <>
      <div className="h-9 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-2">
        {/* Terminal Tabs */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
                activeTabId === tab.id
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-gray-400 hover:bg-[#37373d]'
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              <TerminalIcon className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className="ml-1 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={onTabAdd}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#37373d] rounded transition-colors"
            title="Add new terminal"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-300">
            <div className={cn('h-1.5 w-1.5 rounded-full', getStatusBgClasses(project.status))} />
            <span>{project.status}</span>
          </div>

          {/* Network Button */}
          <button
            onClick={() => setShowNetworkDialog(true)}
            className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#37373d] rounded transition-colors flex items-center gap-1"
            title="View network endpoints"
          >
            <Network className="h-3 w-3" />
            <span>Network</span>
          </button>
        </div>
      </div>

      {/* Network Dialog */}
      <Dialog open={showNetworkDialog} onOpenChange={setShowNetworkDialog}>
        <DialogContent className="bg-[#252526] border-[#3e3e42] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Network Endpoints</DialogTitle>
            <DialogDescription className="text-gray-400 mt-1">
              All publicly accessible endpoints for this sandbox
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 mt-5">
            {networkEndpoints.map((endpoint, index) => (
              <div
                key={index}
                className="p-3.5 bg-[#1e1e1e] rounded-lg border border-[#3e3e42] hover:border-[#4e4e52] transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-white">Port {endpoint.port}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#252526] text-[#858585] border border-[#3e3e42]">
                      {endpoint.label}
                    </span>
                  </div>
                  <span className="text-xs text-[#858585] font-mono">{endpoint.protocol}</span>
                </div>
                <a
                  href={endpoint.domain}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#3794ff] hover:text-[#4fc1ff] break-all underline underline-offset-2 hover:underline-offset-4 transition-all"
                >
                  {endpoint.domain}
                </a>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
