# FullStack Web Runtime

A comprehensive Docker image providing a complete development environment for AI-powered full-stack web development with Claude Code CLI integration. This runtime powers the FullstackAgent platform's isolated Kubernetes sandbox environments.

## Overview

The FullStack Web Runtime is a production-ready Ubuntu 24.04-based container that includes everything needed for modern full-stack development:
- Pre-configured Next.js project with shadcn/ui components
- Claude Code CLI for AI-assisted development
- Container tools for building and deploying applications
- Web-based terminal (ttyd) for browser access
- Development tools and utilities

## Features

### Core Development Stack
- **Base OS**: Ubuntu 24.04 LTS
- **Node.js**: 22.x LTS with npm, pnpm, and yarn
- **Next.js**: Pre-initialized project with TypeScript, Tailwind CSS, and ESLint
- **shadcn/ui**: All components pre-installed and ready to use
- **Prisma**: ORM for database management

### AI Integration
- **Claude Code CLI**: Latest @anthropic-ai/claude-code package
- Auto-starts on first terminal connection
- Configured for seamless AI-assisted development

### Container Tools
- **Buildah**: Build OCI container images
- **Podman**: Rootless container runtime
- **Skopeo**: Container image operations
- Configured for rootless operation with VFS storage driver

### Development Tools
- **Version Control**: Git, GitHub CLI (gh)
- **Databases**: PostgreSQL 16 client
- **Modern CLI**: eza, ripgrep, fd-find, jq, bat
- **Editors**: vim, nano
- **Utilities**: tmux, screen, htop, tree, curl, wget
- **Network Tools**: ping, telnet, netcat, dnsutils

### Web Terminal
- **ttyd**: WebSocket-based web terminal
- Accessible via browser on port 7681
- Secure, configurable, and production-ready

### Multi-Architecture Support
- **linux/amd64**: x86_64 systems
- **linux/arm64**: ARM-based systems (Apple Silicon, AWS Graviton, etc.)

## Docker Registries

### GitHub Container Registry (Recommended)
```bash
docker pull ghcr.io/{owner}/fullstack-web-runtime:latest
```

### Docker Hub
```bash
docker pull fullstackagent/fullstack-web-runtime:latest
```

## Available Tags

Images are automatically tagged using semantic versioning and metadata:

- `latest` - Latest stable release from main/master branch
- `main` / `master` - Latest from main/master branch
- `dev.1` - Development branch builds
- `sha-{commit}` - Specific commit SHA (e.g., `sha-cd65417`)
- `v{version}` - Semantic version tags (e.g., `v1.0.0`, `v1.0`, `v1`)

## Quick Start

### Basic Usage

```bash
docker run -d \
  -p 7681:7681 \
  -p 3000:3000 \
  ghcr.io/{owner}/fullstack-web-runtime:latest
```

### With Claude Code Configuration

```bash
docker run -d \
  -p 7681:7681 \
  -p 3000:3000 \
  -e ANTHROPIC_AUTH_TOKEN="your-anthropic-api-token" \
  -e PROJECT_NAME="my-project" \
  ghcr.io/{owner}/fullstack-web-runtime:latest
```

### With Persistent Storage

```bash
docker run -d \
  -p 7681:7681 \
  -p 3000:3000 \
  -v $(pwd)/workspace:/home/agent/workspace \
  -e ANTHROPIC_AUTH_TOKEN="your-token" \
  ghcr.io/{owner}/fullstack-web-runtime:latest
```

### Access Web Terminal

After starting the container, open your browser to:
```
http://localhost:7681
```

The Claude Code CLI will auto-start on first connection.

## Environment Variables

### Claude Code Configuration
- `ANTHROPIC_AUTH_TOKEN` - Your Anthropic API key (required for Claude Code)
- `ANTHROPIC_BASE_URL` - API endpoint (optional, uses default)
- `ANTHROPIC_MODEL` - Model to use (e.g., claude-sonnet-4-5-20250929)
- `ANTHROPIC_SMALL_FAST_MODEL` - Fast model for quick tasks

