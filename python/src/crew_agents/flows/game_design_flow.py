"""Game Design Flow - Orchestrates the design phase.

Flow sequence:
1. World Design → QA Review → (retry if needed)
2. Creature Design → QA Review → (retry if needed)
3. Gameplay Design → QA Review → (retry if needed)
4. Final Integration Validation

Based on the self_evaluation_loop_flow pattern from CrewAI examples.
"""

from __future__ import annotations

from crewai.flow.flow import Flow, listen, router, start
from pydantic import BaseModel

from crew_agents.crews.creature_design.creature_design_crew import CreatureDesignCrew
from crew_agents.crews.gameplay_design.gameplay_design_crew import GameplayDesignCrew
from crew_agents.crews.qa_validation.qa_crew import QAValidationCrew
from crew_agents.crews.world_design.world_design_crew import WorldDesignCrew


class DesignState(BaseModel):
    """State maintained throughout the design flow."""

    # Design documents
    world_design: str = ""
    creature_design: str = ""
    gameplay_design: str = ""

    # Review feedback
    world_review: str = ""
    creature_review: str = ""
    gameplay_review: str = ""
    integration_review: str = ""

    # Approval status
    world_approved: bool = False
    creature_approved: bool = False
    gameplay_approved: bool = False
    integration_approved: bool = False

    # Retry tracking
    world_retry_count: int = 0
    creature_retry_count: int = 0
    gameplay_retry_count: int = 0
    max_retries: int = 2


class GameDesignFlow(Flow[DesignState]):
    """Orchestrates the complete game design phase.

    Runs design crews in sequence with QA validation gates.
    Implements retry logic for designs that don't pass review.
    """

    initial_state = DesignState

    @start()
    def design_world(self):
        """Start with world design."""
        print("🌍 Starting World Design...")

        crew = WorldDesignCrew()
        result = crew.crew().kickoff()

        self.state.world_design = result.raw
        return result.raw

    @listen(design_world)
    def review_world(self, world_design: str):
        """Review world design."""
        print("📋 Reviewing World Design...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(
            inputs={"document": world_design, "doc_type": "world_design"}
        )

        self.state.world_review = result.raw
        return result.raw

    @router(review_world)
    def check_world_approval(self):
        """Route based on world design review."""
        # Simple approval check - in production, parse the review
        if "APPROVED" in self.state.world_review.upper():
            self.state.world_approved = True
            return "design_creatures"
        elif self.state.world_retry_count < self.state.max_retries:
            self.state.world_retry_count += 1
            return "retry_world"
        else:
            # Max retries reached, proceed anyway with warning
            print("⚠️ World design not fully approved, proceeding...")
            return "design_creatures"

    @listen("retry_world")
    def retry_world_design(self):
        """Retry world design with feedback."""
        print(f"🔄 Retrying World Design (attempt {self.state.world_retry_count})...")

        crew = WorldDesignCrew()
        result = crew.crew().kickoff(inputs={"feedback": self.state.world_review})

        self.state.world_design = result.raw
        return result.raw

    @listen(retry_world_design)
    def review_world_retry(self, design: str):
        """Review retried world design."""
        return self.review_world(design)

    @listen("design_creatures")
    def design_creatures(self):
        """Design creatures based on world."""
        print("🦎 Starting Creature Design...")

        crew = CreatureDesignCrew()
        result = crew.crew().kickoff(inputs={"world_design": self.state.world_design})

        self.state.creature_design = result.raw
        return result.raw

    @listen(design_creatures)
    def review_creatures(self, creature_design: str):
        """Review creature design."""
        print("📋 Reviewing Creature Design...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(
            inputs={"document": creature_design, "doc_type": "creature_design"}
        )

        self.state.creature_review = result.raw
        return result.raw

    @router(review_creatures)
    def check_creature_approval(self):
        """Route based on creature design review."""
        if "APPROVED" in self.state.creature_review.upper():
            self.state.creature_approved = True
            return "design_gameplay"
        elif self.state.creature_retry_count < self.state.max_retries:
            self.state.creature_retry_count += 1
            return "retry_creatures"
        else:
            print("⚠️ Creature design not fully approved, proceeding...")
            return "design_gameplay"

    @listen("retry_creatures")
    def retry_creature_design(self):
        """Retry creature design with feedback."""
        print(f"🔄 Retrying Creature Design (attempt {self.state.creature_retry_count})...")

        crew = CreatureDesignCrew()
        result = crew.crew().kickoff(
            inputs={"world_design": self.state.world_design, "feedback": self.state.creature_review}
        )

        self.state.creature_design = result.raw
        return result.raw

    @listen(retry_creature_design)
    def review_creatures_retry(self, design: str):
        """Review retried creature design."""
        return self.review_creatures(design)

    @listen("design_gameplay")
    def design_gameplay(self):
        """Design gameplay systems."""
        print("🎮 Starting Gameplay Design...")

        crew = GameplayDesignCrew()
        result = crew.crew().kickoff(
            inputs={
                "world_design": self.state.world_design,
                "creature_design": self.state.creature_design,
            }
        )

        self.state.gameplay_design = result.raw
        return result.raw

    @listen(design_gameplay)
    def review_gameplay(self, gameplay_design: str):
        """Review gameplay design."""
        print("📋 Reviewing Gameplay Design...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(
            inputs={"document": gameplay_design, "doc_type": "gameplay_design"}
        )

        self.state.gameplay_review = result.raw
        return result.raw

    @router(review_gameplay)
    def check_gameplay_approval(self):
        """Route based on gameplay design review."""
        if "APPROVED" in self.state.gameplay_review.upper():
            self.state.gameplay_approved = True
            return "validate_integration"
        elif self.state.gameplay_retry_count < self.state.max_retries:
            self.state.gameplay_retry_count += 1
            return "retry_gameplay"
        else:
            print("⚠️ Gameplay design not fully approved, proceeding...")
            return "validate_integration"

    @listen("retry_gameplay")
    def retry_gameplay_design(self):
        """Retry gameplay design with feedback."""
        print(f"🔄 Retrying Gameplay Design (attempt {self.state.gameplay_retry_count})...")

        crew = GameplayDesignCrew()
        result = crew.crew().kickoff(
            inputs={
                "world_design": self.state.world_design,
                "creature_design": self.state.creature_design,
                "feedback": self.state.gameplay_review,
            }
        )

        self.state.gameplay_design = result.raw
        return result.raw

    @listen(retry_gameplay_design)
    def review_gameplay_retry(self, design: str):
        """Review retried gameplay design."""
        return self.review_gameplay(design)

    @listen("validate_integration")
    def validate_integration(self):
        """Final integration validation."""
        print("🔗 Validating Design Integration...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(
            inputs={
                "world_design": self.state.world_design,
                "creature_design": self.state.creature_design,
                "gameplay_design": self.state.gameplay_design,
                "task_type": "integration",
            }
        )

        self.state.integration_review = result.raw
        self.state.integration_approved = "APPROVED" in result.raw.upper()

        print("✅ Design Phase Complete!")
        print(f"   World: {'✅' if self.state.world_approved else '⚠️'}")
        print(f"   Creatures: {'✅' if self.state.creature_approved else '⚠️'}")
        print(f"   Gameplay: {'✅' if self.state.gameplay_approved else '⚠️'}")
        print(f"   Integration: {'✅' if self.state.integration_approved else '⚠️'}")

        return self.state


async def run_game_design():
    """Run the complete game design flow."""
    flow = GameDesignFlow()
    result = await flow.kickoff_async()
    return result
