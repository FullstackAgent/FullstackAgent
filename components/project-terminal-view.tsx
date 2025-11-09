'use client';

import { useState } from 'react';
import type { Database, Project, Sandbox } from '@prisma/client';
import {
  ChevronDown,
  Globe,
  Loader2,
  Network,
  Play,
  Plus,
  Server,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import TerminalWrapper from '@/components/terminal-wrapper';
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
import { POST } from '@/lib/fetch-client';
import { getAvailableProjectActions, type ProjectAction } from '@/lib/util/action';
import { cn } from '@/lib/utils';

interface ProjectTerminalViewProps {
  sandbox: Sandbox | undefined;
  project: Project & {
    databases: Pick<Database, 'status'>[];
    sandboxes: Pick<Sandbox, 'status'>[];
  };
}

interface Terminal {
  id: string;
  name: string;
  isActive: boolean;
}

interface NetworkEndpoint {
  domain: string;
  port: number;
  protocol: string;
}

export default function ProjectTerminalView({ sandbox, project }: ProjectTerminalViewProps) {
  const router = useRouter();
  const [terminals, setTerminals] = useState<Terminal[]>([
    { id: '1', name: 'Terminal 1', isActive: true },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState('1');
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [loading, setLoading] = useState<ProjectAction | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get available actions based on current status
  const availableActions = getAvailableProjectActions(project);

  // Network endpoints for this sandbox
  const networkEndpoints: NetworkEndpoint[] = [
    { domain: sandbox?.publicUrl || '', port: 3000, protocol: 'HTTPS' },
    { domain: sandbox?.ttydUrl || '', port: 7681, protocol: 'HTTPS' },
  ];

  const addTerminal = () => {
    const newId = (terminals.length + 1).toString();
    const newTerminal: Terminal = {
      id: newId,
      name: `Terminal ${newId}`,
      isActive: false,
    };
    setTerminals([...terminals, newTerminal]);
    setActiveTerminalId(newId);
  };

  const closeTerminal = (id: string) => {
    if (terminals.length === 1) return; // Keep at least one terminal

    const newTerminals = terminals.filter((t) => t.id !== id);
    setTerminals(newTerminals);

    if (activeTerminalId === id) {
      setActiveTerminalId(newTerminals[0].id);
    }
  };

  const handleOperation = async (action: ProjectAction) => {
    setLoading(action);

    try {
      let endpoint = '';

      switch (action) {
        case 'START':
          endpoint = `/api/projects/${project.id}/start`;
          break;
        case 'STOP':
          endpoint = `/api/projects/${project.id}/stop`;
          break;
        case 'DELETE':
          endpoint = `/api/projects/${project.id}/delete`;
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      await POST(endpoint);

      // For delete, redirect to projects list
      if (action === 'DELETE') {
        router.push('/projects');
        return;
      }

      // Refresh the page to show updated status
      router.refresh();
    } catch (err) {
      console.error(`Failed to ${action.toLowerCase()} project:`, err);
      // Error is logged to console, and router.refresh() will show updated status
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteDialog(false);
    handleOperation('DELETE');
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Header Bar */}
      <div className="h-9 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-between px-2">
        {/* Terminal Tabs */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors',
                activeTerminalId === terminal.id
                  ? 'bg-[#1e1e1e] text-white'
                  : 'text-gray-400 hover:bg-[#37373d]'
              )}
              onClick={() => setActiveTerminalId(terminal.id)}
            >
              <TerminalIcon className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{terminal.name}</span>
              {terminals.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(terminal.id);
                  }}
                  className="ml-1 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTerminal}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#37373d] rounded transition-colors"
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
                  onClick={() => handleOperation('START')}
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
                  onClick={() => handleOperation('STOP')}
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

      {/* Terminal Content */}
      <div className="flex-1 bg-black">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            className={cn('h-full', activeTerminalId === terminal.id ? 'block' : 'hidden')}
          >
            <TerminalWrapper
              sandboxUrl={sandbox?.publicUrl ?? undefined}
              terminalId={terminal.id}
              ttydUrl={sandbox?.ttydUrl ?? undefined}
              sandboxStatus={sandbox?.status}
            />
          </div>
        ))}
      </div>

      {/* Network Dialog */}
      <Dialog open={showNetworkDialog} onOpenChange={setShowNetworkDialog}>
        <DialogContent className="bg-[#252526] border-[#3e3e42] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network Endpoints
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              All publicly accessible endpoints for this sandbox
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {networkEndpoints.map((endpoint, index) => (
              <div key={index} className="p-3 bg-[#1e1e1e] rounded border border-[#3e3e42]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {endpoint.port === 3000 ? (
                      <Globe className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Server className="h-4 w-4 text-green-400" />
                    )}
                    <span className="text-sm font-medium">Port {endpoint.port}</span>
                  </div>
                  <span className="text-xs text-gray-400">{endpoint.protocol}</span>
                </div>
                <a
                  href={endpoint.domain}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 break-all"
                >
                  {endpoint.domain}
                </a>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowNetworkDialog(false)}
              className="w-full px-3 py-2 bg-[#0e639c] hover:bg-[#1177bb] text-white text-sm rounded transition-colors"
            >
              Close
            </button>
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
    </div>
  );
}
