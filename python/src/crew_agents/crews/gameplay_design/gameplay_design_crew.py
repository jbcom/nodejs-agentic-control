"""Gameplay Design Crew - Designs core mechanics and systems.

This crew defines:
- Core gameplay loop
- Combat system
- Progression systems
- Economy and resources
- Quest structures
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
class GameplayDesignCrew:
    """Gameplay Design Crew.

    Creates the core mechanics and systems that make the game fun.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with file tools (read-only for design context)."""
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def systems_designer(self) -> Agent:
        """Core game systems and loops."""
        return Agent(
            config=self.agents_config["systems_designer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def combat_designer(self) -> Agent:
        """Combat mechanics and feel."""
        return Agent(
            config=self.agents_config["combat_designer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def economy_designer(self) -> Agent:
        """Resources, progression, rewards."""
        return Agent(
            config=self.agents_config["economy_designer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @task
    def design_core_loop(self) -> Task:
        """Design the core gameplay loop."""
        return Task(
            config=self.tasks_config["design_core_loop"],
        )

    @task
    def design_combat(self) -> Task:
        """Design combat mechanics."""
        return Task(
            config=self.tasks_config["design_combat"],
        )

    @task
    def design_progression(self) -> Task:
        """Design progression and economy."""
        return Task(
            config=self.tasks_config["design_progression"],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the Gameplay Design Crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
