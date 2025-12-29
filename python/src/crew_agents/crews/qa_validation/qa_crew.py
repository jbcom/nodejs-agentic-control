"""QA Validation Crew - Reviews all crew outputs.

This crew validates:
- Design document quality
- Code correctness
- Asset quality
- Integration readiness
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
class QAValidationCrew:
    """QA Validation Crew.

    Provides quality gates between crews to ensure outputs
    meet standards before passing to the next stage.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with file tools (read-only for QA)."""
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def design_reviewer(self) -> Agent:
        """Reviews design documents."""
        return Agent(
            config=self.agents_config["design_reviewer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def code_reviewer(self) -> Agent:
        """Reviews code outputs."""
        return Agent(
            config=self.agents_config["code_reviewer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @agent
    def integration_tester(self) -> Agent:
        """Tests integration points."""
        return Agent(
            config=self.agents_config["integration_tester"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            verbose=True,
        )

    @task
    def review_design(self) -> Task:
        """Review design document quality."""
        return Task(
            config=self.tasks_config["review_design"],
        )

    @task
    def review_code(self) -> Task:
        """Review code quality."""
        return Task(
            config=self.tasks_config["review_code"],
        )

    @task
    def validate_integration(self) -> Task:
        """Validate integration points."""
        return Task(
            config=self.tasks_config["validate_integration"],
        )

    @crew
    def crew(self) -> Crew:
        """Creates the QA Validation Crew."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
