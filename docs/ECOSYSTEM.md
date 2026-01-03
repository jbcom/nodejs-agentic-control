# Ecosystem Workflows

The **Ecosystem** is a unified family of GitHub Actions workflows powered by `@agentic/control`.

## Architecture

```
                    ┌─────────────────────────┐
                    │   @agentic/control      │
                    │   (npm package)         │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ CursorAPI     │   │ Triage Tools  │   │ Fleet Manager │
│ (fleet/)      │   │ (triage/)     │   │ (fleet/)      │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Workflows

| Workflow | Purpose | Uses |
|----------|---------|------|
| `ecosystem-curator` | Nightly orchestration | `agentic-orchestrator` |
| `ecosystem-reviewer` | PR lifecycle | `agentic-pr-review` |
| `ecosystem-fixer` | CI resolution | `agentic-ci-resolution` |
| `ecosystem-delegator` | Issue delegation | `agentic-issue-triage` |
| `ecosystem-harvester` | Agent monitoring | Direct fleet API |
| `ecosystem-sage` | On-call advisor | Ollama |

## Actions from @agentic/control

```yaml
# Fleet orchestration
- uses: jbcom/nodejs-agentic-control/actions/agentic-orchestrator@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    command: summary

# PR review
- uses: jbcom/nodejs-agentic-control/actions/agentic-pr-review@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    model: glm-4.6:cloud

# Issue triage
- uses: jbcom/nodejs-agentic-control/actions/agentic-issue-triage@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    issue_number: ${{ github.event.issue.number }}

# CI resolution
- uses: jbcom/nodejs-agentic-control/actions/agentic-ci-resolution@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    run_id: ${{ github.event.workflow_run.id }}
```

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `CURSOR_API_KEY` | Cursor Cloud Agent API |
| `GOOGLE_JULES_API_KEY` | Google Jules API |
| `OLLAMA_API_KEY` | Ollama cloud API |

## Related Packages

- `@agentic/control` - Orchestration and fleet management
- `@agentic/triage` - AI triage primitives (Zod schemas, Vercel AI SDK)
- `python-agentic-crew` - CrewAI integration
- `python-vendor-connectors` - Vendor API clients (Cursor, GitHub, etc.)
