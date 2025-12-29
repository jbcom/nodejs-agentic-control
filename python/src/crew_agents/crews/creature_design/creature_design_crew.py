"""Creature Design Crew - Designs all species in the game.

This crew defines:
- Species characteristics and stats
- AI behavior patterns
- Combat abilities
- Visual appearance guidelines
- Sound design direction
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
class CreatureDesignCrew:
    """Creature Design Crew.

    Creates comprehensive species designs including stats,
    behaviors, and visual guidelines.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with file tools (read-only for design context)."""
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def creature_designer(self) -> Agent:
        """Overall creature concept and stats."""
        return Agent(
            config=self.agents_config["creature_designer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def behavior_specialist(self) -> Agent:
        """AI behavior and state machines."""
        return Agent(
            config=self.agents_config["behavior_specialist"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def stats_balancer(self) -> Agent:
        """Numerical balance and progression."""
        return Agent(
            config=self.agents_config["stats_balancer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @task
    def design_species_roster(self) -> Task:
        """Define all species in the game."""
        return Task(
            config=self.tasks_config["design_species_roster"],
        )

    @task
    def define_behaviors(self) -> Task:
        """Define AI behavior patterns."""
        return Task(
            config=self.tasks_config["define_behaviors"],
        )

    @task
    def balance_stats(self) -> Task:
        """Balance combat and survival stats."""
        return Task(
            config=self.tasks_config["balance_stats"],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the Creature Design Crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
