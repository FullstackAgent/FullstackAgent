import { prisma } from '@/lib/db'
import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/repo/environment' })

/**
 * Get all environment variables for a project
 * Returns environment variables as a Record<string, string> for easy use in K8s
 *
 * @param projectId - Project ID
 * @returns Record of environment variable key-value pairs
 */
export async function getProjectEnvironments(projectId: string): Promise<Record<string, string>> {
  try {
    const environments = await prisma.environment.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Convert array to Record<string, string>
    const envVars: Record<string, string> = {}
    for (const env of environments) {
      envVars[env.key] = env.value
    }

    logger.info(`Loaded ${environments.length} environment variables for project ${projectId}`)

    return envVars
  } catch (error) {
    logger.error(`Failed to load environment variables for project ${projectId}: ${error}`)
    throw error
  }
}
