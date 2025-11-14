/**
 * Hook for fetching projects list with React Query
 *
 * Provides automatic caching, refetching, and state synchronization
 */

import type { Prisma } from '@prisma/client'
import { useQuery } from '@tanstack/react-query'

import { GET } from '@/lib/fetch-client'

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: {
    sandboxes: true
    databases: true
    environments: true
  }
}>

interface UseProjectsOptions {
  /** Enable automatic refetching every 3 seconds */
  refetchInterval?: number
  /** Enable refetch on window focus */
  refetchOnWindowFocus?: boolean
  /** Show all projects regardless of namespace */
  all?: boolean
  /** Search keyword - matches both name and description (case-insensitive partial match) */
  keyword?: string
  /** Filter by creation date - projects created from this date (inclusive) */
  createdFrom?: string | Date
  /** Filter by creation date - projects created until this date (inclusive) */
  createdTo?: string | Date
}

/**
 * Fetch projects list with automatic polling
 *
 * @param options - Query options
 * @returns Query result with projects list
 */
export function useProjects(options: UseProjectsOptions = {}) {
  const {
    refetchInterval = 3000,
    refetchOnWindowFocus = true,
    all,
    keyword,
    createdFrom,
    createdTo,
  } = options

  // Build query key for caching
  const queryKey = ['projects', all, keyword, createdFrom, createdTo]

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()

      if (all) {
        params.append('all', 'true')
      }
      if (keyword) {
        params.append('keyword', keyword)
      }
      if (createdFrom) {
        params.append(
          'createdFrom',
          createdFrom instanceof Date ? createdFrom.toISOString() : createdFrom
        )
      }
      if (createdTo) {
        params.append('createdTo', createdTo instanceof Date ? createdTo.toISOString() : createdTo)
      }

      const queryString = params.toString()
      const url = queryString ? `/api/projects?${queryString}` : '/api/projects'

      return GET<ProjectWithRelations[]>(url)
    },
    refetchInterval,
    refetchOnWindowFocus,
    staleTime: 2000, // Consider data stale after 2 seconds
    retry: 2,
  })
}
