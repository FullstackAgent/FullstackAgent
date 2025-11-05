'use client';

import { useEffect, useState } from 'react';
import type { Prisma } from '@prisma/client';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Play,
  Square,
  Trash2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import ProjectTerminalView from '@/components/project-terminal-view';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GET, POST } from '@/lib/fetch-client';
import { cn } from '@/lib/utils';
import { getAvailableProjectActions, type ProjectAction } from '@/lib/utils/action';

type Project = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true
    databases: true
  }
}>

export default function TerminalPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch project data
  const fetchProject = async () => {
    try {
      const data = await GET<Project>(`/api/projects/${projectId}`);
      setProject(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  // Initial load and polling
  useEffect(() => {
    // Initial fetch
    fetchProject();

    // Polling: refresh every 3 seconds
    const interval = setInterval(() => {
      fetchProject();
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-400">Loading project...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-12 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="ml-2 text-sm text-red-400">{error || 'Project not found'}</span>
        </div>
      </div>
    );
  }

  const sandbox = project.sandboxes[0];

  return (
    <div className="flex flex-col h-full">
      {/* Conditional Terminal View based on Project Status (aggregated) */}
      <div className="flex-1 min-h-0">
        {project.status === 'RUNNING' && sandbox ? (
          <ProjectTerminalView sandbox={sandbox} project={project} />
        ) : (
          <StatusTransitionView status={project.status} project={project} />
        )}
      </div>
    </div>
  );
}

interface StatusTransitionViewProps {
  status: string;
  project: Project;
}

function StatusTransitionView({ status, project }: StatusTransitionViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<ProjectAction | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const availableActions = getAvailableProjectActions(project);

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

      if (action === 'DELETE') {
        router.push('/projects');
        return;
      }

      router.refresh();
    } catch (err) {
      console.error(`Failed to ${action.toLowerCase()} project:`, err);
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

  // Get status message and icon
  let message = '';
  let showSpinner = false;

  switch (status) {
    case 'CREATING':
      message = 'Creating sandbox...';
      showSpinner = true;
      break;
    case 'STARTING':
      message = 'Starting sandbox...';
      showSpinner = true;
      break;
    case 'STOPPED':
      message = 'Sandbox stopped';
      showSpinner = false;
      break;
    case 'STOPPING':
      message = 'Stopping sandbox...';
      showSpinner = true;
      break;
    case 'TERMINATING':
      message = 'Terminating sandbox...';
      showSpinner = true;
      break;
    case 'ERROR':
      message = 'Sandbox error';
      showSpinner = false;
      break;
    default:
      message = `Status: ${status}`;
      showSpinner = true;
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Header Bar with Operations */}
      <div className="h-9 bg-[#2d2d30] border-b border-[#3e3e42] flex items-center justify-end px-2">
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

      {/* Status Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {showSpinner ? (
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
          ) : status === 'ERROR' ? (
            <AlertCircle className="h-8 w-8 text-gray-400" />
          ) : null}
          <p className="text-sm text-gray-400">{message}</p>
        </div>
      </div>

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
