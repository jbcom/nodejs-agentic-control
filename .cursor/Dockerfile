# Pre-built image with Python 3.13 + Node.js 24 + uv
# https://github.com/nikolaik/docker-python-nodejs
FROM nikolaik/python-nodejs:python3.13-nodejs24

WORKDIR /workspace

# =============================================================================
# SYSTEM DEPENDENCIES
# =============================================================================
# Single consolidated layer for all apt packages to minimize image size
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build essentials (required for native Node modules: better-sqlite3, esbuild, etc.)
    build-essential \
    pkg-config \
    # Version control
    git-lfs \
    # GitHub CLI (Debian native package)
    gh \
    # Task automation (Debian native package)
    just \
    && rm -rf /var/lib/apt/lists/*

# =============================================================================
# GO INSTALLATION
# =============================================================================
RUN wget https://go.dev/dl/go1.25.3.linux-amd64.tar.gz && \
    rm -rf /usr/local/go && \
    tar -C /usr/local -xzf go1.25.3.linux-amd64.tar.gz && \
    rm go1.25.3.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:${PATH}"

RUN go version

# =============================================================================
# GIT LFS CONFIGURATION
# =============================================================================
# CRITICAL: --skip-smudge prevents workspace crashes with large LFS repos
# LFS files appear as pointers (fine for Cursor/AI analysis)
# Actual LFS operations (checkout, pull) handled by GitHub Actions
RUN git lfs install --system --skip-smudge

# =============================================================================
# NODE.JS PACKAGE MANAGER (pnpm)
# =============================================================================
# MUST match package.json "packageManager" field exactly
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && \
    corepack prepare pnpm@9.15.0 --activate && \
    pnpm --version

# =============================================================================
# DEVELOPER TOOLS
# =============================================================================
# Process-compose - Multi-process orchestration (required for CrewAI workflows)
# Using official installation script
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/F1bonacc1/process-compose/main/scripts/get-pc.sh)" -- -b /usr/local/bin && \
    process-compose version

# =============================================================================
# PLAYWRIGHT BROWSER CACHE
# =============================================================================
# Pre-install Playwright dependencies and Chromium browser
# Playwright bundles its own Chromium (not using system package)
# This is required for CrewAI agents using @modelcontextprotocol/server-playwright
RUN pnpm dlx playwright install-deps chromium && \
    pnpm dlx playwright install chromium
