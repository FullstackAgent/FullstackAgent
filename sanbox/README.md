# FullStack Web Runtime

A comprehensive Docker image providing a complete development environment for AI-powered full-stack web development with Claude Code CLI integration.

## Features

- **Claude Code CLI**: Pre-installed and configured for AI-assisted development
- **Node.js 22.x**: Latest LTS version with npm, yarn, and pnpm
- **Next.js & React**: Full support for modern web development
- **PostgreSQL Client**: Database management tools
- **ttyd**: Web-based terminal access via WebSocket
- **Container Tools**: Buildah, Podman, and Skopeo for container operations
- **Development Tools**: Git, GitHub CLI, vim, nano, and more
- **Multi-architecture**: Supports both amd64 and arm64

## Docker Hub

```bash
docker pull fullstackagent/fullstack-web-runtime:latest
```

## Available Tags

- `latest` - Latest stable release from main branch
- `develop` - Development version from develop branch
- `v1.0.0`, `v1.0`, `v1` - Semantic versioning tags
- `main-sha-xxxxxxx` - SHA-based tags for specific commits
- `YYYYMMDD` - Date-based tags

## Quick Start

### Run Interactive Shell

```bash
docker run -it --rm \
  -p 7681:7681 \
  -p 3000:3000 \
  fullstackagent/fullstack-web-runtime:latest
```

### With Claude Code Configuration

```bash
docker run -it --rm \
  -p 7681:7681 \
  -p 3000:3000 \
  -e ANTHROPIC_AUTH_TOKEN="your-token" \
  -e ANTHROPIC_BASE_URL="https://api.anthropic.com" \
  -e ANTHROPIC_MODEL="claude-3-5-sonnet-20241022" \
  fullstackagent/fullstack-web-runtime:latest
```

### Access Web Terminal

After starting the container, access the web terminal at:
- http://localhost:7681

## Environment Variables

### Claude Code Configuration
- `ANTHROPIC_AUTH_TOKEN` - Your Anthropic API key
- `ANTHROPIC_BASE_URL` - API endpoint (default: empty, uses Claude Code's default)
- `ANTHROPIC_MODEL` - Model to use (e.g., claude-3-5-sonnet-20241022)
- `ANTHROPIC_SMALL_FAST_MODEL` - Fast model for quick tasks

### ttyd Configuration
- `TTYD_PORT` - Port for web terminal (default: 7681)
- `TTYD_USERNAME` - Username for authentication (optional)
- `TTYD_PASSWORD` - Password for authentication (optional)
- `TTYD_INTERFACE` - Network interface (default: 0.0.0.0)
- `TTYD_BASE_PATH` - Base URL path (default: /)
- `TTYD_WS_PATH` - WebSocket path (default: /ws)
- `TTYD_MAX_CLIENTS` - Maximum concurrent clients (default: 0 = unlimited)
- `TTYD_READONLY` - Read-only mode (default: false)
- `TTYD_CHECK_ORIGIN` - Check WebSocket origin (default: false)
- `TTYD_ALLOW_ORIGIN` - Allowed origins for CORS (default: *)
- `DISABLE_TTYD` - Set to "true" to disable ttyd

### Docker Hub Credentials (for Buildah push)
- `DOCKER_HUB_NAME` - Docker Hub username
- `DOCKER_HUB_PASSWD` - Docker Hub password

## Exposed Ports

- `3000` - Next.js development server
- `3001` - Next.js production server
- `5000` - Python/Flask applications
- `5173` - Vite development server
- `7681` - ttyd web terminal
- `8000` - General HTTP service
- `8080` - General HTTP service
- `5432` - PostgreSQL client connections

## Building the Image

### Local Build

```bash
cd runtime
docker build -t fullstack-web-runtime:local .
```

### Multi-architecture Build

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t fullstackagent/fullstack-web-runtime:latest \
  --push \
  .
```

## GitHub Actions Workflow

The image is automatically built and pushed to Docker Hub when:
- Changes are pushed to `main` branch (tagged as `latest`)
- Changes are pushed to `develop` branch (tagged as `develop`)
- A version tag is created (e.g., `v1.0.0`)
- Manually triggered via workflow dispatch

### Required GitHub Secrets

Set these in your repository settings:
- `DOCKER_HUB_USERNAME` - Your Docker Hub username
- `DOCKER_HUB_PASSWORD` - Your Docker Hub password or access token

## Development

### Customizing the Image

1. Edit `Dockerfile` to add or remove packages
2. Modify `entrypoint.sh` to change startup behavior
3. Test locally before pushing

### Testing Changes

```bash
# Build locally
docker build -t test-runtime .

# Test ttyd
docker run --rm -p 7681:7681 test-runtime

# Test with custom environment
docker run --rm \
  -e TTYD_USERNAME=admin \
  -e TTYD_PASSWORD=secret \
  -p 7681:7681 \
  test-runtime
```

## Security Considerations

1. **Authentication**: Always set `TTYD_USERNAME` and `TTYD_PASSWORD` in production
2. **Origin Checking**: Enable `TTYD_CHECK_ORIGIN=true` for production deployments
3. **Network Security**: Use proper ingress rules and TLS termination
4. **Container Security**: Run as non-root user when possible

## Troubleshooting

### ttyd Not Starting

Check logs:
```bash
docker logs <container-id>
```

Common issues:
- Port already in use
- Invalid environment variables
- Missing dependencies

### WebSocket Connection Failed

1. Check nginx/ingress configuration for WebSocket support
2. Verify `TTYD_CHECK_ORIGIN` and `TTYD_ALLOW_ORIGIN` settings
3. Ensure proper proxy headers are forwarded

### Claude Code CLI Issues

1. Verify `ANTHROPIC_AUTH_TOKEN` is set correctly
2. Check network connectivity to Anthropic API
3. Ensure proper model name is specified

## License

MIT License - See LICENSE file in the repository root

## Support

- Issues: https://github.com/FullstackAgent/FullstackAgent/issues
- Discussions: https://github.com/FullstackAgent/FullstackAgent/discussions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the image locally
5. Submit a pull request

## Maintainers

- fanux@sealos.io

---

Built with ❤️ for AI-powered development