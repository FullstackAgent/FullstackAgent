/**
 * TerminalToolbar Component
 *
 * Toolbar for terminal with tabs, status, and operation controls
 */

'use client';

import { useMemo, useState } from 'react';
import type { Prisma } from '@prisma/client';
import {
  Network,
  Plus,
  Terminal as TerminalIcon,
  X,
} from 'lucide-react';

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

  const networkEndpoints = useMemo(
    () => [
      { domain: sandbox?.publicUrl || '', port: 3000, protocol: 'HTTPS', label: 'Application' },
      { domain: sandbox?.ttydUrl || '', port: 7681, protocol: 'HTTPS', label: 'Terminal' },
    ],
    [sandbox?.publicUrl, sandbox?.ttydUrl]
  );

  return (
    <>
      <div className="h-12 bg-tabs-background border-b border-border flex items-center justify-between">
        {/* Terminal Tabs */}
        <div className="flex items-center flex-1 min-w-0 h-full">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-1 px-4 h-full text-sm font-medium cursor-pointer transition-colors',
                activeTabId === tab.id
                  ? 'bg-tab-active-background text-tab-active-foreground'
                  : 'bg-tab-background text-tab-foreground'
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              <TerminalIcon className="h-4 w-4" />
              <span className="truncate max-w-[100px] text-inherit">{tab.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className={cn(
                  "ml-1 hover:text-white",
                  tabs.length <= 1 && "invisible pointer-events-none"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={onTabAdd}
            className="flex items-center gap-1 px-4 h-full text-tab-foreground hover:text-white transition-colors"
            title="Add new terminal"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mr-4">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-tab-foreground">
            <div className={cn('h-1.5 w-1.5 rounded-full', getStatusBgClasses(project.status))} />
            <span>{project.status}</span>
          </div>

          {/* Network Button */}
          <button
            onClick={() => setShowNetworkDialog(true)}
            className="px-2 py-1 text-xs text-tab-active-foreground hover:bg-tab-hover-background rounded transition-colors flex items-center gap-1"
            title="View network endpoints"
          >
            <Network className="h-3 w-3" />
            <span>Network</span>
          </button>
        </div>
      </div>

      {/* Network Dialog */}
      <Dialog open={showNetworkDialog} onOpenChange={setShowNetworkDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Network Endpoints</DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              All publicly accessible endpoints for this sandbox
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 mt-5">
            {networkEndpoints.map((endpoint, index) => (
              <div
                key={index}
                className="p-3.5 bg-background rounded-lg border border-border hover:border-accent transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-foreground">Port {endpoint.port}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-card text-muted-foreground border border-border">
                      {endpoint.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{endpoint.protocol}</span>
                </div>
                <a
                  href={endpoint.domain}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary-hover break-all underline underline-offset-2 hover:underline-offset-4 transition-all"
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
