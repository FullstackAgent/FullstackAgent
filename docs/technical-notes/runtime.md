# Full-Stack Web Application Runtime

A comprehensive Docker container image designed for full-stack web development with all the modern tools and frameworks pre-installed.

## Features

This runtime includes:

- **Node.js** (v22.x) - Latest LTS version for JavaScript runtime
- **Next.js** - Full-stack React framework for production
- **PostgreSQL Client Tools** - For database connectivity and management
- **shadcn/ui** - Modern React component library with Tailwind CSS
- **Claude Code CLI** - AI-powered coding assistant
- **Buildah** - Container building tool that works in unprivileged mode
- **ttyd** - Web-based terminal access for remote development
- **Development Tools** - Git, GitHub CLI, ripgrep, and more

## Quick Start

### Using Pre-built Image

```bash
# Pull the image from Docker Hub
docker pull fullstackagent/fullstack-web-runtime:latest

# Run the container
docker run -it --rm \
  -p 3000:3000 \
  -p 5000:5000 \
  -p 8080:8080 \
  -v $(pwd):/workspace \
  fullstackagent/fullstack-web-runtime:latest
```

### Building from Source

The image can be built using multiple methods, including automated GitHub Actions builds for environments with restrictions.

#### Option 1: GitHub Actions (Recommended for Restricted Environments)

This method uses GitHub Actions to build the image in the cloud, perfect for environments without Docker access:

```bash
# First, set up GitHub repository secrets:
# Go to: https://github.com/FullstackAgent/fullstack-runtime-builder/settings/secrets
# Add two secrets:
#   - DOCKER_HUB_USERNAME: your Docker Hub username
#   - DOCKER_HUB_PASSWORD: your Docker Hub password

# Method A: Trigger via Web UI
# Go to: https://github.com/FullstackAgent/fullstack-runtime-builder/actions
# Click "Build and Push Docker Image" → "Run workflow"

# Method B: Trigger via GitHub CLI
gh workflow run docker-build.yml -f tag="latest"

# Method C: Automatic trigger on push
# The workflow automatically runs when you push changes to Dockerfile
```

#### Option 2: Using the Build Script

The build script supports both local and GitHub Actions builds:

```bash
# Show help
./build.sh --help

# Trigger GitHub Actions build
./build.sh --github

# Build locally (requires Docker/Buildah/Podman)
./build.sh --local

# Build with specific tag
./build.sh --github v1.0.0

# For local builds with push to Docker Hub:
export DOCKER_HUB_NAME=your_username
export DOCKER_HUB_PASSWD=your_password
./build.sh --local
```

#### Option 3: Manual Build with Docker

```bash
# Build the image
docker build -t fullstackagent/fullstack-web-runtime:latest .

# Push to Docker Hub (optional)
docker login
docker push fullstackagent/fullstack-web-runtime:latest
```

#### Option 4: Manual Build with Buildah (for rootless environments)

```bash
# Build with Buildah
buildah bud -t fullstackagent/fullstack-web-runtime:latest .

# Or with VFS driver for restricted environments
buildah --storage-driver vfs bud -t fullstackagent/fullstack-web-runtime:latest .

# Push to Docker Hub
buildah login docker.io
buildah push fullstackagent/fullstack-web-runtime:latest docker://fullstackagent/fullstack-web-runtime:latest
```

## Environment Variables

The runtime supports the following environment variables:

### Core Configuration

| Variable                     | Description                            | Default | Required    |
| ---------------------------- | -------------------------------------- | ------- | ----------- |
| `ANTHROPIC_BASE_URL`         | Base URL for Anthropic API             | -       | No          |
| `ANTHROPIC_AUTH_TOKEN`       | Authentication token for Anthropic API | -       | No          |
| `ANTHROPIC_MODEL`            | Primary AI model to use                | -       | No          |
| `ANTHROPIC_SMALL_FAST_MODEL` | Fast model for quick operations        | -       | No          |
| `DOCKER_HUB_NAME`            | Docker Hub username for pushing images | -       | For pushing |
| `DOCKER_HUB_PASSWD`          | Docker Hub password for pushing images | -       | For pushing |

### ttyd Web Terminal Configuration

| Variable            | Description                              | Default | Required |
| ------------------- | ---------------------------------------- | ------- | -------- |
| `TTYD_PORT`         | Port for web terminal access             | 7681    | No       |
| `TTYD_USERNAME`     | Username for authentication              | -       | No       |
| `TTYD_PASSWORD`     | Password for authentication              | -       | No       |
| `TTYD_INTERFACE`    | Network interface to bind                | 0.0.0.0 | No       |
| `TTYD_BASE_PATH`    | Base URL path for ttyd                   | /       | No       |
| `TTYD_MAX_CLIENTS`  | Maximum concurrent clients (0=unlimited) | 0       | No       |
| `TTYD_READONLY`     | Enable read-only mode                    | false   | No       |
| `TTYD_ALLOW_ORIGIN` | CORS allow origin header                 | \*      | No       |
| `DISABLE_TTYD`      | Disable ttyd completely                  | false   | No       |

