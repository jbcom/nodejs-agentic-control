# =============================================================================
# jbcom/agentic-control - Optimized for Cursor Background Agents & Agentic CI
# =============================================================================
# Multi-stage build for a production-ready agentic control container
#
# Features:
# - Node.js 22 LTS (main runtime)
# - Python 3.13 (companion package + agent tooling)
# - UV for fast Python package management
# - PNPM for Node package management
# - GitHub CLI, Git, and common CI tools
# - Rootless execution support
#
# Tags published:
# - latest, x.y.z, x.y, x (semantic versions)
# - python3.13-node22 (version-specific)
# =============================================================================

ARG NODE_VERSION=22
ARG PYTHON_VERSION=3.13
ARG DISTRO=bookworm

# -----------------------------------------------------------------------------
# Stage 1: Python base with UV
# -----------------------------------------------------------------------------
FROM python:${PYTHON_VERSION}-${DISTRO} AS python-base

# Install UV (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Create non-root user
RUN groupadd --gid 1000 agent && \
    useradd --uid 1000 --gid agent --shell /bin/bash --create-home agent

# -----------------------------------------------------------------------------
# Stage 2: Node.js installation
# -----------------------------------------------------------------------------
FROM python-base AS node-install

ARG NODE_VERSION
ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    xz-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js from official distribution
RUN ARCH= && case "${TARGETARCH}" in \
        amd64) ARCH='x64';; \
        arm64) ARCH='arm64';; \
        *) echo "Unsupported architecture: ${TARGETARCH}"; exit 1;; \
    esac && \
    NODE_FULL_VERSION=$(curl -fsSL "https://nodejs.org/dist/latest-v${NODE_VERSION}.x/SHASUMS256.txt" | head -n1 | awk '{print $2}' | sed 's/node-\(.*\)-linux.*/\1/') && \
    echo "Installing Node.js ${NODE_FULL_VERSION} for ${ARCH}" && \
    curl -fsSLO "https://nodejs.org/dist/${NODE_FULL_VERSION}/node-${NODE_FULL_VERSION}-linux-${ARCH}.tar.xz" && \
    tar -xJf "node-${NODE_FULL_VERSION}-linux-${ARCH}.tar.xz" -C /usr/local --strip-components=1 --no-same-owner && \
    rm "node-${NODE_FULL_VERSION}-linux-${ARCH}.tar.xz" && \
    ln -sf /usr/local/bin/node /usr/local/bin/nodejs

# Enable corepack for pnpm/yarn
RUN corepack enable && corepack prepare pnpm@latest --activate

# -----------------------------------------------------------------------------
# Stage 3: Final image with all tools
# -----------------------------------------------------------------------------
FROM node-install AS final

LABEL org.opencontainers.image.title="agentic-control"
LABEL org.opencontainers.image.description="AI agent fleet management and orchestration for Cursor and CI/CD"
LABEL org.opencontainers.image.authors="jbcom"
LABEL org.opencontainers.image.source="https://github.com/jbcom/agentic-control"
LABEL org.opencontainers.image.licenses="MIT"

ARG VERSION=dev

# Install runtime dependencies and agentic tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core tools
    git \
    curl \
    wget \
    jq \
    # Build essentials (for native npm modules)
    build-essential \
    # Process management
    procps \
    # Networking
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Agent SDK globally (for sandbox execution)
RUN npm install -g @anthropic-ai/claude-agent-sdk

# Set up environment
ENV NODE_ENV=production
ENV UV_SYSTEM_PYTHON=1
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
ENV VERSION=${VERSION}

# Sandbox-specific directories
ENV AGENTIC_WORKSPACE=/workspace
ENV AGENTIC_OUTPUT=/output
RUN mkdir -p ${AGENTIC_WORKSPACE} ${AGENTIC_OUTPUT} && \
    chown agent:agent ${AGENTIC_WORKSPACE} ${AGENTIC_OUTPUT}

# Create workspace directory
WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./
COPY python/pyproject.toml python/uv.lock ./python/

# Install Node.js dependencies
RUN pnpm install --frozen-lockfile --prod

# Install Python dependencies
RUN cd python && uv sync --frozen --no-dev

# Copy application code
COPY dist/ ./dist/
COPY python/src/ ./python/src/
COPY sandbox/ ./sandbox/

# Copy entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create symlinks for CLI access
RUN ln -sf /app/node_modules/.bin/agentic /usr/local/bin/agentic && \
    ln -sf /app/node_modules/.bin/agentic-control /usr/local/bin/agentic-control

# Switch to non-root user
USER agent

# Volumes for workspace and output
VOLUME ["/workspace", "/output"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version && python --version && gh --version

# Default entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["--help"]
