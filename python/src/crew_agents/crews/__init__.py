"""CrewAI Crews for game development.

Each crew is a specialized team of agents that work together
on a specific domain of game development.
"""

from __future__ import annotations

from crew_agents.crews.asset_pipeline.asset_crew import AssetPipelineCrew
from crew_agents.crews.creature_design.creature_design_crew import CreatureDesignCrew
from crew_agents.crews.ecs_implementation.ecs_crew import ECSImplementationCrew
from crew_agents.crews.game_builder.game_builder_crew import GameBuilderCrew
from crew_agents.crews.gameplay_design.gameplay_design_crew import GameplayDesignCrew
from crew_agents.crews.qa_validation.qa_crew import QAValidationCrew
from crew_agents.crews.rendering.rendering_crew import RenderingCrew
from crew_agents.crews.world_design.world_design_crew import WorldDesignCrew

__all__ = [
    "AssetPipelineCrew",
    "CreatureDesignCrew",
    "ECSImplementationCrew",
    "GameBuilderCrew",
    "GameplayDesignCrew",
    "QAValidationCrew",
    "RenderingCrew",
    "WorldDesignCrew",
]
