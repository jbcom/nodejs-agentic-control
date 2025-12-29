"""Asset Generation Flow - Orchestrates 3D asset creation.

Flow sequence:
1. Generate asset specifications from creature designs
2. Create Meshy prompts for each asset
3. Generate assets (calls Meshy API)
4. QA review generated assets
5. Human approval gate (HITL)
6. Integration with ECS entities

This flow includes Human-in-the-Loop gates for asset approval.
"""

from __future__ import annotations

from crewai.flow.flow import Flow, listen, router, start
from pydantic import BaseModel

from crew_agents.crews.asset_pipeline.asset_crew import AssetPipelineCrew
from crew_agents.crews.qa_validation.qa_crew import QAValidationCrew


class AssetSpec(BaseModel):
    """Specification for a single asset."""

    name: str
    species: str
    description: str
    polygon_budget: int = 5000
    texture_size: str = "1024x1024"
    prompt: str = ""
    status: str = "pending"  # pending, generating, review, approved, rejected


class AssetState(BaseModel):
    """State maintained throughout asset generation."""

    # Required by CrewAI Flow
    id: str = ""

    # Input designs
    creature_design: str = ""
    world_design: str = ""

    # Asset tracking
    asset_specs: list[dict] = []
    current_asset_index: int = 0

    # Review state
    qa_criteria: str = ""
    human_approval_required: list[str] = []

    # Results
    approved_assets: list[str] = []
    rejected_assets: list[str] = []


class AssetGenerationFlow(Flow[AssetState]):
    """Orchestrates 3D asset generation through Meshy.

    Includes automated QA and human-in-the-loop approval gates.
    """

    initial_state = AssetState

    @start()
    def create_asset_specs(self):
        """Create specifications for all needed assets."""
        print("📋 Creating Asset Specifications...")

        crew = AssetPipelineCrew()
        result = crew.crew().kickoff(
            inputs={
                "creature_design": self.state.creature_design,
                "world_design": self.state.world_design,
                "task_focus": "specifications",
            }
        )

        # Parse result into asset specs
        # In production, this would parse the structured output
        print("Created specifications for assets")
        return result.raw

    @listen(create_asset_specs)
    def define_qa_criteria(self, specs: str):
        """Define QA criteria for asset review."""
        print("✅ Defining QA Criteria...")

        crew = AssetPipelineCrew()
        result = crew.crew().kickoff(inputs={"asset_specs": specs, "task_focus": "qa_criteria"})

        self.state.qa_criteria = result.raw
        return result.raw

    @listen(define_qa_criteria)
    def generate_prompts(self, qa_criteria: str):
        """Generate Meshy prompts for each asset."""
        print("✍️ Generating Meshy Prompts...")

        crew = AssetPipelineCrew()
        result = crew.crew().kickoff(
            inputs={
                "creature_design": self.state.creature_design,
                "qa_criteria": qa_criteria,
                "task_focus": "prompts",
            }
        )

        return result.raw

    @listen(generate_prompts)
    def queue_for_generation(self, prompts: str):
        """Queue assets for Meshy generation."""
        print("📤 Queueing Assets for Generation...")

        # In production, this would:
        # 1. Parse prompts
        # 2. Call Meshy API for each asset
        # 3. Wait for results
        # 4. Store generated assets

        # For now, output the generation queue
        return {"status": "queued", "prompts": prompts, "next_step": "meshy_webhook"}

    @listen(queue_for_generation)
    def automated_qa_review(self, generation_result: dict):
        """Run automated QA on generated assets."""
        print("🔍 Running Automated QA...")

        qa_crew = QAValidationCrew()
        result = qa_crew.crew().kickoff(
            inputs={
                "assets": generation_result,
                "qa_criteria": self.state.qa_criteria,
                "task_type": "asset_qa",
            }
        )

        return result.raw

    @router(automated_qa_review)
    def route_after_qa(self):
        """Route based on QA results."""
        # In production, parse QA results
        # If critical issues, reject and regenerate
        # If minor issues, flag for human review
        # If good, proceed to human approval

        return "human_approval_gate"

    @listen("human_approval_gate")
    def create_hitl_issue(self):
        """Create GitHub issue for human approval."""
        print("👤 Creating HITL Review Request...")

        # This would create a GitHub issue using the HITL workflow
        # The actual asset approval happens asynchronously via webhook

        return {
            "status": "awaiting_human_approval",
            "review_type": "asset_quality",
            "assets_pending": self.state.human_approval_required,
        }

    @listen(create_hitl_issue)
    def finalize_assets(self, approval_result: dict):
        """Finalize approved assets for integration."""
        print("✅ Finalizing Approved Assets...")

        # This would be called after human approval (via webhook)
        # It prepares assets for ECS integration

        return {
            "approved_assets": self.state.approved_assets,
            "rejected_assets": self.state.rejected_assets,
            "integration_ready": len(self.state.approved_assets) > 0,
        }


async def run_asset_generation(design_state: dict, species: str = None):
    """Run asset generation flow.

    Args:
        design_state: Output from GameDesignFlow
        species: Optional specific species to generate (otherwise all)
    """
    flow = AssetGenerationFlow()
    flow.state.creature_design = design_state.get("creature_design", "")
    flow.state.world_design = design_state.get("world_design", "")

    result = await flow.kickoff_async()
    return result
