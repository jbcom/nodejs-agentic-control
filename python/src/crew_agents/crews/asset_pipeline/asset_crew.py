"""Asset Pipeline Crew - Generates and manages 3D assets.

This crew handles:
- Meshy API prompt engineering
- Asset specification documents
- Quality review criteria
- Integration with ECS
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
class AssetPipelineCrew:
    """Asset Pipeline Crew.

    Manages the generation of 3D assets through Meshy API
    with quality control and ECS integration.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with file tools (read-only for asset context)."""
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def asset_director(self) -> Agent:
        """Overall asset strategy."""
        return Agent(
            config=self.agents_config["asset_director"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def prompt_engineer(self) -> Agent:
        """Meshy prompt optimization."""
        return Agent(
            config=self.agents_config["prompt_engineer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def asset_qa(self) -> Agent:
        """Quality assessment."""
        return Agent(
            config=self.agents_config["asset_qa"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @task
    def create_asset_spec(self) -> Task:
        """Create asset specifications."""
        return Task(
            config=self.tasks_config["create_asset_spec"],
        )

    @task
    def generate_prompts(self) -> Task:
        """Generate Meshy prompts."""
        return Task(
            config=self.tasks_config["generate_prompts"],
        )

    @task
    def define_qa_criteria(self) -> Task:
        """Define quality criteria."""
        return Task(
            config=self.tasks_config["define_qa_criteria"],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the Asset Pipeline Crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
