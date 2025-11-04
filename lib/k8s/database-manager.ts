import * as k8s from '@kubernetes/client-node'

import { logger as baseLogger } from '@/lib/logger'

import { isK8sNotFound } from './k8s-error-utils'
import { KubernetesUtils } from './kubernetes-utils'
import { VERSIONS } from './versions'

const logger = baseLogger.child({ module: 'lib/k8s/database-manager' })

/**
 * Database status type matching Prisma ResourceStatus enum
 * Note: CREATING state is managed at DB level, not K8s level
 */
export type DatabaseStatus =
  | 'STARTING' // Cluster starting up (Creating, Updating phase)
  | 'RUNNING' // Cluster is fully operational
  | 'STOPPING' // Cluster is stopping (Stopping phase or replicas scaling to 0)
  | 'STOPPED' // Cluster is stopped (Stopped phase or replicas = 0)
  | 'TERMINATING' // Cluster is being deleted (Deleting phase)
  | 'TERMINATED' // Cluster doesn't exist
  | 'ERROR' // Cluster in failed or abnormal state

export interface DatabaseInfo {
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  clusterName: string
}

export interface ClusterStatusDetail {
  status: DatabaseStatus
  phase?: string // Raw KubeBlocks phase
  message?: string // Status message from cluster
  replicas: number // Current replica count
  observedGeneration?: number
}

// Type definitions for KubeBlocks Cluster CRD
interface KubeBlocksClusterSpec {
  affinity: {
    nodeLabels: Record<string, string>
    podAntiAffinity: string
    tenancy: string
    topologyKeys: string[]
  }
  clusterDefinitionRef: string
  clusterVersionRef: string
  componentSpecs: Array<{
    componentDefRef: string
    monitor: boolean
    name: string
    noCreatePDB: boolean
    replicas: number
    resources: {
      requests: { cpu: string; memory: string }
      limits: { cpu: string; memory: string }
    }
    serviceAccountName: string
    switchPolicy: { type: string }
    volumeClaimTemplates: Array<{
      name: string
      spec: {
        accessModes: string[]
        resources: { requests: { storage: string } }
        storageClassName: string
      }
    }>
  }>
  terminationPolicy: string
  tolerations: unknown[]
}

interface KubeBlocksClusterStatus {
  phase?:
    | 'Creating'
    | 'Running'
    | 'Updating'
    | 'Stopping'
    | 'Stopped'
    | 'Deleting'
    | 'Failed'
    | 'Abnormal'
  message?: string
  observedGeneration?: number
  components?: Record<string, unknown>
}

interface KubeBlocksCluster {
  apiVersion: string
  kind: string
  metadata: k8s.V1ObjectMeta
  spec: KubeBlocksClusterSpec
  status?: KubeBlocksClusterStatus
}

export class DatabaseManager {
  private kc: k8s.KubeConfig
  private k8sApi: k8s.CoreV1Api
  private customObjectsApi: k8s.CustomObjectsApi
  private rbacApi: k8s.RbacAuthorizationV1Api

