/**
 * 多用户多 Kubeconfig 场景使用示例
 *
 * 展示 4 种不同的架构模式在实际场景中的应用
 */

import * as fs from 'fs'

import {
  createMultiTenantManager,
  createRequestContext,
  k8sFactory,
  KubernetesRequestContext,
  KubernetesServiceFactory,
  MultiTenantKubernetesManager,
  StatelessKubernetesService,
} from './multi-user-patterns'

// ============================================
// 模拟用户数据
// ============================================

interface User {
  id: string
  name: string
  kubeconfigPath: string
}

const users: User[] = [
  { id: 'user-001', name: 'Alice', kubeconfigPath: '.secret/alice-kubeconfig' },
  { id: 'user-002', name: 'Bob', kubeconfigPath: '.secret/bob-kubeconfig' },
  { id: 'user-003', name: 'Charlie', kubeconfigPath: '.secret/charlie-kubeconfig' },
]

// 读取用户的 kubeconfig
function getUserKubeconfig(user: User): string {
  // 实际场景中，这可能从数据库或密钥管理系统获取
  return fs.readFileSync(user.kubeconfigPath, 'utf-8')
}

// ============================================
// 方案 1: 服务工厂 + 连接池模式（推荐）
// ============================================

/**
 * 示例 1-1: 基本使用 - 多用户并发操作
 */
async function example1_1_FactoryBasicUsage() {
  console.log('\n=== 方案1: 服务工厂模式 - 基本使用 ===\n')

  const factory = k8sFactory

  // 用户 Alice 创建项目
  const aliceConfig = getUserKubeconfig(users[0])
  const aliceService = factory.getService(users[0].id, aliceConfig)
  const aliceDb = await aliceService.createPostgreSQLDatabase('alice-project')
  console.log(`✅ Alice 创建了数据库: ${aliceDb.clusterName}`)

  // 用户 Bob 创建项目
  const bobConfig = getUserKubeconfig(users[1])
  const bobService = factory.getService(users[1].id, bobConfig)
  const bobDb = await bobService.createPostgreSQLDatabase('bob-project')
  console.log(`✅ Bob 创建了数据库: ${bobDb.clusterName}`)

  // Alice 再次操作（会复用缓存的服务实例）
  const aliceService2 = factory.getService(users[0].id, aliceConfig)
  const aliceStatus = await aliceService2.getSandboxStatus('alice-project')
  console.log(`✅ Alice 查询状态: ${aliceStatus}`)

  // 查看连接池状态
  console.log('\n📊 连接池状态:')
  console.log(JSON.stringify(factory.getPoolStats(), null, 2))
}

/**
 * 示例 1-2: Web 应用场景 - 模拟 HTTP 请求
 */
async function example1_2_FactoryWebScenario() {
  console.log('\n=== 方案1: Web 应用场景 ===\n')

  const factory = k8sFactory

  // 模拟多个并发 HTTP 请求
  async function handleRequest(userId: string, kubeconfigContent: string, projectName: string) {
    console.log(`🌐 收到来自用户 [${userId}] 的请求`)

    // 从工厂获取服务实例（自动缓存和复用）
    const service = factory.getService(userId, kubeconfigContent)

    try {
      // 执行操作
      const status = await service.getSandboxStatus(projectName)
      console.log(`✅ [${userId}] 项目 ${projectName} 状态: ${status}`)

      if (status === 'TERMINATED') {
        // 创建新环境
        const dbInfo = await service.createPostgreSQLDatabase(projectName)
        await service.createSandbox(projectName, {}, undefined, dbInfo)
        console.log(`✅ [${userId}] 创建了新环境`)
      }

      return { success: true, status }
    } catch (error) {
      console.error(`❌ [${userId}] 请求失败:`, error)
      return { success: false, error }
    }
  }

  // 模拟 10 个并发请求
  const requests = []
  for (let i = 0; i < 10; i++) {
    const user = users[i % users.length]
    const kubeconfig = getUserKubeconfig(user)
    requests.push(handleRequest(user.id, kubeconfig, `${user.name}-project-${i}`))
  }

  await Promise.all(requests)

  // 显示连接池效率
  const stats = factory.getPoolStats()
  console.log(`\n📊 处理了 10 个请求，连接池大小: ${stats.size}`)
  console.log(`♻️  缓存复用率: ${(((10 - stats.size) / 10) * 100).toFixed(1)}%`)
}

/**
 * 示例 1-3: 清理和维护
 */
