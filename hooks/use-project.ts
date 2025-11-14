/**
 * Hook for fetching project data with React Query
 *
 * Provides automatic caching, refetching, and state synchronization
 */

import type { Prisma } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';

import { GET } from '@/lib/fetch-client';

type Project = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true;
    databases: true;
    environments: true;
  };
}>;

interface UseProjectOptions {
  /** Enable automatic refetching every 3 seconds */
  refetchInterval?: number;
  /** Enable refetch on window focus */
  refetchOnWindowFocus?: boolean;
}

/**
 * Fetch project data with automatic polling
 *
 * @param projectId - Project ID
 * @param options - Query options
 * @returns Query result with project data
 */
export function useProject(projectId: string, options: UseProjectOptions = {}) {
  const { refetchInterval = 3000, refetchOnWindowFocus = false } = options;

  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const data = await GET<Project>(`/api/projects/${projectId}`);
      return data;
    },
    refetchInterval,
    refetchOnWindowFocus,
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: 2,
  });
}