### Setting Environment Variables

When running the container:

```bash
docker run -it --rm \
  -e ANTHROPIC_BASE_URL=https://api.anthropic.com \
  -e ANTHROPIC_AUTH_TOKEN=your_token \
  -e ANTHROPIC_MODEL=claude-3-opus-20240229 \
  -v $(pwd):/workspace \
  fullstackagent/fullstack-web-runtime:latest
```

Or use an `.env` file:

```bash
docker run -it --rm \
  --env-file .env \
  -v $(pwd):/workspace \
  fullstackagent/fullstack-web-runtime:latest
```

## Web Terminal Access (ttyd)

The runtime includes ttyd, providing secure web-based terminal access. This is particularly useful for:

- Remote development environments
- Cloud-based IDEs
- Product demonstrations
- Educational platforms

### Basic Usage

```bash
# Run with default ttyd configuration (port 7681, no auth)
docker run -it --rm -p 7681:7681 fullstackagent/fullstack-web-runtime:latest

# Access the web terminal at: http://localhost:7681
```

### Secure Usage with Authentication

```bash
# Run with authentication enabled
docker run -it --rm \
  -p 7681:7681 \
  -e TTYD_USERNAME=admin \
  -e TTYD_PASSWORD=secretpassword \
  fullstackagent/fullstack-web-runtime:latest
```

### Custom Configuration

```bash
# Run with custom port and path
docker run -it --rm \
  -p 8080:8080 \
  -e TTYD_PORT=8080 \
  -e TTYD_BASE_PATH=/terminal \
  -e TTYD_USERNAME=developer \
  -e TTYD_PASSWORD=secure123 \
  fullstackagent/fullstack-web-runtime:latest

# Access at: http://localhost:8080/terminal
```

### Disable ttyd

If you don't need web terminal access:

```bash
docker run -it --rm \
  -e DISABLE_TTYD=true \
  fullstackagent/fullstack-web-runtime:latest
```

## Usage Examples

### Create a Next.js Application

```bash
docker run -it --rm \
  -v $(pwd):/workspace \
  fullstackagent/fullstack-web-runtime:latest \
  bash -c "npx create-next-app@latest my-app --typescript --tailwind --app"
```

### Run a Development Server

```bash
docker run -it --rm \
  -p 3000:3000 \
  -v $(pwd):/workspace \
  -w /workspace/my-app \
  fullstackagent/fullstack-web-runtime:latest \
  npm run dev
```

### Use Claude Code CLI

```bash
docker run -it --rm \
  -e ANTHROPIC_AUTH_TOKEN=your_token \
  -v $(pwd):/workspace \
  fullstackagent/fullstack-web-runtime:latest \
  claude-code
```

### Build Containers Inside the Runtime

The runtime includes Buildah for building containers without requiring Docker daemon:

```bash
docker run -it --rm \
  --privileged \
  -v $(pwd):/workspace \
  fullstackagent/fullstack-web-runtime:latest \
  buildah --storage-driver vfs bud -t my-image .
```

## Exposed Ports

The following ports are exposed by default:

- `3000` - Next.js development server
- `3001` - Alternative development port
- `5000` - Python/Flask applications
- `5173` - Vite development server
- `8080` - General web server
- `8000` - Django/FastAPI
- `5432` - PostgreSQL connection
- `7681` - ttyd web terminal interface

## Volume Mounts

Recommended volume mounts:

```bash
-v $(pwd):/workspace        # Mount current directory as workspace
-v ~/.ssh:/root/.ssh:ro     # Mount SSH keys (read-only)
-v ~/.gitconfig:/root/.gitconfig:ro  # Mount Git config (read-only)
```

## Installed Tools

### Core Development Tools

- Node.js v22.x with npm and yarn
- TypeScript
- Git with GitHub CLI
- Python 3 with pip
- Make, gcc, build-essential

### Web Frameworks

- Next.js (latest)
- Create Next App
- Vercel CLI
- Prisma ORM

### UI/Styling

- shadcn/ui CLI
- Tailwind CSS
- PostCSS
- Autoprefixer

### Database Tools

- PostgreSQL Client v16
- Prisma CLI

### Container Tools

- Buildah (rootless container builds)
- Podman
- Skopeo

### Web Terminal

- ttyd (web-based terminal with authentication support)

### Utilities

- ripgrep (fast search)
- fd-find (fast file finder)
- bat (better cat)
- exa (better ls)
- jq (JSON processor)
- htop, tmux, screen
- curl, wget
- Network tools (ping, telnet, dig)

## Security Notes

1. **Running as Root**: By default, the container runs as root. For production use, consider creating and switching to a non-root user.

2. **Privileged Mode**: Building containers with Buildah inside the runtime may require `--privileged` flag or proper capability settings.

3. **Secrets Management**: Never hardcode sensitive information in the Dockerfile. Always use environment variables or mounted secret files.