async function example1_3_FactoryMaintenance() {
  console.log('\n=== 方案1: 连接池维护 ===\n')

  const factory = k8sFactory

  // 配置连接池参数
  factory.configure({
    maxPoolSize: 50,
    ttl: 15 * 60 * 1000, // 15 分钟过期
    cleanupInterval: 2 * 60 * 1000, // 2 分钟清理一次
  })

  // 添加一些用户
  for (const user of users) {
    const kubeconfig = getUserKubeconfig(user)
    factory.getService(user.id, kubeconfig)
  }

  console.log('📊 初始状态:', factory.getPoolStats())

  // 清除特定用户
  factory.clearUserService(users[0].id)
  console.log('\n🗑️  清除 Alice 后:', factory.getPoolStats())

  // 清空所有
  factory.clearAll()
  console.log('\n🗑️  清空所有后:', factory.getPoolStats())
}

// ============================================
// 方案 2: 无状态服务模式
// ============================================

/**
 * 示例 2-1: 无状态操作
 */
async function example2_1_StatelessOperations() {
  console.log('\n=== 方案2: 无状态服务模式 ===\n')

  const user = users[0]
  const kubeconfig = getUserKubeconfig(user)

  // 每次调用都传递 kubeconfig，不维护状态
  console.log('创建数据库...')
  const dbInfo = await StatelessKubernetesService.createPostgreSQLDatabase(
    kubeconfig,
    'stateless-project'
  )

  console.log('创建 Sandbox...')
  await StatelessKubernetesService.createSandbox(
    kubeconfig,
    'stateless-project',
    { ENV: 'stateless' },
    undefined,
    dbInfo
  )

  console.log('查询状态...')
  const status = await StatelessKubernetesService.getSandboxStatus(kubeconfig, 'stateless-project')

  console.log(`✅ 项目状态: ${status}`)
}

/**
 * 示例 2-2: 无状态适合的场景
 */
