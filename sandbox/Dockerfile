# =============================================================================
# Stage 1: Base image with system dependencies
# =============================================================================
FROM ubuntu:24.04 AS base

# Metadata labels for image identification and management
LABEL maintainer="FullstackAgent" \
      version="1.0.0" \
      description="Full-stack web development runtime with Next.js, shadcn/ui, Claude Code CLI, and container tools" \
      org.opencontainers.image.source="https://github.com/your-repo/FullstackAgent" \
      org.opencontainers.image.licenses="MIT"

# Environment variables for build configuration
# DEBIAN_FRONTEND: Prevents interactive prompts during apt-get operations
# NODE_VERSION: Target Node.js version for installation
# PATH: Extends PATH to include user-local binaries
# NOTE: Sensitive variables below are declared as empty strings for documentation.
#       Actual values will be securely injected at runtime via Kubernetes Secrets.
#       This is safe - no actual secrets are hardcoded in the Dockerfile.
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_VERSION=22.x \
    CLAUDE_CODE_VERSION=latest \
    PATH="/root/.local/bin:/home/agent/.local/bin:$PATH" \
    ANTHROPIC_BASE_URL="" \
    ANTHROPIC_AUTH_TOKEN="" \
    ANTHROPIC_MODEL="" \
    ANTHROPIC_SMALL_FAST_MODEL="" \
    DOCKER_HUB_NAME="" \
    DOCKER_HUB_PASSWD=""

# -----------------------------------------------------------------------------
# Install system dependencies in a single layer to reduce image size
# Combines base tools, Node.js repository setup, and PostgreSQL repository
# -----------------------------------------------------------------------------
RUN set -eux; \
    # Update package lists and install base dependencies
    apt-get update; \
    apt-get install -y --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        git \
        gnupg \
        lsb-release \
        nano \
        python3 \
        python3-pip \
        software-properties-common \
        sudo \
        unzip \
        vim \
        wget; \
    # Add Node.js 22.x LTS repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION} | bash -; \
    # Add PostgreSQL repository (using new gpg keyring method)
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg; \
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list; \
    # Update again after adding new repositories
    apt-get update; \
    # Install Node.js and PostgreSQL client
    apt-get install -y --no-install-recommends \
        nodejs \
        postgresql-client-16; \
    # Upgrade npm to latest version
    npm install -g npm@latest; \
    # Clean up apt cache and temporary files to reduce image size
    apt-get clean; \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# -----------------------------------------------------------------------------
# Install global npm packages in a single layer
# Includes CLI tools for Next.js, package managers, deployment, and AI assistance
# -----------------------------------------------------------------------------
RUN npm install -g \
        @anthropic-ai/claude-code \
        create-next-app \
        pnpm \
        prisma \
        typescript \
        vercel \
        yarn \
    # Clean npm cache to reduce image size
    && npm cache clean --force

# -----------------------------------------------------------------------------
# Create non-root user for security best practices
# agent user (UID 1001) with sudo privileges for development flexibility
# -----------------------------------------------------------------------------
RUN groupadd -g 1001 agent \
    && useradd -u 1001 -g 1001 -m -s /bin/bash agent \
    && echo 'agent ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# -----------------------------------------------------------------------------
# Install container tools (Buildah, Podman, Skopeo) for rootless container operations
# Enables building and managing containers without Docker daemon
# -----------------------------------------------------------------------------
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        buildah \
        crun \
        fuse-overlayfs \
        podman \
        skopeo \
        slirp4netns \
        uidmap \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# -----------------------------------------------------------------------------
# Configure Buildah and Podman for rootless operation
# Sets up storage, runtime, and registry configurations
# -----------------------------------------------------------------------------
RUN mkdir -p /etc/containers /home/agent/.local/share/containers /home/agent/.config/containers \
    # Storage configuration (VFS driver for simplicity and compatibility)
    && { \
        echo '[storage]'; \
        echo 'driver = "vfs"'; \
        echo 'runroot = "/run/user/1001/containers"'; \
        echo 'graphroot = "/home/agent/.local/share/containers/storage"'; \
        echo '[storage.options]'; \
        echo 'mount_program = "/usr/bin/fuse-overlayfs"'; \
    } > /etc/containers/storage.conf \
    # Engine configuration (cgroup and runtime settings)
    && { \
        echo '[engine]'; \
        echo 'cgroup_manager = "cgroupfs"'; \
        echo 'events_logger = "file"'; \
        echo '[engine.runtimes]'; \
        echo 'crun = ["/usr/bin/crun"]'; \
    } > /etc/containers/containers.conf \
    # Registry configuration (default search registries)
    && { \
        echo '[registries.search]'; \
        echo 'registries = ["docker.io", "quay.io"]'; \
    } > /etc/containers/registries.conf \
    # Set proper ownership for agent user directories
    && chown -R agent:agent /home/agent/.local /home/agent/.config