## Troubleshooting

### Permission Denied Errors

If you encounter permission errors when building containers inside the runtime:

```bash
# Run with privileged mode
docker run -it --rm --privileged fullstackagent/fullstack-web-runtime:latest

# Or use VFS storage driver
buildah --storage-driver vfs bud -t my-image .
```

### Port Already in Use

If ports are already in use on your host:

```bash
# Map to different host ports
docker run -it --rm -p 3001:3000 fullstackagent/fullstack-web-runtime:latest
```

### Out of Space

The VFS storage driver may use more disk space. Clean up regularly:

```bash
buildah rm --all
buildah rmi --all
```

## Contributing

To contribute to this runtime:

1. Fork the repository
2. Make your changes to the Dockerfile
3. Test the build locally
4. Submit a pull request

## License

This runtime is provided as-is for development purposes. Please ensure compliance with all included software licenses.

## Port Exposure Policy (v0.4.0+)

### Default Exposed Ports

Starting from v0.4.0, only essential ports are exposed by default:

**Exposed**:
- **3000**: Next.js application (App Ingress)
  - Primary development port for Next.js apps
  - Kubernetes Ingress: `https://{random}.usw.sealos.io`
- **7681**: ttyd web terminal (Terminal Ingress)
  - WebSocket-based terminal access
  - Kubernetes Ingress: `https://{random}-ttyd.usw.sealos.io`

**Not Exposed by Default** (security improvement):
- 5000: Python/Flask applications
- 8080: General HTTP services
- 5173: Vite development server
- 8000: Django/FastAPI applications

### Rationale

1. **Security**: Reduce attack surface by only exposing necessary ports
2. **Cost**: Fewer Kubernetes ingresses reduce resource usage
3. **Simplicity**: Users primarily develop Next.js applications
4. **Flexibility**: Users can manually expose additional ports if needed

### Exposing Additional Ports

If your application requires additional ports (e.g., Flask on port 5000):

**Option 1: Port Forwarding in Application**
```typescript
// Forward Flask to Next.js port
// In your Next.js app/api/proxy/route.ts
export async function GET(req: Request) {
  const flaskResponse = await fetch('http://localhost:5000/api/endpoint')
  return flaskResponse
}
```

**Option 2: Custom Ingress (Manual)**
```yaml
# Create custom ingress for port 5000
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {project}-flask
  namespace: {namespace}
spec:
  rules:
  - host: {custom-domain}.usw.sealos.io
    http:
      paths:
      - path: /
        backend:
          service:
            name: {service-name}
            port:
              number: 5000
```

## Reconciliation Integration (v0.4.0+)

### Sandbox Lifecycle

The runtime container lifecycle is now managed by the reconciliation pattern:

**Creation Flow**:
```
User creates project
    ↓
API: INSERT Sandbox (status=CREATING)
    ↓
Reconciliation Job (every 3s)
    ↓
Event Listener: handleCreateSandbox()
    ↓
Kubernetes: Create StatefulSet with runtime image
    ↓
Update: status=STARTING
    ↓
Wait for pod ready
    ↓
Update: status=RUNNING
```

**Key Benefits**:
- **Non-blocking**: API returns immediately
- **Automatic retry**: Failed creates automatically retry
- **Status tracking**: Real-time status in database
- **Resilient**: Survives app restarts

### Multi-Tenancy with User Kubeconfig

Starting from v0.4.0, each user operates in their own Kubernetes namespace:

**User-Specific Configuration**:
- Each user has `UserConfig` with `key=KUBECONFIG`
- `lib/k8s/k8s-service-helper.ts` loads per-user credentials
- Sandboxes created in user's namespace
- True multi-tenancy isolation

**Authentication Flow**:
1. User logs in (PASSWORD/GITHUB/SEALOS)
2. System retrieves user's kubeconfig from `UserConfig`
3. Kubernetes operations use user's credentials
4. Resources created in user's namespace

**Sealos OAuth Integration**:
- Sealos users authenticate with JWT token
- Kubeconfig automatically stored in `UserConfig`
- Seamless namespace isolation
- No manual configuration required

## Support

For issues or questions:

- Open an issue in the repository
- Check the Dockerfile for specific version information
- Consult the documentation of individual tools included in the runtime

## Summary

The runtime image provides a complete, pre-configured development environment that:
- Requires zero local setup
- Includes AI assistance via Claude Code
- Provides browser-based terminal access
- Supports full-stack development out of the box
- Enables instant project creation and deployment
- **NEW (v0.4.0+)**: Only exposes essential ports (3000, 7681) for security
- **NEW (v0.4.0+)**: Managed by reconciliation pattern for reliability
- **NEW (v0.4.0+)**: Supports multi-tenant isolation via user kubeconfig

This design eliminates the traditional "works on my machine" problem by ensuring every developer works in an identical, cloud-based environment. The reconciliation architecture ensures reliability, scalability, and true multi-tenancy.
