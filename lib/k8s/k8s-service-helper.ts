import type { Session } from 'next-auth'

import { prisma } from '@/lib/db'

import { KubernetesService } from './kubernetes'
import { k8sServiceFactory } from './kubernetes-service-factory'

/**
 * Get Kubernetes service instance for a user
 *
 * Automatically fetches user's kubeconfig from database and returns
 * cached service instance from factory.
 *
 * @param userId - User ID
 * @returns KubernetesService instance
 * @throws Error if user doesn't have KUBECONFIG configured
 */
export async function getK8sServiceForUser(userId: string): Promise<KubernetesService> {
  // Fetch user's kubeconfig from UserConfig table
  const kubeconfigEntry = await prisma.userConfig.findUnique({
    where: {
      userId_key: {
        userId,
        key: 'KUBECONFIG',
      },
    },
  })

  if (!kubeconfigEntry) {
    throw new Error(`User [${userId}] does not have KUBECONFIG configured`)
  }

  // Get service from factory (automatically cached and reused)
  const service = k8sServiceFactory.getService(userId, kubeconfigEntry.value)

  return service
}

/**
 * Get Kubernetes service with automatic user ID extraction from session
 *
 * This is a convenience function for use in API routes.
 *
 * @param session - NextAuth session object
 * @returns KubernetesService instance
 * @throws Error if session is invalid or user doesn't have kubeconfig
 */
export async function getK8sServiceFromSession(
  session: Session | null
): Promise<KubernetesService> {
  if (!session?.user?.id) {
    throw new Error('Invalid session: user ID not found')
  }

  return await getK8sServiceForUser(session.user.id)
}

/**
 * Check if user has kubeconfig configured
 *
 * @param userId - User ID
 * @returns True if user has KUBECONFIG configured
 */
export async function userHasKubeconfig(userId: string): Promise<boolean> {
  const count = await prisma.userConfig.count({
    where: {
      userId,
      key: 'KUBECONFIG',
    },
  })

  return count > 0
}

/**
 * Update user's kubeconfig
 *
 * This will automatically clear the cached service instance,
 * forcing a new instance to be created on next access.
 *
 * @param userId - User ID
 * @param kubeconfigContent - New kubeconfig content
 */
export async function updateUserKubeconfig(
  userId: string,
  kubeconfigContent: string
): Promise<void> {
  // Update in database
  await prisma.userConfig.upsert({
    where: {
      userId_key: {
        userId,
        key: 'KUBECONFIG',
      },
    },
    create: {
      userId,
      key: 'KUBECONFIG',
      value: kubeconfigContent,
      category: 'kc',
      isSecret: true,
    },
    update: {
      value: kubeconfigContent,
      updatedAt: new Date(),
    },
  })

  // Clear cached service (will be recreated with new config on next access)
  k8sServiceFactory.clearUserService(userId)
}

/**
 * Delete user's kubeconfig and clear cached service
 *
 * @param userId - User ID
 */
export async function deleteUserKubeconfig(userId: string): Promise<void> {
  // Delete from database
  await prisma.userConfig.deleteMany({
    where: {
      userId,
      key: 'KUBECONFIG',
    },
  })

  // Clear cached service
  k8sServiceFactory.clearUserService(userId)
}

/**
 * Get user's kubeconfig content (if needed for direct access)
 *
 * @param userId - User ID
 * @returns Kubeconfig content string or null if not found
 */
export async function getUserKubeconfigContent(userId: string): Promise<string | null> {
  const config = await prisma.userConfig.findUnique({
    where: {
      userId_key: {
        userId,
        key: 'KUBECONFIG',
      },
    },
  })

  return config?.value || null
}