### Project Configuration
- `PROJECT_NAME` - Project name shown in terminal prompt (default: sandbox)

### Docker Hub Credentials (for Buildah push)
- `DOCKER_HUB_NAME` - Docker Hub username
- `DOCKER_HUB_PASSWD` - Docker Hub password/token

## Exposed Ports

### Essential Ports (Exposed by Default)
- `3000` - Next.js application server
- `7681` - ttyd web terminal

### Additional Ports (Available but not exposed)
Users can manually expose these ports if needed:
- `3001` - Next.js production server (alternative)
- `5000` - Python/Flask applications
- `5173` - Vite development server
- `8000` - General HTTP service
- `8080` - General HTTP service
- `5432` - PostgreSQL client connections

## Building the Image

### Automated Build (GitHub Actions)

The image is automatically built via GitHub Actions workflow when:
- Pull requests are opened (validation only, no push)
- Changes are pushed to `main` or `master` branch
- Changes are detected in `sandbox/` directory
- Manually triggered via workflow dispatch

**Workflow File**: `.github/workflows/build-runtime.yml`

### Build Process

1. **Matrix Build**: Builds amd64 and arm64 in parallel
   - amd64: Uses ubuntu-24.04 runner
   - arm64: Uses ubuntu-24.04-arm runner (native ARM)

2. **Digest Push**: Each architecture pushes by digest

3. **Manifest Creation**: Merges digests into multi-arch manifest

4. **Registry Push**: Pushes to GHCR and Docker Hub (if configured)

### Local Build (Single Architecture)

```bash
cd sandbox
docker build -t fullstack-web-runtime:local .
```

### Local Multi-Architecture Build

```bash
cd sandbox
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t fullstack-web-runtime:local \
  --load \
  .
```

## GitHub Actions Configuration

### Required Repository Variables

Set these in repository settings (Settings → Secrets and variables → Actions → Variables):
- `DOCKERHUB_USERNAME` - Your Docker Hub username (optional)

### Required Repository Secrets

Set these in repository settings (Settings → Secrets and variables → Actions → Secrets):
- `DOCKERHUB_TOKEN` - Docker Hub access token (optional, for dual registry push)
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### Workflow Features

- **PR Validation**: Builds amd64 image on PR, posts comment with status
- **Path Triggers**: Only builds when `sandbox/` files change
- **Concurrency Control**: Cancels outdated builds on new pushes
- **Optimized Caching**: Per-architecture GitHub Actions cache
- **Build Summary**: Detailed summary in GitHub Actions UI

## Development

### Directory Structure

```
sandbox/
├── Dockerfile           # Multi-stage Docker build
├── entrypoint.sh        # Container startup script
├── .bashrc              # Shell configuration with custom prompt
└── README.md           # This file
```

### Customizing the Image

1. **Add System Packages**: Edit `Dockerfile` base stage
2. **Add Node.js Packages**: Edit global npm install section
3. **Modify Startup**: Edit `entrypoint.sh`
4. **Customize Shell**: Edit `.bashrc`

### Testing Changes Locally

```bash
# Build locally
cd sandbox
docker build -t test-runtime .

# Test web terminal
docker run --rm -p 7681:7681 test-runtime

# Test with full environment
docker run --rm \
  -p 7681:7681 \
  -p 3000:3000 \
  -e ANTHROPIC_AUTH_TOKEN="test-token" \
  -e PROJECT_NAME="test-project" \
  test-runtime
```

### Creating a Pull Request

When submitting changes:
1. Ensure `Dockerfile` builds successfully locally
2. Test the runtime environment
3. Create PR - the workflow will automatically validate
4. Check the PR comment for build status
5. Merge to main to publish multi-arch images

## Image Architecture

### Multi-Stage Build

**Stage 1: Base** (Ubuntu 24.04)
- System dependencies
- Node.js 22.x setup
- PostgreSQL repository
- Global npm packages
- Container tools (Buildah, Podman)
- Development tools

**Stage 2: User Environment** (as agent user)
- Next.js project initialization
- shadcn/ui components installation
- User-specific configurations

