# =============================================================================
# jbcom Universal Development Environment
# Supports: Python 3.13, Node.js 24, Go 1.24
# =============================================================================
# Synced from: jbcom/jbcom-control-center
# DO NOT EDIT - Changes will be overwritten by sync workflow
# =============================================================================

FROM nikolaik/python-nodejs:python3.13-nodejs24

# Set shell options for safer RUN commands
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

WORKDIR /workspace

# =============================================================================
# SYSTEM DEPENDENCIES
# =============================================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials
    build-essential \
    pkg-config \
    # Version control
    git-lfs \
    gh \
    # Task automation
    just \
    # Database tools
    sqlite3 \
    # Modern shell utilities
    ripgrep \
    fd-find \
    # JSON/YAML processing
    jq \
    # Text editors
    vim \
    nano \
    # Network tools
    curl \
    wget \
    ca-certificates \
    # Process management
    procps \
    htop \
    # Compression
    unzip \
    zip \
    # Playwright/browser dependencies
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Git LFS
RUN git lfs install --system --skip-smudge

# =============================================================================
# GO INSTALLATION
# =============================================================================
ENV GO_VERSION=1.24.0
ENV GOROOT=/usr/local/go
ENV GOPATH=/root/go
ENV PATH="$GOROOT/bin:$GOPATH/bin:$PATH"

RUN ARCH=$(dpkg --print-architecture) && \
    curl -sSL "https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz" | tar -C /usr/local -xzf - && \
    go version

# Go tools
RUN go install golang.org/x/tools/gopls@latest && \
    go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest && \
    rm -rf /root/go/pkg/mod/cache

# =============================================================================
# PNPM (Node.js package manager)
# =============================================================================
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && \
    corepack prepare pnpm@9.15.0 --activate && \
    pnpm --version

# =============================================================================
# PROCESS COMPOSE
# =============================================================================
RUN PROCESS_COMPOSE_VERSION="v1.35.2" && \
    ARCH=$(dpkg --print-architecture) && \
    curl -sSL "https://github.com/F1bonacc1/process-compose/releases/download/${PROCESS_COMPOSE_VERSION}/process-compose_linux-${ARCH}.tar.gz" \
        -o /tmp/process-compose.tar.gz && \
    tar -xzf /tmp/process-compose.tar.gz -C /usr/local/bin process-compose && \
    rm /tmp/process-compose.tar.gz && \
    process-compose version

# =============================================================================
# GLOBAL NODE.JS TOOLS
# =============================================================================
RUN pnpm add -g \
    @intellectronica/ruler@0.3.16 \
    @anthropic-ai/claude-code@2.0.55 \
    typescript \
    && ruler --version

# =============================================================================
# PYTHON TOOLS (via uv)
# =============================================================================
ENV PATH="/root/.local/bin:$PATH"

# aider requires Python 3.12
RUN uv tool install --python python3.12 aider-chat==0.86.1 && \
    aider --version

# =============================================================================
# VERIFICATION
# =============================================================================
RUN echo "=== Tool Verification ===" && \
    echo "Python: $(python --version)" && \
    echo "Node.js: $(node --version)" && \
    echo "Go: $(go version)" && \
    echo "pnpm: $(pnpm --version)" && \
    echo "uv: $(uv --version)" && \
    echo "gh: $(gh --version | head -1)" && \
    echo "golangci-lint: $(golangci-lint --version | head -1)" && \
    echo "ruler: $(ruler --version 2>&1 | head -1)" && \
    echo "aider: $(aider --version 2>&1 | head -1)" && \
    echo "process-compose: $(process-compose version 2>&1 | head -1)" && \
    echo "=== Verification Complete ==="
