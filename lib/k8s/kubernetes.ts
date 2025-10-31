import * as k8s from '@kubernetes/client-node'

import { DatabaseInfo, DatabaseManager } from './database-manager'
import { KubernetesUtils } from './kubernetes-utils'
import { SandboxInfo, SandboxManager, SandboxStatus } from './sandbox-manager'

export class KubernetesService {
  private kc: k8s.KubeConfig
  private databaseManager: DatabaseManager
  private sandboxManager: SandboxManager
  private defaultNamespace: string

  constructor(configStr: string) {
    this.kc = new k8s.KubeConfig()
    this.kc.loadFromString(configStr)

    // 初始化管理器
    this.databaseManager = new DatabaseManager(this.kc)
    this.sandboxManager = new SandboxManager(this.kc)

    // 获取默认命名空间
    this.defaultNamespace = KubernetesUtils.getNamespaceFromKubeConfig(this.kc)
  }

  /**
   * 获取默认命名空间
   */
  getDefaultNamespace(): string {
    return this.defaultNamespace
  }

  /**
   * 获取 Ingress 域名
   */
  getIngressDomain(): string {
    return KubernetesUtils.getIngressDomain(this.kc)
  }

  // ==================== 数据库相关方法 ====================

  /**
   * 创建 PostgreSQL 数据库
   */
  async createPostgreSQLDatabase(projectName: string, namespace?: string): Promise<DatabaseInfo> {
    namespace = namespace || this.defaultNamespace
    const randomSuffix = KubernetesUtils.generateRandomSuffix()

    return await this.databaseManager.createPostgreSQLDatabase(projectName, namespace, randomSuffix)
  }

  /**
   * 等待数据库就绪
   */
  async waitForDatabaseReady(
    clusterName: string,
    namespace?: string,
    timeoutMs: number = 120000
  ): Promise<boolean> {
    namespace = namespace || this.defaultNamespace
    return await this.databaseManager.waitForDatabaseReady(clusterName, namespace, timeoutMs)
  }

  /**
   * 获取数据库密钥
   */
  async getDatabaseSecret(projectName: string, namespace?: string): Promise<DatabaseInfo> {
    namespace = namespace || this.defaultNamespace
    return await this.databaseManager.getDatabaseSecret(projectName, namespace)
  }

  // ==================== Sandbox 相关方法 ====================

  /**
   * 创建 Sandbox
   */
  async createSandbox(
    projectName: string,
    envVars: Record<string, string>,
    namespace?: string,
    databaseInfo?: DatabaseInfo
  ): Promise<SandboxInfo> {
    namespace = namespace || this.defaultNamespace
    const randomSuffix = KubernetesUtils.generateRandomSuffix()
    const ingressDomain = this.getIngressDomain()

    return await this.sandboxManager.createSandbox(
      projectName,
      envVars,
      namespace,
      ingressDomain,
      randomSuffix,
      databaseInfo
    )
  }

  /**
   * 删除 Sandbox
   */
  async deleteSandbox(projectName: string, namespace?: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.sandboxManager.deleteSandbox(projectName, namespace)
  }

  /**
   * 获取 Sandbox 状态
   */
  async getSandboxStatus(projectName: string, namespace?: string): Promise<SandboxStatus> {
    namespace = namespace || this.defaultNamespace
    return await this.sandboxManager.getSandboxStatus(projectName, namespace)
  }

  /**
   * 停止 Sandbox
   */
  async stopSandbox(projectName: string, namespace?: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.sandboxManager.stopSandbox(projectName, namespace)
  }

  /**
   * 启动 Sandbox
   */
  async startSandbox(projectName: string, namespace?: string): Promise<void> {
    namespace = namespace || this.defaultNamespace
    await this.sandboxManager.startSandbox(projectName, namespace)
  }

  /**
   * 更新 StatefulSet 环境变量
   */
  async updateStatefulSetEnvVars(
    projectName: string,
    namespace: string,
    envVars: Record<string, string>
  ): Promise<boolean> {
    namespace = namespace || this.defaultNamespace

    return await this.sandboxManager.updateStatefulSetEnvVars(
      projectName,
      namespace,
      envVars,
      // 传递 getDatabaseSecret 方法的引用
      (pName: string, ns: string) => this.getDatabaseSecret(pName, ns)
    )
  }

  // ==================== 工具方法 ====================

  /**
   * 从 kubeconfig 获取命名空间
   */
  getNamespaceFromKubeConfig(): string {
    return KubernetesUtils.getNamespaceFromKubeConfig(this.kc)
  }

  /**
   * 生成随机后缀
   * @deprecated 请使用 KubernetesUtils.generateRandomSuffix()
   */
  private generateRandomSuffix(): string {
    return KubernetesUtils.generateRandomSuffix()
  }

  /**
   * 生成随机名称
   * @deprecated 请使用 KubernetesUtils.generateRandomName()
   */
  private generateRandomName(length: number = 12): string {
    return KubernetesUtils.generateRandomName(length)
  }
}

// 保持向后兼容
export const k8sService = new KubernetesService('')