  constructor(kubeConfig: k8s.KubeConfig) {
    this.kc = kubeConfig
    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api)
    this.customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi)
    this.rbacApi = this.kc.makeApiClient(k8s.RbacAuthorizationV1Api)
  }

  // ==================== Public Methods ====================

  /**
   * Create PostgreSQL database cluster
   */
  async createPostgreSQLDatabase(
    projectName: string,
    namespace: string,
    databaseName: string
  ): Promise<void> {
    // Convert project name to k8s-compatible format
    const k8sProjectName = KubernetesUtils.toK8sProjectName(projectName)

    // 1. Create ServiceAccount
    await this.createServiceAccount(databaseName, k8sProjectName, namespace)

    // 2. Create Role
    await this.createRole(databaseName, k8sProjectName, namespace)

    // 3. Create RoleBinding
    await this.createRoleBinding(databaseName, k8sProjectName, namespace)

    // 4. Create KubeBlocks Cluster
    await this.createCluster(databaseName, k8sProjectName, namespace)
  }

  /**
   * Stop database cluster (set replicas to 0)
   * This method is idempotent and can be called repeatedly
   */
  async stopCluster(clusterName: string, namespace: string): Promise<void> {
    const cluster = await this.getCluster(clusterName, namespace)

    if (!cluster) {
      logger.warn(`Cluster not found (already deleted or never existed): ${clusterName}`)
      return // Idempotent: don't throw error if cluster doesn't exist
    }

    // Check current replicas in the first component spec
    const componentSpec = cluster.spec.componentSpecs?.[0]
    if (!componentSpec) {
      logger.warn(`Cluster '${clusterName}' has no componentSpecs`)
      return
    }

    const currentReplicas = componentSpec.replicas || 0

    if (currentReplicas === 0) {
      logger.info(`Cluster '${clusterName}' is already stopped (replicas = 0)`)
      return // Idempotent: skip patch operation if already stopped
    }

    try {
      // Patch the cluster to set replicas to 0
      // Use JSON Patch format (array of operations)
      await this.customObjectsApi.patchNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace,
        plural: 'clusters',
        name: clusterName,
        body: [
          {
            op: 'replace',
            path: '/spec/componentSpecs/0/replicas',
            value: 0,
          },
        ],
      })

      logger.info(`✅ Cluster '${clusterName}' stopped (replicas set to 0)`)
    } catch (error) {
      logger.error(
        `stopCluster: failed patching cluster=${clusterName} ns=${namespace}: ${String(error)}`
      )
      throw error
    }
  }

  /**
   * Start database cluster (set replicas to 1)
   * This method is idempotent and can be called repeatedly
   */
  async startCluster(clusterName: string, namespace: string): Promise<void> {
    const cluster = await this.getCluster(clusterName, namespace)

    if (!cluster) {
      logger.warn(`Cluster not found (already deleted or never existed): ${clusterName}`)
      return // Idempotent: don't throw error if cluster doesn't exist
    }

    // Check current replicas in the first component spec
    const componentSpec = cluster.spec.componentSpecs?.[0]
    if (!componentSpec) {
      logger.warn(`Cluster '${clusterName}' has no componentSpecs`)
      return
    }

    const currentReplicas = componentSpec.replicas || 0

    if (currentReplicas >= 1) {
      logger.info(`Cluster '${clusterName}' is already running (replicas = ${currentReplicas})`)
      return // Idempotent: skip patch operation if already running
    }

    try {
      // Patch the cluster to set replicas to 1
      // Use JSON Patch format (array of operations)
      await this.customObjectsApi.patchNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace,
        plural: 'clusters',
        name: clusterName,
        body: [
          {
            op: 'replace',
            path: '/spec/componentSpecs/0/replicas',
            value: 1,
          },
        ],
      })

      logger.info(`✅ Cluster '${clusterName}' started (replicas set to 1)`)
    } catch (error) {
      logger.error(
        `startCluster: failed patching cluster=${clusterName} ns=${namespace}: ${String(error)}`
      )
      throw error
    }
  }

  /**
   * Get database cluster status
   * Determines status based on KubeBlocks cluster.status.phase and replicas
   */
  async getClusterStatus(clusterName: string, namespace: string): Promise<ClusterStatusDetail> {
    const cluster = await this.getCluster(clusterName, namespace)

    if (!cluster) {
      return {
        status: 'TERMINATED',
        replicas: 0,
      }
    }

    const phase = cluster.status?.phase
    const message = cluster.status?.message
    const observedGeneration = cluster.status?.observedGeneration
    const componentSpec = cluster.spec.componentSpecs?.[0]
    const replicas = componentSpec?.replicas || 0

    let status: DatabaseStatus

    // Map KubeBlocks phase to our DatabaseStatus
    switch (phase) {
      case 'Running':
        status = 'RUNNING'
        break

      case 'Creating':
        status = 'STARTING'
        break

      case 'Updating':
        // Updating phase occurs when replicas change (0→1 or 1→0)
        // Check replicas to determine if starting or stopping
        if (replicas === 0) {
          status = 'STOPPING' // Scaling down to 0
        } else {
          status = 'STARTING' // Scaling up from 0 or updating config
        }
        break

      case 'Stopping':
        status = 'STOPPING'
        break

      case 'Stopped':
        status = 'STOPPED'
        break

      case 'Deleting':
        status = 'TERMINATING'
        break

      case 'Failed':
      case 'Abnormal':
        status = 'ERROR'
        break

      default:
        // If phase is undefined or unknown, check replicas
        if (replicas === 0) {
          status = 'STOPPED'
        } else {
          status = 'STARTING'
        }
        break
    }

    logger.info(
      `📊 Cluster '${clusterName}' status: ${status} (phase: ${phase || 'unknown'}, replicas: ${replicas})`
    )

    return {
      status,
      phase,
      message,
      replicas,
      observedGeneration,
    }
  }

  /**
   * Delete database cluster and all related resources
   * This method is idempotent and can be called repeatedly
   */
  async deleteCluster(clusterName: string, namespace: string): Promise<void> {
    logger.info(`🗑️ Deleting database cluster '${clusterName}' and all related resources...`)

    // Delete resources in parallel for better performance
    // Note: We don't throw errors if resources don't exist (idempotent)
    const results = await Promise.allSettled([
      this.deleteKubeBlocksCluster(clusterName, namespace),
      this.deleteRoleBinding(clusterName, namespace),
      this.deleteRole(clusterName, namespace),
      this.deleteServiceAccount(clusterName, namespace),
    ])

    // Log any errors but don't throw (idempotent behavior)
    results.forEach((result, index) => {
      const resourceNames = ['Cluster', 'RoleBinding', 'Role', 'ServiceAccount']
      if (result.status === 'rejected') {
        logger.warn(`Failed to delete ${resourceNames[index]} '${clusterName}': ${result.reason}`)
      }
    })

    logger.info(`✅ Database cluster '${clusterName}' deletion completed`)
  }

  /**
   * Get database credentials
   * Returns null if secret exists but data is not populated yet (transient state during cluster initialization)
   */
  async getDatabaseCredentials(
    clusterName: string,
    namespace: string
  ): Promise<DatabaseInfo | null> {
    const dbInfo: DatabaseInfo = {
      clusterName,
    }

    try {
      const secretName = `${clusterName}-conn-credential`
      const response = await this.k8sApi.readNamespacedSecret({ name: secretName, namespace })

      // In @kubernetes/client-node v1.4.0, the response is HttpInfo<V1Secret>
      // However, for readNamespacedSecret, response.data is already the secret's data field
      // (not the full V1Secret object with metadata)
      const secretData = this.getK8sData<Record<string, string>>(response)

      if (!secretData || typeof secretData !== 'object' || Object.keys(secretData).length === 0) {
        // Secret exists but data not populated yet by KubeBlocks
        // This is a transient state during cluster initialization - return null to signal not ready
        logger.warn(
          `Secret ${secretName} exists but data not populated yet (KubeBlocks still initializing)`
        )
        return null
      }

      // Helper function to safely decode base64 values
      const decodeSecretValue = (key: string): string | undefined => {
        const value = secretData[key]
        return value ? Buffer.from(value, 'base64').toString('utf-8') : undefined
      }

      // Decode base64 encoded secret values
      // KubeBlocks secret structure: host, port, username, password
      // Note: KubeBlocks doesn't include database name in secret, use clusterName instead
      dbInfo.host = decodeSecretValue('host')
      const portStr = decodeSecretValue('port')
      dbInfo.port = portStr ? parseInt(portStr, 10) : undefined
      dbInfo.username = decodeSecretValue('username')
      dbInfo.password = decodeSecretValue('password')
      // Database name is the cluster name (Database.databaseName)
      dbInfo.database = clusterName

      logger.info(
        `✅ Retrieved credentials for cluster '${clusterName}' (fields: host=${Boolean(
          dbInfo.host
        )}, port=${Boolean(dbInfo.port)}, database=${Boolean(dbInfo.database)}, username=${Boolean(
          dbInfo.username
        )}, password=${Boolean(dbInfo.password)})`
      )
    } catch (error) {
      logger.error(
        `getDatabaseCredentials: failed reading secret for cluster='${clusterName}' ns=${namespace}: ${String(
          error
        )}`
      )
      throw error
    }

    return dbInfo
  }

  // ==================== Private Methods ====================

  /**
   * Get KubeBlocks Cluster object (internal method)
   */
  private async getCluster(
    clusterName: string,
    namespace: string
  ): Promise<KubeBlocksCluster | null> {
    try {
      const response = await this.customObjectsApi.getNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace,
        plural: 'clusters',
        name: clusterName,
      })

      // In @kubernetes/client-node v1.4.0, the response is HttpInfo<T>
      // The actual data is in response.data property
      const data =
        (response as { data?: unknown; body?: unknown }).data ??
        (response as { data?: unknown; body?: unknown }).body ??
        (response as unknown)

      return data as KubeBlocksCluster
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.warn(`getCluster: 404 NotFound for ${clusterName} in ns=${namespace}`)
        return null
      }
      logger.error(`getCluster: error fetching ${clusterName} in ns=${namespace}: ${String(error)}`)
      throw error
    }
  }

  /**
   * Create ServiceAccount (idempotent - skips if already exists)
   */
  private async createServiceAccount(
    clusterName: string,
    k8sProjectName: string,
    namespace: string
  ): Promise<void> {
    // Check if ServiceAccount already exists
    try {
      await this.k8sApi.readNamespacedServiceAccount({
        name: clusterName,
        namespace,
      })
      logger.info(`ServiceAccount '${clusterName}' already exists, skipping creation`)
      return
    } catch (error) {
      if (!isK8sNotFound(error)) {
        logger.error(
          `createServiceAccount: failed to check existence sa=${clusterName} ns=${namespace}: ${String(error)}`
        )
        throw error
      }
      // 404 means doesn't exist, continue to create
    }

    const serviceAccount: k8s.V1ServiceAccount = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        labels: {
          'sealos-db-provider-cr': clusterName,
          'app.kubernetes.io/instance': clusterName,
          'app.kubernetes.io/managed-by': 'kbcli',
          'project.fullstackagent.io/name': k8sProjectName,
        },
        name: clusterName,
        namespace,
      },
    }

    try {
      await this.k8sApi.createNamespacedServiceAccount({
        namespace,
        body: serviceAccount,
      })
      logger.info(`✅ ServiceAccount '${clusterName}' created`)
    } catch (error) {
      logger.error(
        `createServiceAccount: failed creating sa=${clusterName} ns=${namespace}: ${String(error)}`
      )
      throw error
    }
  }

  /**
   * Create Role (idempotent - skips if already exists)
   */
  private async createRole(
    clusterName: string,
    k8sProjectName: string,
    namespace: string
  ): Promise<void> {
    // Check if Role already exists
    try {
      await this.rbacApi.readNamespacedRole({ name: clusterName, namespace })
      logger.info(`Role '${clusterName}' already exists, skipping creation`)
      return
    } catch (error) {
      if (!isK8sNotFound(error)) {
        logger.error(
          `createRole: failed to check role=${clusterName} ns=${namespace}: ${String(error)}`
        )
        throw error
      }
      // 404 means doesn't exist, continue to create
    }

    const role: k8s.V1Role = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        labels: {
          'sealos-db-provider-cr': clusterName,
          'app.kubernetes.io/instance': clusterName,
          'app.kubernetes.io/managed-by': 'kbcli',
          'project.fullstackagent.io/name': k8sProjectName,
        },
        name: clusterName,
        namespace,
      },
      rules: [
        {
          apiGroups: ['*'],
          resources: ['*'],
          verbs: ['*'],
        },
      ],
    }

    try {
      await this.rbacApi.createNamespacedRole({ namespace, body: role })
      logger.info(`✅ Role '${clusterName}' created`)
    } catch (error) {
      logger.error(
        `createRole: failed creating role=${clusterName} ns=${namespace}: ${String(error)}`
      )
      throw error
    }
  }

  /**
   * Create RoleBinding (idempotent - skips if already exists)
   */
  private async createRoleBinding(
    clusterName: string,
    k8sProjectName: string,
    namespace: string
  ): Promise<void> {
    // Check if RoleBinding already exists
    try {
      await this.rbacApi.readNamespacedRoleBinding({
        name: clusterName,
        namespace,
      })
      logger.info(`RoleBinding '${clusterName}' already exists, skipping creation`)
      return
    } catch (error) {
      if (!isK8sNotFound(error)) {
        logger.error(
          `createRoleBinding: failed to check rb=${clusterName} ns=${namespace}: ${String(error)}`
        )
        throw error
      }
      // 404 means doesn't exist, continue to create
    }

    const roleBinding: k8s.V1RoleBinding = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        labels: {
          'sealos-db-provider-cr': clusterName,
          'app.kubernetes.io/instance': clusterName,
          'app.kubernetes.io/managed-by': 'kbcli',
          'project.fullstackagent.io/name': k8sProjectName,
        },
        name: clusterName,
        namespace,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: clusterName,
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: clusterName,
          namespace,
        },
      ],
    }

    try {
      await this.rbacApi.createNamespacedRoleBinding({
        namespace,
        body: roleBinding,
      })
      logger.info(`✅ RoleBinding '${clusterName}' created`)
    } catch (error) {
      logger.error(
        `createRoleBinding: failed creating rb=${clusterName} ns=${namespace}: ${String(error)}`
      )
      throw error
    }
  }

  /**
   * Create KubeBlocks Cluster (idempotent - skips if already exists)
   */
  private async createCluster(
    clusterName: string,
    k8sProjectName: string,
    namespace: string
  ): Promise<void> {
    // Check if Cluster already exists
    const existingCluster = await this.getCluster(clusterName, namespace)
    if (existingCluster) {
      logger.info(`KubeBlocks Cluster '${clusterName}' already exists, skipping creation`)
      return
    }

    const cluster: KubeBlocksCluster = {
      apiVersion: 'apps.kubeblocks.io/v1alpha1',
      kind: 'Cluster',
      metadata: {
        finalizers: ['cluster.kubeblocks.io/finalizer'],
        labels: {
          'clusterdefinition.kubeblocks.io/name': VERSIONS.POSTGRESQL_DEFINITION,
          'clusterversion.kubeblocks.io/name': VERSIONS.POSTGRESQL_VERSION,
          'sealos-db-provider-cr': clusterName,
          'project.fullstackagent.io/name': k8sProjectName,
        },
        annotations: {},
        name: clusterName,
        namespace,
      },
      spec: {
        affinity: {
          nodeLabels: {},
          podAntiAffinity: 'Preferred',
          tenancy: 'SharedNode',
          topologyKeys: ['kubernetes.io/hostname'],
        },
        clusterDefinitionRef: VERSIONS.POSTGRESQL_DEFINITION,
        clusterVersionRef: VERSIONS.POSTGRESQL_VERSION,
        componentSpecs: [
          {
            componentDefRef: 'postgresql',
            monitor: true,
            name: 'postgresql',
            noCreatePDB: false,
            replicas: 1,
            resources: VERSIONS.RESOURCES.DATABASE,
            serviceAccountName: clusterName,
            switchPolicy: {
              type: 'Noop',
            },
            volumeClaimTemplates: [
              {
                name: 'data',
                spec: {
                  accessModes: ['ReadWriteOnce'],
                  resources: {
                    requests: {
                      storage: VERSIONS.STORAGE.DATABASE_SIZE,
                    },
                  },
                  storageClassName: VERSIONS.STORAGE.STORAGE_CLASS,
                },
              },
            ],
          },
        ],
        terminationPolicy: 'Delete',
        tolerations: [],
      },
    }

    try {
      await this.customObjectsApi.createNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace,
        plural: 'clusters',
        body: cluster,
      })
      logger.info(`✅ KubeBlocks Cluster '${clusterName}' created`)
    } catch (error) {
      logger.error(
        `createCluster: failed creating cluster=${clusterName} ns=${namespace}: ${String(error)}`
      )
      throw error
    }
  }

  /**
   * Delete KubeBlocks Cluster (private method)
   */
  private async deleteKubeBlocksCluster(clusterName: string, namespace: string): Promise<void> {
    try {
      // Check if cluster is already being deleted
      const cluster = await this.getCluster(clusterName, namespace)

      if (!cluster) {
        logger.info(`Cluster '${clusterName}' not found (already deleted)`)
        return // Idempotent
      }

      const phase = cluster.status?.phase

      if (phase === 'Deleting') {
        logger.info(
          `Cluster '${clusterName}' is already in Deleting phase, skipping duplicate delete request`
        )
        return // Idempotent - already being deleted
      }

      // Proceed with deletion
      await this.customObjectsApi.deleteNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace,
        plural: 'clusters',
        name: clusterName,
      })
      logger.info(`✅ KubeBlocks Cluster '${clusterName}' deletion initiated`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.info(`Cluster '${clusterName}' not found (already deleted)`)
        return // Idempotent
      }
      throw error
    }
  }

  /**
   * Delete RoleBinding (private method)
   */
  private async deleteRoleBinding(clusterName: string, namespace: string): Promise<void> {
    try {
      await this.rbacApi.deleteNamespacedRoleBinding({
        name: clusterName,
        namespace,
      })
      logger.info(`✅ RoleBinding '${clusterName}' deleted`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.info(`RoleBinding '${clusterName}' not found (already deleted)`)
        return // Idempotent
      }
      throw error
    }
  }

  /**
   * Delete Role (private method)
   */
  private async deleteRole(clusterName: string, namespace: string): Promise<void> {
    try {
      await this.rbacApi.deleteNamespacedRole({ name: clusterName, namespace })
      logger.info(`✅ Role '${clusterName}' deleted`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.info(`Role '${clusterName}' not found (already deleted)`)
        return // Idempotent
      }
      throw error
    }
  }

  /**
   * Delete ServiceAccount (private method)
   */
  private async deleteServiceAccount(clusterName: string, namespace: string): Promise<void> {
    try {
      await this.k8sApi.deleteNamespacedServiceAccount({
        name: clusterName,
        namespace,
      })
      logger.info(`✅ ServiceAccount '${clusterName}' deleted`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.info(`ServiceAccount '${clusterName}' not found (already deleted)`)
        return // Idempotent
      }
      throw error
    }
  }

  // ==================== Internal helpers ====================

  /**
   * Extract payload from HttpInfo<T> or return original object
   */
  private getK8sData<T>(res: unknown): T {
    const anyRes = res as { data?: unknown; body?: unknown }
    return (anyRes?.data ?? anyRes?.body ?? (res as unknown)) as T
  }
}
