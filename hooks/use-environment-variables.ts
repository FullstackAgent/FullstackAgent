/**
 * Hook for managing environment variables with React Query
 * Provides loading, mutation, and caching for environment variables
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { DELETE, FetchError, GET, POST, PUT } from '@/lib/fetch-client'

/**
 * Extract user-friendly error message from FetchError
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof FetchError && error.body && typeof error.body === 'object') {
    const body = error.body as { error?: string }
    if (body.error) {
      return body.error
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unknown error occurred'
}

export interface EnvironmentVariable {
  id?: string
  key: string
  value: string
  category?: string
  isSecret?: boolean
}

export interface GroupedEnvironmentVariables {
  auth: EnvironmentVariable[]
  payment: EnvironmentVariable[]
  ttyd: EnvironmentVariable[]
  general: EnvironmentVariable[]
  secret: EnvironmentVariable[]
}

/**
 * Fetch environment variables for a project
 */
export function useEnvironmentVariables(projectId: string) {
  return useQuery({
    queryKey: ['environmentVariables', projectId],
    queryFn: async () => {
      const data = await GET<GroupedEnvironmentVariables>(`/api/projects/${projectId}/environment`)
      return data
    },
    staleTime: 5000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Add or update environment variable
 */
export function useUpsertEnvironmentVariable(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variable: EnvironmentVariable) => {
      if (variable.id) {
        // Update existing
        return await PUT(`/api/projects/${projectId}/environment/${variable.id}`, {
          value: variable.value,
        })
      } else {
        // Create new
        return await POST(`/api/projects/${projectId}/environment`, variable)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environmentVariables', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Environment variable saved')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Delete environment variable
 */
export function useDeleteEnvironmentVariable(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (variableId: string) => {
      await DELETE(`/api/projects/${projectId}/environment/${variableId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environmentVariables', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Environment variable deleted')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Batch update environment variables for a category
 */
export function useBatchUpdateEnvironmentVariables(projectId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { category: string; variables: EnvironmentVariable[] }) => {
      return await POST(`/api/projects/${projectId}/environment`, {
        variables: params.variables.map((v) => ({
          key: v.key,
          value: v.value,
          category: params.category,
          isSecret: v.isSecret || false,
        })),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environmentVariables', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })
}
