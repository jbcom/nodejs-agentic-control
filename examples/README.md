# agentic-control Examples

This directory contains working examples demonstrating key features of the agentic-control package.

## Prerequisites

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   export CURSOR_API_KEY="your-cursor-api-key"
   export GITHUB_TOKEN="your-github-token"
   ```

3. **Build the package:**
   ```bash
   pnpm run build
   ```

## Examples

### Basic Examples

| Example | Description |
|---------|-------------|
| [01-agent-spawn.ts](./01-agent-spawn.ts) | Spawn a single background agent |
| [02-fleet-management.ts](./02-fleet-management.ts) | Monitor and manage multiple agents |
| [03-orchestration-patterns.ts](./03-orchestration-patterns.ts) | Diamond pattern and multi-agent coordination |

### Running Examples

```bash
# Run with tsx (development)
pnpm tsx examples/01-agent-spawn.ts

# Or after building
node examples/01-agent-spawn.js
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Control Center (You)                      │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ Fleet   │  │ AI Analyzer  │  │ Handoff Manager      │    │
│  │ Manager │  │ (Triage)     │  │ (Agent Continuity)   │    │
│  └────┬────┘  └──────┬───────┘  └──────────┬───────────┘    │
│       │              │                      │                │
│       └──────────────┴──────────────────────┘                │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ Agent 1 │    │ Agent 2 │    │ Agent 3 │
    │ (repo-a)│    │ (repo-b)│    │ (repo-c)│
    └─────────┘    └─────────┘    └─────────┘
```

## Key Concepts

### Fleet

The `Fleet` class manages Cursor Background Agents:

- **Spawning**: Create new agents with specific tasks
- **Monitoring**: Track agent status and progress
- **Communication**: Send follow-up messages to agents
- **Archiving**: Store conversation history

### AI Analyzer

The `AIAnalyzer` provides intelligent analysis:

- **Conversation Analysis**: Extract tasks, blockers, and recommendations
- **Code Review**: Automated PR review with severity ratings
- **Priority Assessment**: Triage issues by severity and category

### Orchestration Patterns

- **Diamond Pattern**: Fan-out work to multiple agents, fan-in results
- **Coordination Loop**: Bidirectional communication via PR comments
- **Handoff**: Seamless agent-to-agent task continuation

## Additional Resources

- [API Documentation](../docs/_build/api/index.html)
- [Contributing Guide](../CONTRIBUTING.md)
- [Main README](../README.md)
