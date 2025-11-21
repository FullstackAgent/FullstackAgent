import * as k8s from '@kubernetes/client-node'

import {
  ClusterStatusDetail,
  DatabaseInfo,
  DatabaseManager,
  DatabaseStatus,
} from './database-manager'
import { KubernetesUtils } from './kubernetes-utils'
import {
  SandboxInfo,
  SandboxManager,
  SandboxStatus,
  StatefulSetStatusDetail,
} from './sandbox-manager'

/**
 * KubernetesService - Main service for managing Kubernetes resources
 *
 * This service acts as a facade that delegates operations to specialized managers:
 * - DatabaseManager: Handles KubeBlocks PostgreSQL cluster operations
 * - SandboxManager: Handles StatefulSet sandbox environment operations
 */
export class KubernetesService {
  private kc: k8s.KubeConfig
  private databaseManager: DatabaseManager
  private sandboxManager: SandboxManager
  private defaultNamespace: string

  constructor(configStr: string) {
    this.kc = new k8s.KubeConfig()
    this.kc.loadFromString(configStr)

    // Initialize managers
    this.databaseManager = new DatabaseManager(this.kc)
    this.sandboxManager = new SandboxManager(this.kc)

    // Get default namespace
    this.defaultNamespace = KubernetesUtils.getNamespaceFromKubeConfig(this.kc)
  }

  /**
   * Get default namespace
   */
  getDefaultNamespace(): string {
    return this.defaultNamespace
  }

  /**
   * Get Ingress domain from kubeconfig
   */
  getIngressDomain(): string {
    return KubernetesUtils.getIngressDomain(this.kc)
  }

  // ==================== Database Methods ====================

