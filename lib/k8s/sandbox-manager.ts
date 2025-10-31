import * as k8s from '@kubernetes/client-node'
import fs from 'fs'
import path from 'path'

import { getRuntimeImage, VERSIONS } from './config/versions'
import { DatabaseInfo } from './database-manager'

export interface SandboxInfo {
  statefulSetName: string
  serviceName: string
  publicUrl: string
  ttydUrl: string
}

export type SandboxStatus = 'RUNNING' | 'STOPPED' | 'CREATING' | 'TERMINATED' | 'ERROR'

export class SandboxManager {
  private kc: k8s.KubeConfig
  private k8sApi: k8s.CoreV1Api
  private k8sAppsApi: k8s.AppsV1Api
  private k8sNetworkingApi: k8s.NetworkingV1Api

  constructor(kubeConfig: k8s.KubeConfig) {
    this.kc = kubeConfig
    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api)
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api)
    this.k8sNetworkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api)
  }

  /**
   * 创建 Sandbox 环境
   */
  async createSandbox(
    projectName: string,
    envVars: Record<string, string>,
    namespace: string,
    ingressDomain: string,
    randomSuffix: string,
    databaseInfo?: DatabaseInfo
  ): Promise<SandboxInfo> {
    const k8sProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
    const sandboxName = `${k8sProjectName}-agentruntime-${randomSuffix}`

    // Generate random names
    const port3000Name = this.generateRandomName()
    const port5000Name = this.generateRandomName()
    const port7681Name = this.generateRandomName()
    const port8080Name = this.generateRandomName()
    const appDomain = this.generateRandomName()
    const ttydDomain = this.generateRandomName()

    // Load environment variables
    const claudeEnvVars = this.loadClaudeEnvVars()

    // Prepare database connection string
    const dbConnectionString = this.prepareDatabaseConnectionString(
      databaseInfo,
      k8sProjectName,
      namespace,
      claudeEnvVars
    )

    // Prepare container environment
    const containerEnv = {
      ...claudeEnvVars,
      ...envVars,
      DATABASE_URL: dbConnectionString || claudeEnvVars.DATABASE,
      NODE_ENV: 'development',
      TTYD_PORT: '7681',
      TTYD_INTERFACE: '0.0.0.0',
      PROJECT_NAME: projectName,
    }

    // Create ConfigMaps
    await this.createConfigMaps(sandboxName, k8sProjectName, namespace)

    // Create StatefulSet
    await this.createStatefulSet(sandboxName, k8sProjectName, namespace, containerEnv)

    // Create Service
    const serviceName = await this.createService(
      sandboxName,
      k8sProjectName,
      namespace,
      port3000Name,
      port5000Name,
      port7681Name,
      port8080Name
    )

    // Create Ingresses
    await this.createIngresses(
      sandboxName,
      k8sProjectName,
      namespace,
      serviceName,
      appDomain,
      ttydDomain,
      ingressDomain
    )

    return {
      statefulSetName: sandboxName,
      serviceName: serviceName,
      publicUrl: `https://${appDomain}.${ingressDomain}`,
      ttydUrl: `https://${ttydDomain}.${ingressDomain}`,
    }
  }

  /**
   * 加载 Claude Code 环境变量
   */
  private loadClaudeEnvVars(): Record<string, string> {
    let claudeEnvPath = path.join(process.cwd(), '.secret', '.env')
    if (!fs.existsSync(claudeEnvPath)) {
      claudeEnvPath = path.join(process.cwd(), '..', '.secret', '.env')
    }

    const claudeEnvVars: Record<string, string> = {}

    if (fs.existsSync(claudeEnvPath)) {
      console.log(`Loading Claude Code env from: ${claudeEnvPath}`)
      const envContent = fs.readFileSync(claudeEnvPath, 'utf-8')
      envContent.split('\n').forEach((line) => {
        if (line.startsWith('#') || !line.includes('=')) return

        const cleanLine = line.replace(/^export\s+/, '')
        const [key, ...valueParts] = cleanLine.split('=')
        const value = valueParts.join('=')

        if (key && value) {
          claudeEnvVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
        }
      })
    }

    return claudeEnvVars
  }

  /**
   * 准备数据库连接字符串
   */
  private prepareDatabaseConnectionString(
    databaseInfo: DatabaseInfo | undefined,
    k8sProjectName: string,
    namespace: string,
    claudeEnvVars: Record<string, string>
  ): string {
    if (databaseInfo) {
      console.log(`📊 Using provided database credentials for '${databaseInfo.clusterName}'`)
      return `postgresql://${databaseInfo.username}:${databaseInfo.password}@${databaseInfo.host}:${databaseInfo.port}/${databaseInfo.database}?schema=public`
    }

    return ''
  }

  /**
   * 创建 ConfigMaps
   */
  private async createConfigMaps(sandboxName: string, k8sProjectName: string, namespace: string) {
    // Read kubeconfig
    const kubeconfigContent = this.readKubeconfigContent()
    if (kubeconfigContent) {
      await this.createKubeconfigConfigMap(
        sandboxName,
        k8sProjectName,
        namespace,
        kubeconfigContent
      )
    }

    // Read CLAUDE.md
    const claudeMdContent = this.readClaudeMdContent()
    if (claudeMdContent) {
      await this.createClaudeMdConfigMap(sandboxName, k8sProjectName, namespace, claudeMdContent)
    }
  }

  /**
   * 读取 kubeconfig 内容
   */
  private readKubeconfigContent(): string {
    try {
      let kubeconfigPath = path.join(process.cwd(), '.secret', 'kubeconfig')
      if (!fs.existsSync(kubeconfigPath)) {
        kubeconfigPath = path.join(process.cwd(), '..', '.secret', 'kubeconfig')
      }

      if (fs.existsSync(kubeconfigPath)) {
        console.log(`✅ Loaded kubeconfig for ConfigMap creation`)
        return fs.readFileSync(kubeconfigPath, 'utf8')
      } else {
        console.warn(`⚠️  Kubeconfig file not found for ConfigMap creation`)
        return ''
      }
    } catch (error) {
      console.error(`❌ Failed to read kubeconfig for ConfigMap: ${error}`)
      return ''
    }
  }

  /**
   * 读取 CLAUDE.md 内容
   */
  private readClaudeMdContent(): string {
    try {
      let claudeMdPath = path.join(process.cwd(), '..', 'CLAUDE.md')
      if (!fs.existsSync(claudeMdPath)) {
        claudeMdPath = path.join(process.cwd(), 'CLAUDE.md')
      }

      if (fs.existsSync(claudeMdPath)) {
        console.log(`✅ Loaded CLAUDE.md for ConfigMap creation`)
        return fs.readFileSync(claudeMdPath, 'utf8')
      } else {
        console.warn(`⚠️  CLAUDE.md file not found for ConfigMap creation`)
        return ''
      }
    } catch (error) {
      console.error(`❌ Failed to read CLAUDE.md for ConfigMap: ${error}`)
      return ''
    }
  }

  /**
   * 创建 kubeconfig ConfigMap
   */
  private async createKubeconfigConfigMap(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    kubeconfigContent: string
  ) {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${sandboxName}-kubeconfig`,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          app: sandboxName,
          'project.fullstackagent.io/name': k8sProjectName,
        },
      },
      data: {
        kubeconfig: kubeconfigContent,
      },
    }

    try {
      await this.k8sApi.createNamespacedConfigMap({ namespace, body: configMap as any })
      console.log(`✅ Created ConfigMap: ${sandboxName}-kubeconfig`)
    } catch (error) {
      console.error(`❌ Failed to create ConfigMap: ${error}`)
      throw error
    }
  }

  /**
   * 创建 CLAUDE.md ConfigMap
   */
  private async createClaudeMdConfigMap(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    claudeMdContent: string
  ) {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${sandboxName}-claude-md`,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          app: sandboxName,
          'project.fullstackagent.io/name': k8sProjectName,
        },
      },
      data: {
        'CLAUDE.md': claudeMdContent,
      },
    }

    try {
      await this.k8sApi.createNamespacedConfigMap({ namespace, body: configMap as any })
      console.log(`✅ Created ConfigMap: ${sandboxName}-claude-md`)
    } catch (error) {
      console.error(`❌ Failed to create CLAUDE.md ConfigMap: ${error}`)
      throw error
    }
  }

  /**
   * 创建 StatefulSet
   */
  private async createStatefulSet(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    containerEnv: Record<string, string>
  ) {
    const currentTime = new Date()
      .toISOString()
      .replace(/[-:T.]/g, '')
      .substring(0, 14)

    const kubeconfigContent = this.readKubeconfigContent()
    const claudeMdContent = this.readClaudeMdContent()

    const statefulSet = {
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      metadata: {
        name: sandboxName,
        namespace,
        annotations: {
          originImageName: getRuntimeImage(),
          'deploy.cloud.sealos.io/minReplicas': '1',
          'deploy.cloud.sealos.io/maxReplicas': '1',
          'deploy.cloud.sealos.io/resize': VERSIONS.STORAGE.SANDBOX_SIZE,
        },
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          app: sandboxName,
          'project.fullstackagent.io/name': k8sProjectName,
        },
      },
      spec: {
        replicas: 1,
        revisionHistoryLimit: 1,
        serviceName: `${sandboxName}-service`,
        selector: {
          matchLabels: {
            app: sandboxName,
          },
        },
        updateStrategy: {
          type: 'RollingUpdate',
          rollingUpdate: {
            maxUnavailable: '50%',
          },
        },
        minReadySeconds: 10,
        template: {
          metadata: {
            labels: {
              app: sandboxName,
              restartTime: currentTime,
              'project.fullstackagent.io/name': k8sProjectName,
            },
          },
          spec: {
            initContainers: [
              {
                name: 'init-home-directory',
                image: getRuntimeImage(),
                command: ['sh', '-c'],
                args: [this.generateInitContainerScript(kubeconfigContent, claudeMdContent)],
                volumeMounts: [
                  {
                    name: 'vn-homevn-agent',
                    mountPath: '/home/agent',
                  },
                  ...(kubeconfigContent
                    ? [
                        {
                          name: 'kubeconfig-volume',
                          mountPath: '/tmp/kubeconfig',
                        },
                      ]
                    : []),
                  ...(claudeMdContent
                    ? [
                        {
                          name: 'claude-md-volume',
                          mountPath: '/tmp/claude-md',
                        },
                      ]
                    : []),
                ],
                securityContext: {
                  runAsUser: 0,
                  runAsNonRoot: false,
                },
              },
            ],
            automountServiceAccountToken: false,
            terminationGracePeriodSeconds: 10,
            securityContext: {
              fsGroup: 1001,
              runAsUser: 1001,
              runAsNonRoot: true,
            },
            containers: [
              {
                name: sandboxName,
                image: getRuntimeImage(),
                env: Object.entries(containerEnv).map(([key, value]) => ({
                  name: key,
                  value: String(value),
                })),
                resources: VERSIONS.RESOURCES.SANDBOX,
                ports: [
                  { containerPort: 3000, name: this.generateRandomName() },
                  { containerPort: 5000, name: this.generateRandomName() },
                  { containerPort: 7681, name: this.generateRandomName() },
                  { containerPort: 8080, name: this.generateRandomName() },
                ],
                imagePullPolicy: 'Always',
                volumeMounts: [
                  {
                    name: 'vn-homevn-agent',
                    mountPath: '/home/agent',
                  },
                ],
              },
            ],
            volumes: [
              ...(kubeconfigContent
                ? [
                    {
                      name: 'kubeconfig-volume',
                      configMap: {
                        name: `${sandboxName}-kubeconfig`,
                      },
                    },
                  ]
                : []),
              ...(claudeMdContent
                ? [
                    {
                      name: 'claude-md-volume',
                      configMap: {
                        name: `${sandboxName}-claude-md`,
                      },
                    },
                  ]
                : []),
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: {
              annotations: {
                path: '/home/agent',
                value: VERSIONS.STORAGE.SANDBOX_SIZE.replace('Gi', ''),
              },
              name: 'vn-homevn-agent',
            },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: {
                requests: {
                  storage: VERSIONS.STORAGE.SANDBOX_SIZE,
                },
              },
            },
          },
        ],
      },
    }

    await this.k8sAppsApi.createNamespacedStatefulSet({ namespace, body: statefulSet as any })
  }

  /**
   * 生成初始化容器脚本
   */
  private generateInitContainerScript(kubeconfigContent: string, claudeMdContent: string): string {
    const commands = [
      'mkdir -p /home/agent/.kube /home/agent/.config',
      'cp /etc/skel/.bashrc /home/agent/.bashrc',
      'chmod 644 /home/agent/.bashrc',
    ]

    if (kubeconfigContent) {
      commands.push(
        'cp /tmp/kubeconfig/kubeconfig /home/agent/.kube/config',
        'chmod 600 /home/agent/.kube/config'
      )
    } else {
      commands.push('touch /home/agent/.kube/config')
    }

    if (claudeMdContent) {
      commands.push(
        'cp /tmp/claude-md/CLAUDE.md /home/agent/CLAUDE.md',
        'chmod 644 /home/agent/CLAUDE.md'
      )
    }

    commands.push(
      'chown -R 1001:1001 /home/agent',
      'chmod 755 /home/agent',
      'echo "Home directory initialization completed"'
    )

    return commands.join(' && ')
  }

  /**
   * 创建 Service
   */
  private async createService(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    port3000Name: string,
    port5000Name: string,
    port7681Name: string,
    port8080Name: string
  ): Promise<string> {
    const serviceName = `${sandboxName}-service`
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          'project.fullstackagent.io/name': k8sProjectName,
        },
      },
      spec: {
        ports: [
          { port: 3000, targetPort: 3000, name: port3000Name, protocol: 'TCP' },
          { port: 5000, targetPort: 5000, name: port5000Name, protocol: 'TCP' },
          { port: 7681, targetPort: 7681, name: port7681Name, protocol: 'TCP' },
          { port: 8080, targetPort: 8080, name: port8080Name, protocol: 'TCP' },
        ],
        selector: {
          app: sandboxName,
        },
      },
    }

    await this.k8sApi.createNamespacedService({ namespace, body: service as any })
    return serviceName
  }

  /**
   * 创建 Ingresses
   */
  private async createIngresses(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    serviceName: string,
    appDomain: string,
    ttydDomain: string,
    ingressDomain: string
  ) {
    const ingresses = [
      this.createAppIngress(
        sandboxName,
        k8sProjectName,
        namespace,
        serviceName,
        appDomain,
        ingressDomain
      ),
      this.createTtydIngress(
        sandboxName,
        k8sProjectName,
        namespace,
        serviceName,
        ttydDomain,
        ingressDomain
      ),
    ]

    for (const ingress of ingresses) {
      await this.k8sNetworkingApi.createNamespacedIngress({ namespace, body: ingress as any })
    }
  }

  /**
   * 创建应用 Ingress
   */
  private createAppIngress(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    serviceName: string,
    appDomain: string,
    ingressDomain: string
  ) {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `${sandboxName}-app-ingress`,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          'cloud.sealos.io/app-deploy-manager-domain': appDomain,
          'project.fullstackagent.io/name': k8sProjectName,
        },
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'nginx.ingress.kubernetes.io/proxy-body-size': '32m',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
          'nginx.ingress.kubernetes.io/client-body-buffer-size': '64k',
          'nginx.ingress.kubernetes.io/proxy-buffer-size': '64k',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '300',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '300',
          'nginx.ingress.kubernetes.io/server-snippet':
            'client_header_buffer_size 64k;\nlarge_client_header_buffers 4 128k;',
        },
      },
      spec: {
        rules: [
          {
            host: `${appDomain}.${ingressDomain}`,
            http: {
              paths: [
                {
                  pathType: 'Prefix',
                  path: '/',
                  backend: {
                    service: {
                      name: serviceName,
                      port: { number: 3000 },
                    },
                  },
                },
              ],
            },
          },
        ],
        tls: [
          {
            hosts: [`${appDomain}.${ingressDomain}`],
            secretName: 'wildcard-cert',
          },
        ],
      },
    }
  }

  /**
   * 创建 ttyd Ingress
   */
  private createTtydIngress(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    serviceName: string,
    ttydDomain: string,
    ingressDomain: string
  ) {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `${sandboxName}-ttyd-ingress`,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          'cloud.sealos.io/app-deploy-manager-domain': ttydDomain,
          'project.fullstackagent.io/name': k8sProjectName,
        },
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'nginx.ingress.kubernetes.io/proxy-body-size': '32m',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'false',
          'nginx.ingress.kubernetes.io/backend-protocol': 'HTTP',
          'nginx.ingress.kubernetes.io/client-body-buffer-size': '64k',
          'nginx.ingress.kubernetes.io/proxy-buffer-size': '64k',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '300',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '300',
          'nginx.ingress.kubernetes.io/server-snippet':
            'client_header_buffer_size 64k;\nlarge_client_header_buffers 4 128k;',
        },
      },
      spec: {
        rules: [
          {
            host: `${ttydDomain}.${ingressDomain}`,
            http: {
              paths: [
                {
                  pathType: 'Prefix',
                  path: '/',
                  backend: {
                    service: {
                      name: serviceName,
                      port: { number: 7681 },
                    },
                  },
                },
              ],
            },
          },
        ],
        tls: [
          {
            hosts: [`${ttydDomain}.${ingressDomain}`],
            secretName: 'wildcard-cert',
          },
        ],
      },
    }
  }

  /**
   * 删除 Sandbox
   */
  async deleteSandbox(projectName: string, namespace: string) {
    const k8sProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
    console.log(`🗑️ Deleting sandbox for project: ${projectName} (k8s: ${k8sProjectName})`)

    try {
      await this.deleteStatefulSets(k8sProjectName, namespace)
      await this.deleteServices(k8sProjectName, namespace)
      await this.deleteIngresses(k8sProjectName, namespace)
      await this.deleteConfigMaps(k8sProjectName, namespace)
    } catch (error) {
      console.error('Failed to delete sandbox resources:', error)
    }
  }

  /**
   * 删除 StatefulSets
   */
  private async deleteStatefulSets(k8sProjectName: string, namespace: string) {
    const statefulSets = await this.k8sAppsApi.listNamespacedStatefulSet({ namespace })
    const statefulSetItems = (statefulSets as any).body?.items || statefulSets.items || []
    const projectStatefulSets = statefulSetItems.filter((sts: any) =>
      sts.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
    )

    for (const statefulSet of projectStatefulSets) {
      try {
        await this.k8sAppsApi.deleteNamespacedStatefulSet({
          name: statefulSet.metadata.name,
          namespace,
        })
        console.log(`Deleted StatefulSet: ${statefulSet.metadata.name}`)
      } catch (error) {
        console.error(`Failed to delete StatefulSet ${statefulSet.metadata.name}:`, error)
      }
    }
  }

  /**
   * 删除 Services
   */
  private async deleteServices(k8sProjectName: string, namespace: string) {
    const services = await this.k8sApi.listNamespacedService({ namespace })
    const serviceItems = services.body?.items || (services as any).items || []
    const projectServices = serviceItems.filter((svc: any) =>
      svc.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
    )

    for (const service of projectServices) {
      try {
        await this.k8sApi.deleteNamespacedService({
          name: service.metadata.name,
          namespace,
        })
        console.log(`Deleted service: ${service.metadata.name}`)
      } catch (error) {
        console.error(`Failed to delete service ${service.metadata.name}:`, error)
      }
    }
  }

  /**
   * 删除 Ingresses
   */
  private async deleteIngresses(k8sProjectName: string, namespace: string) {
    const ingresses = await this.k8sNetworkingApi.listNamespacedIngress({ namespace })
    const ingressItems = ingresses.body?.items || (ingresses as any).items || []
    const projectIngresses = ingressItems.filter(
      (ing: any) =>
        ing.metadata.labels &&
        ing.metadata.labels['cloud.sealos.io/app-deploy-manager'] &&
        ing.metadata.labels['cloud.sealos.io/app-deploy-manager'].startsWith(
          `${k8sProjectName}-agentruntime-`
        )
    )

    for (const ingress of projectIngresses) {
      try {
        await this.k8sNetworkingApi.deleteNamespacedIngress({
          name: ingress.metadata.name,
          namespace,
        })
        console.log(`Deleted ingress: ${ingress.metadata.name}`)
      } catch (error) {
        console.error(`Failed to delete ingress ${ingress.metadata.name}:`, error)
      }
    }
  }

  /**
   * 删除 ConfigMaps
   */
  private async deleteConfigMaps(k8sProjectName: string, namespace: string) {
    try {
      const configMaps = await this.k8sApi.listNamespacedConfigMap({ namespace })
      const configMapItems = configMaps.body?.items || (configMaps as any).items || []
      const projectConfigMaps = configMapItems.filter(
        (cm: any) =>
          cm.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`) &&
          (cm.metadata.name.endsWith('-kubeconfig') || cm.metadata.name.endsWith('-claude-md'))
      )

      for (const configMap of projectConfigMaps) {
        try {
          await this.k8sApi.deleteNamespacedConfigMap({
            name: configMap.metadata.name,
            namespace,
          })
          console.log(`Deleted ConfigMap: ${configMap.metadata.name}`)
        } catch (error) {
          console.error(`Failed to delete ConfigMap ${configMap.metadata.name}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to list or delete ConfigMaps:', error)
    }
  }

  /**
   * 获取 Sandbox 状态
   */
  async getSandboxStatus(projectName: string, namespace: string): Promise<SandboxStatus> {
    try {
      const k8sProjectName = projectName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 20)

      const statefulSets = await this.k8sAppsApi.listNamespacedStatefulSet({ namespace })
      const statefulSetItems = (statefulSets as any).body?.items || statefulSets.items || []
      const projectStatefulSet = statefulSetItems.find((sts: any) =>
        sts.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      )

      if (!projectStatefulSet) {
        return 'TERMINATED'
      }

      const replicas = projectStatefulSet.status?.replicas || 0
      const readyReplicas = projectStatefulSet.status?.readyReplicas || 0

      if (readyReplicas === replicas && replicas > 0) {
        return 'RUNNING'
      } else if (replicas === 0) {
        return 'STOPPED'
      } else {
        return 'CREATING'
      }
    } catch (error: any) {
      if (error?.response?.statusCode === 404) {
        return 'TERMINATED'
      }
      return 'ERROR'
    }
  }

  /**
   * 停止 Sandbox
   */
  async stopSandbox(projectName: string, namespace: string) {
    const k8sProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
    console.log(`⏸️ Stopping sandbox for project: ${projectName} (k8s: ${k8sProjectName})`)

    try {
      const statefulSets = await this.k8sAppsApi.listNamespacedStatefulSet({ namespace })
      const statefulSetItems = (statefulSets as any).body?.items || statefulSets.items || []
      const projectStatefulSet = statefulSetItems.find((sts: any) =>
        sts.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      )

      if (!projectStatefulSet) {
        throw new Error(`No StatefulSet found for project ${projectName}`)
      }

      const statefulSetName = projectStatefulSet.metadata.name
      const updatedStatefulSet = {
        ...projectStatefulSet,
        spec: {
          ...projectStatefulSet.spec,
          replicas: 0,
        },
      }

      await this.k8sAppsApi.replaceNamespacedStatefulSet({
        name: statefulSetName,
        namespace,
        body: updatedStatefulSet,
      })

      console.log(`✅ Stopped StatefulSet: ${statefulSetName} (scaled to 0 replicas)`)
    } catch (error) {
      console.error(`Failed to stop sandbox:`, error)
      throw error
    }
  }

  /**
   * 启动 Sandbox
   */
  async startSandbox(projectName: string, namespace: string) {
    const k8sProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)
    console.log(`▶️ Starting sandbox for project: ${projectName} (k8s: ${k8sProjectName})`)

    try {
      const statefulSets = await this.k8sAppsApi.listNamespacedStatefulSet({ namespace })
      const statefulSetItems = (statefulSets as any).body?.items || statefulSets.items || []
      const projectStatefulSet = statefulSetItems.find((sts: any) =>
        sts.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      )

      if (!projectStatefulSet) {
        throw new Error(`No StatefulSet found for project ${projectName}`)
      }

      const statefulSetName = projectStatefulSet.metadata.name

      await this.k8sAppsApi.patchNamespacedStatefulSet({
        name: statefulSetName,
        namespace,
        body: {
          spec: {
            replicas: 1,
          },
        },
      })

      console.log(`✅ Started StatefulSet: ${statefulSetName} (scaled to 1 replica)`)
    } catch (error) {
      console.error(`Failed to start sandbox:`, error)
      throw error
    }
  }

  /**
   * 更新 StatefulSet 环境变量
   */
  async updateStatefulSetEnvVars(
    projectName: string,
    namespace: string,
    envVars: Record<string, string>,
    getDatabaseSecret: (projectName: string, namespace: string) => Promise<DatabaseInfo>
  ) {
    const k8sProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 20)

    try {
      const statefulSets = await this.k8sAppsApi.listNamespacedStatefulSet({ namespace })
      const statefulSetItems = (statefulSets as any).body?.items || statefulSets.items || []
      const projectStatefulSet = statefulSetItems.find((sts: any) =>
        sts.metadata.name.startsWith(`${k8sProjectName}-agentruntime-`)
      )

      if (!projectStatefulSet) {
        throw new Error(`No StatefulSet found for project ${projectName}`)
      }

      const statefulSetName = projectStatefulSet.metadata.name
      const claudeEnvVars = this.loadClaudeEnvVars()

      let dbConnectionString = ''
      try {
        const dbInfo = await getDatabaseSecret(k8sProjectName, namespace)
        dbConnectionString = `postgresql://${dbInfo.username}:${dbInfo.password}@${dbInfo.host}:${dbInfo.port}/${dbInfo.database}?schema=public`
      } catch (error) {
        console.log('Could not get database info for environment update')
      }

      const allEnvVars = {
        ...claudeEnvVars,
        ...envVars,
        DATABASE_URL: dbConnectionString || claudeEnvVars.DATABASE_URL,
        NODE_ENV: 'development',
        TTYD_PORT: '7681',
        TTYD_INTERFACE: '0.0.0.0',
      }

      const updatedStatefulSet = {
        ...projectStatefulSet,
        spec: {
          ...projectStatefulSet.spec,
          template: {
            ...projectStatefulSet.spec.template,
            spec: {
              ...projectStatefulSet.spec.template.spec,
              containers: projectStatefulSet.spec.template.spec.containers.map((container: any) => {
                if (container.name === statefulSetName) {
                  return {
                    ...container,
                    env: Object.entries(allEnvVars).map(([key, value]) => ({
                      name: key,
                      value: String(value),
                    })),
                  }
                }
                return container
              }),
            },
          },
        },
      }

      await this.k8sAppsApi.replaceNamespacedStatefulSet({
        name: statefulSetName,
        namespace,
        body: updatedStatefulSet,
      })

      console.log(`✅ Updated StatefulSet ${statefulSetName} with new environment variables`)
      return true
    } catch (error) {
      console.error(`Failed to update StatefulSet environment variables:`, error)
      throw error
    }
  }

  /**
   * 生成随机名称
   */
  private generateRandomName(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyz'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return result
  }
}
