# Architecture

## Overview

`agentic-control` is a TypeScript library for unified AI agent fleet management, triage, and orchestration. It provides:

- **Fleet Management**: Spawn and manage Cursor Cloud Agents
- **Triage**: AI-powered PR analysis and code review
- **MCP Integration**: Connect to vendor APIs via Model Context Protocol
- **GitHub Integration**: PR lifecycle management

## Package Structure

```
packages/agentic-control/
├── src/
│   ├── core/           # Configuration, providers, tokens
│   ├── fleet/          # Cursor API and agent spawning
│   ├── github/         # GitHub client and PR operations
│   ├── triage/         # AI analysis and MCP clients
│   ├── handoff/        # Agent handoff protocols
│   ├── sandbox/        # Docker sandbox for crew execution
│   └── crews/          # CrewAI integration (subprocess)
├── tests/              # Test files
└── dist/               # Built output
```

## Key Components

### Core

- `config.ts` - Configuration loading via cosmiconfig
- `providers.ts` - AI provider loading (Anthropic, OpenAI, Ollama, etc.)
- `tokens.ts` - Token management for GitHub and AI APIs

### Fleet

- `cursor-api.ts` - Direct HTTP client for Cursor Background Agent API
- `fleet.ts` - Fleet management and agent spawning

### Triage

- `analyzer.ts` - AI-powered code review and conversation analysis
- `mcp-clients.ts` - MCP client initialization and tool loading
- `pr-triage-agent.ts` - PR-specific triage agent

### GitHub

- `client.ts` - GitHub REST API client
- PR status, CI checks, feedback collection

## AI Provider Architecture

Supports multiple AI providers via Vercel AI SDK:

| Provider | Package | Notes |
|----------|---------|-------|
| Anthropic | `@ai-sdk/anthropic` | Default provider |
| OpenAI | `@ai-sdk/openai` | GPT-4, etc. |
| Google | `@ai-sdk/google` | Gemini |
| Ollama | `ai-sdk-ollama` | Local and Cloud (v3.0.0+) |
| Azure | `@ai-sdk/azure` | Azure OpenAI |
| Mistral | `@ai-sdk/mistral` | Mistral AI |

### Ollama v3.0.0 Features

- Automatic JSON repair for structured outputs
- `reliableObjectGeneration` with retries
- Web search and fetch tools

## MCP Integration

MCP (Model Context Protocol) servers provide tools for AI agents:

| Server | Purpose |
|--------|---------|
| `vendor-connectors` | Jules, Cursor, GitHub, Slack APIs |
| `cursor-mcp-server` | Cursor-specific tools |
| `@modelcontextprotocol/server-github` | GitHub operations |
| `@anthropic/context7-mcp` | Context7 tools |

## Configuration

Via `agentic.config.json`:

```json
{
  "defaultRepository": "owner/repo",
  "triage": {
    "provider": "ollama",
    "model": "qwen3-coder:480b-cloud"
  },
  "mcp": {
    "vendor-connectors": { "enabled": true }
  }
}
```

## Security Considerations

- Token sanitization in error messages
- SSRF protection for webhook URLs
- Input validation for agent IDs and prompts
- No shell interpolation in subprocess execution
