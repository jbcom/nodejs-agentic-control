
# CrewAI Flows

This directory contains production-ready, event-driven workflows that orchestrate game development.

## Available Flows

### 1. TDD Prototype Flow (`tdd_prototype_flow.py`)
**Purpose:** Standard 4-phase Test-Driven Development pattern for prototyping features

**Phases:**
1. Design Phase - Technical design with HITL approval
2. Implementation Phase - Build based on approved design  
3. Validation Phase - QA testing with HITL approval
4. Documentation Phase - Update ConPort and create handoff docs

**Usage:**
```bash
cd python/crew_agents && uv run python -m crew_agents.run_flow tdd_prototype
```

### 2. Meshy Asset Flow (`meshy_asset_flow.py`)
**Purpose:** Complete pipeline for generating 3D game assets via Meshy API

**Steps:**
1. Generate static 3D model from text
2. Add skeleton rigging
3. Generate animation variants (parallel)
4. Create retextured variant
5. Human review of all variants

**Usage:**
```bash
cd python/crew_agents && uv run python -m crew_agents.run_flow meshy_asset otter "realistic river otter" "grey fur variant"
```

### 3. Prototype to Production Flow (`prototype_to_production_flow.py`)
**Purpose:** Assess prototype readiness and plan next development steps

**Routes:**
- `deploy` - If production ready
- `refactor` - If needs refactoring
- `next_slice` - Plan next vertical slice

**Usage:**
```bash
cd python/crew_agents && uv run python -m crew_agents.run_flow prototype_assessment biome_selector_diorama
```

### 4. Asset Integration Flow (`asset_integration_flow.py`)
**Purpose:** Integrate generated assets into ECS and validate

**Steps:**
1. Load asset manifest
2. Generate ECS components
3. Validate in-game

### 5. HITL Review Flow (`hitl_review_flow.py`)
**Purpose:** Human-in-the-loop review with standardized UI controls

**Controls:**
- Slider (1-10 rating)
- Notes text area
- REJECT / SAVE buttons

### 6. Batch Generation Flow (`batch_generation_flow.py`)
**Purpose:** Generate multiple species/assets in parallel for efficiency

## Architecture

All flows:
- Use `@start()` decorator for entry points
- Use `@listen()` decorator for event-driven execution
- Use `@router()` decorator for conditional branching
- Maintain state using Pydantic models
- Support resumability through state persistence

## Integration with Process Compose

Each flow can be run as a background process via `process-compose.yaml`:

```yaml
tdd_prototype_flow:
  command: "cd python/crew_agents && uv run python -m crew_agents.run_flow tdd_prototype"
```

## Documentation

For detailed workflow patterns and best practices, see:
- `/python/crew_agents/.ruler/reusable_workflows.md`
- CrewAI Flow docs: `/crewAI/docs/en/concepts/flows.mdx`
