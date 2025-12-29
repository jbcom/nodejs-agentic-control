"""Prototype to Production Flow - Assess readiness → Identify gaps → Plan next slice."""

from __future__ import annotations

from typing import Any

from crewai.flow.flow import Flow, listen, router, start
from pydantic import BaseModel


class PrototypeAssessmentState(BaseModel):
    """State for Prototype Assessment workflow."""

    id: str = ""
    prototypes: list[str] = []
    assessment: dict[str, Any] = {}
    production_ready: bool = False
    needs_refactoring: bool = False


class PrototypeToProductionFlow(Flow[PrototypeAssessmentState]):
    """Evaluate prototype and plan next steps.

    Routes:
    - deploy: If production ready
    - refactor: If needs refactoring
    - next_slice: Plan next vertical slice
    """

    initial_state = PrototypeAssessmentState
    name = "prototype_to_production_flow"

    @start()
    def assess_deliverables(self):
        """Review what's been built."""
        from crew_agents.crew import CrewAgents

        crew = CrewAgents()
        result = crew.kickoff(
            inputs={"task": "assess_prototypes", "completed_prototypes": self.state.prototypes}
        )

        assessment = result.raw if hasattr(result, "raw") else result
        self.state.assessment = assessment

        # Parse assessment results
        self.state.production_ready = assessment.get("production_ready", False)
        self.state.needs_refactoring = assessment.get("needs_refactoring", False)

        return result

    @router(assess_deliverables)
    def check_production_readiness(self, assessment):
        """Decide next action based on assessment."""
        if self.state.production_ready:
            return "deploy"
        elif self.state.needs_refactoring:
            return "refactor"
        else:
            return "next_slice"

    @listen("next_slice")
    def plan_next_vertical_slice(self):
        """Choose and plan next feature."""
        from crew_agents.crew import CrewAgents

        crew = CrewAgents()
        result = crew.kickoff(
            inputs={"task": "plan_next_slice", "assessment": self.state.assessment}
        )

        print("\n=== Next Vertical Slice Planned ===")
        print(result)
        return result

    @listen("refactor")
    def plan_refactoring(self):
        """Create refactoring plan."""
        from crew_agents.crew import CrewAgents

        crew = CrewAgents()
        result = crew.kickoff(
            inputs={"task": "plan_refactoring", "assessment": self.state.assessment}
        )

        print("\n=== Refactoring Plan Created ===")
        print(result)
        return result

    @listen("deploy")
    def prepare_deployment(self):
        """Build production deployment."""
        from crew_agents.crew import CrewAgents

        crew = CrewAgents()
        result = crew.kickoff(
            inputs={"task": "prepare_deployment", "assessment": self.state.assessment}
        )

        print("\n=== Deployment Prepared ===")
        print(result)
        return result
