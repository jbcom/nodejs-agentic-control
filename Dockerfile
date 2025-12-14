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

# Install pnpm (fast Node.js package manager)
RUN npm install -g pnpm

# Create non-root user for security
RUN useradd -m -u 1000 -s /bin/bash agent
USER agent
WORKDIR /home/agent

# =============================================================================
# Install agentic-crew with AI framework support
# =============================================================================

# Install agentic-crew with CrewAI (most common framework)
# Users can install additional frameworks via: pip install agentic-crew[langgraph,strands]
RUN pip install --user --no-cache-dir "agentic-crew[crewai]"

# =============================================================================
# Install agentic-control (TypeScript control plane)
# =============================================================================

# Setup pnpm for global installs (required for pnpm v9+)
# Modern pnpm versions do not create a global bin directory by default.
# This setup ensures cross-platform compatibility and is critical for:
# - GitHub Actions Marketplace workflows
# - Multi-architecture Docker builds (linux/amd64, linux/arm64)
# - Local Docker image execution with global CLI access
# Note: pnpm setup uses $HOME/.local/share/pnpm by default on Linux
# For the 'agent' user (HOME=/home/agent), this resolves to /home/agent/.local/share/pnpm
RUN pnpm setup && echo "pnpm setup completed successfully"
ENV PNPM_HOME="/home/agent/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install agentic-control globally
RUN pnpm add -g agentic-control

# Verify installation
RUN agentic-control --version

# =============================================================================
# Environment setup
# =============================================================================

# Add user local bin to PATH for agentic-crew CLI
# Note: PNPM_HOME is already in PATH from earlier setup
ENV PATH="/home/agent/.local/bin:${PATH}"

# Default working directory for agent tasks
WORKDIR /workspace

# Verify installation
RUN agentic-crew --help && agentic --help

# Entry point: agentic-control CLI
ENTRYPOINT ["agentic"]
CMD ["--help"]

# =============================================================================
# Usage Examples:
# =============================================================================
#
# Build:
#   docker build -t agentic-control .
#
# Run fleet status:
#   docker run --rm agentic-control fleet status
#
# Run a crew (requires mounting workspace and setting API keys):
#   docker run --rm \
#     -v $(pwd):/workspace \
#     -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
#     agentic-control sandbox run --image agentic-control "Implement feature X"
#
# Interactive shell:
#   docker run --rm -it --entrypoint bash agentic-control
#
# =============================================================================
