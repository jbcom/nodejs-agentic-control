# @agentic/control

> 🚀 **Unified AI agent fleet management, triage, and orchestration toolkit**

[![npm version](https://badge.fury.io/js/@agentic/control.svg)](https://www.npmjs.com/package/@agentic/control)
[![Docker Pulls](https://img.shields.io/docker/pulls/jbcom/@agentic/control)](https://hub.docker.com/r/jbcom/@agentic/control)
[![CI](https://github.com/jbcom/nodejs-agentic-control/workflows/CI/badge.svg)](https://github.com/jbcom/nodejs-agentic-control/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

**Transform your development workflow with AI-powered agent orchestration.** Spawn, coordinate, and manage fleets of AI agents across your repositories with intelligent token switching, advanced triage capabilities, and secure sandbox execution.

---

## ✨ **What Makes @agentic/control Special?**

🎯 **Smart Token Management** - Automatically routes operations to the right GitHub tokens based on organization  
🚀 **Fleet Orchestration** - Spawn and coordinate multiple Cursor Background Agents simultaneously  
🔍 **AI-Powered Triage** - Analyze conversations, review code, and extract actionable insights  
🏗️ **Sandbox Execution** - Run AI agents in isolated Docker containers for safe local development  
🤝 **Seamless Handoffs** - Transfer work between agents with full context preservation  
🔐 **Security First** - Token sanitization, safe subprocess execution, and zero hardcoded credentials  
🔌 **Provider Agnostic** - Works with Anthropic, OpenAI, Google, Mistral, and Azure  

---

## 🎬 **Quick Demo**

```bash
# Initialize with smart detection
agentic init

# Spawn an AI agent to fix your CI
agentic fleet spawn "https://github.com/my-org/my-repo" \
  "Fix the failing GitHub Actions workflow" --auto-pr

# Run AI analysis in a secure sandbox
agentic sandbox run "Analyze this codebase for security vulnerabilities" \
  --workspace . --output ./security-report

# Get AI-powered code review
agentic triage review --base main --head feature-branch

# Coordinate multiple agents on complex tasks
agentic fleet coordinate --repo my-org/app --pr 156 \
  --agents agent-1,agent-2,agent-3
```

## 🌟 **Core Features**

### 🎯 **Intelligent Multi-Org Token Management**
Automatically routes GitHub operations to the correct tokens based on repository organization. No more manual token switching!

### 🚀 **AI Agent Fleet Management** 
Spawn, monitor, and coordinate multiple Cursor Background Agents working simultaneously across your repositories.

### 🏗️ **Secure Sandbox Execution** *(NEW!)*
Run AI agents in isolated Docker containers with resource limits, workspace mounting, and parallel execution support.

### 🔍 **Advanced AI Triage & Analysis**
Leverage multiple AI providers (Anthropic, OpenAI, Google, Mistral) for code review, conversation analysis, and task extraction.

### 🤝 **Station-to-Station Handoffs**
Seamlessly transfer work between agents with full context preservation and automated PR management.

### 🔐 **Production-Ready Security**
- Token sanitization in all error messages
- Safe subprocess execution without shell injection
- Typed error classes with specific error codes
- Non-root Docker execution

## 📦 **Installation**

### **Option 1: npm/pnpm (Recommended)**
```bash
# Install globally
pnpm add -g @agentic/control
# or
npm install -g @agentic/control

# Verify installation
agentic --version
```

### **Option 2: Docker (Includes Python companion)**
```bash
# Pull the latest image
docker pull jbcom/agentic-control:latest

# Run with your environment
docker run --rm \
  -e GITHUB_TOKEN=$GITHUB_TOKEN \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd):/workspace \
  jbcom/agentic-control:latest fleet list
```

### **Option 3: Development Setup**
```bash
git clone https://github.com/jbcom/nodejs-agentic-control.git
cd agentic-control
pnpm install
pnpm run build
pnpm run agentic --help
```

### Installing AI Providers

AI triage features require installing a provider SDK. Install the one you need:

```bash
# Anthropic (recommended)
pnpm add @ai-sdk/anthropic

# OpenAI
pnpm add @ai-sdk/openai

# Google AI
pnpm add @ai-sdk/google

# Mistral
pnpm add @ai-sdk/mistral

# Azure OpenAI
pnpm add @ai-sdk/azure
```

## Quick Start

### 1. Initialize Configuration

```bash
agentic init
```

The `init` command is intelligent:
- Detects your Git repository from `git remote`
- Scans for existing tokens in your environment (`GITHUB_*_TOKEN`, etc.)
- Interactively prompts for missing configuration (if terminal is interactive)
- Generates a working `agentic.config.json`

Example generated config:

```json
{
  "tokens": {
    "organizations": {
      "my-org": {
        "name": "my-org",
        "tokenEnvVar": "GITHUB_MY_ORG_TOKEN"
      }
    },
    "defaultTokenEnvVar": "GITHUB_TOKEN",
    "prReviewTokenEnvVar": "GITHUB_TOKEN"
  },
  "defaultRepository": "my-org/my-repo",
  "fleet": {
    "autoCreatePr": false,
    "openAsCursorGithubApp": false
  },
  "triage": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY"
  }
}
```

### 2. Set Environment Variables

```bash
export GITHUB_TOKEN="ghp_xxx"           # Default token
export GITHUB_MY_ORG_TOKEN="ghp_xxx"    # Organization-specific token
export ANTHROPIC_API_KEY="sk-xxx"       # For AI triage (or your provider's key)
export CURSOR_API_KEY="xxx"             # For fleet management
```

### 3. Check Token Status

```bash
agentic tokens status
```

### 4. List Your Fleet

```bash
agentic fleet list --running
```

### 5. Spawn an Agent

```bash
agentic fleet spawn https://github.com/my-org/my-repo "Fix the CI workflow" --auto-pr
```

### 6. Analyze a Session

```bash
agentic triage analyze bc-xxx-xxx -o report.md --create-issues
```

## Commands

### Configuration

```bash
# Initialize configuration (interactive)
agentic init

# Non-interactive initialization
agentic init --non-interactive
```

### Token Management

```bash
# Check all token status
agentic tokens status

# Validate required tokens
agentic tokens validate

# Show token for a specific repo
agentic tokens for-repo my-org/my-repo
```

### Fleet Management

```bash
# List all agents
agentic fleet list

# List only running agents
agentic fleet list --running

# List available Cursor models
agentic fleet models

# Get fleet summary
agentic fleet summary

# Spawn a new agent
agentic fleet spawn <repo> <task>

# Spawn with options
agentic fleet spawn <repo> <task> --ref feature-branch --auto-pr --branch my-branch

# Send followup message
agentic fleet followup <agent-id> "Status update?"

# Run coordination loop
agentic fleet coordinate --pr 123 --repo my-org/my-repo
```

> **Note**: Model selection for fleet agents is handled by Cursor internally.
> You cannot specify a model when spawning agents. Use `agentic fleet models` to see available models.

### AI Triage

```bash
# Quick triage of text
agentic triage quick "Error in deployment pipeline"

# Review code changes
agentic triage review --base main --head HEAD

# Analyze agent conversation
agentic triage analyze <agent-id> -o report.md

# Create issues from analysis
agentic triage analyze <agent-id> --create-issues

# Use specific model (overrides config)
agentic triage analyze <agent-id> --model claude-opus-4-20250514
```

### Sandbox Execution *(NEW!)*

```bash
# Run a single AI agent in sandbox
agentic sandbox run "Analyze this codebase and suggest performance improvements" \
  --runtime claude \
  --workspace . \
  --output ./analysis-results \
  --timeout 300

# Run multiple agents in parallel
agentic sandbox fleet \
  "Review authentication system" \
  "Analyze database queries" \
  "Check for security vulnerabilities" \
  --runtime claude \
  --workspace . \
  --output ./fleet-results

# With custom environment and resource limits
agentic sandbox run "Refactor the API layer" \
  --workspace ./src/api \
  --output ./refactor-results \
  --memory 2048 \
  --timeout 600 \
  --env "NODE_ENV=development,LOG_LEVEL=debug"
```

### Handoff Protocol

```bash
# Initiate handoff to successor
agentic handoff initiate <predecessor-id> --pr 123 --branch my-branch --repo https://github.com/my-org/my-repo

# Confirm health as successor
agentic handoff confirm <predecessor-id>

# Take over from predecessor
agentic handoff takeover <predecessor-id> 123 my-new-branch
```

## Configuration

### Configuration File

Create `agentic.config.json` in your project root (or run `agentic init`):

```json
{
  "tokens": {
    "organizations": {
      "my-company": {
        "name": "my-company",
        "tokenEnvVar": "GITHUB_COMPANY_TOKEN"
      },
      "open-source-org": {
        "name": "open-source-org",
        "tokenEnvVar": "GITHUB_OSS_TOKEN"
      }
    },
    "defaultTokenEnvVar": "GITHUB_TOKEN",
    "prReviewTokenEnvVar": "GITHUB_TOKEN"
  },
  "defaultRepository": "my-company/my-repo",
  "logLevel": "info",
  "fleet": {
    "autoCreatePr": true,
    "openAsCursorGithubApp": false
  },
  "triage": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY"
  }
}
```

Config is loaded using [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig).
Searches for: `agentic.config.json`, `.agenticrc`, `package.json` "agentic" key.

### AI Provider Configuration

Configure your preferred AI provider in the `triage` section:

| Provider | Package | `provider` value | Default API Key Env |
|----------|---------|------------------|---------------------|
| **Anthropic** | `@ai-sdk/anthropic` | `anthropic` | `ANTHROPIC_API_KEY` |
| **OpenAI** | `@ai-sdk/openai` | `openai` | `OPENAI_API_KEY` |
| **Google AI** | `@ai-sdk/google` | `google` | `GOOGLE_API_KEY` |
| **Mistral** | `@ai-sdk/mistral` | `mistral` | `MISTRAL_API_KEY` |
| **Azure** | `@ai-sdk/azure` | `azure` | `AZURE_API_KEY` |

Example with OpenAI:

```json
{
  "triage": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKeyEnvVar": "OPENAI_API_KEY"
  }
}
```

### Fleet Configuration

The `fleet` section configures default options for spawning agents:

```json
{
  "fleet": {
    "autoCreatePr": false,
    "openAsCursorGithubApp": false,
    "skipReviewerRequest": false
  }
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `autoCreatePr` | Auto-create PR when agent completes | `false` |
| `openAsCursorGithubApp` | Open PR as Cursor GitHub App | `false` |
| `skipReviewerRequest` | Don't add user as reviewer | `false` |

CLI flags override config file defaults:

```bash
# Override autoCreatePr
agentic fleet spawn <repo> <task> --auto-pr

# Override openAsCursorGithubApp
agentic fleet spawn <repo> <task> --as-app

# Set custom branch name
agentic fleet spawn <repo> <task> --branch feature/my-fix
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | Default GitHub token | Recommended |
| `GITHUB_<ORG>_TOKEN` | Organization-specific tokens | Per org |
| `ANTHROPIC_API_KEY` | Anthropic API key | For Anthropic triage |
| `OPENAI_API_KEY` | OpenAI API key | For OpenAI triage |
| `CURSOR_API_KEY` | Cursor API key | For fleet ops |
| `AGENTIC_MODEL` | Default AI model | Optional |
| `AGENTIC_PROVIDER` | Default AI provider | Optional |
| `AGENTIC_REPOSITORY` | Default repository | Optional |
| `AGENTIC_LOG_LEVEL` | Log level (debug/info/warn/error) | Optional |

### Dynamic Organization Configuration

Add organizations via environment variables:

```bash
# Pattern: AGENTIC_ORG_<NAME>_TOKEN=<ENV_VAR_NAME>
export AGENTIC_ORG_MYCOMPANY_TOKEN=GITHUB_MYCOMPANY_TOKEN
export AGENTIC_ORG_PARTNER_TOKEN=PARTNER_GH_PAT
```

### PR Review Token

Configure a consistent identity for all PR review operations:

```bash
export AGENTIC_PR_REVIEW_TOKEN=GITHUB_TOKEN
```

## 🎯 **Real-World Use Cases**

### **🔧 Automated Code Maintenance**
```bash
# Spawn agents to update dependencies across multiple repos
agentic fleet spawn "my-org/frontend" "Update React to v18 and fix breaking changes" --auto-pr
agentic fleet spawn "my-org/backend" "Update Node.js dependencies and fix vulnerabilities" --auto-pr
agentic fleet spawn "my-org/mobile" "Update React Native and test on latest iOS" --auto-pr
```

### **🔍 Security Auditing**
```bash
# Run security analysis in isolated sandbox
agentic sandbox run "Perform comprehensive security audit focusing on authentication, authorization, and data validation" \
  --workspace . --output ./security-audit --timeout 900
```

### **📊 Code Review Automation**
```bash
# AI-powered code review for all PRs
agentic triage review --base main --head feature/user-auth
agentic triage analyze <agent-id> --create-issues  # Auto-create follow-up issues
```

### **🚀 Release Coordination**
```bash
# Coordinate multiple agents for release preparation
agentic fleet coordinate --repo my-org/app --pr 200 \
  --agents docs-agent,test-agent,deploy-agent
```

## 💻 **Programmatic Usage**

```typescript
import { 
  Fleet, 
  AIAnalyzer, 
  SandboxExecutor,
  GitHubClient,
  getTokenForRepo,
  setTokenConfig,
  addOrganization,
} from "@agentic/control";

// Configure organizations programmatically
addOrganization({
  name: "my-company",
  tokenEnvVar: "GITHUB_COMPANY_TOKEN",
});

// Or configure everything at once
setTokenConfig({
  organizations: {
    "my-company": { name: "my-company", tokenEnvVar: "GITHUB_COMPANY_TOKEN" },
  },
  prReviewTokenEnvVar: "GITHUB_TOKEN",
});

// Fleet management
const fleet = new Fleet();
const agents = await fleet.list();
await fleet.spawn({
  repository: "https://github.com/my-company/my-repo",
  task: "Fix the bug",
  target: { autoCreatePr: true },
});

// Token-aware operations
const token = getTokenForRepo("my-company/my-repo");
// Returns value of GITHUB_COMPANY_TOKEN

// AI Analysis with default provider (from config)
const analyzer = new AIAnalyzer({ repo: "my-company/my-repo" });
const result = await analyzer.quickTriage("Error in deployment");

// AI Analysis with specific provider
const openaiAnalyzer = new AIAnalyzer({ 
  repo: "my-company/my-repo",
  provider: "openai",
  model: "gpt-4o",
  apiKey: process.env.OPENAI_API_KEY,
});

// Sandbox execution
const sandbox = new SandboxExecutor();
const result = await sandbox.execute({
  runtime: 'claude',
  workspace: './src',
  outputDir: './analysis',
  prompt: 'Analyze this code for performance bottlenecks',
  timeout: 300000, // 5 minutes
  memory: 1024, // 1GB
});

// Parallel sandbox execution
const results = await sandbox.executeFleet([
  {
    runtime: 'claude',
    workspace: './frontend',
    outputDir: './frontend-analysis',
    prompt: 'Review React components for accessibility issues',
  },
  {
    runtime: 'cursor', 
    workspace: './backend',
    outputDir: './backend-analysis',
    prompt: 'Analyze API endpoints for security vulnerabilities',
  }
]);
```

## Token Switching Logic

The package automatically selects tokens based on organization configuration:

```
Repository                    → Token Used
────────────────────────────────────────────
my-company/repo-1             → GITHUB_COMPANY_TOKEN (configured)
my-company/repo-2             → GITHUB_COMPANY_TOKEN (configured)
unknown-org/repo              → GITHUB_TOKEN (default)

PR Review Operations          → Configured PR review token
```

### How It Works

1. **Config file** (`agentic.config.json`) defines org → token mappings
2. **Environment variables** (`AGENTIC_ORG_*_TOKEN`) add dynamic mappings
3. **Programmatic configuration** overrides at runtime
4. **Default token** (`GITHUB_TOKEN`) used for unconfigured orgs

## Architecture

```
agentic-control/
├── src/
│   ├── core/           # Types, tokens, config
│   │   ├── types.ts    # Shared type definitions
│   │   ├── tokens.ts   # Intelligent token switching
│   │   └── config.ts   # Configuration management (cosmiconfig)
│   ├── fleet/          # Cursor agent fleet management
│   │   ├── fleet.ts    # High-level Fleet API
│   │   └── cursor-api.ts   # Direct Cursor API client
│   ├── triage/         # AI-powered analysis
│   │   └── analyzer.ts # Multi-provider AI analysis
│   ├── github/         # Token-aware GitHub ops
│   │   └── client.ts   # Multi-org GitHub client
│   ├── handoff/        # Agent continuity
│   │   └── manager.ts  # Handoff protocols
│   ├── cli.ts          # Command-line interface
│   └── index.ts        # Main exports
└── tests/
```

## Security

This package is designed with security in mind:

- **No hardcoded values** - All tokens and organizations are user-configured
- **Safe subprocess execution** - Uses `spawnSync` instead of shell interpolation
- **Token sanitization** - Tokens are never logged or exposed in error messages
- **ReDoS protection** - Regex patterns are designed to prevent denial of service
- **No credential patterns in docs** - We don't document third-party API key formats

### CI/CD Security Best Practices

This project follows industry security best practices:

#### GitHub Actions SHA Pinning
All GitHub Actions are pinned to their full commit SHA instead of semantic version tags. This prevents supply-chain attacks where action maintainers could modify code behind version tags.

**Example:**
```yaml
- uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
```

Instead of:
```yaml
- uses: actions/checkout@v4  # ⚠️ Vulnerable to tag manipulation
```

#### npm Trusted Publishing (OIDC)
Package publishing uses OpenID Connect (OIDC) authentication instead of long-lived tokens. This eliminates the risk of token leakage and provides cryptographic proof of package provenance.

**Setup on npmjs.com:**
1. Navigate to package settings → Publishing Access
2. Add GitHub Actions as a trusted publisher
3. Configure: `owner/repo`, `main` branch, `ci.yml` workflow, `release-node` job

**Benefits:**
- No `NPM_TOKEN` secret needed
- Automatic provenance attestation
- Cryptographic supply-chain transparency
- Time-limited credentials per publish

## Development

```bash
# Install dependencies
pnpm install

# Run CLI from source (no build required)
pnpm run agentic

# Build
pnpm run build

# Test
pnpm test

# Watch mode
pnpm run dev
```

## Related Projects

### agentic-triage (Triage Primitives)

**@agentic/control** consumes triage tools from **[agentic-triage](https://github.com/jbdevprimary/agentic-triage)**:

```typescript
import { getTriageTools } from 'agentic-triage';
import { generateText } from 'ai';

// Use in your agent configurations
const result = await generateText({
  model: yourModel,
  tools: {
    ...getTriageTools(),
    ...yourOtherTools,
  },
  prompt: 'Triage open issues...',
});
```

agentic-triage provides:
- **Vercel AI SDK Tools** - Portable triage tools for any AI agent
- **MCP Server** - Model Context Protocol server for Claude/Cursor
- **Multi-Provider Support** - GitHub, Beads, Jira, Linear

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure `pnpm test` passes
5. Create a pull request

## License

MIT © [Jon Bogaty](https://github.com/jbcom)

---

**Part of the [jbcom-oss-ecosystem](https://github.com/jbcom/jbcom-oss-ecosystem)**

