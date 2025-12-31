# agentic-control Docker Image
# Provides both agentic-control (TypeScript) and agentic-crew (Python)
# for AI agent fleet management and crew orchestration

# =============================================================================
# Stage 1: Node.js base for copying binaries
# =============================================================================
FROM node:22-slim AS node-base

# =============================================================================
# Stage 2: Final image with Python base + Node.js
# =============================================================================
FROM python:3.13-slim AS final

# Install Node.js binaries from node-base
COPY --from=node-base /usr/local/bin/node /usr/local/bin/
COPY --from=node-base /usr/local/lib/node_modules /usr/local/lib/node_modules

# Create symlinks for npm and npx
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    jq \
    ca-certificates \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
    dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | \
    tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv

# Install pnpm (match CI version)
RUN npm install -g pnpm@9

# Create non-root user for security
RUN useradd -m -u 1000 -s /bin/bash agent
USER agent
WORKDIR /home/agent

# Setup pnpm for global installs (required for pnpm v9+)
ENV PNPM_HOME="/home/agent/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN mkdir -p "$PNPM_HOME"

# =============================================================================
# Install Python dependencies (agentic-control-crews)
# =============================================================================

# Copy Python code
COPY --chown=agent:agent python/ ./python/

# Install the Python package locally
RUN pip install --user --no-cache-dir "./python[crewai]"

# =============================================================================
# Install agentic-control (TypeScript control plane)
# =============================================================================

# Copy workspace files
COPY --chown=agent:agent package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=agent:agent packages/agentic-control/package.json ./packages/agentic-control/
COPY --chown=agent:agent packages/providers/package.json ./packages/providers/
COPY --chown=agent:agent packages/vitest-agentic-control/package.json ./packages/vitest-agentic-control/
COPY --chown=agent:agent scripts/ ./scripts/

# Install dependencies (use --no-frozen-lockfile to match CI and handle any drift)
RUN pnpm install --no-frozen-lockfile

# Copy source code and build
COPY --chown=agent:agent packages/ ./packages/

# Build the packages
RUN pnpm run build

# Create global symlinks for CLI commands
RUN ln -s /home/agent/packages/agentic-control/dist/cli.js "$PNPM_HOME/agentic" && \
    ln -s /home/agent/packages/agentic-control/dist/cli.js "$PNPM_HOME/agentic-control" && \
    chmod +x /home/agent/packages/agentic-control/dist/cli.js

# Verify installation
RUN node /home/agent/packages/agentic-control/dist/cli.js --version || echo "CLI version check skipped"

# =============================================================================
# Environment setup
# =============================================================================

# Add user local bin to PATH for Python CLIs
ENV PATH="/home/agent/.local/bin:${PATH}"

# Default working directory for agent tasks
WORKDIR /workspace

# Verify installation
RUN /home/agent/.local/bin/crew-agents --help && \
    node /home/agent/packages/agentic-control/dist/cli.js --help

# Entry point: agentic-control CLI
ENTRYPOINT ["node", "/home/agent/packages/agentic-control/dist/cli.js"]
CMD ["--help"]
