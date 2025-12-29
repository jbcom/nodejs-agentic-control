# CrewAI Quickstart for Otterfall

## Setup (One-time)

```bash
# 1. Set up environment variables
export ANTHROPIC_API_KEY="your-key-here"
# Optional: export OPENROUTER_API_KEY="your-key-here"  # Fallback

# 2. Navigate to crew_agents
cd packages/crew_agents

# 3. Link Otterfall specs to knowledge base
ln -s ../../../.kiro/specs/otterfall-complete knowledge/specs

# 4. Add Otterfall patterns to knowledge
mkdir -p knowledge/otterfall_patterns
cp ../../otterfall/src/ecs/components.ts knowledge/otterfall_patterns/
cp ../../otterfall/src/ecs/data/species.ts knowledge/otterfall_patterns/
```

## Using CrewAI for Task Implementation

### Example: Implement Section 6.1 (Species Data System)

```bash
cd packages/crew_agents

# Run the crew with a specific task
uv run crew_agents build "Implement Section 6.1: Species Data System

Requirements:
- Read .kiro/specs/otterfall-complete/requirements.md Requirements 1-2
- Read .kiro/specs/otterfall-complete/design.md Properties 19-20
- Read .kiro/specs/otterfall-complete/tasks.md Section 6.1

Tasks:
1. Verify all 13 predator species are defined in packages/otterfall/src/ecs/data/species.ts
2. Verify all 15 prey species are defined
3. Create SpeciesComponent in packages/otterfall/src/ecs/components.ts if not exists
4. Implement species assignment on entity creation
5. Add species-specific model loading logic

Validation:
- TypeScript compiles with zero errors
- All species have required properties (health, stamina, attacks, etc.)
- Species data matches requirements exactly"
```

### What Happens

1. **Project Manager** loads context:
   - Reads requirements 1-2
   - Reads design properties 19-20
   - Reads task 6.1
   - Validates prerequisites

2. **Senior Engineer** implements:
   - Checks existing species.ts
   - Adds missing species if any
   - Creates/updates SpeciesComponent
   - Implements species assignment logic
   - Adds model loading

3. **QA Engineer** reviews:
   - Runs TypeScript compiler
   - Checks for errors
   - Validates against patterns
   - Runs unit tests

4. **Chief Engineer** approves:
   - Verifies completeness
   - Ensures quality
   - Approves for merge

## Task Decomposition Examples

### ❌ Too Vague
```bash
uv run crew_agents build "Make combat work"
```

### ✅ Good - Specific with Context
```bash
uv run crew_agents build "Implement CombatComponent (Requirement 3.1)

Create CombatComponent in packages/otterfall/src/ecs/components.ts with:
- health: number
- maxHealth: number
- stamina: number
- maxStamina: number
- armor: number (percentage 0-100)
- dodge: number (percentage 0-100)
- archetype: 'tank' | 'agile' | 'balanced'
- attacks: AttackType[]
- staminaRegenRate: number
- lastDamageTime: number
- isStunned: boolean
- stunEndTime: number

Apply archetype-specific stats:
- Tank: 150 HP, 80 stamina, 30% armor, 10% dodge, 8/sec regen
- Agile: 80 HP, 120 stamina, 5% armor, 35% dodge, 15/sec regen
- Balanced: 100 HP, 100 stamina, 15% armor, 20% dodge, 10/sec regen"
```

### ✅ Best - With Requirements and Validation
```bash
uv run crew_agents build "Implement Attack System (Requirements 3.2-3.7, 5.1-5.8)

Context:
- Read .kiro/specs/otterfall-complete/requirements.md Requirements 3, 5
- Read .kiro/specs/otterfall-complete/design.md Combat System Design
- Read packages/otterfall/src/ecs/data/species.ts for attack types

Implementation:
1. Create AttackType enum: bite, claw, tail_whip, headbutt, pounce, roll_crush
2. Create attack data with damage, range, stamina cost, cooldown
3. Implement attack execution function:
   - Check stamina >= cost
   - Check cooldown == 0
   - Check target in range
   - Apply damage with armor reduction
   - Apply knockback force
   - Apply stun duration
   - Set cooldown timestamp
4. Implement damage calculation:
   - finalDamage = baseDamage * (1 ± 0.1) * (1 - armorPercent)
5. Add to packages/otterfall/src/ecs/systems/CombatSystem.ts

Validation:
- TypeScript compiles
- All attack types have correct properties
- Damage calculation matches design
- Cooldowns prevent spam
- Unit tests pass"
```

