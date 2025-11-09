/**
 * Hook for fetching projects list with React Query
 *
 * Provides automatic caching, refetching, and state synchronization
 */

import type { Project } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';

import { GET } from '@/lib/fetch-client';

interface UseProjectsOptions {
  /** Enable automatic refetching every 3 seconds */
  refetchInterval?: number;
  /** Enable refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Optional namespace filter (for Sealos environment) */
  namespace?: string | null;
}

/**
 * Fetch projects list with automatic polling
 *
 * @param options - Query options
 * @returns Query result with projects list
 */
export function useProjects(options: UseProjectsOptions = {}) {
  const { refetchInterval = 3000, refetchOnWindowFocus = false, namespace } = options;

  return useQuery({
    queryKey: ['projects', namespace],
    queryFn: async () => {
      const url = namespace
        ? `/api/projects?namespace=${encodeURIComponent(namespace)}`
        : '/api/projects';
      return GET<Project[]>(url);
    },
    refetchInterval,
    refetchOnWindowFocus,
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: 2,
  });
}
