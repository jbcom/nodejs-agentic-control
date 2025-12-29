# CrewAI Modular Architecture

## Overview

This package provides a **package-agnostic CrewAI engine** that discovers and
runs crews defined in packages' `.crewai/` directories.

## Current Implementation

The architecture has two main parts:

### 1. Generic Engine (`internal/crewai`)

```
internal/crewai/
  src/crew_agents/
    core/
      discovery.py    # Discovers .crewai/ directories
      loader.py       # Loads crews from YAML configs
      runner.py       # Executes crews
    base/
      archetypes.yaml # Reusable agent templates
    tools/            # Shared file tools
    main.py           # CLI: crewai run <package> <crew>
```

### 2. Package-Specific Crews (`packages/<name>/.crewai/`)

```
packages/otterfall/.crewai/
  manifest.yaml       # Package crew configuration
  knowledge/          # Domain-specific knowledge
  crews/              # Crew definitions (agents.yaml, tasks.yaml)
```

## Solution: Package-Defined Crews

Each package that needs CrewAI defines its own configuration in a `.crewai/` directory.
The `internal/crewai` package becomes a **generic loader/runner** that discovers and executes these.

## Directory Structure

```
# Generic CrewAI engine (internal/crewai)
internal/crewai/
  src/crew_agents/
    core/
      discovery.py      # Discovers .crewai/ directories in packages
      loader.py         # Loads crew definitions from YAML
      runner.py         # Runs crews with loaded configs
    base/
      agents.py         # Reusable agent archetypes
      tools.py          # Shared tools (file I/O, etc.)
    cli.py              # CLI: `crewai run <package> <crew>`

# Package-specific crew definitions
packages/otterfall/.crewai/
  manifest.yaml         # Package crew configuration
  knowledge/
    ecs_patterns/
    rendering_patterns/
    game_components/
  crews/
    game_builder/
      agents.yaml       # Agent definitions
      tasks.yaml        # Task definitions
    world_design/
      agents.yaml
      tasks.yaml
  flows/
    build.yaml          # Complex multi-crew flows

packages/vendor-connectors/.crewai/
  manifest.yaml
  knowledge/
    api_patterns/
  crews/
    connector_builder/
      agents.yaml
      tasks.yaml
```

## Package Manifest (manifest.yaml)

```yaml
# packages/otterfall/.crewai/manifest.yaml
name: otterfall
description: CrewAI crews for Otterfall game development
version: "1.0"

# Python requirements for this package's crews
requires:
  - crewai[tools,anthropic]>=1.5.0

# Default LLM configuration
llm:
  provider: anthropic
  model: claude-sonnet-4-20250514

# Available crews
crews:
  game_builder:
    description: Build ECS components and game systems
    agents: crews/game_builder/agents.yaml
    tasks: crews/game_builder/tasks.yaml
    knowledge:
      - knowledge/ecs_patterns
      - knowledge/rendering_patterns
      - knowledge/game_components

  world_design:
    description: Design world and biome systems
    agents: crews/world_design/agents.yaml
    tasks: crews/world_design/tasks.yaml

# Complex workflows using multiple crews
flows:
  full_build:
    description: Complete build workflow
    steps:
      - crew: world_design
      - crew: game_builder
      - crew: qa_validation
```

## Agent Template System

Packages can extend base agent archetypes:

```yaml
# internal/crewai base agents
# internal/crewai/base/archetypes.yaml
archetypes:
  senior_engineer:
    role: Senior {language} Engineer
    goal: Write production-quality {language} code following best practices
    backstory: >
      You are a senior developer with 10+ years experience.
      You always read existing code before writing.
      You follow project conventions exactly.

  qa_engineer:
    role: Quality Assurance Engineer
    goal: Review code for errors, security issues, and convention violations
    backstory: >
      You specialize in code review with an eye for bugs,
      type safety, and security issues.

  technical_lead:
    role: Technical Lead
    goal: Ensure code is complete and properly integrated
    backstory: >
      You have final approval on code quality and architecture.
```

```yaml
# packages/otterfall/.crewai/crews/game_builder/agents.yaml
senior_typescript_engineer:
  extends: senior_engineer  # Uses base archetype
  variables:
    language: TypeScript/TSX
  # Override specific fields
  backstory: >
    {base}  # Include base backstory
    You have deep knowledge of:
    - Miniplex ECS patterns
    - React Three Fiber rendering
    - Yuka AI steering behaviors
    - Mobile performance optimization
```

## CLI Usage

```bash
# List available packages with crews
crewai list

# List crews in a package
crewai list otterfall

# Run a specific crew
crewai run otterfall game_builder --input "Create a QuestComponent"

# Run a flow
crewai flow otterfall full_build

# Run with custom knowledge path
crewai run otterfall game_builder --knowledge ./extra-docs/
```

## GitHub Actions Workflow

The workflow becomes generic:

```yaml
# .github/workflows/crewai.yml
name: CrewAI Tasks

on:
  workflow_dispatch:
    inputs:
      package:
        description: 'Package to run crew for'
        required: true
        type: choice
        options:
          - otterfall
          - vendor-connectors
      crew:
        description: 'Crew to run'
        required: true
        type: string
      input:
        description: 'Input specification'
        required: true
        type: string

jobs:
  run-crewai:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      
      - name: Run CrewAI
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd internal/crewai
          uv run crewai run ${{ inputs.package }} ${{ inputs.crew }} \
            --input "${{ inputs.input }}"
```

## Discovery Implementation

```python
# internal/crewai/src/crew_agents/core/discovery.py
from pathlib import Path
import yaml

def discover_packages(workspace_root: Path) -> dict[str, Path]:
    """Discover all packages with .crewai/ directories."""
    packages = {}
    
    # Check packages/ directory
    for pkg_dir in (workspace_root / "packages").iterdir():
        crewai_dir = pkg_dir / ".crewai"
        if crewai_dir.exists() and (crewai_dir / "manifest.yaml").exists():
            packages[pkg_dir.name] = crewai_dir
    
    return packages

def load_manifest(crewai_dir: Path) -> dict:
    """Load a package's CrewAI manifest."""
    manifest_path = crewai_dir / "manifest.yaml"
    with open(manifest_path) as f:
        return yaml.safe_load(f)

def get_crew_config(crewai_dir: Path, crew_name: str) -> dict:
    """Load a specific crew's configuration."""
    manifest = load_manifest(crewai_dir)
    crew_config = manifest["crews"].get(crew_name)
    if not crew_config:
        raise ValueError(f"Crew '{crew_name}' not found")
    
    # Load agents and tasks YAML
    agents = yaml.safe_load((crewai_dir / crew_config["agents"]).read_text())
    tasks = yaml.safe_load((crewai_dir / crew_config["tasks"]).read_text())
    
    return {
        "agents": agents,
        "tasks": tasks,
        "knowledge_paths": [
            crewai_dir / kp for kp in crew_config.get("knowledge", [])
        ],
    }
```

## Migration Path

1. **Phase 1**: Create the discovery/loader system in `internal/crewai`
2. **Phase 2**: Move Otterfall-specific content to `packages/otterfall/.crewai/`
3. **Phase 3**: Update GitHub workflow to use generic runner
4. **Phase 4**: Add crews for other packages as needed

## Benefits

1. **Separation of Concerns**: Each package owns its AI configuration
2. **Reusability**: Base agent archetypes can be shared
3. **Discoverability**: CLI can list all available crews
4. **Maintainability**: Otterfall changes don't affect core engine
5. **Extensibility**: New packages can add crews without touching internal/crewai
