"""World Design Crew - Creates the world, biomes, and ecosystems.

This crew defines WHAT the game world contains:
- Biome types and characteristics
- Environmental rules and hazards
- Resource distribution
- Visual themes and atmosphere
"""

from __future__ import annotations

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

from crew_agents.config.llm import get_llm
from crew_agents.tools.file_tools import (
    DirectoryListTool,
    GameCodeReaderTool,
)


@CrewBase
class WorldDesignCrew:
    """World Design Crew.

    Creates comprehensive world design documents that define
    the game's biomes, environments, and ecological systems.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with file tools (read-only for design context)."""
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def world_architect(self) -> Agent:
        """High-level world structure and rules."""
        return Agent(
            config=self.agents_config["world_architect"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def biome_designer(self) -> Agent:
        """Individual biome design and characteristics."""
        return Agent(
            config=self.agents_config["biome_designer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def ecosystem_specialist(self) -> Agent:
        """Ecological relationships and resource cycles."""
        return Agent(
            config=self.agents_config["ecosystem_specialist"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @task
    def define_world_structure(self) -> Task:
        """Define overall world layout and rules."""
        return Task(
            config=self.tasks_config["define_world_structure"],
        )

    @task
    def design_biomes(self) -> Task:
        """Design each of the 7 biomes."""
        return Task(
            config=self.tasks_config["design_biomes"],
        )

    @task
    def create_ecosystem_rules(self) -> Task:
        """Define ecological relationships."""
        return Task(
            config=self.tasks_config["create_ecosystem_rules"],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the World Design Crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
