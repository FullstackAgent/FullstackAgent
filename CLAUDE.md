# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FullstackAgent** is an AI-powered cloud development platform that creates isolated Kubernetes sandbox environments for full-stack development. Each project gets a container with Claude Code CLI pre-installed, accessible via web terminal (ttyd), plus a dedicated PostgreSQL database. The platform uses an **asynchronous reconciliation pattern** (v0.4.0+) where background jobs sync desired state (database) with actual state (Kubernetes) every 3 seconds.

**Core Value**: Users describe their app idea in natural language, and the platform + Claude Code CLI builds, configures, and deploys a production-ready Next.js application in minutes.

## Development Commands

### Main Application
```bash
npm run dev          # Start dev server on 0.0.0.0:3000 (Sealos deployment)
npm run build        # Build for production
npm start            # Start production server on 0.0.0.0:3000
npm run lint         # Run ESLint
```

### Database
```bash
npx prisma generate  # Generate Prisma client after schema changes
npx prisma db push   # Push schema to database (dev)
npx prisma studio    # Open database GUI
```

### Runtime Image (runtime/)
```bash
cd runtime
./build.sh           # Build Docker image locally
./push-to-dockerhub.sh  # Push to fullstackagent/fullstack-web-runtime
```

**Version Update Process**:
1. Update `runtime/VERSION` file
2. Build and push: `cd runtime && ./push-to-dockerhub.sh`
3. Update `lib/k8s/versions.ts` with new image tag
4. Restart main app to pick up new version

## Architecture (v0.4.0+)

### Reconciliation Pattern (Critical)

**Flow**: API returns immediately → Reconciliation jobs (every 3s) → Event listeners execute K8s operations → Status updates

```
User Request → API updates DB (status=CREATING) → Returns immediately
                     ↓
         Reconciliation Job (every 3s)
                     ↓
         Emit Events → Listeners execute K8s ops
                     ↓
         Update status: CREATING → STARTING → RUNNING
                     ↓
         Frontend polls for updates
```

**Key Points**:
- API endpoints are **non-blocking** - only update database, never wait for K8s
- Background jobs (`lib/jobs/`) reconcile every 3 seconds
- Event bus (`lib/events/`) connects jobs to K8s operations
- Optimistic locking prevents concurrent conflicts
- Project status **aggregated** from child resources (sandboxes + databases)

### System Layers

**Layer 1: Control Plane (Main App)**
- Next.js 15 + App Router + React 19
- NextAuth v5 (GitHub, Password, Sealos OAuth)
- Prisma ORM → PostgreSQL
- Manages projects, users, environment variables
- **Does NOT directly execute K8s operations** - only updates database

**Layer 2: Reconciliation System (NEW v0.4.0)**
- Background jobs: `lib/jobs/sandbox/`, `lib/jobs/database/`
- Event system: `lib/events/sandbox/`, `lib/events/database/`
- Repository layer: `lib/repo/` with optimistic locking
- Status aggregation: `lib/utils/projectStatus.ts`

**Layer 3: Kubernetes Managers**
- User-specific K8s services via `getK8sServiceForUser(userId)`
- `SandboxManager` (`lib/k8s/sandbox-manager.ts`) - StatefulSet operations
- `DatabaseManager` (`lib/k8s/database-manager.ts`) - KubeBlocks operations
- All operations are **idempotent** and **non-blocking**

