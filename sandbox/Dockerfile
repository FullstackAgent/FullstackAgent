# =============================================================================
# Stage 1: Base image with system dependencies
# =============================================================================
FROM ubuntu:24.04 AS base

# Metadata labels for image identification and management
LABEL maintainer="FullstackAgent" \
      version="1.0.0" \
      description="Full-stack web development runtime with Next.js, shadcn/ui, Claude Code CLI, and container tools" \
      org.opencontainers.image.source="https://github.com/FullstackAgent/fulling" \
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
    PATH="/root/.local/bin:/home/fulling/.local/bin:$PATH" \
    TERM=xterm-256color \
    COLORTERM=truecolor \
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
RUN groupadd -g 1001 fulling \
    && useradd -u 1001 -g 1001 -m -s /bin/bash fulling \
    && echo 'fulling ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

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
RUN mkdir -p /etc/containers /home/fulling/.local/share/containers /home/fulling/.config/containers \
    # Storage configuration (VFS driver for simplicity and compatibility)
    && { \
        echo '[storage]'; \
        echo 'driver = "vfs"'; \
        echo 'runroot = "/run/user/1001/containers"'; \
        echo 'graphroot = "/home/fulling/.local/share/containers/storage"'; \
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
    # Set proper ownership for fulling user directories
    && chown -R fulling:fulling /home/fulling/.local /home/fulling/.config

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
WORKDIR /home/fulling

# -----------------------------------------------------------------------------
# Copy configuration files (placed before user switch for better caching)
# entrypoint.sh: Container startup script
# ttyd-auth.sh: Authentication script for ttyd terminal access
# .bashrc: Shell configuration with custom prompt and Claude CLI auto-start
# -----------------------------------------------------------------------------
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --chmod=755 ttyd-auth.sh /usr/local/bin/ttyd-auth.sh
COPY --chmod=644 .bashrc /etc/skel/.bashrc

# =============================================================================
# Stage 2: Next.js project template preparation
# =============================================================================

# Create Next.js template directly in /opt/next-template as root, then chown to agent
# This is simpler and faster than creating in /tmp and moving
# Root can safely run npm commands during image build (not runtime)

# -----------------------------------------------------------------------------
# Step 1: Create Next.js project directly in final location
# -----------------------------------------------------------------------------
RUN set -eux; \
    TEMPLATE_DIR="/opt/next-template"; \
    mkdir -p "$TEMPLATE_DIR"; \
    cd "$TEMPLATE_DIR"; \
    echo "=== Creating Next.js project in $TEMPLATE_DIR ==="; \
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
    echo "=== Verifying Next.js project ==="; \
    ls -la "$TEMPLATE_DIR"; \
    if [ ! -f "$TEMPLATE_DIR/package.json" ]; then \
        echo "ERROR: package.json not found"; \
        exit 1; \
    fi; \
    echo "✓ Next.js project created successfully"

# -----------------------------------------------------------------------------
# Step 2: Install shadcn/ui components
# -----------------------------------------------------------------------------
RUN set -eux; \
    TEMPLATE_DIR="/opt/next-template"; \
    cd "$TEMPLATE_DIR"; \
    echo "=== Initializing shadcn/ui ==="; \
    pnpm dlx shadcn@latest init -d -y; \
    echo "=== Installing shadcn/ui components ==="; \
    pnpm dlx shadcn@latest add --all --yes; \
    echo "✓ shadcn/ui installed"

# -----------------------------------------------------------------------------
# Step 3: Clean up node_modules and set ownership
# Rationale: node_modules installed by root causes permission issues when
#            copied to PVC and used by agent user (UID 1001)
# Solution: Remove node_modules from template, agent will install when needed
# -----------------------------------------------------------------------------
RUN set -eux; \
    TEMPLATE_DIR="/opt/next-template"; \
    cd "$TEMPLATE_DIR"; \
    echo "=== Removing node_modules to avoid permission issues ==="; \
    rm -rf node_modules .next; \
    echo "=== Cleaning up pnpm cache ==="; \
    pnpm store prune; \
    echo "=== Setting ownership to fulling user (1001:1001) ==="; \
    chown -R fulling:fulling "$TEMPLATE_DIR"; \
    echo "=== Final verification ==="; \
    ls -la "$TEMPLATE_DIR"; \
    if [ ! -f "$TEMPLATE_DIR/package.json" ]; then \
        echo "ERROR: Template verification failed - package.json missing"; \
        exit 1; \
    fi; \
    if [ -d "$TEMPLATE_DIR/node_modules" ]; then \
        echo "ERROR: node_modules should have been removed"; \
        exit 1; \
    fi; \
    echo "✓ Template ready at $TEMPLATE_DIR (owned by fulling:fulling)"; \
    echo "✓ node_modules removed - user will install dependencies as needed"

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
