"""Rendering Crew - Builds visual systems.

This crew implements:
- React Three Fiber scenes
- GLSL shaders
- Post-processing effects
- Performance optimization for mobile
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
class RenderingCrew:
    """Rendering Crew.

    Creates beautiful, performant visuals that run at 60fps on mobile.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with file tools."""
        self.code_writer = GameCodeWriterTool()
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def shader_engineer(self) -> Agent:
        """GLSL shader development."""
        return Agent(
            config=self.agents_config["shader_engineer"],
            llm=get_llm(),
            tools=[self.code_writer, self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def r3f_specialist(self) -> Agent:
        """React Three Fiber implementation."""
        return Agent(
            config=self.agents_config["r3f_specialist"],
            llm=get_llm(),
            tools=[self.code_writer, self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def performance_engineer(self) -> Agent:
        """Mobile optimization."""
        return Agent(
            config=self.agents_config["performance_engineer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @task
    def create_water_shader(self) -> Task:
        """Create water/marsh shader."""
        return Task(
            config=self.tasks_config["create_water_shader"],
        )

    @task
    def build_terrain_system(self) -> Task:
        """Build procedural terrain."""
        return Task(
            config=self.tasks_config["build_terrain_system"],
        )

    @task
    def optimize_rendering(self) -> Task:
        """Optimize for 60fps mobile."""
        return Task(
            config=self.tasks_config["optimize_rendering"],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the Rendering Crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
