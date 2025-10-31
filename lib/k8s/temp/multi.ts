import * as k8s from '@kubernetes/client-node'

import { DatabaseManager } from './database-manager'
import { KubernetesService } from './kubernetes-service-refactored'
import { SandboxManager } from './sandbox-manager'

/**
 * 方案 1: 服务工厂 + 连接池模式（推荐）
 *
 * 特点:
 * - 为每个用户维护独立的服务实例
 * - 自动缓存和复用实例
 * - 支持实例过期和清理
 * - 线程安全
 */
export class KubernetesServiceFactory {
  private static instance: KubernetesServiceFactory
  private servicePool: Map<
    string,
    {
      service: KubernetesService
      lastAccessed: number
      accessCount: number
    }
  > = new Map()

  // 配置选项
  private maxPoolSize: number = 100 // 最大连接池大小
  private ttl: number = 30 * 60 * 1000 // 30 分钟过期
  private cleanupInterval: number = 5 * 60 * 1000 // 5 分钟清理一次

  private constructor() {
    // 启动定期清理
    this.startCleanupTask()
  }

  /**
   * 获取工厂单例
   */
  public static getInstance(): KubernetesServiceFactory {
    if (!KubernetesServiceFactory.instance) {
      KubernetesServiceFactory.instance = new KubernetesServiceFactory()
    }
    return KubernetesServiceFactory.instance
  }

  /**
   * 根据用户获取或创建服务实例
   * @param userId 用户 ID（用于标识和缓存）
   * @param kubeconfigContent kubeconfig 内容
   * @returns KubernetesService 实例
   */
  public getService(userId: string, kubeconfigContent: string): KubernetesService {
    const cacheKey = this.generateCacheKey(userId, kubeconfigContent)

    // 检查缓存
    const cached = this.servicePool.get(cacheKey)
    if (cached) {
      // 更新访问时间和计数
      cached.lastAccessed = Date.now()
      cached.accessCount++
      console.log(`♻️  复用服务实例 [${userId}] (访问次数: ${cached.accessCount})`)
      return cached.service
    }

    // 检查池大小限制
    if (this.servicePool.size >= this.maxPoolSize) {
      this.evictOldestEntry()
    }

    // 创建新实例
    console.log(`🆕 创建新服务实例 [${userId}]`)
    const service = new KubernetesService(kubeconfigContent)

    this.servicePool.set(cacheKey, {
      service,
      lastAccessed: Date.now(),
      accessCount: 1,
    })

    return service
  }

  /**
   * 生成缓存键
   * 使用用户 ID + kubeconfig hash 作为唯一标识
   */
  private generateCacheKey(userId: string, kubeconfigContent: string): string {
    // 简单的 hash 函数（生产环境建议使用 crypto.createHash）
    const hash = this.simpleHash(kubeconfigContent)
    return `${userId}:${hash}`
  }

