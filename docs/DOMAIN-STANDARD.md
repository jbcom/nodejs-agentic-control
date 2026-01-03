# Multi-Repo Domain Standard

This document outlines the standard for granting a dedicated domain to a project ecosystem.

## Qualifying Criteria

A project qualifies for a dedicated domain when it meets the following criteria:

1.  **3+ repositories** exist under the same namespace prefix.
2.  **Cross-repo dependencies** exist (repos depend on each other).
3.  **Unified brand identity** is maintained across repos.
4.  **Public API surface** warrants dedicated documentation.

## Agentic Ecosystem Example

The `agentic` ecosystem is an example of a project that meets these criteria.

| Repository | Description | npm Package |
|------------|-------------|-------------|
| nodejs-agentic-triage | Primitives for AI-powered development | `@agentic/triage` |
| nodejs-agentic-control | Orchestration layer | `@agentic/control` |
| python-agentic-crew | AI crew orchestration | PyPI: agentic-crew |
| python-agentic-game-development | Game dev with AI | (internal) |
| rust-agentic-game-development | Core AI client libs | crates.io: agentic-ai |
| rust-agentic-game-generator | RPG generation | (to merge) |

## Proposed Domain Structure

The following domain structure is proposed for the `agentic` ecosystem:

```
agentic.dev/                      # Apex - main documentation
├── /docs                         # Core concepts
├── /api                          # API reference
└── /examples                     # Usage examples

triage.agentic.dev/               # Primitives package
control.agentic.dev/              # Orchestration package
crew.agentic.dev/                 # Crew package (Python)
```

## Subdomain Configuration

To configure a subdomain for a specific repository, create a `.github/settings.yml` file in that repository with the following content:

```yaml
# Inherit all settings from the organization .github repository
_extends: .github

# =============================================================================
# Pages
# =============================================================================
pages:
  # The source branch and directory for GitHub Pages
  source:
    branch: main
    path: "/docs" # Or the appropriate path for your documentation

  # The custom domain for GitHub Pages
  cname: triage.agentic.dev # Replace with your subdomain
```

This will override the default GitHub Pages configuration and set the custom domain for the repository.