async function example2_2_StatelessUseCase() {
  console.log('\n=== 方案2: 无状态场景 - 云函数/Serverless ===\n')

  // 模拟 AWS Lambda 或云函数场景
  async function lambdaHandler(event: any) {
    console.log('☁️  云函数被触发')

    const { userId, kubeconfig, action, projectName } = event

    switch (action) {
      case 'create':
        return await StatelessKubernetesService.createPostgreSQLDatabase(kubeconfig, projectName)

      case 'status':
        return await StatelessKubernetesService.getSandboxStatus(kubeconfig, projectName)

      case 'delete':
        return await StatelessKubernetesService.deleteSandbox(kubeconfig, projectName)

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  // 模拟多个云函数调用
  const events = [
    {
      userId: 'user-001',
      kubeconfig: getUserKubeconfig(users[0]),
      action: 'status',
      projectName: 'lambda-project',
    },
    {
      userId: 'user-002',
      kubeconfig: getUserKubeconfig(users[1]),
      action: 'status',
      projectName: 'lambda-project',
    },
  ]

  for (const event of events) {
    const result = await lambdaHandler(event)
    console.log(`✅ [${event.userId}] ${event.action} 完成:`, result)
  }
}

// ============================================
// 方案 3: 多租户管理器模式
// ============================================

/**
 * 示例 3-1: 租户注册和管理
 */
async function example3_1_MultiTenantBasic() {
  console.log('\n=== 方案3: 多租户管理器模式 ===\n')

  const manager = createMultiTenantManager()

  // 注册租户
  console.log('📝 注册租户...')
  for (const user of users) {
    const kubeconfig = getUserKubeconfig(user)
    manager.registerTenant(user.id, kubeconfig)
  }

  console.log('\n📊 租户统计:')
  console.log(JSON.stringify(manager.getStats(), null, 2))

  // 使用租户服务
  console.log('\n🔧 使用租户服务...')
  const aliceService = manager.getTenantService(users[0].id)
  const aliceDb = await aliceService.createPostgreSQLDatabase('tenant-alice-project')
  console.log(`✅ Alice 创建了数据库: ${aliceDb.clusterName}`)

  const bobService = manager.getTenantService(users[1].id)
  const bobDb = await bobService.createPostgreSQLDatabase('tenant-bob-project')
  console.log(`✅ Bob 创建了数据库: ${bobDb.clusterName}`)
}

/**
 * 示例 3-2: SaaS 多租户场景
 */
async function example3_2_MultiTenantSaaS() {
  console.log('\n=== 方案3: SaaS 多租户场景 ===\n')

  const manager = createMultiTenantManager()

  // 模拟租户订阅流程
  class TenantSubscriptionService {
    constructor(private manager: MultiTenantKubernetesManager) {}

    async onboard(tenantId: string, kubeconfigContent: string) {
      console.log(`🎉 新租户 [${tenantId}] 加入`)

      // 注册租户
      this.manager.registerTenant(tenantId, kubeconfigContent)

      // 为租户创建初始资源
      const service = this.manager.getTenantService(tenantId)

      // 创建默认数据库
      const dbInfo = await service.createPostgreSQLDatabase(`${tenantId}-default`)
      console.log(`✅ 为租户创建了默认数据库`)

      // 创建演示环境
      await service.createSandbox(`${tenantId}-demo`, { TENANT_ID: tenantId }, undefined, dbInfo)
      console.log(`✅ 为租户创建了演示环境`)

      return { success: true, tenantId }
    }

    async upgrade(tenantId: string, newKubeconfigContent: string) {
      console.log(`⬆️  租户 [${tenantId}] 升级配置`)
      this.manager.updateTenant(tenantId, newKubeconfigContent)
    }

    async offboard(tenantId: string) {
      console.log(`👋 租户 [${tenantId}] 离开`)

      // 清理租户资源
      const service = this.manager.getTenantService(tenantId)
      await service.deleteSandbox(`${tenantId}-demo`)

      // 移除租户
      this.manager.removeTenant(tenantId)
    }

    getTenantList() {
      return this.manager.getAllTenants()
    }
  }

  // 使用订阅服务
  const subscriptionService = new TenantSubscriptionService(manager)

  // 新租户加入
  for (const user of users) {
    const kubeconfig = getUserKubeconfig(user)
    await subscriptionService.onboard(user.id, kubeconfig)
  }

  // 查看所有租户
  console.log('\n📋 当前租户列表:')
  console.log(subscriptionService.getTenantList())

  // 租户离开
  await subscriptionService.offboard(users[0].id)

  console.log('\n📋 更新后的租户列表:')
  console.log(subscriptionService.getTenantList())
}

// ============================================
// 方案 4: 请求上下文模式
// ============================================

/**
 * 示例 4-1: Express 中间件集成
 */
async function example4_1_ExpressMiddleware() {
  console.log('\n=== 方案4: Express 中间件模式 ===\n')

  // 模拟 Express 请求对象
  interface MockRequest {
    user: { id: string; kubeconfig: string }
    k8sContext?: KubernetesRequestContext
  }

  interface MockResponse {
    json: (data: any) => void
    status: (code: number) => MockResponse
  }

  type NextFunction = () => void

  // Kubernetes 上下文中间件
  function k8sContextMiddleware(req: MockRequest, res: MockResponse, next: NextFunction) {
    // 从请求中获取用户信息和 kubeconfig
    const { id, kubeconfig } = req.user

    // 创建 Kubernetes 上下文
    req.k8sContext = createRequestContext(id, kubeconfig)

    console.log(`🔐 为用户 [${id}] 创建了 K8s 上下文`)
    next()
  }

  // 模拟路由处理器
  async function createProjectHandler(req: MockRequest, res: MockResponse) {
    if (!req.k8sContext) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
      const { projectName } = req as any
      console.log(`📦 创建项目: ${projectName}`)

      // 使用上下文中的服务
      const dbInfo = await req.k8sContext.createDatabase(projectName)
      const sandboxInfo = await req.k8sContext.createSandbox(projectName, {}, undefined, dbInfo)

      res.json({
        success: true,
        data: { dbInfo, sandboxInfo },
      })
    } catch (error) {
      res.status(500).json({ error: (error as Error).message })
    }
  }

  // 模拟请求
  const mockReq: MockRequest = {
    user: {
      id: users[0].id,
      kubeconfig: getUserKubeconfig(users[0]),
    },
    k8sContext: undefined,
  } as any
  mockReq['projectName'] = 'express-project'

  const mockRes: MockResponse = {
    json: (data) => console.log('📤 响应:', JSON.stringify(data, null, 2)),
    status: (code) => {
      console.log(`📤 状态码: ${code}`)
      return mockRes
    },
  }

  // 执行中间件链
  k8sContextMiddleware(mockReq, mockRes, () => {
    createProjectHandler(mockReq, mockRes)
  })
}

/**
 * 示例 4-2: GraphQL Resolver 集成
 */
async function example4_2_GraphQLResolver() {
  console.log('\n=== 方案4: GraphQL Resolver 模式 ===\n')

  // 模拟 GraphQL 上下文
  interface GraphQLContext {
    user: { id: string; kubeconfig: string }
    k8s: KubernetesRequestContext
  }

  // 创建上下文函数（每个请求都会调用）
  function createGraphQLContext(req: any): GraphQLContext {
    const { userId, kubeconfig } = req

    return {
      user: { id: userId, kubeconfig },
      k8s: createRequestContext(userId, kubeconfig),
    }
  }

  // GraphQL Resolvers
  const resolvers = {
    Mutation: {
      createProject: async (
        _parent: any,
        args: { projectName: string },
        context: GraphQLContext
      ) => {
        console.log(`[${context.user.id}] GraphQL Mutation: createProject`)

        // 使用上下文中的 K8s 服务
        const dbInfo = await context.k8s.createDatabase(args.projectName)
        const sandboxInfo = await context.k8s.createSandbox(args.projectName, {}, undefined, dbInfo)

        return {
          success: true,
          project: {
            name: args.projectName,
            database: dbInfo,
            sandbox: sandboxInfo,
          },
        }
      },

      deleteProject: async (
        _parent: any,
        args: { projectName: string },
        context: GraphQLContext
      ) => {
        console.log(`[${context.user.id}] GraphQL Mutation: deleteProject`)

        await context.k8s.deleteSandbox(args.projectName)

        return {
          success: true,
          message: `Project ${args.projectName} deleted`,
        }
      },
    },

    Query: {
      projectStatus: async (
        _parent: any,
        args: { projectName: string },
        context: GraphQLContext
      ) => {
        console.log(`[${context.user.id}] GraphQL Query: projectStatus`)

        const status = await context.k8s.getStatus(args.projectName)

        return {
          projectName: args.projectName,
          status,
        }
      },
    },
  }

  // 模拟 GraphQL 请求
  const mockRequest = {
    userId: users[0].id,
    kubeconfig: getUserKubeconfig(users[0]),
  }

  const context = createGraphQLContext(mockRequest)

  // 执行 mutations
  console.log('\n📝 执行 GraphQL Mutations:')
  const createResult = await resolvers.Mutation.createProject(
    null,
    { projectName: 'graphql-project' },
    context
  )
  console.log('✅ 创建结果:', createResult)

  // 执行 queries
  console.log('\n🔍 执行 GraphQL Queries:')
  const statusResult = await resolvers.Query.projectStatus(
    null,
    { projectName: 'graphql-project' },
    context
  )
  console.log('✅ 状态查询:', statusResult)
}

// ============================================
// 方案对比
// ============================================

async function exampleComparison() {
  console.log('\n=== 方案对比 ===\n')

  console.log(`
┌──────────────────────────────────────────────────────────────────┐
│                         方案对比                                  │
├──────────────┬───────────────────────────────────────────────────┤
│ 方案1: 工厂  │ ✅ 自动缓存和复用                                 │
│ + 连接池     │ ✅ 高性能                                         │
│ (推荐)       │ ✅ 适合 Web 应用                                  │
│              │ ⚠️  需要管理连接池                                │
├──────────────┼───────────────────────────────────────────────────┤
│ 方案2: 无状态│ ✅ 简单直接                                       │
│              │ ✅ 适合 Serverless                                │
│              │ ❌ 每次都创建新实例，性能较低                      │
├──────────────┼───────────────────────────────────────────────────┤
│ 方案3: 多租户│ ✅ 租户隔离清晰                                   │
│              │ ✅ 适合 SaaS                                      │
│              │ ⚠️  需要提前注册租户                              │
├──────────────┼───────────────────────────────────────────────────┤
│ 方案4: 上下文│ ✅ 与框架集成良好                                 │
│              │ ✅ 请求级别隔离                                   │
│              │ ⚠️  需要中间件支持                                │
└──────────────┴───────────────────────────────────────────────────┘

推荐选择：
- Web 应用（Express/Koa）: 方案1 或 方案4
- Serverless/云函数: 方案2
- SaaS 多租户: 方案3
- GraphQL API: 方案4
  `)
}

// ============================================
// 主函数
// ============================================

async function main() {
  console.log('='.repeat(70))
  console.log('多用户多 Kubeconfig 场景使用示例')
  console.log('='.repeat(70))

  try {
    // 方案 1: 服务工厂模式
    // await example1_1_FactoryBasicUsage()
    // await example1_2_FactoryWebScenario()
    // await example1_3_FactoryMaintenance()

    // 方案 2: 无状态模式
    // await example2_1_StatelessOperations()
    // await example2_2_StatelessUseCase()

    // 方案 3: 多租户模式
    // await example3_1_MultiTenantBasic()
    // await example3_2_MultiTenantSaaS()

    // 方案 4: 上下文模式
    // await example4_1_ExpressMiddleware()
    // await example4_2_GraphQLResolver()

    // 方案对比
    await exampleComparison()

    console.log('\n✅ 示例准备就绪！取消注释相应函数以运行。')
  } catch (error) {
    console.error('❌ 示例执行失败:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

// 导出所有示例
export {
  example1_1_FactoryBasicUsage,
  example1_2_FactoryWebScenario,
  example1_3_FactoryMaintenance,
  example2_1_StatelessOperations,
  example2_2_StatelessUseCase,
  example3_1_MultiTenantBasic,
  example3_2_MultiTenantSaaS,
  example4_1_ExpressMiddleware,
  example4_2_GraphQLResolver,
  exampleComparison,
}