**Layer 4: Kubernetes Orchestration**
- Deployed on Sealos (usw.sealos.io)
- Each user operates in their own namespace (from user's kubeconfig)
- Per project: StatefulSet + Service + 2 Ingresses + PostgreSQL cluster
- Resources use pattern: `{k8s-project-name}-agentruntime-{6chars}`

**Layer 5: Runtime Containers**
- Image: `fullstackagent/fullstack-web-runtime:v0.0.1-alpha.12`
- Base: Ubuntu 24.04 + Node.js 22.x
- Includes: Claude Code CLI, ttyd, Next.js, Prisma, PostgreSQL client, Buildah
- Auto-starts Claude Code CLI on terminal connection

### Key Directories

```
app/                    # Next.js App Router pages and API routes
├── api/
│   ├── projects/      # Project CRUD (returns immediately)
│   │   ├── [id]/start/    # Set status=STARTING
│   │   ├── [id]/stop/     # Set status=STOPPING
│   │   └── [id]/delete/   # Set status=TERMINATING
lib/
├── jobs/              # Reconciliation jobs (v0.4.0+)
│   ├── sandbox/       # Sandbox reconciliation
│   └── database/      # Database reconciliation
├── events/            # Event bus and listeners (v0.4.0+)
│   ├── sandbox/       # Sandbox lifecycle events
│   └── database/      # Database lifecycle events
├── repo/              # Repository layer with locking (v0.4.0+)
│   ├── sandbox.ts     # Sandbox queries with optimistic locking
│   ├── database.ts    # Database queries with optimistic locking
│   └── project.ts     # Project status aggregation
├── k8s/               # Kubernetes managers (v0.4.0+)
│   ├── sandbox-manager.ts      # StatefulSet operations
│   ├── database-manager.ts     # KubeBlocks operations
│   ├── k8s-service-helper.ts   # User-specific K8s service
│   ├── kubernetes.ts           # Main K8s service class
│   └── versions.ts             # Runtime image version
├── startup/           # Application initialization (v0.4.0+)
│   └── index.ts       # Register listeners, start jobs
├── utils/
│   └── projectStatus.ts        # Status aggregation logic
components/            # React components (Shadcn/UI)
prisma/
└── schema.prisma      # Database schema (v0.4.0+)
                       # UserIdentity, UserConfig, Project, Sandbox, Database, Environment
runtime/               # Docker image for sandbox environments
instrumentation.ts     # Next.js instrumentation (calls startup/index.ts)
```

## Critical Implementation Details (v0.4.0+)

### Getting User-Specific Kubernetes Service

**ALWAYS use this pattern** (never instantiate KubernetesService directly):

```typescript
import { getK8sServiceForUser } from '@/lib/k8s/k8s-service-helper'

// In API routes or event listeners
const k8sService = await getK8sServiceForUser(userId)

// Get managers
const sandboxManager = k8sService.getSandboxManager()
const databaseManager = k8sService.getDatabaseManager()
const namespace = k8sService.getNamespace()

// Example: Create sandbox (idempotent, returns immediately)
await sandboxManager.createSandbox({
  projectName: 'my-project',
  sandboxName: 'my-project-agentruntime-abc123',
  namespace,
  envVars: [
    { name: 'DATABASE_URL', value: 'postgresql://...' },
    { name: 'PROJECT_NAME', value: 'my-project' }
  ]
})

// Check status (non-blocking query)
const status = await sandboxManager.getSandboxStatus(namespace, 'my-project-agentruntime-abc123')
// Returns: 'RUNNING' | 'STARTING' | 'STOPPED' | 'STOPPING' | 'TERMINATED' | 'ERROR'
```

**Key Points**:
- Loads user's kubeconfig from `UserConfig` table (key='KUBECONFIG')
- Each user operates in their own Kubernetes namespace
- Factory pattern ensures services are cached per user
- All K8s methods are idempotent (can be called multiple times safely)

### Multi-Provider Authentication (v0.4.0+)

**UserIdentity Model** - One user can have multiple login methods:

```typescript
// Supported providers:
enum AuthProvider {
  PASSWORD  // Username/password
  GITHUB    // GitHub OAuth
  SEALOS    // Sealos OAuth (NEW)
}

// lib/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({ /* GitHub OAuth */ }),
    Credentials({ id: 'password', /* Username/password */ }),
    Credentials({ id: 'sealos', /* Sealos OAuth with JWT + kubeconfig */ })
  ]
})
```

**Sealos OAuth Flow**:
1. User logs in via Sealos OAuth
2. Sealos provides JWT token + kubeconfig
3. Platform validates JWT with `SEALOS_JWT_SECRET`
4. Creates/updates `UserIdentity` with `provider=SEALOS`
5. Stores kubeconfig in `UserConfig` table
6. Returns user session

### Resource Lifecycle States

**ResourceStatus** (Sandbox, Database):
```typescript
'CREATING'     // K8s resource being initially created
'STARTING'     // Transitioning from STOPPED to RUNNING
'RUNNING'      // Active and operational
'STOPPING'     // Transitioning from RUNNING to STOPPED
'STOPPED'      // Paused (replicas=0)
'TERMINATING'  // Being deleted from K8s
'TERMINATED'   // Deleted from K8s (soft delete in DB)
'ERROR'        // Encountered an error
```

**ProjectStatus** (aggregated from resources):
```typescript
'RUNNING'      // All resources operational
'STOPPED'      // All resources paused
'CREATING'     // Initial creation
'STARTING'     // Some resources starting
'STOPPING'     // Some resources stopping
'TERMINATING'  // Some resources being deleted
'ERROR'        // At least one resource has error
'PARTIAL'      // Inconsistent mixed states (manual intervention needed)
```

### Reconciliation Flow Example

```typescript
// 1. User clicks "Create Project"
POST /api/projects { name: "my-blog" }

// 2. API creates database records immediately
const project = await prisma.project.create({
  data: {
    name: "my-blog",
    userId: session.user.id,
    status: 'CREATING',
    sandboxes: {
      create: { status: 'CREATING', sandboxName: '...', k8sNamespace: '...' }
    },
    databases: {
      create: { status: 'CREATING', databaseName: '...', k8sNamespace: '...' }
    }
  }
})
// Returns immediately (< 50ms)

// 3. Reconciliation job runs (lib/jobs/sandbox/sandboxReconcile.ts)
// Query: SELECT * FROM Sandbox WHERE status='CREATING' AND lockedUntil IS NULL
// Locks sandbox, emits CreateSandbox event

// 4. Event listener executes (lib/events/sandbox/sandboxListener.ts)
const k8sService = await getK8sServiceForUser(user.id)
await k8sService.getSandboxManager().createSandbox({ /* ... */ })
// Updates status: CREATING → STARTING

// 5. Next cycle checks K8s status
const k8sStatus = await sandboxManager.getSandboxStatus(namespace, sandboxName)
if (k8sStatus === 'RUNNING') {
  await updateSandboxStatus(sandbox.id, 'RUNNING')
  await projectStatusReconcile(project.id) // Aggregate project status
}
```

### Database Schema (prisma/schema.prisma)

**UserIdentity** (v0.4.0+):
```prisma
model UserIdentity {
  id             String       @id @default(cuid())
  userId         String
  provider       AuthProvider  // PASSWORD, GITHUB, SEALOS
  providerUserId String        // Username, GitHub ID, Sealos user ID
  metadata       Json          // Provider-specific data (tokens, kubeconfig)
  isPrimary      Boolean       // Mark primary login method

  @@unique([provider, providerUserId])
}
```

**UserConfig** (v0.4.0+):
```prisma
model UserConfig {
  id       String  @id @default(cuid())
  userId   String
  key      String  // KUBECONFIG, ANTHROPIC_AUTH_TOKEN, etc.
  value    String
  category String? // kc, anthropic-api, github, general
  isSecret Boolean @default(false)

  @@unique([userId, key])
}
```

**Project** (v0.4.0+):
```prisma
model Project {
  id          String        @id @default(cuid())
  name        String
  userId      String
  status      ProjectStatus @default(CREATING) // Aggregated status

  sandboxes   Sandbox[]     // Multiple sandboxes per project
  databases   Database[]    // Multiple databases per project
  environments Environment[] // Project-level config
}
```

**Sandbox** (v0.4.0+):
```prisma
model Sandbox {
  id          String         @id @default(cuid())
  projectId   String
  sandboxName String         // K8s resource name
  k8sNamespace String        // User's K8s namespace
  publicUrl   String?
  ttydUrl     String?
  status      ResourceStatus @default(CREATING)
  lockedUntil DateTime?      // Optimistic locking
}
```

**Database** (v0.4.0+):
```prisma
model Database {
  id            String         @id @default(cuid())
  projectId     String
  databaseName  String         // K8s cluster name
  k8sNamespace  String         // User's K8s namespace
  connectionUrl String?
  status        ResourceStatus @default(CREATING)
  lockedUntil   DateTime?      // Optimistic locking
}
```

**Environment**:
```prisma
model Environment {
  id        String  @id @default(cuid())
  projectId String
  key       String
  value     String
  category  String? // auth/payment/general
  isSecret  Boolean @default(false)

  @@unique([projectId, key])
}
```

### Resource Naming Convention

Project name `My Blog!` becomes:
1. **K8s name**: `myblog` (lowercase, alphanumeric only, max 20 chars)
2. **StatefulSet**: `myblog-agentruntime-abc123` (6-char random suffix)
3. **Service**: `myblog-agentruntime-abc123`
4. **Database**: `myblog-agentruntime-abc123` (KubeBlocks cluster)
5. **Ingresses**: Random 12-char domain names
   - App: `https://xyz123abc456.usw.sealos.io` (port 3000)
   - Terminal: `https://abc456xyz123.usw.sealos.io` (port 7681)

**Label Strategy**:
```yaml
labels:
  cloud.sealos.io/app-deploy-manager: {resource-name}  # Required by Sealos
  project.fullstackagent.io/name: {k8s-project-name}   # Our tracking
  app: {resource-name}                                  # Pod selector
```

### Port Exposure Policy (v0.4.0+)

**Only expose essential ports** for security:
- **3000**: Next.js application (App Ingress)
- **7681**: ttyd web terminal (Terminal Ingress)

**Not exposed by default**: 5000, 8080, 5173, 8000

Users can manually expose additional ports via custom ingress if needed.

## API Routes (v0.4.0+)

**All API routes only update database, reconciliation handles K8s operations**

### Project Management
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create project (sets status=CREATING, returns immediately)
- `GET /api/projects/[id]` - Get project with sandboxes, databases, environments
- `POST /api/projects/[id]/start` - Set resources to status=STARTING
- `POST /api/projects/[id]/stop` - Set resources to status=STOPPING
- `POST /api/projects/[id]/delete` - Set resources to status=TERMINATING

### Environment Variables
- `GET /api/projects/[id]/environment` - List env vars
- `POST /api/projects/[id]/environment` - Add env var (DB only, K8s sync via reconciliation)
- `PUT /api/projects/[id]/environment/[envId]` - Update env var
- `DELETE /api/projects/[id]/environment/[envId]` - Delete env var

**Important**: Environment variable changes are NOT immediately reflected in sandbox. Reconciliation will sync them within 3 seconds.

## Common Development Patterns

### Testing Locally

```bash
# 1. Set up secrets
mkdir -p .secret
# Add .env with ANTHROPIC_AUTH_TOKEN (will be injected into sandboxes)
# Users provide their own kubeconfig via Sealos OAuth

# 2. Set DATABASE_URL in .env.local for main app
echo 'DATABASE_URL="postgresql://user:password@localhost:5432/fullstackagent"' >> .env.local

# 3. Push Prisma schema
npx prisma db push

# 4. Start dev server
npm run dev

# 5. Create project via UI
# Open http://localhost:3000 and login
```

### Debugging Kubernetes Resources

```bash
# Set kubeconfig (user-specific)
export KUBECONFIG=/path/to/user/kubeconfig

# Check StatefulSets (v0.4.0+, changed from Deployments)
kubectl get statefulsets -n {namespace} | grep {project-name}

# Check pods
kubectl get pods -n {namespace} -l app={statefulset-name}

# Pod logs
kubectl logs -n {namespace} {pod-name}

# Check KubeBlocks database cluster
kubectl get cluster -n {namespace} | grep {project-name}

# Get database credentials
kubectl get secret -n {namespace} {cluster-name}-conn-credential -o yaml

# Check ingresses
kubectl get ingress -n {namespace} | grep {project-name}

# Describe resource for events
kubectl describe statefulset -n {namespace} {statefulset-name}
```

### Writing Event Listeners

```typescript
// lib/events/sandbox/sandboxListener.ts pattern

import { sandboxEventBus } from './bus'

export function registerSandboxEventListeners() {
  sandboxEventBus.on('CreateSandbox', handleCreateSandbox)
  sandboxEventBus.on('StartSandbox', handleStartSandbox)
  sandboxEventBus.on('StopSandbox', handleStopSandbox)
  sandboxEventBus.on('DeleteSandbox', handleDeleteSandbox)
}

async function handleCreateSandbox(payload: SandboxEventPayload) {
  const { user, project, sandbox } = payload

  // Only process CREATING sandboxes
  if (sandbox.status !== 'CREATING') return

  try {
    // Get user-specific K8s service
    const k8sService = await getK8sServiceForUser(user.id)
    const sandboxManager = k8sService.getSandboxManager()

    // Execute K8s operation (idempotent)
    await sandboxManager.createSandbox({ /* ... */ })

    // Update status to next state
    await updateSandboxStatus(sandbox.id, 'STARTING')
    await projectStatusReconcile(project.id)
  } catch (error) {
    logger.error(`handleCreateSandbox failed: ${error}`)
    await updateSandboxStatus(sandbox.id, 'ERROR')
  }
}
```

## Critical Issues & Solutions

### Issue 1: API Endpoints Must Not Block

**Symptom**: API endpoint takes 30+ seconds to respond
**Cause**: API is directly executing K8s operations instead of using reconciliation
**Solution**: API should only update database, return immediately

```typescript
// ❌ BAD (blocking)
export async function POST(req: Request) {
  await k8sService.createSandbox() // Blocks for 30s
  return NextResponse.json({ success: true })
}

// ✅ GOOD (non-blocking)
export async function POST(req: Request) {
  await prisma.sandbox.create({
    data: { status: 'CREATING', /* ... */ }
  })
  // Reconciliation will handle K8s operations
  return NextResponse.json({ success: true })
}
```

### Issue 2: Always Use getK8sServiceForUser()

**Symptom**: "User does not have KUBECONFIG configured"
**Cause**: Trying to use global K8s service instead of user-specific
**Solution**: Always load user's kubeconfig from UserConfig table

```typescript
// ❌ BAD (old pattern)
const k8sService = new KubernetesService()

// ✅ GOOD (v0.4.0+)
const k8sService = await getK8sServiceForUser(userId)
```

### Issue 3: Optimistic Locking Prevents Concurrent Updates

**Symptom**: Reconciliation job skips some records
**Cause**: Multiple instances or rapid cycles trying to process same records
**Solution**: This is expected behavior - optimistic locking ensures single-writer

```typescript
// Repository layer automatically handles locking
const lockedSandboxes = await acquireAndLockSandboxes(10)
// Only returns sandboxes where lockedUntil IS NULL OR < NOW()
// Sets lockedUntil = NOW() + 30 seconds atomically
```

### Issue 4: Status Aggregation Rules

**Symptom**: Project shows PARTIAL status unexpectedly
**Cause**: Child resources in inconsistent states
**Solution**: Understand aggregation priority rules (see `lib/utils/projectStatus.ts`)

Priority order:
1. **ERROR** - At least one resource has ERROR
2. **CREATING** - At least one resource has CREATING
3. **Pure states** - All same status → use that status
4. **Transition states**:
   - STARTING: All ∈ {RUNNING, STARTING}
   - STOPPING: All ∈ {STOPPED, STOPPING}
   - TERMINATING: All ∈ {TERMINATED, TERMINATING}
5. **PARTIAL** - Inconsistent mixed states

## Development Best Practices

### Project Name Sanitization

```typescript
// ALWAYS sanitize project names for Kubernetes
import { KubernetesUtils } from '@/lib/k8s/kubernetes-utils'

const k8sProjectName = KubernetesUtils.toK8sProjectName(projectName)
// Converts "My Blog!" → "myblog" (lowercase, alphanumeric, max 20 chars)
```

### Resource Lifecycle

- **Stop**: Scales replicas to 0 (preserves config, no data loss)
- **Delete**: Removes K8s resources (database data persists unless explicitly deleted)
- **StatefulSets**: v0.4.0+ uses StatefulSets instead of Deployments for sandboxes

### Version Management

**Single source of truth**: `lib/k8s/versions.ts`

```typescript
export const VERSIONS = {
  RUNTIME_IMAGE: 'fullstackagent/fullstack-web-runtime:v0.0.1-alpha.12',
  POSTGRESQL_VERSION: 'postgresql-14.8.0',
  POSTGRESQL_DEFINITION: 'postgresql',
  // ...
}
```

Never hardcode versions elsewhere. Always import from this file.

### Error Handling in Event Listeners

```typescript
// Always catch errors and update status to ERROR
try {
  await k8sOperation()
  await updateStatus('RUNNING')
} catch (error) {
  logger.error(`Operation failed: ${error}`)
  await updateStatus('ERROR')
  // Don't throw - let reconciliation retry
}
```

## Important Notes

- **Reconciliation Delay**: Status updates may take up to 3 seconds
- **User-Specific Namespaces**: Each user operates in their own K8s namespace
- **Frontend Polling**: Client components poll every 3 seconds for status updates
- **Database Wait Time**: PostgreSQL cluster takes 2-3 minutes to reach "Running"
- **Idempotent Operations**: All K8s methods can be called multiple times safely
- **Lock Duration**: Optimistic locks held for 30 seconds
- **Deployment Domain**: Main app listens on `0.0.0.0:3000` (not localhost) for Sealos

## Key Files for Understanding

**Core Architecture**:
1. `lib/k8s/k8s-service-helper.ts` - User-specific K8s service loading
2. `lib/k8s/sandbox-manager.ts` - StatefulSet operations (1005 lines)
3. `lib/k8s/database-manager.ts` - KubeBlocks operations (826 lines)
4. `lib/jobs/sandbox/sandboxReconcile.ts` - Sandbox reconciliation job
5. `lib/events/sandbox/sandboxListener.ts` - Sandbox lifecycle handlers
6. `lib/repo/sandbox.ts` - Sandbox queries with optimistic locking
7. `lib/utils/projectStatus.ts` - Status aggregation logic
8. `instrumentation.ts` - Application startup (registers listeners, starts jobs)

**Data Models**:
9. `prisma/schema.prisma` - Database schema (UserIdentity, UserConfig, Project, Sandbox, Database)

**Documentation**:
10. `docs/changelogs/v0.4-reconciliation-architecture.md` - Complete v0.4.0 changelog
11. `docs/technical-notes/TECHNICAL_DOCUMENTATION.md` - Detailed architecture
12. `docs/technical-notes/RUNTIME_WORKFLOW.md` - Complete workflow documentation