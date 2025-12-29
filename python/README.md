# CrewAI - Package-Agnostic Crew Runner

A generic CrewAI engine that discovers and runs crews defined in packages' `.crewai/` directories.

## Quick Start

```bash
# List all packages with crews
just crew-list

# Run a specific crew
just crew-run otterfall game_builder --input "Create a QuestComponent"

# Show crew details
just crew-info otterfall game_builder
```

## Architecture

### Engine (`internal/crewai`)

The engine provides:
- **Discovery**: Finds `.crewai/` directories in packages
- **Loading**: Parses YAML configs into CrewAI objects
- **Running**: Executes crews with provided inputs
- **CLI**: `crewai run <package> <crew> --input "..."`

### Package Crews (`packages/<name>/.crewai/`)

Each package can define its own crews:

```
packages/otterfall/.crewai/
  manifest.yaml       # Package crew configuration
  knowledge/          # Domain-specific knowledge files
  crews/
    game_builder/
      agents.yaml     # Agent definitions
      tasks.yaml      # Task definitions
```

## CLI Usage

```bash
# From the internal/crewai directory
cd internal/crewai

# List available packages and crews
uv run python -m crew_agents list

# Run a crew
uv run python -m crew_agents run otterfall game_builder --input "Create X"

# Run with input from file
uv run python -m crew_agents run otterfall game_builder --file tasks.md

# Show crew info
uv run python -m crew_agents info otterfall game_builder

# Legacy: Direct build (uses otterfall game_builder)
uv run python -m crew_agents build "Create a QuestComponent"
```

## Adding Crews to a Package

1. Create `.crewai/manifest.yaml`:

```yaml
name: mypackage
description: My package crews
version: "1.0"

crews:
  builder:
    description: Build components
    agents: crews/builder/agents.yaml
    tasks: crews/builder/tasks.yaml
    knowledge:
      - knowledge/patterns
```

2. Create agent and task YAML files:

```yaml
# crews/builder/agents.yaml
senior_engineer:
  role: Senior Engineer
  goal: Write production-quality code
  backstory: You are a senior developer...
```

```yaml
# crews/builder/tasks.yaml
write_code:
  description: Write the requested code
  expected_output: Working code with tests
  agent: senior_engineer
```

3. Add knowledge files (optional):

```
knowledge/
  patterns/
    architecture.md
    examples.ts
```

## GitHub Actions

The CrewAI workflow can be triggered manually:

1. Go to Actions → CrewAI Tasks
2. Select package and crew
3. Choose input type (Kiro tasks or custom)
4. Run workflow

## Development

```bash
# Install dependencies
cd internal/crewai
uv sync

# Run tests
uv run pytest

# Test tools
uv run python -m crew_agents test-tools
```

## Dependencies

- **crewai**: Core CrewAI framework
- **anthropic**: Claude API access
- **pyyaml**: YAML parsing
- **mesh-toolkit**: 3D asset generation (optional, from mesh-toolkit PR)
