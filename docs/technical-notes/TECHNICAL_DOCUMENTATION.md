# FullStack Agent - Technical Implementation Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Kubernetes Integration](#kubernetes-integration)
4. [Database Management](#database-management)
5. [Authentication Flow](#authentication-flow)
6. [Sandbox Lifecycle](#sandbox-lifecycle)
7. [API Design](#api-design)
8. [Security Implementation](#security-implementation)
9. [Performance Optimizations](#performance-optimizations)
10. [Troubleshooting Guide](#troubleshooting-guide)

## System Architecture

### Overview
FullStack Agent follows a microservices-inspired architecture deployed on Kubernetes, with clear separation between the control plane (Next.js application) and the data plane (sandbox environments).

### Component Diagram
```
┌──────────────────────────────────────────────────────────────────┐
│                          Control Plane                            │
├────────────────────────────────────────────────────────────────── │
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Next.js   │───▶│   Prisma    │───▶│ PostgreSQL  │         │
│  │  App Router │    │     ORM     │    │   Database  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  NextAuth   │───▶│   GitHub    │    │ Kubernetes  │        │
│  │     v5      │    │   OAuth     │    │   Service   │        │
│  └─────────────┘    └─────────────┘    └─────▬───────┘        │
│                                                │                 │
└─────────────────────────────────────────────── │ ────────────────┘
                                                  │
┌──────────────────────────────────────────────── ▼ ────────────────┐
│                          Data Plane                               │
├────────────────────────────────────────────────────────────────── │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Kubernetes Cluster                       │   │
│  │                                                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │  KubeBlocks  │  │   Sandbox    │  │   Ingress    │  │   │
│  │  │  PostgreSQL  │  │  Deployment  │  │  Controller  │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└────────────────────────────────────────────────────────────────── │
```

## Core Components

### 1. Kubernetes Management (v0.4.0+)

The platform uses **user-specific Kubernetes services** for multi-tenancy isolation.

#### Architecture Changes (v0.4.0):
- **OLD**: Single global `KubernetesService` class (`lib/kubernetes.ts` - DEPRECATED)
- **NEW**: User-specific managers via `getK8sServiceForUser()` helper
- **Components**:
  - `SandboxManager` (`lib/k8s/sandbox-manager.ts`) - StatefulSet management
  - `DatabaseManager` (`lib/k8s/database-manager.ts`) - KubeBlocks management
  - `K8sServiceHelper` (`lib/k8s/k8s-service-helper.ts`) - User kubeconfig loading

#### Key Responsibilities:
- **User Isolation**: Each user operates in their own Kubernetes namespace
- **Resource Creation**: StatefulSets, Services, Ingresses (sandboxes)
- **Database Provisioning**: KubeBlocks PostgreSQL clusters
- **Status Monitoring**: Real-time resource status from K8s API
- **Idempotent Operations**: All methods can be safely called multiple times

#### Implementation (v0.4.0+):

```typescript
// Get user-specific K8s service
import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'

// Load user's kubeconfig from UserConfig table
const k8sService = await getK8sServiceForUser(userId)

// Get managers
const sandboxManager = k8sService.getSandboxManager()
const databaseManager = k8sService.getDatabaseManager()
const namespace = k8sService.getNamespace()

// Example: Create sandbox (idempotent)
await sandboxManager.createSandbox({
  projectName: 'my-project',
  sandboxName: 'my-project-sandbox-abc123',
  namespace,
  envVars: [
    { name: 'DATABASE_URL', value: 'postgresql://...' },
    { name: 'PROJECT_NAME', value: 'my-project' }
  ]
})

// Check status (non-blocking)
const status = await sandboxManager.getSandboxStatus(
  namespace,
  'my-project-sandbox-abc123'
)
// Returns: 'RUNNING' | 'STARTING' | 'STOPPED' | 'STOPPING' | 'TERMINATED' | 'ERROR'
```

#### Critical Fix Applied (2025-10-11):
**Problem**: Kubernetes API responses have inconsistent structure
**Solution**: Handle both `response.body.items` and `response.data` patterns

```typescript
// Extract data from K8s API response
private getK8sData<T>(res: unknown): T {
  const anyRes = res as { data?: unknown; body?: unknown }
  return (anyRes?.data ?? anyRes?.body ?? (res as unknown)) as T
}

// Example usage
const response = await this.k8sApi.listNamespacedStatefulSet({ namespace })
const statefulSets = this.getK8sData<k8s.V1StatefulSetList>(response)
const items = statefulSets.items || []
```

### 2. Database Management

#### KubeBlocks Integration
Uses KubeBlocks for managed PostgreSQL instances with automatic:
- High availability configuration
- Backup and restore capabilities
- Connection credential management

#### Database Creation Flow:
1. Create ServiceAccount with proper labels
2. Create Role with full permissions
3. Create RoleBinding
4. Create KubeBlocks Cluster resource
5. Wait for cluster to be ready
6. Retrieve connection credentials from generated secret

#### Implementation (v0.4.0+):
```typescript
// DatabaseManager methods (lib/k8s/database-manager.ts)
class DatabaseManager {
  async createPostgreSQLDatabase(
    projectName: string,
    namespace: string,
    databaseName: string
  ): Promise<void> {
    const k8sProjectName = KubernetesUtils.toK8sProjectName(projectName)

    // 1. Create RBAC resources (idempotent)
    await this.createServiceAccount(databaseName, k8sProjectName, namespace)
    await this.createRole(databaseName, k8sProjectName, namespace)
    await this.createRoleBinding(databaseName, k8sProjectName, namespace)

    // 2. Create KubeBlocks Cluster (idempotent)
    await this.createCluster(databaseName, k8sProjectName, namespace)
  }

  async getClusterStatus(
    clusterName: string,
    namespace: string
  ): Promise<ClusterStatusDetail> {
    const cluster = await this.getCluster(clusterName, namespace)

    if (!cluster) {
      return { status: 'TERMINATED', replicas: 0 }
    }

    const phase = cluster.status?.phase
    const replicas = cluster.spec.componentSpecs?.[0]?.replicas || 0

    // Map KubeBlocks phase to DatabaseStatus
    switch (phase) {
      case 'Running': return { status: 'RUNNING', phase, replicas }
      case 'Creating': return { status: 'STARTING', phase, replicas }
      case 'Updating':
        return replicas === 0
          ? { status: 'STOPPING', phase, replicas }
          : { status: 'STARTING', phase, replicas }
      case 'Stopped': return { status: 'STOPPED', phase, replicas }
      case 'Deleting': return { status: 'TERMINATING', phase, replicas }
      case 'Failed':
      case 'Abnormal':
        return { status: 'ERROR', phase, replicas }
      default:
        return replicas === 0
          ? { status: 'STOPPED', phase, replicas }
          : { status: 'STARTING', phase, replicas }
    }
  }

  async getDatabaseCredentials(
    clusterName: string,
    namespace: string
  ): Promise<DatabaseInfo | null> {
    const secretName = `${clusterName}-conn-credential`
    const response = await this.k8sApi.readNamespacedSecret({
      name: secretName,
      namespace
    })

    const secretData = this.getK8sData<Record<string, string>>(response)

    if (!secretData || Object.keys(secretData).length === 0) {
      return null // Secret not populated yet
    }

    // Decode base64 values
    return {
      clusterName,
      host: Buffer.from(secretData.host, 'base64').toString('utf-8'),
      port: parseInt(Buffer.from(secretData.port, 'base64').toString('utf-8')),
      username: Buffer.from(secretData.username, 'base64').toString('utf-8'),
      password: Buffer.from(secretData.password, 'base64').toString('utf-8'),
      database: clusterName
    }
  }
}
```

**Key Changes in v0.4.0**:
- All methods are **idempotent** (can be called multiple times safely)
- Returns immediately without waiting for K8s completion
- Status checked separately via `getClusterStatus()`
- Credentials retrieved only when secret is populated
```

### 3. Sandbox Management (v0.4.0+)

#### Sandbox Components:
- **StatefulSet**: Runs the fullstack-web-runtime container (changed from Deployment)
- **Service**: Internal networking for pod access
- **Ingresses**: Two separate ingresses for app and terminal
- **Environment Variables**: Injected from project environments

#### Container Specification (v0.4.0+):
```yaml
image: fullstackagent/fullstack-web-runtime:v0.0.1-alpha.12
ports:
  - 3000  # Next.js application (EXPOSED via ingress)
  - 7681  # ttyd web terminal (EXPOSED via ingress)
  # Ports 5000, 8080, 5173, 8000 NO LONGER exposed by default
resources:
  requests:
    cpu: 20m
    memory: 25Mi
  limits:
    cpu: 200m
    memory: 256Mi
env:
  - name: DATABASE_URL
    value: postgresql://user:pass@host:5432/db
  - name: PROJECT_NAME
    value: my-project
  - name: TTYD_PORT
    value: "7681"
  # Additional env vars from Environment table
```

#### Port Exposure Policy (v0.4.0+):
**Exposed Ports**:
- `3000`: Next.js app → App Ingress (`https://{random}.usw.sealos.io`)
- `7681`: ttyd terminal → Terminal Ingress (`https://{random}-ttyd.usw.sealos.io`)

**Not Exposed** (security improvement):
- `5000`, `8080`, `5173`, `8000` - Reduced attack surface

#### ttyd Terminal Integration:
WebSocket support via ingress annotations:
```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-set-headers: |
    Upgrade $http_upgrade
    Connection "upgrade"
args: [
  '-c',
  `ttyd --port 7681 --interface 0.0.0.0 --check-origin false /bin/bash`
]
```

### 4. Authentication System

#### NextAuth v5 Configuration:
```typescript
export const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Store GitHub access token (encrypted)
        token.accessToken = account.access_token;
        token.githubId = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Attach user ID for database queries
      session.user.id = token.sub!;
      return session;
    }
  }
}
```

## Kubernetes Integration

### Namespace Management
- Uses single namespace from kubeconfig: `ns-ajno7yq7`
- No namespace creation permissions required
- All resources tagged with project labels

### Resource Naming Convention
```
[project-name]-agentruntime-[6-char-random]
```
- Ensures uniqueness across deployments
- Allows easy resource filtering
- Supports multiple sandboxes per project

### Label Strategy
Critical labels for resource management:
```yaml
labels:
  cloud.sealos.io/app-deploy-manager: [resource-name]
  project.fullstackagent.io/name: [project-name]
  app: [deployment-name]
```

### Ingress Configuration
Two ingresses per sandbox:
1. **Application Ingress**: Port 3000
2. **Terminal Ingress**: Port 7681 with WebSocket support

```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-body-size: "32m"
  nginx.ingress.kubernetes.io/ssl-redirect: "false"
  nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
  # For ttyd WebSocket support:
  nginx.ingress.kubernetes.io/proxy-set-headers: |
    Upgrade $http_upgrade
    Connection "upgrade"
```

## Database Management

### Connection String Format
```
postgresql://[username]:[password]@[host]:[port]/[database]?schema=public
```

### Credential Retrieval
KubeBlocks automatically creates secrets with naming pattern:
```
[cluster-name]-conn-credential
```

Secret structure:
```yaml
data:
  host: [base64-encoded]
  port: [base64-encoded]
  database: [base64-encoded]
  username: [base64-encoded]
  password: [base64-encoded]
```

### Database Lifecycle Fix (2025-10-11)
**Problem**: System assumed database exists if `project.databaseUrl` is set
**Solution**: Verify actual cluster existence before using existing database

```typescript
if (project.databaseUrl) {
  try {
    // Try to get database info from Kubernetes
    const dbInfo = await k8sService.getDatabaseSecret(project.name, namespace);
    // Database exists, use it
  } catch (error) {
    // Database doesn't exist, create new one
    needCreateDatabase = true;
  }
}
```

## Sandbox Lifecycle

### Creation Flow
1. **Pre-flight Checks**
   - Verify user authentication
   - Check project ownership
   - Delete existing terminated sandboxes

2. **Database Provisioning**
   - Check if database exists in Kubernetes
   - Create if needed (KubeBlocks cluster)
   - Wait for database ready state
   - Retrieve connection credentials

3. **Sandbox Deployment**
   - Create Kubernetes Deployment
   - Create Service for internal networking
   - Create Ingress for external access
   - Inject environment variables

4. **Post-Creation**
   - Update database records
   - Return public URLs
   - Monitor pod startup status

### Progress Tracking
Five-stage progress indication:
1. **Database Creation**: PostgreSQL provisioning
2. **Container Provisioning**: Deploying runtime pod
3. **Network Configuration**: Setting up services/ingress
4. **Terminal Initialization**: Starting ttyd service
5. **Environment Ready**: Sandbox operational

### Deletion Flow
1. Delete Kubernetes Deployment
2. Delete Service
3. Delete Ingress resources
4. Update database status to "TERMINATED"
5. Keep database for data persistence

## API Design

### RESTful Endpoints

#### Sandbox API
```typescript
// GET /api/sandbox/[projectId]
// Returns sandbox status and URLs

// POST /api/sandbox/[projectId]
// Creates or restarts sandbox
// Body: { envVars: Record<string, string> }

// DELETE /api/sandbox/[projectId]
// Terminates sandbox
```

#### Error Handling
Comprehensive error responses:
```json
{
  "error": "Failed to create sandbox",
  "details": {
    "name": "Error",
    "message": "Detailed error message",
    "stack": "Stack trace (dev only)",
    "kubernetesStatus": "Pod status if available"
  },
  "projectId": "project-id",
  "timestamp": "2025-10-11T10:00:00.000Z"
}
```

## Security Implementation

### Authentication
- GitHub OAuth for user authentication
- Session-based authorization
- Encrypted access token storage

### Kubernetes Security
- ServiceAccount with scoped permissions
- Resource limits to prevent DoS
- Network isolation between sandboxes
- No privileged container access

### Secret Management
```typescript
// Environment variables injection
const containerEnv = {
  ...claudeEnvVars,    // From .secret/.env
  ...projectEnvVars,   // From database
  ...requestEnvVars,   // From API request
  DATABASE_URL: dbConnectionString,
  NODE_ENV: 'development'
};
```

### Input Validation
- Project name sanitization for Kubernetes compatibility
- SQL injection prevention via Prisma ORM
- XSS protection in React components

## Performance Optimizations

### Resource Allocation
Conservative defaults to maximize density:
- CPU: 20m request, 200m limit
- Memory: 25Mi request, 256Mi limit
- Allows ~50 sandboxes per node (2 CPU, 4GB RAM)

### Database Connection Pooling
Prisma connection management:
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});
```

### Caching Strategy
- KubeBlocks cluster list cached for getDatabaseSecret
- Deployment status cached for 5 seconds
- Static assets cached via Next.js

### Parallel Operations
Multiple tool calls for efficiency:
```typescript
// Parallel deletion of resources
await Promise.all([
  deleteDeployments(projectName),
  deleteServices(projectName),
  deleteIngresses(projectName)
]);
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "Failed to create sandbox" Error
**Symptoms**: Sandbox creation fails immediately
**Causes**:
- Kubeconfig not properly loaded
- Kubernetes API unreachable
- Insufficient permissions

**Solutions**:
```bash
# Verify kubeconfig
cat .secret/kubeconfig | grep server
# Should show: https://usw.sealos.io:6443

# Test API connection
node test-k8s.mjs

# Check logs
npm run dev 2>&1 | grep -E "Error|Failed"
```

#### 2. Database Not Created
**Symptoms**: Sandbox created but no database
**Causes**:
- KubeBlocks CRDs not installed
- Project has stale databaseUrl

**Solutions**:
```javascript
// Check existing clusters
node check-databases.mjs

// Clear stale database URL in database
UPDATE projects SET "databaseUrl" = NULL WHERE name = 'project-name';
```

#### 3. Terminal Not Accessible
**Symptoms**: ttyd URL returns 404 or connection refused
**Causes**:
- ttyd not starting properly
- Ingress misconfiguration
- WebSocket headers missing

**Solutions**:
- Check pod logs for ttyd errors
- Verify ingress has WebSocket annotations
- Ensure port 7681 is exposed

#### 4. Kubernetes API Response Issues
**Symptoms**: "Cannot read property 'items' of undefined"
**Fix Applied**: Handle both response formats
```typescript
const items = response.body?.items || (response as any).items || [];
```

### Debugging Commands

```bash
# Check pod status
kubectl --kubeconfig=.secret/kubeconfig get pods -n ns-ajno7yq7

# View pod logs
kubectl --kubeconfig=.secret/kubeconfig logs [pod-name] -n ns-ajno7yq7

# Describe deployment
kubectl --kubeconfig=.secret/kubeconfig describe deployment [name] -n ns-ajno7yq7

# Check ingress
kubectl --kubeconfig=.secret/kubeconfig get ingress -n ns-ajno7yq7
```

### Log Locations
- Next.js server: Console output
- Kubernetes events: `kubectl get events`
- Pod logs: `kubectl logs [pod-name]`
- Database logs: KubeBlocks cluster logs

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for consistency
- Prettier for formatting

### Testing Strategy
- Unit tests for utilities
- Integration tests for API endpoints
- E2E tests for critical flows

### Git Workflow
1. Feature branches from `main`
2. Pull request with review
3. Squash merge to main
4. Automatic deployment via CI/CD

### Environment Management
```
.env.local          # Local development
.env.production     # Production settings
.secret/.env        # Claude Code credentials
.secret/kubeconfig  # Kubernetes config
```

## Reconciliation Architecture (v0.4.0+)

### Overview

Starting from v0.4.0, FullstackAgent uses an **asynchronous reconciliation pattern** inspired by Kubernetes controllers:

1. **API endpoints return immediately** - No blocking on K8s operations
2. **Background jobs** reconcile every 3 seconds
3. **Event-driven architecture** - Jobs emit events → Listeners execute K8s ops
4. **Optimistic locking** prevents concurrent conflicts
5. **Status aggregation** - Project status computed from resources

### Reconciliation Components

#### 1. Reconciliation Jobs (`lib/jobs/`)

**Sandbox Reconcile** (`lib/jobs/sandbox/sandboxReconcile.ts`):
- Runs every 3 seconds via cron
- Queries sandboxes with status IN (`CREATING`, `STARTING`, `STOPPING`, `TERMINATING`)
- Atomically locks up to 10 sandboxes per cycle
- Emits lifecycle events for each sandbox

**Database Reconcile** (`lib/jobs/database/databaseReconcile.ts`):
- Same pattern as sandbox reconciliation
- Handles database lifecycle events

#### 2. Event System (`lib/events/`)

**Event Bus** (`lib/events/sandbox/bus.ts`, `lib/events/database/bus.ts`):
- Simple EventEmitter-based pub/sub
- Events: `CreateSandbox`, `StartSandbox`, `StopSandbox`, `DeleteSandbox`

**Event Listeners** (`lib/events/sandbox/sandboxListener.ts`):
```typescript
// Example: handleStartSandbox
async function handleStartSandbox(payload: SandboxEventPayload) {
  const { user, project, sandbox } = payload

  // Only process STARTING sandboxes
  if (sandbox.status !== 'STARTING') return

  // Execute K8s operation
  const k8sService = await getK8sServiceForUser(user.id)
  await k8sService.startSandbox(sandbox.k8sNamespace, sandbox.sandboxName)

  // Check K8s status
  const k8sStatus = await k8sService.getSandboxStatus(...)

  // If ready, transition to RUNNING
  if (k8sStatus === 'RUNNING') {
    await updateSandboxStatus(sandbox.id, 'RUNNING')
    await projectStatusReconcile(project.id)
  }
  // Otherwise, keep STARTING and poll again next cycle
}
```

#### 3. Repository Layer (`lib/repo/`)

**Optimistic Locking** (`lib/repo/sandbox.ts`):
```typescript
// Atomic query+lock in single database operation
export async function acquireAndLockSandboxes(limit: number) {
  const lockDuration = 30 // seconds

  return await prisma.$queryRaw`
    UPDATE "Sandbox"
    SET "lockedUntil" = NOW() + INTERVAL '${lockDuration} seconds',
        "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "Sandbox"
      WHERE "status" IN ('CREATING', 'STARTING', 'STOPPING', 'TERMINATING')
        AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
      LIMIT ${limit}
    )
    RETURNING *
  `
}
```

**Benefits**:
- Prevents thundering herd problem
- Multiple instances can coexist
- Each instance gets exclusive lock on different records

#### 4. Status Aggregation (`lib/utils/projectStatus.ts`)

**Aggregation Rules** (priority order):
1. **ERROR**: At least one resource has ERROR
2. **CREATING**: At least one resource has CREATING
3. **Pure states**: All same status → use that status
4. **Transition states**:
   - STARTING: All ∈ {RUNNING, STARTING}
   - STOPPING: All ∈ {STOPPED, STOPPING}
   - TERMINATING: All ∈ {TERMINATED, TERMINATING}
5. **PARTIAL**: Inconsistent mixed states

### Resource Lifecycle Example

```
User clicks "Create Project"
        ↓
API: INSERT Project, Sandbox, Database (all status=CREATING)
     Returns immediately (< 50ms)
        ↓
Reconciliation Job (3s later):
  Query: SELECT * FROM Sandbox WHERE status='CREATING' AND lockedUntil < NOW()
  Lock sandbox, emit CreateSandbox event
        ↓
Event Listener:
  Execute K8s createSandbox()
  Update status: CREATING → STARTING
        ↓
Reconciliation Job (3s later):
  Query: SELECT * FROM Sandbox WHERE status='STARTING'
  Emit StartSandbox event
        ↓
Event Listener:
  Check K8s status
  If ready: Update status: STARTING → RUNNING
  Aggregate project status: RUNNING
```

### Multi-Provider Authentication (v0.4.0+)

#### UserIdentity Model

**Purpose**: Support multiple authentication providers per user

```prisma
model UserIdentity {
  id             String       @id
  userId         String
  provider       AuthProvider // PASSWORD, GITHUB, SEALOS
  providerUserId String       // Provider's user identifier
  metadata       Json         // Provider-specific data
  isPrimary      Boolean      // Mark primary login method

  @@unique([provider, providerUserId])
}

enum AuthProvider {
  PASSWORD  // Username/password
  GITHUB    // GitHub OAuth
  SEALOS    // Sealos OAuth (NEW)
  GOOGLE    // Google OAuth (future)
}
```

#### Sealos OAuth Integration (NEW)

**Authentication Flow**:
1. User logs in via Sealos OAuth
2. Sealos provides JWT token + kubeconfig
3. Platform validates JWT with `SEALOS_JWT_SECRET`
4. Parses Sealos user ID from JWT
5. Creates/updates `UserIdentity` with `provider=SEALOS`
6. Stores kubeconfig in `UserConfig` table
7. Returns user session

**Server Action** (`app/actions/sealos-auth.ts`):
```typescript
// Bypass client-side CSRF issues in iframe environments
export async function authenticateWithSealos(
  sealosToken: string,
  sealosKubeconfig: string
): Promise<{ success: boolean; error?: string }>
```

**User-Specific Kubeconfig**:
- Each user operates in their own K8s namespace
- Kubeconfig stored in `UserConfig` with `key=KUBECONFIG`
- `lib/k8s/k8s-service-helper.ts` loads per-user credentials
- Enables true multi-tenancy

**Benefits**:
- ✅ **Multiple Auth Methods**: Users choose preferred login
- ✅ **Seamless Sealos Integration**: Native OAuth support
- ✅ **User-Specific K8s**: Each user has isolated namespace
- ✅ **Auto-Registration**: No manual signup required

### Port Exposure Policy (v0.4.0+)

**Default Exposed Ports**:
- **3000**: Next.js application (App Ingress)
- **7681**: ttyd web terminal (Terminal Ingress)

**Not Exposed by Default** (security improvement):
- 5000: Python/Flask applications
- 8080: General HTTP services
- 5173: Vite development server
- 8000: Django/FastAPI

**Rationale**:
- Reduce attack surface
- Minimize ingress costs
- Users primarily develop Next.js apps
- Manual exposure available via custom ingress

## Future Enhancements

### Planned Features (v0.5.0+)
1. **WebSocket Updates**: Real-time status updates (replacing polling)
2. **Multi-region Support**: Deploy sandboxes across regions
3. **Custom Images**: User-provided Docker images
4. **Persistent Storage**: Volume mounts for data persistence
5. **Collaborative Editing**: Real-time code collaboration
6. **CI/CD Integration**: Automatic deployment pipelines
7. **Resource Scaling**: Dynamic resource allocation
8. **Monitoring Dashboard**: Resource usage visualization
9. **Backup/Restore**: Project state snapshots

### Architecture Improvements (v0.5.0+)
1. **WebSocket Server**: Replace polling with real-time events
2. **Status Caching**: Redis for status caching
3. **Distributed Caching**: Session/data caching
4. **Metrics Collection**: Prometheus integration
5. **Log Aggregation**: Centralized logging system
6. **Optimistic UI Updates**: Perceived performance improvements

## Conclusion

FullStack Agent represents a modern approach to AI-assisted development, combining the power of Claude Code with Kubernetes orchestration. The architecture prioritizes:

- **Security**: Isolated environments with proper authentication
- **Scalability**: Kubernetes-based resource management
- **Developer Experience**: Seamless project creation and management
- **Reliability**: Comprehensive error handling and recovery

The platform continues to evolve with community feedback and contributions, aiming to make AI-powered development accessible to everyone.

---

*Last Updated: 2025-10-11*
*Version: 1.0.0*