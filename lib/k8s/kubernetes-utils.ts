import * as k8s from '@kubernetes/client-node'
import { customAlphabet } from 'nanoid'

import { logger as baseLogger } from '@/lib/logger'

const logger = baseLogger.child({ module: 'lib/k8s/kubernetes-utils' })

// Create nanoid generator with lowercase letters only for k8s resource name compatibility
// nanoid uses cryptographically secure random source
const nanoidLowercase = customAlphabet('abcdefghijklmnopqrstuvwxyz')

export class KubernetesUtils {
  /**
   * Get default namespace from kubeconfig
   */
  static getNamespaceFromKubeConfig(kc: k8s.KubeConfig): string {
    const currentContextName = kc.getCurrentContext()
    if (!currentContextName) {
      throw new Error('No current context found in kubeconfig')
    }
    const currentContext = kc.getContextObject(currentContextName)
    if (!currentContext || !currentContext.namespace) {
      throw new Error('No namespace found in current context')
    }

    return currentContext.namespace
  }

  /**
   * Get Ingress domain from kubeconfig server URL
   * Extracts domain from Kubernetes API server URL
   * Example: https://usw.sealos.io:6443 -> usw.sealos.io
   */
  static getIngressDomain(kc: k8s.KubeConfig): string {
    const cluster = kc.getCurrentCluster()
    if (!cluster || !cluster.server) {
      throw new Error('No cluster server found in kubeconfig')
    }

    // Parse the server URL to extract domain
    // Format: https://domain:port or https://domain
    const url = new URL(cluster.server)
    const hostname = url.hostname

    return hostname
  }

  /**
   * Generate random string with extremely low collision probability
   * Uses nanoid with lowercase letters only (k8s compatible)
   *
   * For 8 characters with 26 letters:
   * - Total combinations: 26^8 ≈ 208 billion
   * - Collision probability: ~1% after generating 1 million IDs
   *
   * @param length - Length of the random string (default: 8)
   * @returns Random string containing only lowercase letters
   */
  static generateRandomString(length: number = 8): string {
    return nanoidLowercase(length)
  }

  /**
   * Convert project name to Kubernetes compatible format
   * (lowercase, alphanumeric, hyphens)
   */
  static toK8sProjectName(projectName: string): string {
    return projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
  }

  /**
   * Validate kubeconfig string
   *
   * Checks:
   * 1. Can connect to cluster (API server version check)
   * 2. Has permissions in the configured namespace (list pods)
   *
   * @param kubeconfigStr - Kubeconfig YAML string
   * @returns Validation result with namespace if valid
   */
  static async validateKubeconfig(kubeconfigStr: string): Promise<{
    valid: boolean
    namespace?: string
    error?: string
  }> {
    try {
      // Parse kubeconfig
      const kc = new k8s.KubeConfig()
      kc.loadFromString(kubeconfigStr)

      // Extract namespace
      const currentContextName = kc.getCurrentContext()
      if (!currentContextName) {
        return {
          valid: false,
          error: 'No current context found in kubeconfig',
        }
      }

      const currentContext = kc.getContextObject(currentContextName)
      if (!currentContext || !currentContext.namespace) {
        return {
          valid: false,
          error: 'No namespace found in current context',
        }
      }

      const namespace = currentContext.namespace

      // Step 1: Verify cluster connectivity
      const versionApi = kc.makeApiClient(k8s.VersionApi)
      try {
        await versionApi.getCode()
      } catch (error) {
        logger.error(`Kubeconfig validation - cluster connection failed: ${error}`)
        return {
          valid: false,
          error: 'Failed to connect to Kubernetes cluster',
        }
      }

      // Step 2: Verify namespace permissions
      const coreV1Api = kc.makeApiClient(k8s.CoreV1Api)
      try {
        await coreV1Api.listNamespacedPod({ namespace, limit: 1 })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        logger.error(`Kubeconfig validation - namespace permission check failed: ${error}`)

        if (error.statusCode === 403) {
          return {
            valid: false,
            error: `No permission to access namespace "${namespace}"`,
          }
        }

        return {
          valid: false,
          error: `Failed to verify namespace permissions: ${error.message || 'Unknown error'}`,
        }
      }

      // Validation successful
      logger.info(`Kubeconfig validated successfully for namespace: ${namespace}`)
      return {
        valid: true,
        namespace,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      logger.error(`Kubeconfig validation - parse error: ${error}`)
      return {
        valid: false,
        error: `Invalid kubeconfig format: ${error.message || 'Parse error'}`,
      }
    }
  }

  /**
   * Extract namespace from kubeconfig string (without validation)
   *
   * @param kubeconfigStr - Kubeconfig YAML string
   * @returns Namespace or null if extraction fails
   */
  static extractNamespaceFromString(kubeconfigStr: string): string | null {
    try {
      const kc = new k8s.KubeConfig()
      kc.loadFromString(kubeconfigStr)
      return KubernetesUtils.getNamespaceFromKubeConfig(kc)
    } catch (error) {
      logger.error(`Failed to extract namespace from kubeconfig: ${error}`)
      return null
    }
  }
}