# -----------------------------------------------------------------------------
# Install development tools, GitHub CLI, and modern CLI utilities
# Combines multiple installations to reduce layers and image size
# -----------------------------------------------------------------------------
RUN set -eux; \
    # Add GitHub CLI repository
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg; \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null; \
    # Update and install all development tools in one layer
    apt-get update; \
    apt-get install -y --no-install-recommends \
        bat \
        dnsutils \
        fd-find \
        gh \
        htop \
        iputils-ping \
        jq \
        make \
        net-tools \
        openssh-client \
        ripgrep \
        rsync \
        screen \
        telnet \
        tmux \
        tree \
        zip; \
    # Clean up to reduce image size
    apt-get clean; \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# -----------------------------------------------------------------------------
# Install modern CLI tools (eza and ttyd) from GitHub releases
# eza: Modern ls replacement with colors and git integration
# ttyd: Web-based terminal for browser access
# -----------------------------------------------------------------------------
RUN set -eux; \
    # Download and install eza
    wget -q -O - https://github.com/eza-community/eza/releases/latest/download/eza_x86_64-unknown-linux-gnu.tar.gz | tar xz -C /usr/local/bin; \
    # Download and install ttyd
    wget -q -O /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.x86_64; \
    # Set executable permissions
    chmod +x /usr/local/bin/eza /usr/local/bin/ttyd; \
    # Verify installations
    eza --version || true; \
    ttyd --version || true

# Set working directory for application
WORKDIR /home/agent

# -----------------------------------------------------------------------------
# Copy configuration files (placed before user switch for better caching)
# entrypoint.sh: Container startup script
# .bashrc: Shell configuration with custom prompt and Claude CLI auto-start
# -----------------------------------------------------------------------------
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --chmod=644 .bashrc /etc/skel/.bashrc

# -----------------------------------------------------------------------------
# Create and configure /opt/next-template directory with proper permissions
# Must be done as root before switching to agent user
# -----------------------------------------------------------------------------
RUN mkdir -p /opt/next-template \
    && chown -R agent:agent /opt/next-template

# =============================================================================
# Stage 2: Next.js project template preparation
# =============================================================================

# Switch to non-root user for security and proper file ownership
USER agent

# -----------------------------------------------------------------------------
# Create Next.js project template at /opt/next-template
# This template will be copied to /home/agent/next by InitContainer on first run
# Reason: /home/agent will be mounted by PVC, so we need to store template elsewhere
# -----------------------------------------------------------------------------
RUN set -eux; \
    # Create template directory (accessible by agent user)
    mkdir -p /opt/next-template; \
    cd /opt/next-template; \
    # Initialize Next.js with all recommended settings
    # IMPORTANT: --yes flag is required for non-interactive build (skips React Compiler, Turbopack prompts)
    npx --yes create-next-app@latest . \
        --typescript \
        --tailwind \
        --eslint \
        --app \
        --src-dir \
        --import-alias "@/*" \
        --use-pnpm \
        --disable-git \
        --yes; \
    # Verify Next.js project was created successfully
    if [ ! -f /opt/next-template/package.json ]; then \
        echo "ERROR: Next.js creation failed - package.json not found"; \
        ls -la /opt/next-template; \
        exit 1; \
    fi; \
    echo "✓ Next.js project created successfully"; \
    # Initialize shadcn/ui with default configuration
    pnpm dlx shadcn@latest init -d -y; \
    # Install all available shadcn/ui components
    pnpm dlx shadcn@latest add --all --yes; \
    echo "✓ shadcn/ui components installed"; \
    # Clean pnpm cache to reduce layer size
    pnpm store prune; \
    # Final verification
    echo "Verifying template contents:"; \
    ls -la /opt/next-template; \
    echo "✓ Next.js template created at /opt/next-template"

# =============================================================================
# Container Runtime Configuration
# =============================================================================

# -----------------------------------------------------------------------------
# Expose ports for various development servers and services
# 3000/3001: Next.js dev/prod servers
# 5000: Flask/Python apps
# 5173: Vite dev server
# 8000/8080: General HTTP services
# 5432: PostgreSQL client connections
# 7681: ttyd web terminal
# -----------------------------------------------------------------------------
EXPOSE 3000 3001 5000 5173 8080 8000 5432 7681

# -----------------------------------------------------------------------------
# Health check configuration
# Monitors ttyd web terminal availability with lenient timeouts for development
# - Checks every 2 minutes to avoid unnecessary load
# - Waits 1 minute after container start before first check
# - Allows 30 seconds per check with 3 retries before marking unhealthy
# -----------------------------------------------------------------------------
HEALTHCHECK --interval=2m --timeout=30s --start-period=1m --retries=3 \
    CMD curl -f http://localhost:7681/ || exit 1

# -----------------------------------------------------------------------------
# Container entrypoint
# Starts ttyd web terminal which provides browser-based shell access
# The .bashrc will auto-start Claude Code CLI on first connection
# -----------------------------------------------------------------------------
CMD ["/usr/local/bin/entrypoint.sh"]
