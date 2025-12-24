# Agent Instructions for @agentic/control

## Overview

Unified AI agent fleet management with TypeScript core and Python CrewAI companion.

**@agentic/control** consumes triage primitives from **[@agentic/triage](https://github.com/jbdevprimary/@agentic/triage)**.

## Using @agentic/triage Tools

```typescript
import { getTriageTools, getIssueTools, getReviewTools } from '@agentic/triage';
import { generateText } from 'ai';

// In agent configurations
const triageAgent = {
  tools: getTriageTools(),
  systemPrompt: 'You are a triage specialist...',
};

// Or selective import
const issueAgent = {
  tools: getIssueTools(),
  systemPrompt: 'You manage issues...',
};
```

## Before Starting

```bash
cat memory-bank/activeContext.md
```

## TypeScript Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Test
pnpm run test

# Format with Prettier
pnpm run format

# Lint
pnpm run lint
```

## Python Development

```bash
cd python

# Install dependencies
uv sync --extra tests

# Run tests
uv run pytest tests/ -v

# Lint and format
uvx ruff check --fix src/ tests/
uvx ruff format src/ tests/
```

## MCP Server

TypeScript provides MCP server capabilities for CrewAI Python agents.

```bash
# Start TypeScript MCP server (for CrewAI)
npx agentic mcp

# Start Python CrewAI MCP server
crew-mcp
```

## Tool Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    @agentic/control                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   AI Agent Fleet                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │   │
│  │  │ Triage  │  │ Develop │  │ Review  │  │ Deploy │ │   │
│  │  │ Agent   │  │ Agent   │  │ Agent   │  │ Agent  │ │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────────┘ │   │
│  │       │            │            │                   │   │
│  │       └────────────┴────────────┘                   │   │
│  │                    │                                 │   │
│  │                    ▼                                 │   │
│  │       ┌────────────────────────────┐                │   │
│  │       │ getTriageTools() from      │                │   │
│  │       │ @strata/triage             │                │   │
│  │       └────────────────────────────┘                │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ▲                                 │
│                           │ npm dependency                  │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │        @agentic/triage         │
            │  (Triage tool primitives)     │
            └───────────────────────────────┘
```

## Commit Messages

Use conventional commits:
- `feat(fleet): new fleet feature` → minor
- `feat(crew): Python crew feature` → minor
- `fix(triage): bug fix` → patch

## Architecture

- `src/` - TypeScript source (fleet, triage, handoff, GitHub)
- `python/src/crew_agents/` - Python CrewAI agents
- Both share config patterns and MCP integration

## Related

- [@agentic/triage](https://github.com/jbdevprimary/@agentic/triage) - Triage tool primitives (consumed by this project)
- [agentic-crew](https://github.com/jbdevprimary/agentic-crew) - Multi-agent orchestration
