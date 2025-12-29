"""ECS Implementation Crew - Builds the Entity Component System.

This crew implements:
- Miniplex component schemas
- System logic
- Type-safe data contracts
- ECS patterns from .ruler/ecs_patterns.md
"""

from __future__ import annotations

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

from crew_agents.config.llm import get_llm
from crew_agents.tools.file_tools import (
    DirectoryListTool,
    GameCodeReaderTool,
    GameCodeWriterTool,
)


@CrewBase
class ECSImplementationCrew:
    """ECS Implementation Crew.

    Implements the Entity Component System using Miniplex
    with strict TypeScript typing.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with file tools."""
        self.code_writer = GameCodeWriterTool()
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def ecs_architect(self) -> Agent:
        """Component schema design."""
        return Agent(
            config=self.agents_config["ecs_architect"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def typescript_engineer(self) -> Agent:
        """TypeScript implementation."""
        return Agent(
            config=self.agents_config["typescript_engineer"],
            llm=get_llm(),
            tools=[self.code_writer, self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def systems_engineer(self) -> Agent:
        """System logic implementation."""
        return Agent(
            config=self.agents_config["systems_engineer"],
            llm=get_llm(),
            tools=[self.code_writer, self.code_reader, self.dir_lister],
            verbose=True,
        )

    @task
    def design_components(self) -> Task:
        """Design component schemas."""
        return Task(
            config=self.tasks_config["design_components"],
        )

    @task
    def implement_components(self) -> Task:
        """Implement TypeScript components."""
        return Task(
            config=self.tasks_config["implement_components"],
        )

    @task
    def implement_systems(self) -> Task:
        """Implement ECS systems."""
        return Task(
            config=self.tasks_config["implement_systems"],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the ECS Implementation Crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
