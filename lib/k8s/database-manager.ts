import * as k8s from '@kubernetes/client-node'

import { VERSIONS } from './config/versions'

export interface DatabaseInfo {
  host: string
  port: number
  database: string
  username: string
  password: string
  clusterName: string
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

  /**
   * 创建 PostgreSQL 数据库集群
   */
  async createPostgreSQLDatabase(
    projectName: string,
    namespace: string,
    randomSuffix: string
  ): Promise<DatabaseInfo> {
    // Convert project name to k8s-compatible format
    const k8sProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
    const clusterName = `${k8sProjectName}-agentruntime-${randomSuffix}`

    // 1. Create ServiceAccount
    await this.createServiceAccount(clusterName, k8sProjectName, namespace)

    // 2. Create Role
    await this.createRole(clusterName, k8sProjectName, namespace)

    // 3. Create RoleBinding
    await this.createRoleBinding(clusterName, k8sProjectName, namespace)

    // 4. Create KubeBlocks Cluster
    await this.createCluster(clusterName, k8sProjectName, namespace)

    // Wait for the cluster to be ready
    console.log(`⏳ Waiting for database cluster '${clusterName}' to be ready...`)
    const isReady = await this.waitForDatabaseReady(clusterName, namespace)

    if (isReady) {
      return await this.getDatabaseCredentials(clusterName, namespace)
    }

    // Fallback: return default connection info
    console.log(
      `⚠️ Database cluster '${clusterName}' not ready yet, returning default connection info`
    )
    return this.getDefaultDatabaseInfo(clusterName, namespace)
  }

  /**
   * 创建 ServiceAccount
   */
  private async createServiceAccount(
    clusterName: string,
    k8sProjectName: string,
    namespace: string
  ) {
    const serviceAccount = {
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

    await this.k8sApi.createNamespacedServiceAccount({ namespace, body: serviceAccount as any })
  }

  /**
   * 创建 Role
   */
  private async createRole(clusterName: string, k8sProjectName: string, namespace: string) {
    const role = {
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

    await this.rbacApi.createNamespacedRole({ namespace, body: role as any })
  }

  /**
   * 创建 RoleBinding
   */
  private async createRoleBinding(clusterName: string, k8sProjectName: string, namespace: string) {
    const roleBinding = {
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
        },
      ],
    }

    await this.rbacApi.createNamespacedRoleBinding({ namespace, body: roleBinding as any })
  }

