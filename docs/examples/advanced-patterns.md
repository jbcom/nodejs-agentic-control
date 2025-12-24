# Advanced Configuration Patterns

This guide covers advanced multi-organization setups and complex workflows.

## Multi-Organization Setup

For managing multiple GitHub organizations with different tokens:

```json
{
  "tokens": {
    "organizations": {
      "my-company": {
        "name": "my-company",
        "tokenEnvVar": "GITHUB_COMPANY_TOKEN"
      },
      "open-source": {
        "name": "open-source",
        "tokenEnvVar": "GITHUB_OSS_TOKEN"
      },
      "client-work": {
        "name": "client-work", 
        "tokenEnvVar": "GITHUB_CLIENT_TOKEN"
      }
    },
    "defaultTokenEnvVar": "GITHUB_TOKEN",
    "prReviewTokenEnvVar": "GITHUB_REVIEW_TOKEN"
  },
  "triage": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY"
  },
  "fleet": {
    "autoCreatePr": true,
    "openAsCursorGithubApp": false,
    "skipReviewerRequest": false
  },
  "defaultRepository": "my-company/main-project",
  "coordinationPr": 123,
  "logLevel": "debug",
  "verbose": true
}
```

## Environment Variables for Multi-Org

```bash
# Default GitHub token
export GITHUB_TOKEN="ghp_default_token"

# Organization-specific tokens
export GITHUB_COMPANY_TOKEN="ghp_company_token"
export GITHUB_OSS_TOKEN="ghp_oss_token" 
export GITHUB_CLIENT_TOKEN="ghp_client_token"

# Separate token for PR reviews (optional)
export GITHUB_REVIEW_TOKEN="ghp_review_token"

# AI provider keys
export ANTHROPIC_API_KEY="sk-ant-your_key"
export OPENAI_API_KEY="sk-your_openai_key"

# Cursor API for fleet management
export CURSOR_API_KEY="your_cursor_key"
```

## Advanced Fleet Coordination

### Diamond Pattern Coordination

```bash
# Spawn coordinated agents across multiple repos
agentic fleet coordinate \
  --pr 456 \
  --repo my-company/main-project \
  --agents agent1,agent2,agent3 \
  --outbound 30000 \
  --inbound 10000
```

### Station-to-Station Handoff

```bash
# Initiate handoff from current agent
agentic handoff initiate predecessor-123 \
  --pr 789 \
  --branch feature/current-work \
  --repo https://github.com/my-company/next-project \
  --tasks "Complete API integration,Add tests,Update docs"

# Confirm health as successor
agentic handoff confirm predecessor-123

# Take over predecessor's work
agentic handoff takeover predecessor-123 789 feature/new-branch \
  --merge-method squash \
  --auto
```

## AI Provider Configuration

### Multiple Providers

```json
{
  "triage": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

### Azure OpenAI

```json
{
  "triage": {
    "provider": "azure",
    "model": "gpt-4o",
    "apiKeyEnvVar": "AZURE_OPENAI_API_KEY"
  }
}
```

Environment variables for Azure:

```bash
export AZURE_OPENAI_API_KEY="your_azure_key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_API_VERSION="2024-02-15-preview"
```

## MCP Server Configuration

```json
{
  "mcp": {
    "cursor": {
      "enabled": true,
      "tokenEnvVar": "CURSOR_API_KEY",
      "mode": "stdio"
    },
    "github": {
      "enabled": true,
      "tokenEnvVar": "GITHUB_TOKEN",
      "mode": "stdio"
    },
    "context7": {
      "enabled": true,
      "mode": "proxy",
      "proxyUrl": "http://localhost:3000"
    },
    "21st-magic": {
      "enabled": true,
      "command": "npx",
      "args": ["-y", "@21st-dev/magic-mcp@latest"],
      "env": {
        "TWENTY_FIRST_API_KEY": "${TWENTY_FIRST_API_KEY}"
      }
    }
  }
}
```

## Workflow Automation

### Automated Code Review Pipeline

```bash
#!/bin/bash
# review-pipeline.sh

# Get the current branch and base
BRANCH=$(git branch --show-current)
BASE=${1:-main}

# Run AI code review
agentic triage review --base $BASE --head $BRANCH > review.md

# If review passes, create PR
if grep -q "Ready to merge: ✅ YES" review.md; then
  # Spawn agent to create PR
  agentic fleet spawn "$(git remote get-url origin)" \
    "Create PR for $BRANCH with AI review approval" \
    --ref $BRANCH \
    --auto-pr
else
  echo "❌ Code review failed. Check review.md for issues."
  exit 1
fi
```

### Multi-Repository Coordination

```bash
#!/bin/bash
# multi-repo-deploy.sh

REPOS=(
  "my-company/frontend"
  "my-company/backend" 
  "my-company/infrastructure"
)

# Spawn agents for each repo
for repo in "${REPOS[@]}"; do
  agentic fleet spawn "https://github.com/$repo" \
    "Deploy version v1.2.0 to production" \
    --ref release/v1.2.0 \
    --auto-pr
done

# Monitor coordination
agentic fleet coordinate \
  --pr 999 \
  --repo my-company/deployment-coordination \
  --outbound 60000 \
  --inbound 15000
```

## Security Best Practices

### Token Rotation

```bash
# Script to update tokens across environments
#!/bin/bash

# Update GitHub tokens
export GITHUB_TOKEN="$(get-new-token github default)"
export GITHUB_COMPANY_TOKEN="$(get-new-token github company)"
export GITHUB_OSS_TOKEN="$(get-new-token github oss)"

# Validate tokens work
agentic tokens validate

# Test configuration
agentic config
```

### Sandboxed Execution

```bash
# Run agents in isolated containers
agentic sandbox run "Analyze security vulnerabilities" \
  --runtime claude \
  --workspace ./secure-workspace \
  --output ./security-reports \
  --memory 512 \
  --timeout 300 \
  --env "SECURITY_SCAN=true,REPORT_FORMAT=json"
```