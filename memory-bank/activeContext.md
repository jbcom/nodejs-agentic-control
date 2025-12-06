# Active Context

## agentic-control

Unified AI agent fleet management, triage, and orchestration toolkit.

### Architecture
- **TypeScript (main)**: CLI, fleet management, triage, GitHub integration
- **Python (companion)**: CrewAI agents and flows

### TypeScript Package
- **Registry**: npm (agentic-control)
- **Runtime**: Node.js 20+
- **Entry**: `npx agentic-control` or `npx agentic`

### Python Package
- **Registry**: PyPI (agentic-control-crews)
- **Runtime**: Python 3.10+
- **Entry**: `crew-mcp` for MCP server

### Development

#### TypeScript
```bash
pnpm install
pnpm run build
pnpm run test
pnpm run format  # Prettier
```

#### Python
```bash
cd python
uv sync --extra tests
uv run pytest tests/ -v
uvx ruff check src/ tests/
```

---
*Last updated: 2025-12-06*
