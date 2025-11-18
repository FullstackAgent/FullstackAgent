import * as k8s from '@kubernetes/client-node'

import { logger as baseLogger } from '@/lib/logger'

import { isK8sNotFound } from './k8s-error-utils'
import { KubernetesUtils } from './kubernetes-utils'
import { VERSIONS } from './versions'

const logger = baseLogger.child({ module: 'lib/k8s/sandbox-manager' })

/**
 * Sandbox information
 */
export interface SandboxInfo {
  /** StatefulSet name (equals sandboxName) */
  statefulSetName: string
  /** Service name */
  serviceName: string
  /** Application access URL */
  publicUrl: string
  /** Terminal access URL */
  ttydUrl: string
}

/**
 * Sandbox running status (matches ResourceStatus enum in Prisma schema)
 *
 * Status is determined purely from K8s StatefulSet state:
 * - STARTING: spec.replicas > 0, but pods not ready yet (starting up)
 * - RUNNING: spec.replicas > 0, all pods ready
 * - STOPPING: spec.replicas = 0, but currentReplicas > 0 (pods terminating)
 * - STOPPED: spec.replicas = 0, currentReplicas = 0 (fully stopped)
 * - TERMINATED: StatefulSet doesn't exist (deleted from K8s)
 * - ERROR: Failed to query K8s or other errors
 *
 * Note: CREATING state is managed at DB level, not returned by this K8s layer
 */
export type SandboxStatus = 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'TERMINATED' | 'ERROR'

/**
 * StatefulSet detailed status information
 */
export interface StatefulSetStatusDetail {
  /** Current status */
  status: SandboxStatus
  /** Desired replica count */
  replicas: number
  /** Ready replica count */
  readyReplicas: number
  /** Current replica count */
  currentReplicas: number
  /** Updated replica count */
  updatedReplicas: number
  /** Current revision */
  currentRevision?: string
  /** Update revision */
  updateRevision?: string
  /** Whether ready (all replicas are ready) */
  isReady: boolean
}