  /**
   * 简单的字符串 hash
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 移除最旧的条目
   */
  private evictOldestEntry() {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, value] of this.servicePool.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      console.log(`🗑️  移除最旧的服务实例: ${oldestKey}`)
      this.servicePool.delete(oldestKey)
    }
  }

  /**
   * 清理过期的服务实例
   */
  private cleanup() {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, value] of this.servicePool.entries()) {
      if (now - value.lastAccessed > this.ttl) {
        this.servicePool.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 个过期的服务实例`)
    }
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTask() {
    setInterval(() => {
      this.cleanup()
    }, this.cleanupInterval)
  }

  /**
   * 获取池状态
   */
  public getPoolStats() {
    return {
      size: this.servicePool.size,
      maxSize: this.maxPoolSize,
      entries: Array.from(this.servicePool.entries()).map(([key, value]) => ({
        key,
        lastAccessed: new Date(value.lastAccessed).toISOString(),
        accessCount: value.accessCount,
        age: Date.now() - value.lastAccessed,
      })),
    }
  }

  /**
   * 手动清除特定用户的服务实例
   */
  public clearUserService(userId: string) {
    let cleared = 0
    for (const [key] of this.servicePool.entries()) {
      if (key.startsWith(`${userId}:`)) {
        this.servicePool.delete(key)
        cleared++
      }
    }
    console.log(`🗑️  清除了用户 [${userId}] 的 ${cleared} 个服务实例`)
  }

  /**
   * 清空整个连接池
   */
  public clearAll() {
    const size = this.servicePool.size
    this.servicePool.clear()
    console.log(`🗑️  清空了所有 ${size} 个服务实例`)
  }

  /**
   * 配置连接池参数
   */
  public configure(options: { maxPoolSize?: number; ttl?: number; cleanupInterval?: number }) {
    if (options.maxPoolSize) this.maxPoolSize = options.maxPoolSize
    if (options.ttl) this.ttl = options.ttl
    if (options.cleanupInterval) this.cleanupInterval = options.cleanupInterval
  }
}

/**
 * 方案 2: 上下文传递模式
 *
 * 特点:
 * - 不维护状态，每次都传递 kubeconfig
 * - 适合无状态服务
 * - 简单直接，无缓存开销
 */
export class StatelessKubernetesService {
  /**
   * 创建数据库（无状态）
   */
  static async createPostgreSQLDatabase(
    kubeconfigContent: string,
    projectName: string,
    namespace?: string
  ) {
    const service = new KubernetesService(kubeconfigContent)
    return await service.createPostgreSQLDatabase(projectName, namespace)
  }

  /**
   * 创建 Sandbox（无状态）
   */
  static async createSandbox(
    kubeconfigContent: string,
    projectName: string,
    envVars: Record<string, string>,
    namespace?: string,
    databaseInfo?: any
  ) {
    const service = new KubernetesService(kubeconfigContent)
    return await service.createSandbox(projectName, envVars, namespace, databaseInfo)
  }

  /**
   * 获取 Sandbox 状态（无状态）
   */
  static async getSandboxStatus(
    kubeconfigContent: string,
    projectName: string,
    namespace?: string
  ) {
    const service = new KubernetesService(kubeconfigContent)
    return await service.getSandboxStatus(projectName, namespace)
  }

  /**
   * 删除 Sandbox（无状态）
   */
  static async deleteSandbox(kubeconfigContent: string, projectName: string, namespace?: string) {
    const service = new KubernetesService(kubeconfigContent)
    return await service.deleteSandbox(projectName, namespace)
  }

  // 其他方法类似...
}

/**
 * 方案 3: 多租户管理器模式
 *
 * 特点:
 * - 为每个租户提供独立的管理器
 * - 支持租户级别的配置和隔离
 * - 适合 SaaS 多租户场景
 */
export class MultiTenantKubernetesManager {
  private tenants: Map<
    string,
    {
      service: KubernetesService
      metadata: {
        createdAt: number
        kubeconfigHash: string
      }
    }
  > = new Map()

  /**
   * 注册租户
   */
  public registerTenant(tenantId: string, kubeconfigContent: string) {
    console.log(`📝 注册租户 [${tenantId}]`)

    const service = new KubernetesService(kubeconfigContent)
    const kubeconfigHash = this.hashConfig(kubeconfigContent)

    this.tenants.set(tenantId, {
      service,
      metadata: {
        createdAt: Date.now(),
        kubeconfigHash,
      },
    })
  }

  /**
   * 更新租户配置
   */
  public updateTenant(tenantId: string, kubeconfigContent: string) {
    const existing = this.tenants.get(tenantId)
    const newHash = this.hashConfig(kubeconfigContent)

    // 只有在配置真正变化时才更新
    if (existing && existing.metadata.kubeconfigHash === newHash) {
      console.log(`ℹ️  租户 [${tenantId}] 配置未变化，跳过更新`)
      return
    }

    console.log(`🔄 更新租户 [${tenantId}] 配置`)
    this.registerTenant(tenantId, kubeconfigContent)
  }

  /**
   * 获取租户的服务实例
   */
  public getTenantService(tenantId: string): KubernetesService {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) {
      throw new Error(`租户 [${tenantId}] 未注册`)
    }
    return tenant.service
  }

  /**
   * 移除租户
   */
  public removeTenant(tenantId: string) {
    console.log(`🗑️  移除租户 [${tenantId}]`)
    this.tenants.delete(tenantId)
  }

  /**
   * 获取所有租户
   */
  public getAllTenants(): string[] {
    return Array.from(this.tenants.keys())
  }

  /**
   * 租户是否存在
   */
  public hasTenant(tenantId: string): boolean {
    return this.tenants.has(tenantId)
  }

  /**
   * hash 配置内容
   */
  private hashConfig(config: string): string {
    let hash = 0
    for (let i = 0; i < config.length; i++) {
      const char = config.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 获取租户统计信息
   */
  public getStats() {
    return {
      totalTenants: this.tenants.size,
      tenants: Array.from(this.tenants.entries()).map(([id, tenant]) => ({
        tenantId: id,
        createdAt: new Date(tenant.metadata.createdAt).toISOString(),
        age: Date.now() - tenant.metadata.createdAt,
      })),
    }
  }
}

/**
 * 方案 4: 请求级别的上下文模式（适合 Web 框架）
 *
 * 特点:
 * - 与 Express/Koa 等框架集成
 * - 在请求上下文中传递 kubeconfig
 * - 自动处理用户认证
 */
export class KubernetesRequestContext {
  private kubeconfigContent: string
  private userId: string
  private service: KubernetesService | null = null

  constructor(userId: string, kubeconfigContent: string) {
    this.userId = userId
    this.kubeconfigContent = kubeconfigContent
  }

  /**
   * 获取服务实例（延迟初始化）
   */
  private getService(): KubernetesService {
    if (!this.service) {
      this.service = new KubernetesService(this.kubeconfigContent)
    }
    return this.service
  }

  /**
   * 创建数据库
   */
  async createDatabase(projectName: string, namespace?: string) {
    console.log(`[${this.userId}] 创建数据库: ${projectName}`)
    return await this.getService().createPostgreSQLDatabase(projectName, namespace)
  }

  /**
   * 创建 Sandbox
   */
  async createSandbox(
    projectName: string,
    envVars: Record<string, string>,
    namespace?: string,
    databaseInfo?: any
  ) {
    console.log(`[${this.userId}] 创建 Sandbox: ${projectName}`)
    return await this.getService().createSandbox(projectName, envVars, namespace, databaseInfo)
  }

  /**
   * 获取状态
   */
  async getStatus(projectName: string, namespace?: string) {
    return await this.getService().getSandboxStatus(projectName, namespace)
  }

  /**
   * 删除 Sandbox
   */
  async deleteSandbox(projectName: string, namespace?: string) {
    console.log(`[${this.userId}] 删除 Sandbox: ${projectName}`)
    return await this.getService().deleteSandbox(projectName, namespace)
  }

  /**
   * 获取用户 ID
   */
  getUserId(): string {
    return this.userId
  }
}

// ============================================
// 便利导出
// ============================================

/**
 * 获取全局服务工厂实例（推荐使用）
 */
export const k8sFactory = KubernetesServiceFactory.getInstance()

/**
 * 创建多租户管理器实例
 */
export function createMultiTenantManager(): MultiTenantKubernetesManager {
  return new MultiTenantKubernetesManager()
}

/**
 * 创建请求上下文
 */
export function createRequestContext(
  userId: string,
  kubeconfigContent: string
): KubernetesRequestContext {
  return new KubernetesRequestContext(userId, kubeconfigContent)
}
