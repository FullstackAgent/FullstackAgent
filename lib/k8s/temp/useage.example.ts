/**
 * 使用示例 - 展示如何使用重构后的 Kubernetes Service
 */

import * as k8s from '@kubernetes/client-node'
import * as fs from 'fs'

import { DatabaseManager } from './database-manager'
import { KubernetesService } from './kubernetes-service-refactored'
import { KubernetesUtils } from './kubernetes-utils'
import { SandboxManager } from './sandbox-manager'

// ============================================
// 示例 1: 基本使用 - 通过主服务类
// ============================================

async function example1_BasicUsage() {
  console.log('示例 1: 基本使用')

  // 读取 kubeconfig
  const kubeconfigContent = fs.readFileSync('.secret/kubeconfig', 'utf-8')

  // 创建服务实例
  const k8sService = new KubernetesService(kubeconfigContent)

  // 获取默认命名空间
  const namespace = k8sService.getDefaultNamespace()
  console.log(`默认命名空间: ${namespace}`)

  // 获取 Ingress 域名
  const domain = k8sService.getIngressDomain()
  console.log(`Ingress 域名: ${domain}`)
}

// ============================================
// 示例 2: 创建完整的项目环境
// ============================================

async function example2_CreateFullEnvironment() {
  console.log('示例 2: 创建完整的项目环境')

  const kubeconfigContent = fs.readFileSync('.secret/kubeconfig', 'utf-8')
  const k8sService = new KubernetesService(kubeconfigContent)

  const projectName = 'my-awesome-project'

  try {
    // 步骤 1: 创建数据库
    console.log('创建数据库...')
    const dbInfo = await k8sService.createPostgreSQLDatabase(projectName)
    console.log('数据库创建成功:', {
      host: dbInfo.host,
      port: dbInfo.port,
      database: dbInfo.database,
      clusterName: dbInfo.clusterName,
    })

    // 步骤 2: 创建 Sandbox
    console.log('创建 Sandbox...')
    const sandboxInfo = await k8sService.createSandbox(
      projectName,
      {
        MY_CUSTOM_VAR: 'custom-value',
        DEBUG: 'true',
      },
      undefined, // 使用默认命名空间
      dbInfo // 传递数据库信息
    )
    console.log('Sandbox 创建成功:', {
      statefulSet: sandboxInfo.statefulSetName,
      service: sandboxInfo.serviceName,
      appUrl: sandboxInfo.publicUrl,
      terminalUrl: sandboxInfo.ttydUrl,
    })

    // 步骤 3: 检查状态
    console.log('检查 Sandbox 状态...')
    const status = await k8sService.getSandboxStatus(projectName)
    console.log('Sandbox 状态:', status)

    // 等待 Sandbox 就绪
    while ((await k8sService.getSandboxStatus(projectName)) === 'CREATING') {
      console.log('等待 Sandbox 就绪...')
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    console.log('项目环境创建完成!')
    console.log(`访问应用: ${sandboxInfo.publicUrl}`)
    console.log(`访问终端: ${sandboxInfo.ttydUrl}`)
  } catch (error) {
    console.error('创建环境失败:', error)
    throw error
  }
}

// ============================================
// 示例 3: 管理现有项目
// ============================================

async function example3_ManageExistingProject() {
  console.log('示例 3: 管理现有项目')

  const kubeconfigContent = fs.readFileSync('.secret/kubeconfig', 'utf-8')
  const k8sService = new KubernetesService(kubeconfigContent)

  const projectName = 'my-awesome-project'

  try {
    // 获取项目状态
    const status = await k8sService.getSandboxStatus(projectName)
    console.log('当前状态:', status)

    if (status === 'RUNNING') {
      // 停止项目
      console.log('停止项目...')
      await k8sService.stopSandbox(projectName)
      console.log('项目已停止')
    } else if (status === 'STOPPED') {
      // 启动项目
      console.log('启动项目...')
      await k8sService.startSandbox(projectName)
      console.log('项目已启动')
    } else if (status === 'TERMINATED') {
      console.log('项目不存在')
    }

    // 更新环境变量
    console.log('更新环境变量...')
    await k8sService.updateStatefulSetEnvVars(projectName, k8sService.getDefaultNamespace(), {
      NEW_VAR: 'new-value',
      UPDATED_VAR: 'updated-value',
    })
    console.log('环境变量已更新')
  } catch (error) {
    console.error('管理项目失败:', error)
    throw error
  }
}

// ============================================
// 示例 4: 删除项目
// ============================================

async function example4_DeleteProject() {
  console.log('示例 4: 删除项目')

  const kubeconfigContent = fs.readFileSync('.secret/kubeconfig', 'utf-8')
  const k8sService = new KubernetesService(kubeconfigContent)

  const projectName = 'my-awesome-project'

  try {
    // 删除 Sandbox
    console.log('删除 Sandbox...')
    await k8sService.deleteSandbox(projectName)
    console.log('Sandbox 已删除')

    // 注意: 数据库需要手动删除或通过其他工具删除
    console.log('注意: 数据库需要单独删除')
  } catch (error) {
    console.error('删除项目失败:', error)
    throw error
  }
}

// ============================================
// 示例 5: 直接使用管理器类
// ============================================

async function example5_DirectManagerUsage() {
  console.log('示例 5: 直接使用管理器类')

  // 加载 kubeconfig
  const kc = new k8s.KubeConfig()
  kc.loadFromString(fs.readFileSync('.secret/kubeconfig', 'utf-8'))

  // 直接创建管理器实例
  const dbManager = new DatabaseManager(kc)
  const sandboxManager = new SandboxManager(kc)

  const namespace = KubernetesUtils.getNamespaceFromKubeConfig(kc)
  const projectName = 'direct-usage-project'
  const randomSuffix = KubernetesUtils.generateRandomSuffix()

  try {
    // 使用数据库管理器
    console.log('使用 DatabaseManager 创建数据库...')
    const dbInfo = await dbManager.createPostgreSQLDatabase(projectName, namespace, randomSuffix)
    console.log('数据库创建成功')

    // 使用 Sandbox 管理器
    console.log('使用 SandboxManager 创建 Sandbox...')
    const ingressDomain = KubernetesUtils.getIngressDomain(kc)
    const sandboxInfo = await sandboxManager.createSandbox(
      projectName,
      { VAR: 'value' },
      namespace,
      ingressDomain,
      randomSuffix,
      dbInfo
    )
    console.log('Sandbox 创建成功')

    // 获取状态
    const status = await sandboxManager.getSandboxStatus(projectName, namespace)
    console.log('状态:', status)
  } catch (error) {
    console.error('操作失败:', error)
    throw error
  }
}

// ============================================
// 示例 6: 批量管理多个项目
// ============================================

async function example6_BatchOperations() {
  console.log('示例 6: 批量管理多个项目')

  const kubeconfigContent = fs.readFileSync('.secret/kubeconfig', 'utf-8')
  const k8sService = new KubernetesService(kubeconfigContent)

  const projects = ['project-1', 'project-2', 'project-3']

  // 批量创建
  console.log('批量创建项目...')
  const results = await Promise.allSettled(
    projects.map(async (projectName) => {
      console.log(`创建项目: ${projectName}`)
      const dbInfo = await k8sService.createPostgreSQLDatabase(projectName)
      const sandboxInfo = await k8sService.createSandbox(projectName, {}, undefined, dbInfo)
      return { projectName, dbInfo, sandboxInfo }
    })
  )

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`✅ ${projects[index]} 创建成功`)
    } else {
      console.error(`❌ ${projects[index]} 创建失败:`, result.reason)
    }
  })

  // 批量查询状态
  console.log('批量查询状态...')
  const statuses = await Promise.all(
    projects.map(async (projectName) => {
      const status = await k8sService.getSandboxStatus(projectName)
      return { projectName, status }
    })
  )

  statuses.forEach(({ projectName, status }) => {
    console.log(`${projectName}: ${status}`)
  })

  // 批量停止
  console.log('批量停止项目...')
  await Promise.all(projects.map((projectName) => k8sService.stopSandbox(projectName)))
  console.log('所有项目已停止')
}

