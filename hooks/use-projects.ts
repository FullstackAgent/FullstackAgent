/**
 * Hook for fetching projects list with React Query
 *
 * Provides automatic caching, refetching, and state synchronization
 */

import { useQuery } from '@tanstack/react-query';

import { GET } from '@/lib/fetch-client';
import type { Project } from '@/types/project';

interface UseProjectsOptions {
  /** Enable automatic refetching every 3 seconds */
  refetchInterval?: number;
  /** Enable refetch on window focus */
  refetchOnWindowFocus?: boolean;
}

/**
 * Fetch projects list with automatic polling
 *
 * @param options - Query options
 * @returns Query result with projects list
 */
export function useProjects(options: UseProjectsOptions = {}) {
  const { refetchInterval = 3000, refetchOnWindowFocus = false } = options;

  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await GET<Project[]>('/api/projects');
      return data;
    },
    refetchInterval,
    refetchOnWindowFocus,
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: 2,
  });
}