  /**
   * Create PostgreSQL database cluster
   *
   * @param projectName - Project name
   * @param databaseName - Database cluster name
   * @param namespace - Kubernetes namespace (optional, uses default if not provided)
   */
  async createPostgreSQLDatabase(
    projectName: string,
    databaseName: string,
    namespace?: string
  ): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.databaseManager.createPostgreSQLDatabase(projectName, namespace, databaseName)
  }

  /**
   * Stop database cluster (set replicas to 0)
   * This method is idempotent
   *
   * @param clusterName - Database cluster name
   * @param namespace - Kubernetes namespace (optional)
   */
  async stopDatabaseCluster(clusterName: string, namespace?: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.databaseManager.stopCluster(clusterName, namespace)
  }

  /**
   * Start database cluster (set replicas to 1)
   * This method is idempotent
   *
   * @param clusterName - Database cluster name
   * @param namespace - Kubernetes namespace (optional)
   */
  async startDatabaseCluster(clusterName: string, namespace?: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.databaseManager.startCluster(clusterName, namespace)
  }

  /**
   * Get database cluster status
   *
   * @param clusterName - Database cluster name
   * @param namespace - Kubernetes namespace (optional)
   * @returns Cluster status detail
   */
  async getDatabaseClusterStatus(
    clusterName: string,
    namespace?: string
  ): Promise<ClusterStatusDetail> {
    namespace = namespace || this.defaultNamespace
    return await this.databaseManager.getClusterStatus(clusterName, namespace)
  }

  /**
   * Delete database cluster and all related resources
   * This method is idempotent
   *
   * @param clusterName - Database cluster name
   * @param namespace - Kubernetes namespace (optional)
   */
  async deleteDatabaseCluster(clusterName: string, namespace?: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.databaseManager.deleteCluster(clusterName, namespace)
  }

  /**
   * Get database credentials from secret
   * Returns null if secret exists but data is not populated yet (transient state during cluster initialization)
   *
   * @param clusterName - Database cluster name
   * @param namespace - Kubernetes namespace (optional)
   * @returns Database connection information or null if not ready
   */
  async getDatabaseCredentials(
    clusterName: string,
    namespace?: string
  ): Promise<DatabaseInfo | null> {
    namespace = namespace || this.defaultNamespace
    return await this.databaseManager.getDatabaseCredentials(clusterName, namespace)
  }

  // ==================== Sandbox Methods ====================

  /**
   * Create Sandbox environment
   *
   * @param projectName - Project name
   * @param namespace - Kubernetes namespace
   * @param ingressDomain - Ingress domain (will be fetched if not provided)
   * @param sandboxName - Sandbox resource name
   * @returns Sandbox information (URLs, service names)
   */
  async createSandbox(
    projectName: string,
    namespace: string,
    sandboxName: string,
    envVars: Record<string, string> = {}
  ): Promise<SandboxInfo> {
    namespace = namespace || this.defaultNamespace
    const ingressDomain = this.getIngressDomain()

    return await this.sandboxManager.createSandbox(
      projectName,
      namespace,
      ingressDomain,
      sandboxName,
      envVars
    )
  }

  /**
   * Delete Sandbox environment
   * This method is idempotent
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox resource name
   */
  async deleteSandbox(namespace: string, sandboxName: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.sandboxManager.deleteSandbox(namespace, sandboxName)
  }

  /**
   * Get Sandbox status
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox resource name
   * @returns Sandbox status
   */
  async getSandboxStatus(namespace: string, sandboxName: string): Promise<SandboxStatus> {
    namespace = namespace || this.defaultNamespace
    return await this.sandboxManager.getSandboxStatus(namespace, sandboxName)
  }

  /**
   * Get Sandbox detailed status
   *
   * @param sandboxName - Sandbox resource name
   * @param namespace - Kubernetes namespace
   * @returns StatefulSet detailed status
   */
  async getSandboxDetailedStatus(
    sandboxName: string,
    namespace: string
  ): Promise<StatefulSetStatusDetail> {
    namespace = namespace || this.defaultNamespace
    return await this.sandboxManager.getStatefulSetStatus(sandboxName, namespace)
  }

  /**
   * Stop Sandbox (set replicas to 0)
   * This method is idempotent
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox resource name
   */
  async stopSandbox(namespace: string, sandboxName: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.sandboxManager.stopSandbox(namespace, sandboxName)
  }

  /**
   * Start Sandbox (set replicas to 1)
   * This method is idempotent
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox resource name
   */
  async startSandbox(namespace: string, sandboxName: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.sandboxManager.startSandbox(namespace, sandboxName)
  }

  /**
   * Update Sandbox environment variables
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox resource name
   * @param envVars - Environment variables to update
   * @returns Success status
   */
  async updateSandboxEnvVars(
    namespace: string,
    sandboxName: string,
    envVars: Record<string, string>
  ): Promise<boolean> {
    namespace = namespace || this.defaultNamespace

    return await this.sandboxManager.updateStatefulSetEnvVars(namespace, sandboxName, envVars)
  }

  // ==================== Utility Methods ====================

  /**
   * Get namespace from kubeconfig
   */
  getNamespaceFromKubeConfig(): string {
    return KubernetesUtils.getNamespaceFromKubeConfig(this.kc)
  }

  /**
   * Get current working directory of a terminal session in sandbox
   *
   * Delegates to SandboxManager for execution
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox StatefulSet name
   * @param sessionId - Terminal session ID (from TERMINAL_SESSION_ID env var)
   * @returns Current working directory info
   */
  async getSandboxCurrentDirectory(
    namespace: string,
    sandboxName: string,
    sessionId: string
  ): Promise<{ cwd: string; homeDir: string; isInHome: boolean }> {
    namespace = namespace || this.defaultNamespace
    return await this.sandboxManager.getSandboxCurrentDirectory(namespace, sandboxName, sessionId)
  }
}

// Re-export types for convenience
export type { ClusterStatusDetail, DatabaseInfo, DatabaseStatus }
export type { SandboxInfo, SandboxStatus, StatefulSetStatusDetail }
