

<!-- Source: .ruler/reusable_workflows.md -->

# Reusable Flow Patterns

This directory documents reusable **Flow patterns** for composing CrewAI crews into pipelines.

## What Are Flows?

Flows are Python classes that orchestrate multiple crews using decorators:
- `@start()` - Entry point
- `@listen(method)` - Runs after another method completes
- `@router(method)` - Conditional branching based on return value
- `and_()` / `or_()` - Complex trigger conditions

## Core Patterns

### 1. TDD Prototype Flow

**Pattern**: Design → Implement → Validate → Document (with HITL gates)

```python
from crewai.flow.flow import Flow, start, listen, router

class TDDPrototypeFlow(Flow):
    """Standard 4-phase TDD pattern for any prototype"""
    
    @start()
    def design_phase(self):
        """Design the vertical slice"""
        result = design_crew.kickoff(inputs=self.state.requirements)
        self.state.design = result
        return result
    
    @listen(design_phase)
    def human_approval_design(self, design_result):
        """HITL gate - approve design before implementation"""
        if not design_result.approved:
            return "revise_design"
        return "implement"
    
    @listen("implement")
    def implementation_phase(self):
        """Implement based on approved design"""
        result = implementation_crew.kickoff(inputs=self.state.design)
        self.state.implementation = result
        return result
    
    @listen(implementation_phase)
    def validation_phase(self, impl_result):
        """QA validates implementation"""
        result = qa_crew.kickoff(inputs=impl_result)
        self.state.validation = result
        return result
    
    @listen(validation_phase)
    def human_approval_validation(self, validation_result):
        """HITL gate - approve before merge"""
        if not validation_result.approved:
            return "fix_issues"
        return "document"
    
    @listen("document")
    def documentation_phase(self):
        """Update ConPort and create handoff docs"""
        result = doc_crew.kickoff(inputs={
            "design": self.state.design,
            "implementation": self.state.implementation,
            "validation": self.state.validation
        })
        return result
```

### 2. Meshy Asset Pipeline Flow

**Pattern**: Generate → Rig → Animate → Retexture → Review (with parallel variants)

```python
class MeshyAssetFlow(Flow):
    """Standard sequence for generating GLB assets"""
    
    @start()
    def generate_static_model(self):
        """Text-to-3D static model"""
        result = text3d_service.submit_task(
            species=self.state.species,
            prompt=self.state.prompt
        )
        self.state.static_task_id = result.task_id
        return result
    
    @listen(generate_static_model)
    def rig_model(self, static_result):
        """Add skeleton to model"""
        result = rigging_service.submit_task(
            model_id=static_result.model_id
        )
        self.state.rigged_task_id = result.task_id
        return result
    
    @listen(rig_model)
    def animate_variants(self, rigged_result):
        """Trigger parallel animation tasks"""
        walk = animation_service.submit_task(
            model_id=rigged_result.model_id,
            animation_id="1"  # Walk
        )
        attack = animation_service.submit_task(
            model_id=rigged_result.model_id,
            animation_id="4"  # Attack
        )
        self.state.animations = [walk, attack]
        return {"walk": walk, "attack": attack}
    
    @listen(animate_variants)
    def retexture_variant(self, anim_results):
        """Create color variant"""
        result = retexture_service.submit_task(
            model_id=self.state.static_task_id,
            prompt=self.state.retexture_prompt
        )
        return result
    
    @listen(retexture_variant)
    def hitl_review(self, retexture_result):
        """Present all variants for human review"""
        # Loads HITL review prototype with all 4 GLBs
        # Returns approval/rejection + ratings
        return review_prototype.present({
            "static": self.state.static_task_id,
            "walk": self.state.animations[0],
            "attack": self.state.animations[1],
            "variant": retexture_result
        })
```

### 3. Prototype to Production Flow

**Pattern**: Assess readiness → Identify gaps → Plan next slice

```python
class PrototypeAssessmentFlow(Flow):
    """Evaluate prototype and plan next steps"""
    
    @start()
    def assess_deliverables(self):
        """Review what's been built"""
        result = assessment_crew.kickoff(inputs={
            "completed_prototypes": self.state.prototypes
        })
        self.state.assessment = result
        return result
    
    @router(assess_deliverables)
    def check_production_readiness(self, assessment):
        """Decide next action based on assessment"""
        if assessment.production_ready:
            return "deploy"
        elif assessment.needs_refactoring:
            return "refactor"
        else:
            return "next_slice"
    
    @listen("next_slice")
    def plan_next_vertical_slice(self):
        """Choose and plan next feature"""
        result = planning_crew.kickoff(inputs=self.state.assessment)
        return result
    
    @listen("refactor")
    def plan_refactoring(self):
        """Create refactoring plan"""
        result = refactoring_crew.kickoff(inputs=self.state.assessment)
        return result
    
    @listen("deploy")
    def prepare_deployment(self):
        """Build production deployment"""
        result = deployment_crew.kickoff(inputs=self.state.assessment)
        return result
```

## Using Flows with `process-compose.yaml`

Each flow becomes a process:

```yaml
processes:
  biome_prototype_flow:
    command: "cd python/crew_agents && uv run python -m flows.biome_prototype"
    working_dir: "."
    
  meshy_asset_flow:
    command: "cd python/crew_agents && uv run python -m flows.meshy_asset"
    working_dir: "."
```

## Flow State Management

Flows have built-in state that persists across steps:

```python
class MyFlow(Flow):
    @start()
    def step1(self):
        self.state.user_input = "some data"
        self.state.validated = False
        
    @listen(step1)
    def step2(self):
        # Access state from previous step
        if self.state.validated:
            # ...
```

## Visualization

CrewAI can auto-generate flow diagrams:

```python
from crewai.flow.visualization import visualize_flow_structure

# In your flow file
if __name__ == "__main__":
    flow = MyFlow()
    visualize_flow_structure(flow)
```

## Migration from YAML Workflows

❌ **Old approach** (YAML anchors in `crewbase.yaml`):
```yaml
x-tdd-prototype-workflow: &tdd_prototype_workflow
  design_phase:
    agent: rendering_engineer
```

✅ **New approach** (Flow classes in `python/crew_agents/flows/`):
```python
class TDDPrototypeFlow(Flow):
    @start()
    def design_phase(self):
        return design_crew.kickoff()
```

## References

- CrewAI Flow docs: `crewAI/docs/en/concepts/flows.mdx`
- Flow examples: `crewAI/docs/en/guides/flows/first-flow.mdx`
- State management: `crewAI/docs/en/guides/flows/mastering-flow-state.mdx`
- Source code: `crewAI/lib/crewai/src/crewai/flow/`



<!-- Source: .ruler/workflow_configuration.md -->

# CrewAI Workflow Configuration

## Agent Hierarchy

**Technical Director** (Manager)
- Delegates to specialist agents
- Max 40 iterations, 5 reasoning attempts

**Specialists** (Workers)
- ECS Architect, Yuka AI Engineer, Rendering Engineer, etc.
- Max 25-30 iterations, 3 reasoning attempts
- No delegation

## MCP Tool Access

Agents have filtered access to MCP servers based on role:
- **All agents**: Git, Filesystem, Knowledge
- **Chief Architect**: Context7 (doc fetching)
- **Rendering Engineer**: Vite dev server
- **QA Tester**: Playwright, testing tools

## Deliverable Standards

Every CrewAI task output must include:
1. README.md with usage docs
2. Passing unit tests
3. TypeScript type exports (if applicable)
4. Integration notes for frontend
