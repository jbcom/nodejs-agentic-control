"""CrewAI Flows for Otterfall game development.

Flows orchestrate multiple crews in sequences with evaluation
and retry loops for quality control.
"""

from __future__ import annotations

from crew_agents.flows.asset_generation_flow import AssetGenerationFlow
from crew_agents.flows.game_design_flow import GameDesignFlow
from crew_agents.flows.implementation_flow import ImplementationFlow

__all__ = [
    "AssetGenerationFlow",
    "GameDesignFlow",
    "ImplementationFlow",
]
