# Active Context

## agentic-control v1.1.0 - PNPM MONOREPO ✅

Unified AI agent fleet management, triage, and orchestration toolkit.

### Monorepo Structure

The project is a pnpm workspace monorepo:

```
/workspace/
├── pnpm-workspace.yaml          # Workspace configuration
├── packages/
│   ├── agentic-control/         # Main CLI and runtime package (npm)
│   └── vitest-agentic-control/  # Vitest plugin for E2E testing (npm)
├── scripts/
│   ├── monitor-npm.ts           # NPM health & stats monitoring
│   └── sync-versions.ts         # Version sync for monorepo
└── python/                      # Python CrewAI companion (PyPI)
```

### Release & Maintenance (UPDATED 2025-12-24)

- **Standardized Naming**: All package references updated to use `agentic-control` (unscoped) to match the published npm package.
- **Automated Version Sync**: Added `scripts/sync-versions.ts` and `@semantic-release/exec` to ensure workspace packages stay in sync with the root version during release.
- **NPM Monitoring**: New `pnpm run monitor:npm` command and `.github/workflows/monitor.yml` for daily health and download tracking.
- **CI/CD Fixes**: Resolved TypeScript build error in `cli.ts` that was blocking releases.

### Test Status

- **82 tests passing** (23 vitest-agentic-control + 59 agentic-control)
- Workspace-level `pnpm run build` and `pnpm run test` commands work
- Production release property tests are passing, validating build purity and architecture.

### Development Commands

```bash
# Install dependencies (workspace)
pnpm install

# Build all packages
pnpm run build

# Test all packages
pnpm run test

# Monitor npm stats
pnpm run monitor:npm

# Sync versions (manual)
pnpm tsx scripts/sync-versions.ts
```

### Key Features

- **Multi-org token management** with automatic switching
- **AI-powered triage** (Anthropic, OpenAI, Google, Mistral, Azure, Ollama)
- **Sandbox execution** with Docker isolation
- **Fleet coordination** and agent handoff protocols
- **MCP server mocking** for E2E testing
- **Provider mocking** for unit testing without API calls

---
*Release maintenance & monitoring implemented: 2025-12-24*
## Session: 2025-12-31
- Fixed Docker build hang by updating Dockerfile to use pnpm@9 and --no-frozen-lockfile.
- Added build-essential to Docker image for git dependencies.
- Updated Dockerfile to install local Python package instead of missing remote one.
- Updated root package.json repository URLs to match subpackages.
- Added Python tests to CI workflow.
