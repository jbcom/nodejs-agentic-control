# CrewAI Integration for Otterfall Development

## Overview

The CrewAI system has been integrated into the jbcom-oss-ecosystem monorepo to provide **proper agent-to-agent communication** and **intelligent task decomposition** for the Otterfall game development.

## Why CrewAI?

The current Kiro workflow has limitations:
- **Single-agent bottleneck**: One agent tries to do everything
- **No task decomposition**: Complex features aren't broken down intelligently
- **No specialization**: Same agent handles design, implementation, testing, QA
- **No collaboration**: No agent-to-agent communication or review

CrewAI solves this with:
- **Multi-agent collaboration**: Specialized agents work together
- **Hierarchical process**: Manager agent coordinates specialized workers
- **Memory & learning**: Agents learn from past interactions
- **Planning**: Tasks are decomposed before execution
- **QA review**: Code is reviewed before approval

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  OTTERFALL DEVELOPMENT CREW                     │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Project     │ Senior      │ QA          │ Chief               │
│ Manager     │ Engineer    │ Engineer    │ Engineer            │
│             │             │             │                     │
│ • Loads     │ • Writes    │ • Reviews   │ • Final             │
│   context   │   code      │   for       │   approval          │
│ • Plans     │ • Uses      │   errors    │ • Ensures           │
│   tasks     │   patterns  │ • Tests     │   completeness      │
│ • Validates │ • Follows   │   locally   │                     │
│   prereqs   │   specs     │             │                     │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP TOOLS                                   │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ ConPort     │ Git         │ Filesystem  │ Playwright          │
│             │             │             │                     │
│ Schema      │ Version     │ Read/Write  │ E2E Testing         │
│ queries     │ control     │ files       │                     │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE BASE                              │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Specs       │ Design      │ ECS         │ R3F                 │
│             │ Patterns    │ Patterns    │ Patterns            │
│ Req, Design │ Combat,     │ Components, │ Rendering,          │
│ Tasks docs  │ AI, Terrain │ Systems     │ Shaders             │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
```

## Integration Points

### 1. Spec-Driven Development

CrewAI agents read from `.kiro/specs/otterfall-complete/`:
- `requirements.md` - What to build (52 requirements)
- `design.md` - How to build it (55 properties)
- `tasks.md` - Implementation plan (14 sections)

### 2. Knowledge Base

Located in `packages/crew_agents/knowledge/`:
- `ecs_patterns/` - Miniplex ECS patterns
- `rendering_patterns/` - React Three Fiber patterns
- `game_components/` - Otterfall-specific patterns
- `specs/` - Link to `.kiro/specs/otterfall-complete/`

### 3. Code Generation

Agents write to `packages/otterfall/src/`:
- `ecs/components/` - ECS component definitions
- `ecs/systems/` - Game systems
- `ecs/data/` - Species, biomes, resources
- `components/` - R3F rendering components
- `utils/` - Utility functions
- `stores/` - Zustand state management

### 4. Testing Integration

Agents can:
- Run unit tests: `pnpm test --run`
- Run E2E tests: `pnpm run test:e2e`
- Check diagnostics: Use Kiro's getDiagnostics tool
- Validate builds: `pnpm run build`

## Usage

### Basic Task Execution

```bash
# Navigate to crew_agents
cd packages/crew_agents

# Build a feature from the task list
uv run crew_agents build "Implement Section 6.1: Species Data System"

# Build with specific requirements
uv run crew_agents build "Implement combat system with attack types, damage calculation, and cooldowns (Requirements 3-5)"
```

### Training the Crew

```bash
# Train agents with human feedback
uv run crew_agents train 5

# Agents learn from:
# - What code patterns work well
# - What mistakes to avoid
# - How to better decompose tasks
```

### Workflow Patterns

CrewAI supports reusable workflows in `.ruler/`:
- `tdd_prototype_workflow.yaml` - Test-driven development
- `meshy_asset_workflow.yaml` - 3D asset generation
- `prototype_to_production_workflow.yaml` - Refactoring

## Task Decomposition Example

**Input**: "Implement Section 6: Species and Combat Systems"

**CrewAI Decomposition**:

1. **Project Manager** (Alpha Phase):
   - Load requirements 1-5, 8
   - Load design properties 19-22
   - Validate prerequisites (species data exists)
   - Identify blockers (none)

2. **Senior Engineer** (Implementation):
   - Task 6.1.1: Create species data definitions
     - Read existing `species.ts`
     - Verify all 13 predators defined
     - Verify all 15 prey defined
     - Add missing species if any
   
   - Task 6.1.2: Implement species component system
     - Create `SpeciesComponent` with all properties
     - Implement species assignment on entity creation
     - Add species-specific model loading
   
   - Task 6.2.1: Create combat component and stats
     - Implement `CombatComponent`
     - Apply archetype-specific stats
     - Implement stamina regeneration

3. **QA Engineer** (Review):
   - Check TypeScript compilation
   - Verify ECS patterns match `.ruler/ecs_patterns.md`
   - Run unit tests
   - Check for edge cases

4. **Chief Engineer** (Approval):
   - Verify all requirements met
   - Ensure code quality
   - Approve for merge

## Configuration

### Environment Variables

```bash
# Required for LLM access (primary)
export ANTHROPIC_API_KEY="sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Optional - OpenRouter fallback
export OPENROUTER_API_KEY="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Optional - for asset generation
export MESHY_API_KEY="msy_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### LLM Configuration