### Runtime Configuration

- **User**: agent (UID 1001, GID 1001)
- **Home**: `/home/agent`
- **Working Directory**: `/home/agent/next` (auto-cd on shell start)
- **Shell**: bash with custom prompt
- **Entrypoint**: ttyd web terminal

### Storage Configuration

- **Driver**: VFS (for compatibility)
- **Runtime**: crun
- **Cgroup Manager**: cgroupfs
- **Storage Root**: `/home/agent/.local/share/containers/storage`

## Security Considerations

### Container Security
1. **Non-Root User**: Runs as `agent` user (UID 1001)
2. **Sudo Access**: Agent has passwordless sudo for development flexibility
3. **Rootless Containers**: Buildah/Podman configured for rootless operation

### Network Security
1. **Port Exposure**: Only expose necessary ports (3000, 7681)
2. **Ingress Rules**: Use Kubernetes ingress with TLS termination
3. **Authentication**: Consider adding authentication to ttyd in production

### Best Practices
1. Always set `ANTHROPIC_AUTH_TOKEN` securely (Kubernetes secrets)
2. Use resource limits in Kubernetes (CPU, memory)
3. Enable security contexts in pod specifications
4. Regular security updates via automated rebuilds

## Kubernetes Integration

### Used in FullstackAgent Platform

This runtime is designed for Kubernetes deployment:
- StatefulSet with persistent storage
- Service for internal communication
- Ingress for web terminal and app access
- ConfigMap for environment variables
- Secret for sensitive data (API tokens)

### Resource Requirements

**Minimum**:
- CPU: 500m
- Memory: 1Gi
- Storage: 5Gi

**Recommended**:
- CPU: 2000m
- Memory: 4Gi
- Storage: 20Gi

## Troubleshooting

### Image Build Issues

**Problem**: Build fails during Next.js initialization
```bash
# Solution: Check Node.js version compatibility
docker build --no-cache .
```

**Problem**: Multi-arch build slow with QEMU
```bash
# Solution: Use native ARM runners for ARM builds (GitHub Actions matrix)
```

### Runtime Issues

**Problem**: ttyd not accessible
```bash
# Check container logs
docker logs <container-id>

# Check port binding
docker ps
```

**Problem**: Claude Code CLI not starting
```bash
# Verify authentication token
docker exec <container-id> env | grep ANTHROPIC

# Check Claude Code installation
docker exec <container-id> which claude
```

**Problem**: Buildah permission denied
```bash
# Ensure running as agent user
docker exec <container-id> whoami

# Check storage configuration
docker exec <container-id> cat /etc/containers/storage.conf
```

### Performance Issues

**Problem**: Slow container startup
```bash
# Possible causes:
# - Large Next.js node_modules (expected)
# - Resource constraints (increase limits)
# - Image pull time (use local cache)
```

## Health Checks

The image includes a health check for ttyd:
```dockerfile
HEALTHCHECK --interval=2m --timeout=30s --start-period=1m --retries=3 \
  CMD curl -f http://localhost:7681/ || exit 1
```

To check health status:
```bash
docker inspect --format='{{.State.Health.Status}}' <container-id>
```

## License

MIT License - See LICENSE file in the repository root

## Support

- **Issues**: https://github.com/FullstackAgent/FullstackAgent/issues
- **Discussions**: https://github.com/FullstackAgent/FullstackAgent/discussions
- **Documentation**: https://github.com/FullstackAgent/FullstackAgent/tree/main/docs

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes to `sandbox/` directory
4. Test locally with `docker build`
5. Commit your changes (`git commit -m 'feat: Add new feature'`)
6. Push to your fork (`git push origin feature/my-feature`)
7. Create a Pull Request

The CI/CD workflow will automatically validate your changes.

## Changelog

See [docs/changelogs/](../docs/changelogs/) for version history and changes.

## Maintainers

- FullstackAgent Team
- Community Contributors

---

**Built with Claude Code for AI-powered full-stack development**

Multi-architecture support powered by GitHub Actions and Docker Buildx