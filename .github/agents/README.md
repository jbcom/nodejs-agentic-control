# AI Agent Instructions

This directory contains instructions for AI coding agents working on this repository.

## Available Agents

| Agent | File | Purpose |
|-------|------|---------|
| Code Reviewer | `code-reviewer.md` | PR review, security, quality |
| Test Runner | `test-runner.md` | Unit, integration, E2E tests |
| Project Manager | `project-manager.md` | Issues, PRs, project tracking |

## Usage

AI agents should reference these files for repository-specific guidance.

### Authentication

All agents must use proper GitHub authentication:

```bash
GH_TOKEN="$GITHUB_TOKEN" gh <command>
```

### Common Patterns

1. **Read before modifying** - Always understand context first
2. **Run builds after changes** - Verify changes compile
3. **Link issues to PRs** - Use `Closes #123` format