## Training the Crew

After implementing a few tasks, train the agents:

```bash
cd packages/crew_agents

# Train with 5 iterations
uv run crew_agents train 5

# During training, provide feedback:
# - "Good: Followed ECS patterns correctly"
# - "Bad: Didn't check TypeScript compilation"
# - "Improve: Add more edge case handling"
```

## Checking Progress

```bash
# List what's in the knowledge base
uv run crew_agents list-knowledge

# Test that tools work
uv run crew_agents test-tools
```

## Integration with Kiro Workflow

### Recommended Workflow

1. **Use Kiro** to create/update specs:
   ```bash
   # In Kiro chat
   "Update the design document to add Property 56: Combat feedback timing"
   ```

2. **Use CrewAI** to implement complex tasks:
   ```bash
   cd packages/crew_agents
   uv run crew_agents build "Implement Section 6.2: Combat System"
   ```

3. **Use Kiro** for quick fixes:
   ```bash
   # In Kiro chat
   "Fix the TypeScript error in CombatSystem.ts line 42"
   ```

4. **Use CrewAI** for features requiring decomposition:
   ```bash
   uv run crew_agents build "Implement Section 8: Terrain and World Generation"
   ```

### When to Use Which

| Task Type | Use | Why |
|-----------|-----|-----|
| Create specs | Kiro | Excellent at requirements, design, tasks |
| Simple fixes | Kiro | Fast, direct, no overhead |
| Complex features | CrewAI | Proper decomposition, QA review |
| Refactoring | CrewAI | Multiple agents review changes |
| Testing | Both | Kiro for unit tests, CrewAI for comprehensive |
| Documentation | Kiro | Fast, integrated with codebase |

## Troubleshooting

### Issue: "No such file or directory"

**Solution**: Make sure you're in the right directory
```bash
cd packages/crew_agents
pwd  # Should show: .../jbcom-oss-ecosystem/packages/crew_agents
```

### Issue: "ANTHROPIC_API_KEY not set"

**Solution**: Set the environment variable
```bash
export ANTHROPIC_API_KEY="your-key-here"
# Or add to ~/.zshrc or ~/.bashrc

# Optional: Use OpenRouter as fallback
export OPENROUTER_API_KEY="your-key-here"
```

### Issue: Agents don't understand Otterfall patterns

**Solution**: Add more examples to knowledge base
```bash
cd packages/crew_agents/knowledge/otterfall_patterns

# Copy working examples
cp ../../../otterfall/src/ecs/systems/TimeSystem.ts .
cp ../../../otterfall/src/ecs/systems/WeatherSystem.ts .

# Document the patterns
cat > README.md << 'EOF'
# Otterfall ECS Patterns

## System Pattern
Systems are functions that operate on entities with specific components.

Example: TimeSystem.ts
- Updates time of day
- Calculates sun position
- Updates lighting

## Component Pattern
Components are pure data, no logic.

Example: TimeOfDayComponent
- hour: number (0-24)
- phase: 'dawn' | 'day' | 'dusk' | 'night'
- sunIntensity: number
EOF
```

### Issue: Code doesn't match conventions

**Solution**: Train agents with feedback
```bash
uv run crew_agents train 5

# When prompted, provide specific feedback:
# "The code should use Miniplex ECS patterns, not plain objects"
# "Follow the pattern in TimeSystem.ts for system structure"
```

## Next Steps

1. **Add Otterfall patterns** to knowledge base
2. **Train agents** on existing code
3. **Implement Section 6** using CrewAI
4. **Iterate and improve** based on results

## See Also

- [INTEGRATION.md](./INTEGRATION.md) - Full integration guide
- [README.md](./README.md) - CrewAI system overview
- [Otterfall Spec](../../.kiro/specs/otterfall-complete/) - Requirements and design

