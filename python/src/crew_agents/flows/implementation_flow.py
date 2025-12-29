"""Implementation Flow - Orchestrates code implementation.

Flow sequence:
1. ECS Components → Code Review
2. ECS Systems → Code Review
3. Rendering → Code Review
4. Integration Testing

Based on the write_a_book_with_flows pattern from CrewAI examples.
"""

from __future__ import annotations

from crewai.flow.flow import Flow, listen, router, start
from pydantic import BaseModel

from crew_agents.crews.ecs_implementation.ecs_crew import ECSImplementationCrew
from crew_agents.crews.qa_validation.qa_crew import QAValidationCrew
from crew_agents.crews.rendering.rendering_crew import RenderingCrew


class ImplementationState(BaseModel):
    """State maintained throughout implementation."""

    # Required by CrewAI Flow
    id: str = ""

    # Design inputs
    world_design: str = ""
    creature_design: str = ""
    gameplay_design: str = ""

    # Generated code
    ecs_components: str = ""
    ecs_systems: str = ""
    rendering_code: str = ""

    # Review results
    component_review: str = ""
    systems_review: str = ""
    rendering_review: str = ""

    # Approval status
    components_approved: bool = False
    systems_approved: bool = False
    rendering_approved: bool = False

    # Retry tracking
    retry_counts: dict = {}
    max_retries: int = 2


class ImplementationFlow(Flow[ImplementationState]):
    """Orchestrates code implementation from design docs.

    Takes design outputs and implements them as code,
    with code review gates at each stage.
    """

    initial_state = ImplementationState

    @start()
    def implement_ecs_components(self):
        """Start by implementing ECS components."""
        print("🏗️ Implementing ECS Components...")

        crew = ECSImplementationCrew()
        result = crew.crew().kickoff(
            inputs={
                "creature_design": self.state.creature_design,
                "gameplay_design": self.state.gameplay_design,
            }
        )

        self.state.ecs_components = result.raw
        return result.raw

    @listen(implement_ecs_components)
    def review_components(self, code: str):
        """Review ECS component code."""
        print("🔍 Reviewing ECS Components...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(inputs={"code": code, "code_type": "ecs_components"})

        self.state.component_review = result.raw
        return result.raw

    @router(review_components)
    def check_component_approval(self):
        """Route based on component review."""
        if "APPROVED" in self.state.component_review.upper():
            self.state.components_approved = True
            return "implement_systems"
        elif self.state.retry_counts.get("components", 0) < self.state.max_retries:
            self.state.retry_counts["components"] = self.state.retry_counts.get("components", 0) + 1
            return "retry_components"
        else:
            print("⚠️ Components not fully approved, proceeding...")
            return "implement_systems"

    @listen("retry_components")
    def retry_components(self):
        """Retry component implementation."""
        print("🔄 Retrying ECS Components...")

        crew = ECSImplementationCrew()
        result = crew.crew().kickoff(
            inputs={
                "creature_design": self.state.creature_design,
                "gameplay_design": self.state.gameplay_design,
                "feedback": self.state.component_review,
            }
        )

        self.state.ecs_components = result.raw
        return result.raw

    @listen(retry_components)
    def review_components_retry(self, code: str):
        """Review retried components."""
        return self.review_components(code)

    @listen("implement_systems")
    def implement_ecs_systems(self):
        """Implement ECS systems."""
        print("⚙️ Implementing ECS Systems...")

        crew = ECSImplementationCrew()
        result = crew.crew().kickoff(
            inputs={
                "components": self.state.ecs_components,
                "gameplay_design": self.state.gameplay_design,
                "task_focus": "systems",
            }
        )

        self.state.ecs_systems = result.raw
        return result.raw

    @listen(implement_ecs_systems)
    def review_systems(self, code: str):
        """Review ECS systems code."""
        print("🔍 Reviewing ECS Systems...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(inputs={"code": code, "code_type": "ecs_systems"})

        self.state.systems_review = result.raw
        return result.raw

    @router(review_systems)
    def check_systems_approval(self):
        """Route based on systems review."""
        if "APPROVED" in self.state.systems_review.upper():
            self.state.systems_approved = True
            return "implement_rendering"
        elif self.state.retry_counts.get("systems", 0) < self.state.max_retries:
            self.state.retry_counts["systems"] = self.state.retry_counts.get("systems", 0) + 1
            return "retry_systems"
        else:
            print("⚠️ Systems not fully approved, proceeding...")
            return "implement_rendering"

    @listen("retry_systems")
    def retry_systems(self):
        """Retry systems implementation."""
        print("🔄 Retrying ECS Systems...")

        crew = ECSImplementationCrew()
        result = crew.crew().kickoff(
            inputs={
                "components": self.state.ecs_components,
                "gameplay_design": self.state.gameplay_design,
                "task_focus": "systems",
                "feedback": self.state.systems_review,
            }
        )

        self.state.ecs_systems = result.raw
        return result.raw

    @listen(retry_systems)
    def review_systems_retry(self, code: str):
        """Review retried systems."""
        return self.review_systems(code)

    @listen("implement_rendering")
    def implement_rendering(self):
        """Implement rendering code."""
        print("🎨 Implementing Rendering...")

        crew = RenderingCrew()
        result = crew.crew().kickoff(
            inputs={
                "world_design": self.state.world_design,
                "ecs_components": self.state.ecs_components,
            }
        )

        self.state.rendering_code = result.raw
        return result.raw

    @listen(implement_rendering)
    def review_rendering(self, code: str):
        """Review rendering code."""
        print("🔍 Reviewing Rendering...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(inputs={"code": code, "code_type": "rendering"})

        self.state.rendering_review = result.raw
        self.state.rendering_approved = "APPROVED" in result.raw.upper()

        print("✅ Implementation Phase Complete!")
        print(f"   Components: {'✅' if self.state.components_approved else '⚠️'}")
        print(f"   Systems: {'✅' if self.state.systems_approved else '⚠️'}")
        print(f"   Rendering: {'✅' if self.state.rendering_approved else '⚠️'}")

        return self.state


async def run_implementation(design_state: dict):
    """Run implementation flow with design inputs."""
    flow = ImplementationFlow()
    flow.state.world_design = design_state.get("world_design", "")
    flow.state.creature_design = design_state.get("creature_design", "")
    flow.state.gameplay_design = design_state.get("gameplay_design", "")

    result = await flow.kickoff_async()
    return result
