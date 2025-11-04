'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Square, Trash2, Loader2, AlertCircle } from 'lucide-react';
import type { Project, Database, Sandbox } from '@prisma/client';

import { Button } from '@/components/ui/button';
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
import { getAvailableProjectActions, type ProjectAction } from '@/lib/utils/action';
import { cn } from '@/lib/utils';
import { POST } from '@/lib/fetch-client';

interface ProjectOperationsProps {
  project: Project & {
    databases: Pick<Database, 'status'>[];
    sandboxes: Pick<Sandbox, 'status'>[];
  };
}

export default function ProjectOperations({ project }: ProjectOperationsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<ProjectAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get available actions based on current status
  const availableActions = getAvailableProjectActions(project);

  const handleOperation = async (action: ProjectAction) => {
    setLoading(action);
    setError(null);

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
      setError(err instanceof Error ? err.message : `Failed to ${action.toLowerCase()} project`);
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
    <div className="flex items-center gap-2">
      {/* Project Status Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#2d2d30] border border-[#3e3e42]">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
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
        <span className="text-xs text-gray-300">{project.status}</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-900/20 border border-red-800 text-red-400 text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}

      {/* Start Button */}
      {availableActions.includes('START') && (
        <Button
          onClick={() => handleOperation('START')}
          disabled={loading !== null}
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {loading === 'START' ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="mr-2 h-3 w-3" />
              Start
            </>
          )}
        </Button>
      )}

      {/* Stop Button */}
      {availableActions.includes('STOP') && (
        <Button
          onClick={() => handleOperation('STOP')}
          disabled={loading !== null}
          size="sm"
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          {loading === 'STOP' ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Stopping...
            </>
          ) : (
            <>
              <Square className="mr-2 h-3 w-3" />
              Stop
            </>
          )}
        </Button>
      )}

      {/* Delete Button */}
      {availableActions.includes('DELETE') && (
        <Button
          onClick={handleDeleteClick}
          disabled={loading !== null}
          size="sm"
          variant="destructive"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {loading === 'DELETE' ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-3 w-3" />
              Delete
            </>
          )}
        </Button>
      )}

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