Located in `packages/crew_agents/src/crew_agents/config/llm.py`:

```python
# Default: Claude 3.7 Sonnet (best for code)
llm = get_llm()  # Uses ANTHROPIC_API_KEY

# Or specify a model
llm = get_llm("claude-3-5-sonnet-20241022")

# OpenRouter fallback (if OPENROUTER_API_KEY is set)
llm = get_llm("openrouter-auto")
```

### Agent Configuration

Located in `packages/crew_agents/config/agents.yaml`:

```yaml
project_manager:
  role: "Project Manager"
  goal: "Load context, validate prerequisites, plan tasks"
  backstory: "Expert at understanding requirements and planning"

senior_engineer:
  role: "Senior TypeScript Engineer"
  goal: "Write production-quality code following patterns"
  backstory: "10+ years React, Three.js, ECS architecture"

qa_engineer:
  role: "QA Engineer"
  goal: "Review code for errors and convention violations"
  backstory: "Expert at catching bugs before production"

chief_engineer:
  role: "Chief Engineer"
  goal: "Ensure completeness and approve final code"
  backstory: "Architect with deep game development experience"
```

## Benefits for Otterfall

### 1. Proper Task Decomposition

Instead of:
```
❌ "Implement combat system" → One massive task
```

CrewAI does:
```
✅ "Implement combat system"
   ├─ Load requirements 3-5
   ├─ Create CombatComponent
   ├─ Implement attack types
   ├─ Add damage calculation
   ├─ Implement cooldowns
   ├─ Write unit tests
   └─ Write property tests
```

### 2. Specialized Agents

- **Project Manager**: Understands specs, plans work
- **Senior Engineer**: Writes code, follows patterns
- **QA Engineer**: Catches bugs, runs tests
- **Chief Engineer**: Ensures quality, approves

### 3. Memory & Learning

Agents remember:
- What patterns work well
- What mistakes were made
- How to better decompose tasks
- User preferences and feedback

### 4. Quality Assurance

Every piece of code goes through:
1. Implementation (Senior Engineer)
2. Review (QA Engineer)
3. Testing (QA Engineer)
4. Approval (Chief Engineer)

## Integration with Kiro

CrewAI **complements** Kiro, not replaces it:

| Aspect | Kiro | CrewAI |
|--------|------|--------|
| **Spec Creation** | ✅ Excellent | ❌ Not designed for this |
| **Task Planning** | ✅ Good | ✅ Excellent |
| **Code Generation** | ✅ Good | ✅ Excellent |
| **Multi-agent** | ❌ Single agent | ✅ Multiple specialized |
| **QA Review** | ❌ No review | ✅ Built-in review |
| **Learning** | ❌ No memory | ✅ Learns from feedback |

**Recommended Workflow**:
1. Use **Kiro** to create specs (requirements, design, tasks)
2. Use **CrewAI** to implement tasks from the spec
3. Use **Kiro** for quick fixes and iterations
4. Use **CrewAI** for complex features requiring decomposition

## Next Steps

### 1. Add Otterfall Knowledge

```bash
cd packages/crew_agents/knowledge

# Add Otterfall-specific patterns
mkdir -p otterfall_patterns
cp ../../otterfall/src/ecs/components.ts otterfall_patterns/
cp ../../otterfall/src/ecs/systems/*.ts otterfall_patterns/

# Document patterns
cat > otterfall_patterns/README.md << 'EOF'
# Otterfall Patterns

## ECS Architecture
- Miniplex for entity management
- Components are pure data
- Systems contain logic

## Rendering
- React Three Fiber for 3D
- Zustand for state management
- Custom shaders for effects
EOF
```

### 2. Link Specs to Knowledge

```bash
cd packages/crew_agents/knowledge
ln -s ../../../.kiro/specs/otterfall-complete specs
```

### 3. Configure for Otterfall

Edit `packages/crew_agents/crewbase.yaml`:

```yaml
# Add Otterfall-specific configuration
project_root: "../packages/otterfall"
allowed_write_dirs:
  - "src/ecs/components"
  - "src/ecs/systems"
  - "src/ecs/data"
  - "src/components"
  - "src/utils"
  - "src/stores"
```

### 4. Train on Existing Code

```bash
cd packages/crew_agents

# Train agents on existing Otterfall patterns
uv run crew_agents train 10 -f otterfall_training.pkl
```

### 5. Start Building

```bash
# Implement next task from spec
uv run crew_agents build "Implement Section 6.1: Species Data System"
```

## Troubleshooting

### Issue: Agents don't understand Otterfall patterns

**Solution**: Add more examples to knowledge base
```bash
cd packages/crew_agents/knowledge/otterfall_patterns
# Add working code examples from packages/otterfall/src
```

### Issue: Code doesn't match conventions

**Solution**: Train agents with feedback
```bash
uv run crew_agents train 5
# Provide feedback on what's wrong
```

### Issue: Tasks are too large

**Solution**: Break down in task description
```bash
# Instead of:
uv run crew_agents build "Implement combat system"

# Do:
uv run crew_agents build "Implement CombatComponent with health, stamina, armor, dodge properties"
```

## See Also

- [CrewAI Documentation](https://docs.crewai.com/)
- [Otterfall Spec](.kiro/specs/otterfall-complete/)
- [ECS Patterns](knowledge/ecs_patterns/)
- [Kiro Documentation](https://kiro.ai/docs)