  /**
   * 创建 KubeBlocks Cluster
   */
  private async createCluster(clusterName: string, k8sProjectName: string, namespace: string) {
    const cluster = {
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

    await this.customObjectsApi.createNamespacedCustomObject({
      group: 'apps.kubeblocks.io',
      version: 'v1alpha1',
      namespace: namespace,
      plural: 'clusters',
      body: cluster,
    })
  }

  /**
   * 等待数据库集群就绪
   */
  async waitForDatabaseReady(
    clusterName: string,
    namespace: string,
    timeoutMs: number = 120000
  ): Promise<boolean> {
    const startTime = Date.now()

    console.log(`⏳ Waiting for database cluster '${clusterName}' to be ready...`)

    while (Date.now() - startTime < timeoutMs) {
      try {
        const cluster = await this.customObjectsApi.getNamespacedCustomObject({
          group: 'apps.kubeblocks.io',
          version: 'v1alpha1',
          namespace: namespace,
          plural: 'clusters',
          name: clusterName,
        })

        const clusterObj = cluster.body || cluster
        const status = (clusterObj as any)?.status?.phase

        console.log(`📊 Cluster '${clusterName}' status: ${status}`)

        if (status === 'Running') {
          // Check if the connection secret exists
          const secretName = `${clusterName}-conn-credential`
          try {
            await this.k8sApi.readNamespacedSecret({ name: secretName, namespace })
            console.log(`✅ Database cluster '${clusterName}' is ready with credentials`)
            return true
          } catch (secretError) {
            console.log(`⏳ Cluster running but credentials not ready yet...`)
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error) {
        console.log(`⏳ Cluster not found yet, continuing to wait...`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }

    console.log(`⚠️ Timeout waiting for database cluster '${clusterName}' to be ready`)
    return false
  }

  /**
   * 获取数据库凭据
   */
  private async getDatabaseCredentials(
    clusterName: string,
    namespace: string
  ): Promise<DatabaseInfo> {
    try {
      const secretName = `${clusterName}-conn-credential`
      const secret = await this.k8sApi.readNamespacedSecret({ name: secretName, namespace })

      const secretData = (secret as any).body?.data || (secret as any).data
      if (!secretData) {
        throw new Error(`Secret ${secretName} has no data`)
      }

      const dbInfo: DatabaseInfo = {
        host: secretData['host']
          ? Buffer.from(secretData['host'], 'base64').toString()
          : `${clusterName}-postgresql.${namespace}.svc.cluster.local`,
        port: secretData['port']
          ? parseInt(Buffer.from(secretData['port'], 'base64').toString())
          : 5432,
        database: secretData['database']
          ? Buffer.from(secretData['database'], 'base64').toString()
          : 'postgres',
        username: secretData['username']
          ? Buffer.from(secretData['username'], 'base64').toString()
          : 'postgres',
        password: secretData['password']
          ? Buffer.from(secretData['password'], 'base64').toString()
          : 'postgres',
        clusterName,
      }

      console.log(`✅ Database cluster '${clusterName}' created and ready`)
      return dbInfo
    } catch (error) {
      console.error(`Failed to get credentials for cluster '${clusterName}':`, error)
      throw error
    }
  }

  /**
   * 获取默认数据库连接信息
   */
  private getDefaultDatabaseInfo(clusterName: string, namespace: string): DatabaseInfo {
    return {
      host: `${clusterName}-postgresql.${namespace}.svc.cluster.local`,
      port: 5432,
      database: 'postgres',
      username: 'postgres',
      password: 'postgres',
      clusterName,
    }
  }

  /**
   * 根据项目名称获取数据库密钥信息
   */
  async getDatabaseSecret(projectName: string, namespace: string): Promise<DatabaseInfo> {
    const k8sProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
    console.log(`🔍 Getting database secret for project: ${projectName} (k8s: ${k8sProjectName})`)

    try {
      const clusters = await this.customObjectsApi.listNamespacedCustomObject({
        group: 'apps.kubeblocks.io',
        version: 'v1alpha1',
        namespace: namespace,
        plural: 'clusters',
      })

      const clusterList = clusters.body || clusters
      const clusterItems = (clusterList as any)?.items || []

      console.log(
        `🗄️ KubeBlocks clusters response:`,
        clusters.body ? 'has body property' : 'no body property',
        clusterItems.length,
        'items'
      )

      if (!Array.isArray(clusterItems)) {
        throw new Error(`Invalid API response: expected items array, got ${typeof clusterItems}`)
      }

      // Try different naming patterns
      let projectCluster = clusterItems.find((cluster: any) =>
        cluster?.metadata?.name?.startsWith(`${k8sProjectName}-agentruntime-`)
      )

      if (!projectCluster) {
        projectCluster = clusterItems.find(
          (cluster: any) => cluster?.metadata?.name === k8sProjectName
        )
      }

      if (!projectCluster && projectName !== k8sProjectName) {
        projectCluster = clusterItems.find(
          (cluster: any) => cluster?.metadata?.name === projectName
        )
      }

      if (!projectCluster) {
        const availableClusters = clusterItems.map((c: any) => c?.metadata?.name).join(', ')
        throw new Error(
          `No database cluster found for project ${projectName}. Available: ${availableClusters}`
        )
      }

      const clusterName = projectCluster.metadata.name

      // Try to get credentials from secret
      try {
        return await this.getDatabaseCredentials(clusterName, namespace)
      } catch (secretError) {
        // Fallback to default connection info
        return this.getDefaultDatabaseInfo(clusterName, namespace)
      }
    } catch (error) {
      throw new Error(`Failed to get database secret: ${error}`)
    }
  }
}
