import * as k8s from '@kubernetes/client-node'
import { customAlphabet } from 'nanoid'

// import { logger as baseLogger } from '@/lib/logger'

// const logger = baseLogger.child({ module: 'lib/k8s/kubernetes-utils' })

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
}