// ============================================
// 示例 7: 错误处理
// ============================================

async function example7_ErrorHandling() {
  console.log('示例 7: 错误处理')

  const kubeconfigContent = fs.readFileSync('.secret/kubeconfig', 'utf-8')
  const k8sService = new KubernetesService(kubeconfigContent)

  const projectName = 'error-handling-project'

  try {
    // 尝试获取不存在的项目状态
    const status = await k8sService.getSandboxStatus(projectName)
    console.log('状态:', status) // 应该返回 'TERMINATED'

    if (status === 'TERMINATED') {
      console.log('项目不存在,创建新项目...')
      await k8sService.createPostgreSQLDatabase(projectName)
      await k8sService.createSandbox(projectName, {})
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('错误类型:', error.constructor.name)
      console.error('错误信息:', error.message)
      console.error('错误堆栈:', error.stack)
    } else {
      console.error('未知错误:', error)
    }

    // 清理资源
    console.log('尝试清理资源...')
    try {
      await k8sService.deleteSandbox(projectName)
    } catch (cleanupError) {
      console.error('清理失败:', cleanupError)
    }
  }
}

// ============================================
// 示例 8: 监控项目状态
// ============================================

async function example8_MonitorProject() {
  console.log('示例 8: 监控项目状态')

  const kubeconfigContent = fs.readFileSync('.secret/kubeconfig', 'utf-8')
  const k8sService = new KubernetesService(kubeconfigContent)

  const projectName = 'monitored-project'

  // 持续监控状态
  const checkInterval = 10000 // 10 秒
  let lastStatus = ''

  const monitorInterval = setInterval(async () => {
    try {
      const status = await k8sService.getSandboxStatus(projectName)

      if (status !== lastStatus) {
        console.log(`[${new Date().toISOString()}] 状态变化: ${lastStatus} -> ${status}`)
        lastStatus = status

        // 根据状态执行操作
        switch (status) {
          case 'RUNNING':
            console.log('项目正在运行')
            break
          case 'STOPPED':
            console.log('项目已停止')
            break
          case 'CREATING':
            console.log('项目正在创建')
            break
          case 'TERMINATED':
            console.log('项目已删除')
            clearInterval(monitorInterval)
            break
          case 'ERROR':
            console.error('项目遇到错误')
            break
        }
      }
    } catch (error) {
      console.error('监控失败:', error)
    }
  }, checkInterval)

  // 30 秒后停止监控
  setTimeout(() => {
    clearInterval(monitorInterval)
    console.log('停止监控')
  }, 30000)
}

// ============================================
// 主函数 - 运行示例
// ============================================

async function main() {
  console.log('='.repeat(60))
  console.log('Kubernetes Service 使用示例')
  console.log('='.repeat(60))

  try {
    // 取消注释以运行不同的示例

    // await example1_BasicUsage()
    // await example2_CreateFullEnvironment()
    // await example3_ManageExistingProject()
    // await example4_DeleteProject()
    // await example5_DirectManagerUsage()
    // await example6_BatchOperations()
    // await example7_ErrorHandling()
    // await example8_MonitorProject()

    console.log('\n所有示例准备就绪!')
    console.log('取消注释相应的示例函数以运行')
  } catch (error) {
    console.error('示例执行失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error)
}

// 导出所有示例函数
export {
  example1_BasicUsage,
  example2_CreateFullEnvironment,
  example3_ManageExistingProject,
  example4_DeleteProject,
  example5_DirectManagerUsage,
  example6_BatchOperations,
  example7_ErrorHandling,
  example8_MonitorProject,
}
