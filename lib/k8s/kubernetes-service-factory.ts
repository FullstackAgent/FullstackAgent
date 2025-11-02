import crypto from 'crypto'

import { logger as baseLogger } from '@/lib/logger'

import { KubernetesService } from './kubernetes'

const logger = baseLogger.child({ module: 'lib/k8s/kubernetes-service-factory' })

/**
 * Cache entry for Kubernetes service instances
 */
interface ServiceCacheEntry {
  service: KubernetesService
  lastAccessed: number
  accessCount: number
  kubeconfigHash: string
}

/**
 * Pool statistics
 */
export interface PoolStats {
  size: number
  maxSize: number
  entries: Array<{
    userId: string
    lastAccessed: string
    accessCount: number
    ageMs: number
  }>
}

/**
 * Factory configuration options
 */
export interface FactoryConfig {
  maxPoolSize?: number // Maximum pool size (default: 100)
  ttl?: number // Time-to-live in milliseconds (default: 30 minutes)
  cleanupInterval?: number // Cleanup interval in milliseconds (default: 5 minutes)
}

/**
 * KubernetesServiceFactory - Service Factory + Connection Pool Pattern
 *
 * Features:
 * - Maintains independent service instances for each user
 * - Automatic caching and reuse of instances
 * - LRU eviction when pool is full
 * - TTL-based expiration
 * - Automatic cleanup task
 * - Thread-safe operations
 *
 * Usage:
 * ```typescript
 * const factory = KubernetesServiceFactory.getInstance()
 * const service = factory.getService(userId, kubeconfigContent)
 * await service.createPostgreSQLDatabase('my-project', 'my-db')
 * ```
 */
export class KubernetesServiceFactory {
  private static instance: KubernetesServiceFactory

  private servicePool: Map<string, ServiceCacheEntry> = new Map()

  // Configuration
  private maxPoolSize: number = 100 // Max 100 concurrent user services
  private ttl: number = 30 * 60 * 1000 // 30 minutes TTL
  private cleanupInterval: number = 15 * 60 * 1000 // Cleanup every 15 minutes

  private cleanupTimer: NodeJS.Timeout | null = null

  private constructor() {
    this.startCleanupTask()
    logger.info('KubernetesServiceFactory initialized')
  }

  /**
   * Get factory singleton instance
   */
  public static getInstance(): KubernetesServiceFactory {
    if (!KubernetesServiceFactory.instance) {
      KubernetesServiceFactory.instance = new KubernetesServiceFactory()
    }
    return KubernetesServiceFactory.instance
  }

  /**
   * Get or create Kubernetes service instance for a user
   *
   * @param userId - User ID (for cache key)
   * @param kubeconfigContent - Kubeconfig content string
   * @returns KubernetesService instance (cached or new)
   */
  public getService(userId: string, kubeconfigContent: string): KubernetesService {
    const kubeconfigHash = this.hashKubeconfig(kubeconfigContent)
    const cacheKey = this.generateCacheKey(userId, kubeconfigHash)

    // Check if cached instance exists
    const cached = this.servicePool.get(cacheKey)

    if (cached) {
      // Check if kubeconfig has changed
      if (cached.kubeconfigHash !== kubeconfigHash) {
        logger.info(`Kubeconfig changed for user [${userId}], creating new service instance`)
        this.servicePool.delete(cacheKey)
        return this.createNewService(userId, kubeconfigContent, kubeconfigHash, cacheKey)
      }

      // Update access metadata
      cached.lastAccessed = Date.now()
      cached.accessCount++
      logger.debug(
        `Reusing cached service for user [${userId}] (access count: ${cached.accessCount})`
      )
      return cached.service
    }

    // Create new instance
    return this.createNewService(userId, kubeconfigContent, kubeconfigHash, cacheKey)
  }

  /**
   * Create new service instance and add to pool
   */
  private createNewService(
    userId: string,
    kubeconfigContent: string,
    kubeconfigHash: string,
    cacheKey: string
  ): KubernetesService {
    // Check pool size limit
    if (this.servicePool.size >= this.maxPoolSize) {
      logger.warn(`Pool size limit reached (${this.maxPoolSize}), evicting oldest entry`)
      this.evictOldestEntry()
    }

    logger.info(`Creating new service instance for user [${userId}]`)

    const service = new KubernetesService(kubeconfigContent)

    this.servicePool.set(cacheKey, {
      service,
      lastAccessed: Date.now(),
      accessCount: 1,
      kubeconfigHash,
    })

    return service
  }

