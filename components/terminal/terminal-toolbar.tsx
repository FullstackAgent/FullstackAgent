/**
 * TerminalToolbar Component
 *
 * Toolbar for terminal with tabs, status, and operation controls
 */

'use client';

import { useState } from 'react';
import type { Prisma } from '@prisma/client';
import {
  ChevronDown,
  Loader2,
  Network,
  Play,
  Plus,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectOperations } from '@/hooks/use-project-operations';
import { getAvailableProjectActions } from '@/lib/util/action';
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { executeOperation, loading } = useProjectOperations(project.id);

  const availableActions = getAvailableProjectActions(project);

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteDialog(false);
    executeOperation('DELETE');
  };

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
            <div
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                project.status === 'RUNNING' && 'bg-green-500',
                project.status === 'STOPPED' && 'bg-gray-500',
                project.status === 'STARTING' && 'bg-yellow-500 animate-pulse',
                project.status === 'STOPPING' && 'bg-yellow-500 animate-pulse',
                project.status === 'CREATING' && 'bg-blue-500 animate-pulse',
                project.status === 'UPDATING' && 'bg-cyan-500 animate-pulse',
                project.status === 'TERMINATING' && 'bg-red-500 animate-pulse',
                project.status === 'ERROR' && 'bg-red-500',
                project.status === 'PARTIAL' && 'bg-orange-500'
              )}
            />
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

          {/* Operations Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-[#37373d] rounded transition-colors flex items-center gap-1">
                <span>Operations</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#252526] border-[#3e3e42] text-white min-w-[160px]"
            >
              {availableActions.includes('START') && (
                <DropdownMenuItem
                  onClick={() => executeOperation('START')}
                  disabled={loading !== null}
                  className="text-xs cursor-pointer focus:bg-[#37373d] focus:text-white"
                >
                  {loading === 'START' ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-3 w-3" />
                      Start Sandbox
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {availableActions.includes('STOP') && (
                <DropdownMenuItem
                  onClick={() => executeOperation('STOP')}
                  disabled={loading !== null}
                  className="text-xs cursor-pointer focus:bg-[#37373d] focus:text-white"
                >
                  {loading === 'STOP' ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Stopping...
                    </>
                  ) : (
                    <>
                      <Square className="mr-2 h-3 w-3" />
                      Stop Sandbox
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {availableActions.includes('DELETE') && (
                <>
                  <DropdownMenuSeparator className="bg-[#3e3e42]" />
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    disabled={loading !== null}
                    className="text-xs cursor-pointer focus:bg-[#37373d] focus:text-white"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Delete Sandbox
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#252526] border-[#3e3e42] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this project? This will terminate all resources
              (databases, sandboxes) and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#3e3e42] border-[#3e3e42] text-white hover:bg-[#4e4e52]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
