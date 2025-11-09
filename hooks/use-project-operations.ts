/**
 * Hook for managing project operations (start, stop, delete)
 *
 * Provides a unified interface for project lifecycle management
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { POST } from '@/lib/fetch-client';
import type { ProjectAction } from '@/lib/util/action';

interface UseProjectOperationsReturn {
  /** Execute a project operation */
  executeOperation: (action: ProjectAction) => Promise<void>;
  /** Currently executing operation */
  loading: ProjectAction | null;
  /** Error message if operation failed */
  error: string | null;
}

/**
 * Hook for project operations
 *
 * @param projectId - Project ID
 * @returns Operation controls and state
 */
export function useProjectOperations(projectId: string): UseProjectOperationsReturn {
  const router = useRouter();
  const [loading, setLoading] = useState<ProjectAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeOperation = async (action: ProjectAction) => {
    setLoading(action);
    setError(null);

    try {
      let endpoint = '';

      switch (action) {
        case 'START':
          endpoint = `/api/projects/${projectId}/start`;
          break;
        case 'STOP':
          endpoint = `/api/projects/${projectId}/stop`;
          break;
        case 'DELETE':
          endpoint = `/api/projects/${projectId}/delete`;
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
      const errorMessage = `Failed to ${action.toLowerCase()} project`;
      console.error(errorMessage, err);
      setError(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  return {
    executeOperation,
    loading,
    error,
  };
}