/**
 * Sandbox Manager - Manages Kubernetes StatefulSet sandbox environments
 *
 * Core principles:
 * 1. All resource operations based on exact sandboxName and k8sProjectName
 * 2. No fuzzy matching, all lookups are exact matches
 * 3. Resource naming rules:
 *    - StatefulSet: {sandboxName}
 *    - Service: {sandboxName}-service
 *    - Ingress: {sandboxName}-app-ingress, {sandboxName}-ttyd-ingress
 */
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
   * Create Sandbox environment
   *
   * @param projectName - Project name (used to generate k8sProjectName)
   * @param namespace - Kubernetes namespace
   * @param ingressDomain - Ingress domain (e.g., usw.sealos.io)
   * @param sandboxName - Sandbox name (exact resource name, e.g., project-abc123)
   * @returns Sandbox information
   */
  async createSandbox(
    projectName: string,
    namespace: string,
    ingressDomain: string,
    sandboxName: string,
    envVars: Record<string, string> = {}
  ): Promise<SandboxInfo> {
    logger.info(`Creating sandbox: ${sandboxName} for project: ${projectName}`)

    const k8sProjectName = KubernetesUtils.toK8sProjectName(projectName)

    // Prepare container environment
    const containerEnv: Record<string, string> = {
      ...envVars,
      PROJECT_NAME: projectName,
    }

    // Create StatefulSet
    await this.createStatefulSet(sandboxName, k8sProjectName, namespace, containerEnv)
    logger.info(`StatefulSet created: ${sandboxName}`)

    // Create Service
    const serviceName = this.getServiceName(sandboxName)
    await this.createService(sandboxName, k8sProjectName, namespace)
    logger.info(`Service created: ${serviceName}`)

    // Create Ingresses
    await this.createIngresses(sandboxName, k8sProjectName, namespace, serviceName, ingressDomain)
    logger.info(`Ingresses created for: ${sandboxName}`)

    // Build ttydUrl with authentication token if available
    const baseTtydUrl = `https://${sandboxName}-ttyd.${ingressDomain}`
    const ttydAccessToken = envVars['TTYD_ACCESS_TOKEN']
    const ttydUrl = ttydAccessToken ? `${baseTtydUrl}?arg=${ttydAccessToken}` : baseTtydUrl

    return {
      statefulSetName: sandboxName,
      serviceName: serviceName,
      publicUrl: `https://${sandboxName}-app.${ingressDomain}`,
      ttydUrl: ttydUrl,
    }
  }

  /**
   * Delete Sandbox environment
   *
   * Precisely delete all resources for specified sandboxName
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox name (exact match)
   */
  async deleteSandbox(namespace: string, sandboxName: string): Promise<void> {
    logger.info(`Deleting sandbox: ${sandboxName}`)

    // Delete all resources in parallel
    await Promise.all([
      this.deleteStatefulSet(sandboxName, namespace),
      this.deleteService(sandboxName, namespace),
      this.deleteIngresses(sandboxName, namespace),
      this.deletePVCs(sandboxName, namespace),
    ])

    logger.info(`Sandbox deleted: ${sandboxName}`)
  }

  /**
   * Stop Sandbox (set replica count to 0)
   *
   * This method is idempotent - can be called multiple times safely:
   * - If StatefulSet doesn't exist, logs warning and returns (already deleted)
   * - If already stopped (replicas=0), logs info and returns (no-op)
   * - Otherwise, sets replicas to 0
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox name (exact match)
   */
  async stopSandbox(namespace: string, sandboxName: string): Promise<void> {
    logger.info(`Stopping sandbox: ${sandboxName}`)

    try {
      // Find StatefulSet by exact match
      const statefulSet = await this.getStatefulSet(sandboxName, namespace)

      if (!statefulSet) {
        // Idempotent: StatefulSet doesn't exist (already deleted or never created)
        logger.warn(`StatefulSet not found (already deleted): ${sandboxName}`)
        return
      }

      const currentReplicas = statefulSet.spec?.replicas || 0

      // Idempotent: Already stopped, no need to patch
      if (currentReplicas === 0) {
        logger.info(`Sandbox already stopped: ${sandboxName}`)
        return
      }

      // Update replica count to 0
      // Use JSON Patch format (array of operations)
      await this.k8sAppsApi.patchNamespacedStatefulSet({
        name: sandboxName,
        namespace,
        body: [
          {
            op: 'replace',
            path: '/spec/replicas',
            value: 0,
          },
        ],
      })

      logger.info(`Sandbox stopped: ${sandboxName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to stop sandbox: ${sandboxName} - ${errorMessage}`)
      throw error
    }
  }

  /**
   * Start Sandbox (set replica count to 1)
   *
   * This method is idempotent - can be called multiple times safely:
   * - If StatefulSet doesn't exist, logs warning and returns (already deleted)
   * - If already running (replicas=1), logs info and returns (no-op)
   * - Otherwise, sets replicas to 1
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox name (exact match)
   */
  async startSandbox(namespace: string, sandboxName: string): Promise<void> {
    logger.info(`Starting sandbox: ${sandboxName}`)

    try {
      // Find StatefulSet by exact match
      const statefulSet = await this.getStatefulSet(sandboxName, namespace)

      if (!statefulSet) {
        // Idempotent: StatefulSet doesn't exist (already deleted or never created)
        logger.warn(`StatefulSet not found (already deleted): ${sandboxName}`)
        return
      }

      const currentReplicas = statefulSet.spec?.replicas || 0

      // Idempotent: Already running, no need to patch
      if (currentReplicas >= 1) {
        logger.info(`Sandbox already running: ${sandboxName}`)
        return
      }

      // Update replica count to 1
      // Use JSON Patch format (array of operations)
      await this.k8sAppsApi.patchNamespacedStatefulSet({
        name: sandboxName,
        namespace,
        body: [
          {
            op: 'replace',
            path: '/spec/replicas',
            value: 1,
          },
        ],
      })

      logger.info(`Sandbox started: ${sandboxName}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to start sandbox: ${sandboxName} - ${errorMessage}`)
      throw error
    }
  }

  /**
   * Get Sandbox status (simple version)
   *
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox name
   * @returns Sandbox status
   */
  async getSandboxStatus(namespace: string, sandboxName: string): Promise<SandboxStatus> {
    const detail = await this.getStatefulSetStatus(sandboxName, namespace)
    return detail.status
  }

  /**
   * Get StatefulSet detailed status
   *
   * Status determination logic based on K8s StatefulSet state:
   * 1. StatefulSet doesn't exist → TERMINATED
   * 2. spec.replicas = 0, currentReplicas = 0 → STOPPED
   * 3. spec.replicas = 0, currentReplicas > 0 → STOPPING (pods terminating)
   * 4. spec.replicas > 0, all pods ready → RUNNING
   * 5. spec.replicas > 0, pods not ready → STARTING (pods starting up)
   * 6. Error cases → ERROR
   *
   * @param sandboxName - Sandbox name
   * @param namespace - Kubernetes namespace
   * @returns StatefulSet detailed status
   */
  async getStatefulSetStatus(
    sandboxName: string,
    namespace: string
  ): Promise<StatefulSetStatusDetail> {
    try {
      const statefulSet = await this.getStatefulSet(sandboxName, namespace)

      if (!statefulSet) {
        return {
          status: 'TERMINATED',
          replicas: 0,
          readyReplicas: 0,
          currentReplicas: 0,
          updatedReplicas: 0,
          isReady: false,
        }
      }

      const specReplicas = statefulSet.spec?.replicas || 0
      const statusReplicas = statefulSet.status?.replicas || 0
      const readyReplicas = statefulSet.status?.readyReplicas || 0
      const currentReplicas = statefulSet.status?.currentReplicas || 0
      const updatedReplicas = statefulSet.status?.updatedReplicas || 0
      const currentRevision = statefulSet.status?.currentRevision
      const updateRevision = statefulSet.status?.updateRevision

      // Determine if ready (all replicas running and ready)
      const isReady =
        specReplicas > 0 &&
        statusReplicas === specReplicas &&
        readyReplicas === specReplicas &&
        currentReplicas === specReplicas &&
        updatedReplicas === specReplicas

      // Determine status based on K8s state
      let status: SandboxStatus

      if (specReplicas === 0) {
        // Desired state: stopped (replicas=0)
        if (currentReplicas > 0) {
          // Pods still terminating
          status = 'STOPPING'
        } else {
          // Fully stopped
          status = 'STOPPED'
        }
      } else {
        // Desired state: running (specReplicas > 0)
        if (isReady) {
          // All pods ready
          status = 'RUNNING'
        } else {
          // Pods not ready yet (starting up)
          status = 'STARTING'
        }
      }

      return {
        status,
        replicas: specReplicas,
        readyReplicas,
        currentReplicas,
        updatedReplicas,
        currentRevision,
        updateRevision,
        isReady,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to get StatefulSet status: ${sandboxName} - ${errorMessage}`)

      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response: { statusCode?: number } }).response === 'object' &&
        (error as { response: { statusCode?: number } }).response.statusCode === 404
      ) {
        return {
          status: 'TERMINATED',
          replicas: 0,
          readyReplicas: 0,
          currentReplicas: 0,
          updatedReplicas: 0,
          isReady: false,
        }
      }

      return {
        status: 'ERROR',
        replicas: 0,
        readyReplicas: 0,
        currentReplicas: 0,
        updatedReplicas: 0,
        isReady: false,
      }
    }
  }

  /**
   * Update StatefulSet environment variables (idempotent)
   *
   * This method ensures environment variables are up-to-date:
   * 1. Returns false if StatefulSet doesn't exist
   * 2. Returns true without changes if env vars are already correct
   * 3. Updates StatefulSet only if there are differences
   *
   * @param projectName - Project name
   * @param namespace - Kubernetes namespace
   * @param sandboxName - Sandbox name
   * @param envVars - Environment variables to set
   * @returns true if successful or no changes needed, false if StatefulSet not found
   */
  async updateStatefulSetEnvVars(
    namespace: string,
    sandboxName: string,
    envVars: Record<string, string>
  ): Promise<boolean> {
    logger.info(`Updating StatefulSet env vars: ${sandboxName}`)

    try {
      // Step 1: Find StatefulSet by exact match
      const statefulSet = await this.getStatefulSet(sandboxName, namespace)

      if (!statefulSet) {
        // StatefulSet doesn't exist - return false
        logger.warn(`StatefulSet not found: ${sandboxName}`)
        return false
      }

      // Step 2: Get current environment variables from the main container
      const mainContainer = statefulSet.spec!.template.spec!.containers.find(
        (container) => container.name === sandboxName
      )

      if (!mainContainer) {
        logger.error(`Main container not found in StatefulSet: ${sandboxName}`)
        return false
      }

      // Convert current env array to map for comparison
      const currentEnvMap: Record<string, string> = {}
      if (mainContainer.env) {
        for (const envVar of mainContainer.env) {
          if (envVar.name && envVar.value !== undefined) {
            currentEnvMap[envVar.name] = envVar.value
          }
        }
      }

      // Step 3: Check if environment variables have changed
      let hasChanges = false

      // Check if all desired envVars are present with correct values
      for (const [key, value] of Object.entries(envVars)) {
        if (currentEnvMap[key] !== String(value)) {
          hasChanges = true
          break
        }
      }

      // Check if there are any extra env vars that should be removed (optional)
      // For now, we only add/update, not remove, so we skip this check

      if (!hasChanges) {
        // No changes needed - environment variables are already correct
        logger.info(`StatefulSet env vars unchanged: ${sandboxName}`)
        return true
      }

      // Step 4: Merge environment variables (preserve existing, add/update new ones)
      const mergedEnvMap: Record<string, string> = {
        ...currentEnvMap,
        ...envVars,
      }

      // Convert merged map back to env array
      const updatedEnv = Object.entries(mergedEnvMap).map(([key, value]) => ({
        name: key,
        value: String(value),
      }))

      // Step 5: Update container environment variables
      const containers = statefulSet.spec!.template.spec!.containers.map((container) => {
        // Match main container (name equals sandboxName)
        if (container.name === sandboxName) {
          return {
            ...container,
            env: updatedEnv,
          }
        }
        return container
      })

      // Create updated StatefulSet spec
      const updatedSpec: k8s.V1StatefulSetSpec = {
        ...statefulSet.spec!,
        template: {
          ...statefulSet.spec!.template,
          spec: {
            ...statefulSet.spec!.template.spec!,
            containers,
          },
        },
      }

      // Create updated StatefulSet
      const updatedStatefulSet: k8s.V1StatefulSet = {
        ...statefulSet,
        spec: updatedSpec,
      }

      // Step 6: Apply changes to Kubernetes
      await this.k8sAppsApi.replaceNamespacedStatefulSet({
        name: sandboxName,
        namespace,
        body: updatedStatefulSet,
      })

      logger.info(`StatefulSet env vars updated successfully: ${sandboxName}`)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to update StatefulSet env vars: ${sandboxName} - ${errorMessage}`)
      throw error
    }
  }

  // ==================== Private Methods ====================

  /**
   * Get Service name
   */
  private getServiceName(sandboxName: string): string {
    return `${sandboxName}-service`
  }

  /**
   * Get App Ingress name
   */
  private getAppIngressName(sandboxName: string): string {
    return `${sandboxName}-app-ingress`
  }

  /**
   * Get Ttyd Ingress name
   */
  private getTtydIngressName(sandboxName: string): string {
    return `${sandboxName}-ttyd-ingress`
  }

  /**
   * Find StatefulSet by exact match
   *
   * @param sandboxName - Sandbox name
   * @param namespace - Kubernetes namespace
   * @returns StatefulSet object, or null if not found
   */
  private async getStatefulSet(
    sandboxName: string,
    namespace: string
  ): Promise<k8s.V1StatefulSet | null> {
    try {
      const response = await this.k8sAppsApi.readNamespacedStatefulSet({
        name: sandboxName,
        namespace,
      })
      // Handle different response formats from kubernetes client
      const body = (response as { body?: k8s.V1StatefulSet }).body
      return body || (response as k8s.V1StatefulSet)
    } catch (error) {
      if (isK8sNotFound(error)) {
        return null
      }
      throw error
    }
  }

  /**
   * Create StatefulSet (idempotent - skips if already exists)
   */
  private async createStatefulSet(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    containerEnv: Record<string, string>
  ): Promise<void> {
    // Check if StatefulSet already exists
    const existingStatefulSet = await this.getStatefulSet(sandboxName, namespace)
    if (existingStatefulSet) {
      logger.info(`StatefulSet already exists, skipping creation: ${sandboxName}`)
      return
    }

    const statefulSet: k8s.V1StatefulSet = {
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      metadata: {
        name: sandboxName,
        namespace,
        annotations: {
          originImageName: VERSIONS.RUNTIME_IMAGE,
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
        serviceName: this.getServiceName(sandboxName),
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
        // Automatically delete PVCs when StatefulSet is deleted
        // This prevents orphaned PVCs and storage costs
        persistentVolumeClaimRetentionPolicy: {
          whenDeleted: 'Delete', // Delete PVCs when StatefulSet is deleted
          whenScaled: 'Retain', // Keep PVCs when scaling down (for potential scale-up)
        },
        template: {
          metadata: {
            labels: {
              app: sandboxName,
              'project.fullstackagent.io/name': k8sProjectName,
            },
          },
          spec: {
            initContainers: [
              {
                name: 'init-home-directory',
                image: VERSIONS.RUNTIME_IMAGE,
                command: ['sh', '-c'],
                args: [this.generateInitContainerScript()],
                volumeMounts: [
                  {
                    name: 'vn-homevn-fulling',
                    mountPath: '/home/fulling',
                  },
                ],
                securityContext: {
                  runAsUser: 0,
                  runAsNonRoot: false,
                },
                // Resource limits for init container: needs more memory to copy Next.js template (200-300MB)
                resources: {
                  requests: {
                    cpu: '200m',
                    memory: '512Mi',
                  },
                  limits: {
                    cpu: '2000m',
                    memory: '4096Mi',
                  },
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
                image: VERSIONS.RUNTIME_IMAGE,
                env: Object.entries(containerEnv).map(([key, value]) => ({
                  name: key,
                  value: String(value),
                })),
                resources: VERSIONS.RESOURCES.SANDBOX,
                ports: [
                  { containerPort: 3000, name: 'port-3000' },
                  { containerPort: 7681, name: 'port-7681' },
                ],
                imagePullPolicy: 'Always',
                volumeMounts: [
                  {
                    name: 'vn-homevn-fulling',
                    mountPath: '/home/fulling',
                  },
                ],
              },
            ],
            volumes: [],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: {
              annotations: {
                path: '/home/fulling',
                value: VERSIONS.STORAGE.SANDBOX_SIZE.replace('Gi', ''),
              },
              name: 'vn-homevn-fulling',
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

    try {
      await this.k8sAppsApi.createNamespacedStatefulSet({ namespace, body: statefulSet })
    } catch (error) {
      // Handle 409 Conflict (AlreadyExists) as idempotent operation
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response: { statusCode?: number } }).response === 'object' &&
        (error as { response: { statusCode?: number } }).response.statusCode === 409
      ) {
        logger.info(`StatefulSet already exists (409), skipping creation: ${sandboxName}`)
        return
      }
      // Re-throw other errors
      throw error
    }
  }

  /**
   * Generate init container script
   *
   * Purpose: Initialize /home/fulling PVC with necessary files on first run
   *
   * What gets initialized:
   * 1. .bashrc - Shell configuration (only if doesn't exist, never overwrite user changes)
   * 2. next/ - Next.js project template WITHOUT node_modules (only if directory is empty)
   *
   * Safety strategy:
   * - .bashrc: Copy only if missing (user may have customized it)
   * - next/: Copy only if directory doesn't exist or is completely empty
   * - Never overwrites existing user files
   * - node_modules NOT copied (removed from image to avoid root permission issues)
   */
  private generateInitContainerScript(): string {
    return `
set -e

echo "=== Init Container: Home Directory Initialization ==="

# -----------------------------------------------------------------------------
# Step 1: Initialize .bashrc (if not exists)
# Rationale: User may customize .bashrc, so we never overwrite existing file
# -----------------------------------------------------------------------------
if [ -f /home/fulling/.bashrc ]; then
  echo "✓ .bashrc already exists (preserving user configuration)"
else
  if [ -f /etc/skel/.bashrc ]; then
    echo "→ Copying default .bashrc configuration..."
    cp /etc/skel/.bashrc /home/fulling/.bashrc
    chown 1001:1001 /home/fulling/.bashrc
    chmod 644 /home/fulling/.bashrc
    echo "✓ .bashrc initialized"
  else
    echo "⚠ Warning: /etc/skel/.bashrc not found in image"
  fi
fi

# -----------------------------------------------------------------------------
# Step 2: Initialize Next.js project (if not exists or empty)
# Rationale: ANY file in next/ indicates user work - must not overwrite
# -----------------------------------------------------------------------------
if [ -d /home/fulling/next ]; then
  # Directory exists, check if it contains any files (including hidden files)
  if [ -n "$(ls -A /home/fulling/next 2>/dev/null)" ]; then
    echo "✓ Next.js project already exists (preserving user project)"
    echo "  Location: /home/fulling/next"
    
    # Skip to end - all initialization done
    echo ""
    echo "=== Initialization Summary ==="
    echo "✓ .bashrc: $([ -f /home/fulling/.bashrc ] && echo 'ready' || echo 'missing')"
    echo "✓ Next.js project: ready (existing)"
    echo "✓ All user data preserved"
    echo ""
    echo "=== Init Container: Completed successfully ==="
    exit 0
  else
    echo "→ /home/fulling/next exists but is empty"
    echo "→ Removing empty directory and proceeding with initialization"
    rmdir /home/fulling/next
  fi
fi

# If we reach here, next/ doesn't exist or was empty
echo "→ No existing Next.js project detected"
echo "→ Proceeding with project template initialization..."

# Verify template exists in image
if [ ! -d /opt/next-template ]; then
  echo "✗ ERROR: Next.js template not found at /opt/next-template"
  echo "  This is likely a build issue - template should be in the image"
  exit 1
fi

# Copy Next.js project template (without node_modules)
echo "→ Copying Next.js project template from /opt/next-template..."
echo "  Source: /opt/next-template (agent:agent)"
echo "  Target: /home/fulling/next"
echo "  Note: node_modules NOT included - run 'pnpm install' to install dependencies"
echo "  This may take 5-10 seconds..."
mkdir -p /home/fulling/next

# Copy project files (node_modules already removed from image)
# Using cp instead of rsync for simplicity (rsync is available but cp is sufficient)
cp -rp /opt/next-template/. /home/fulling/next 2>&1 || {
  echo "✗ ERROR: Failed to copy template"
  exit 1
}

# Verify copy was successful
if [ ! -f /home/fulling/next/package.json ]; then
  echo "✗ ERROR: Project copy incomplete - package.json not found"
  ls -la /home/fulling/next 2>&1 || true
  exit 1
fi

echo "✓ Next.js project template copied successfully"

# Set ownership and permissions for copied files
# Note: Even though source files are agent:agent in the image,
# cp creates new files owned by the current user (root in init container)
echo "→ Setting ownership (agent:1001) and permissions..."
chown -R 1001:1001 /home/fulling/next 2>&1 || {
  echo "⚠ Warning: Failed to set ownership, but continuing..."
}
chmod -R u+rwX,g+rX,o+rX /home/fulling/next 2>&1 || {
  echo "⚠ Warning: Failed to set permissions, but continuing..."
}

# Count files for verification
FILE_COUNT=$(find /home/fulling/next -type f | wc -l)
echo "✓ Copied $FILE_COUNT files"

echo ""
echo "=== Initialization Summary ==="
echo "✓ .bashrc: $([ -f /home/fulling/.bashrc ] && echo 'ready' || echo 'missing')"
echo "✓ Next.js project: ready (newly created)"
echo "✓ Location: /home/fulling/next"
echo "✓ Ownership: agent (1001:1001)"
echo "✓ Files copied: $FILE_COUNT"
echo "⚠ node_modules not included - run 'pnpm install' to install dependencies"
echo "✓ To start: cd ~/next && pnpm install && pnpm dev"
echo ""
echo "=== Init Container: Completed successfully ==="
    `.trim()
  }

  /**
   * Create Service (idempotent - skips if already exists)
   */
  private async createService(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string
  ): Promise<void> {
    const serviceName = this.getServiceName(sandboxName)

    // Check if Service already exists
    try {
      await this.k8sApi.readNamespacedService({ name: serviceName, namespace })
      logger.info(`Service already exists, skipping creation: ${serviceName}`)
      return
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response: { statusCode?: number } }).response === 'object' &&
        (error as { response: { statusCode?: number } }).response.statusCode !== 404
      ) {
        throw error
      }
      // 404 means doesn't exist, continue to create
    }

    const service: k8s.V1Service = {
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
          { port: 3000, targetPort: 3000, name: 'port-3000', protocol: 'TCP' },
          { port: 7681, targetPort: 7681, name: 'port-7681', protocol: 'TCP' },
        ],
        selector: {
          app: sandboxName,
        },
      },
    }

    await this.k8sApi.createNamespacedService({ namespace, body: service })
  }

  /**
   * Create Ingresses (App and Ttyd) - idempotent
   */
  private async createIngresses(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    serviceName: string,
    ingressDomain: string
  ): Promise<void> {
    const appIngressName = this.getAppIngressName(sandboxName)
    const ttydIngressName = this.getTtydIngressName(sandboxName)

    const appIngress = this.createAppIngress(
      sandboxName,
      k8sProjectName,
      namespace,
      serviceName,
      ingressDomain
    )
    const ttydIngress = this.createTtydIngress(
      sandboxName,
      k8sProjectName,
      namespace,
      serviceName,
      ingressDomain
    )

    await Promise.all([
      this.createIngressIfNotExists(appIngressName, namespace, appIngress),
      this.createIngressIfNotExists(ttydIngressName, namespace, ttydIngress),
    ])
  }

  /**
   * Create Ingress if it doesn't exist (idempotent helper)
   */
  private async createIngressIfNotExists(
    ingressName: string,
    namespace: string,
    ingress: k8s.V1Ingress
  ): Promise<void> {
    try {
      await this.k8sNetworkingApi.readNamespacedIngress({ name: ingressName, namespace })
      logger.info(`Ingress already exists, skipping creation: ${ingressName}`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        await this.k8sNetworkingApi.createNamespacedIngress({ namespace, body: ingress })
      } else {
        throw error
      }
    }
  }

  /**
   * Create App Ingress
   */
  private createAppIngress(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    serviceName: string,
    ingressDomain: string
  ): k8s.V1Ingress {
    const ingressName = this.getAppIngressName(sandboxName)
    const host = `${sandboxName}-app.${ingressDomain}`

    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: ingressName,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          'cloud.sealos.io/app-deploy-manager-domain': `${sandboxName}-app`,
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
            host,
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
            hosts: [host],
            secretName: 'wildcard-cert',
          },
        ],
      },
    }
  }

  /**
   * Create ttyd Ingress
   */
  private createTtydIngress(
    sandboxName: string,
    k8sProjectName: string,
    namespace: string,
    serviceName: string,
    ingressDomain: string
  ): k8s.V1Ingress {
    const ingressName = this.getTtydIngressName(sandboxName)
    const host = `${sandboxName}-ttyd.${ingressDomain}`

    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: ingressName,
        namespace,
        labels: {
          'cloud.sealos.io/app-deploy-manager': sandboxName,
          'cloud.sealos.io/app-deploy-manager-domain': `${sandboxName}-ttyd`,
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
            host,
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
            hosts: [host],
            secretName: 'wildcard-cert',
          },
        ],
      },
    }
  }

  /**
   * Delete StatefulSet (exact deletion)
   */
  private async deleteStatefulSet(sandboxName: string, namespace: string): Promise<void> {
    try {
      await this.k8sAppsApi.deleteNamespacedStatefulSet({
        name: sandboxName,
        namespace,
      })
      logger.info(`Deleted StatefulSet: ${sandboxName}`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.warn(`StatefulSet not found (already deleted): ${sandboxName}`)
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to delete StatefulSet: ${sandboxName} - ${errorMessage}`)
        throw error
      }
    }
  }

  /**
   * Delete Service (exact deletion)
   */
  private async deleteService(sandboxName: string, namespace: string): Promise<void> {
    const serviceName = this.getServiceName(sandboxName)
    try {
      await this.k8sApi.deleteNamespacedService({
        name: serviceName,
        namespace,
      })
      logger.info(`Deleted Service: ${serviceName}`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.warn(`Service not found (already deleted): ${serviceName}`)
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to delete Service: ${serviceName} - ${errorMessage}`)
        throw error
      }
    }
  }

  /**
   * Delete Ingresses (exact deletion of App and Ttyd Ingress)
   */
  private async deleteIngresses(sandboxName: string, namespace: string): Promise<void> {
    const appIngressName = this.getAppIngressName(sandboxName)
    const ttydIngressName = this.getTtydIngressName(sandboxName)

    await Promise.all([
      this.deleteIngress(appIngressName, namespace),
      this.deleteIngress(ttydIngressName, namespace),
    ])
  }

  /**
   * Delete single Ingress
   */
  private async deleteIngress(ingressName: string, namespace: string): Promise<void> {
    try {
      await this.k8sNetworkingApi.deleteNamespacedIngress({
        name: ingressName,
        namespace,
      })
      logger.info(`Deleted Ingress: ${ingressName}`)
    } catch (error) {
      if (isK8sNotFound(error)) {
        logger.warn(`Ingress not found (already deleted): ${ingressName}`)
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to delete Ingress: ${ingressName} - ${errorMessage}`)
        throw error
      }
    }
  }

  /**
   * Delete PVCs associated with a StatefulSet
   *
   * StatefulSets create PVCs with names: {volumeClaimTemplate.name}-{statefulset.name}-{ordinal}
   * For our case: vn-homevn-fulling-{sandboxName}-0
   *
   * This method handles both:
   * 1. Clusters with persistentVolumeClaimRetentionPolicy support (Kubernetes 1.23+)
   * 2. Older clusters where PVCs need manual cleanup
   *
   * @param sandboxName - Sandbox name
   * @param namespace - Kubernetes namespace
   */
  private async deletePVCs(sandboxName: string, namespace: string): Promise<void> {
    try {
      // List all PVCs in namespace that belong to this StatefulSet
      // StatefulSet PVC naming: {volumeClaimTemplate.name}-{statefulset.name}-{ordinal}
      const pvcName = `vn-homevn-fulling-${sandboxName}-0`

      try {
        await this.k8sApi.deleteNamespacedPersistentVolumeClaim({
          name: pvcName,
          namespace,
        })
        logger.info(`Deleted PVC: ${pvcName}`)
      } catch (error) {
        if (isK8sNotFound(error)) {
          logger.info(
            `PVC not found (may have been auto-deleted by persistentVolumeClaimRetentionPolicy): ${pvcName}`
          )
        } else {
          throw error
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to delete PVCs for sandbox: ${sandboxName} - ${errorMessage}`)
      // Don't throw - PVC deletion failure shouldn't block sandbox cleanup
      // The PVCs might have already been deleted by K8s retention policy
    }
  }
}
