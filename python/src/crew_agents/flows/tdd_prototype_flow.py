"""TDD Prototype Flow - Standard 4-phase TDD pattern for any prototype."""

from __future__ import annotations

import logging

from crewai.flow.flow import Flow, listen, router, start
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class TDDPrototypeState(BaseModel):
    """State for TDD Prototype workflow."""

    id: str = ""
    requirements: dict = {}
    design: dict = {}
    implementation: dict = {}
    validation: dict = {}
    documentation: dict = {}
    design_approved: bool = False
    validation_approved: bool = False


class TDDPrototypeFlow(Flow[TDDPrototypeState]):
    """Standard 4-phase TDD pattern for any prototype.

    Phases:
    1. Design Phase - Technical design with HITL approval
    2. Implementation Phase - Build based on approved design
    3. Validation Phase - QA testing with HITL approval
    4. Documentation Phase - Update ConPort and create handoff docs
    """

    initial_state = TDDPrototypeState
    name = "tdd_prototype_flow"

    @start()
    def design_phase(self):
        """Design the vertical slice with technical specifications."""
        try:
            from crew_agents.crew import CrewAgents

            crew = CrewAgents()
            result = crew.kickoff(
                inputs={"task": "design_phase", "requirements": self.state.requirements}
            )
        except ImportError:
            # Fallback for testing/development
            logger.warning("CrewAgents not available, using mock result")
            mock_attrs = {"raw": {"design": "Mock design output", "approved": True}}
            result = type("MockCrewResult", (object,), mock_attrs)()

        self.state.design = result.raw if hasattr(result, "raw") else result
        return result

    @listen(design_phase)
    def human_approval_design(self, design_result):
        """HITL gate - approve design before implementation."""
        # In production, this would integrate with HITLReviewControls.tsx
        logger.info("=== Design Review Required ===")
        logger.info("Review the design and approve to continue")

        # For now, auto-approve; in production this waits for human input
        self.state.design_approved = True

        if self.state.design_approved:
            return "implement"
        return "revise_design"

    @router(human_approval_design)
    def route_after_design_approval(self, approval_result):
        """Route based on design approval."""
        return approval_result

    @listen("implement")
    def implementation_phase(self):
        """Implement based on approved design."""
        from crew_agents.crew import CrewAgents

        crew = CrewAgents()
        result = crew.kickoff(inputs={"task": "implementation_phase", "design": self.state.design})

        self.state.implementation = result.raw if hasattr(result, "raw") else result
        return result

    @listen(implementation_phase)
    def validation_phase(self, impl_result):
        """QA validates implementation."""
        from crew_agents.crew import CrewAgents

        crew = CrewAgents()
        result = crew.kickoff(inputs={"task": "validation_phase", "implementation": impl_result})

        self.state.validation = result.raw if hasattr(result, "raw") else result
        return result

    @listen(validation_phase)
    def human_approval_validation(self, validation_result):
        """HITL gate - approve before merge."""
        logger.info("=== Validation Review Required ===")
        logger.info("Review validation results and approve to continue")

        # For now, auto-approve; in production this waits for human input
        self.state.validation_approved = True

        if self.state.validation_approved:
            return "document"
        return "fix_issues"

    @router(human_approval_validation)
    def route_after_validation(self, approval_result):
        """Route based on validation approval."""
        return approval_result

    @listen("document")
    def documentation_phase(self):
        """Update ConPort and create handoff docs."""
        from crew_agents.crew import CrewAgents

        crew = CrewAgents()
        result = crew.kickoff(
            inputs={
                "task": "documentation_phase",
                "design": self.state.design,
                "implementation": self.state.implementation,
                "validation": self.state.validation,
            }
        )

        self.state.documentation = result.raw if hasattr(result, "raw") else result
        return result

    @listen("revise_design")
    def revise_design_phase(self):
        """Revise design based on feedback."""
        logger.info("Revising design based on feedback...")
        # Re-run design phase with feedback
        return self.design_phase()

    @listen("fix_issues")
    def fix_implementation_issues(self):
        """Fix issues found during validation."""
        logger.info("Fixing implementation issues...")
        # Re-run implementation with fixes
        return self.implementation_phase()