  /**
   * Generate cache key from userId and kubeconfig hash
   */
  private generateCacheKey(userId: string, kubeconfigHash: string): string {
    return `${userId}:${kubeconfigHash}`
  }

  /**
   * Hash kubeconfig content using SHA-256
   */
  private hashKubeconfig(kubeconfigContent: string): string {
    return crypto.createHash('sha256').update(kubeconfigContent).digest('hex').substring(0, 16)
  }

  /**
   * Evict the oldest (least recently accessed) entry from pool
   */
  private evictOldestEntry(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, value] of this.servicePool.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.servicePool.delete(oldestKey)
      logger.info(`Evicted oldest service instance: ${oldestKey}`)
    }
  }

  /**
   * Clean up expired service instances based on TTL
   */
  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, value] of this.servicePool.entries()) {
      if (now - value.lastAccessed > this.ttl) {
        this.servicePool.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired service instance(s)`)
    }
  }

  /**
   * Start automatic cleanup task
   */
  private startCleanupTask(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.cleanupInterval)

    logger.debug(`Cleanup task started (interval: ${this.cleanupInterval}ms)`)
  }

  /**
   * Stop cleanup task
   */
  public stopCleanupTask(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
      logger.info('Cleanup task stopped')
    }
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): PoolStats {
    const entries = Array.from(this.servicePool.entries()).map(([key, value]) => {
      const userId = key.split(':')[0]
      return {
        userId,
        lastAccessed: new Date(value.lastAccessed).toISOString(),
        accessCount: value.accessCount,
        ageMs: Date.now() - value.lastAccessed,
      }
    })

    return {
      size: this.servicePool.size,
      maxSize: this.maxPoolSize,
      entries,
    }
  }

  /**
   * Clear service instance(s) for a specific user
   *
   * @param userId - User ID
   * @returns Number of instances cleared
   */
  public clearUserService(userId: string): number {
    let cleared = 0

    for (const [key] of this.servicePool.entries()) {
      if (key.startsWith(`${userId}:`)) {
        this.servicePool.delete(key)
        cleared++
      }
    }

    if (cleared > 0) {
      logger.info(`Cleared ${cleared} service instance(s) for user [${userId}]`)
    }

    return cleared
  }

  /**
   * Clear all service instances from pool
   */
  public clearAll(): void {
    const size = this.servicePool.size
    this.servicePool.clear()
    logger.info(`Cleared all ${size} service instance(s) from pool`)
  }

  /**
   * Configure factory options
   *
   * @param options - Factory configuration options
   */
  public configure(options: FactoryConfig): void {
    if (options.maxPoolSize !== undefined) {
      this.maxPoolSize = options.maxPoolSize
      logger.info(`Updated maxPoolSize to ${this.maxPoolSize}`)
    }

    if (options.ttl !== undefined) {
      this.ttl = options.ttl
      logger.info(`Updated TTL to ${this.ttl}ms`)
    }

    if (options.cleanupInterval !== undefined) {
      this.cleanupInterval = options.cleanupInterval
      logger.info(`Updated cleanup interval to ${this.cleanupInterval}ms`)

      // Restart cleanup task with new interval
      this.startCleanupTask()
    }
  }

  /**
   * Check if pool contains service for specific user
   *
   * @param userId - User ID
   * @returns True if user has cached service instance
   */
  public hasUserService(userId: string): boolean {
    for (const [key] of this.servicePool.entries()) {
      if (key.startsWith(`${userId}:`)) {
        return true
      }
    }
    return false
  }

  /**
   * Get number of service instances for a specific user
   *
   * @param userId - User ID
   * @returns Count of cached instances
   */
  public getUserServiceCount(userId: string): number {
    let count = 0
    for (const [key] of this.servicePool.entries()) {
      if (key.startsWith(`${userId}:`)) {
        count++
      }
    }
    return count
  }
}

/**
 * Global factory instance (singleton)
 */
export const k8sServiceFactory = KubernetesServiceFactory.getInstance()
