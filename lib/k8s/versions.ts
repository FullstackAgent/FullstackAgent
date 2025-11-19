import { env } from '@/lib/env'
/**
 * Version configuration for container images and dependencies
 * IMPORTANT: Always use specific version tags to ensure consistency
 */

export const VERSIONS = {
  // Runtime container image version - now using centralized version
  RUNTIME_IMAGE: env.RUNTIME_IMAGE || 'docker.io/limbo2342/fullstack-web-runtime:sha-ca2470e',

  // PostgreSQL version for KubeBlocks
  POSTGRESQL_VERSION: 'postgresql-14.8.0',
  POSTGRESQL_DEFINITION: 'postgresql',

  // Resource limits for containers
  RESOURCES: {
    SANDBOX: {
      requests: {
        cpu: '20m',
        memory: '25Mi',
      },
      limits: {
        cpu: '2000m',
        memory: '4096Mi',
      },
    },
    DATABASE: {
      requests: {
        cpu: '100m',
        memory: '102Mi',
      },
      limits: {
        cpu: '1000m',
        memory: '1024Mi',
      },
    },
  },

  // Storage configuration
  STORAGE: {
    DATABASE_SIZE: '3Gi',
    SANDBOX_SIZE: '10Gi',
    STORAGE_CLASS: 'openebs-backup',
  },
} as const
