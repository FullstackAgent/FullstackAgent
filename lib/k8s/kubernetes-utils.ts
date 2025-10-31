import * as k8s from '@kubernetes/client-node'

import { logger } from '@/lib/logger'

export class KubernetesUtils {
  /**
   * 从 kubeconfig 获取默认命名空间
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
   * 从 kubeconfig 服务器 URL 获取 Ingress 域名
   * 从 Kubernetes API 服务器 URL 中提取域名
   * 示例: https://usw.sealos.io:6443 -> usw.sealos.io
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
   * 生成随机后缀 (6 个字符)
   */
  static generateRandomSuffix(): string {
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
  }

  /**
   * 生成随机名称 (默认 12 个字符)
   */
  static generateRandomName(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
  }

  /**
   * 将项目名称转换为 Kubernetes 兼容格式
   * (小写、字母数字、连字符)
   */
  static toK8sProjectName(projectName: string): string {
    return projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
  }
}
