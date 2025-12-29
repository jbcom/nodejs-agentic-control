"""Game Builder Crew - Builds actual game code.

This crew generates TypeScript/TSX code following patterns from the knowledge base.
Based on the CrewAI game-builder-crew example pattern.
"""

from __future__ import annotations

import logging
from pathlib import Path

from crewai import Agent, Crew, Process, Task
from crewai.knowledge.source.text_file_knowledge_source import TextFileKnowledgeSource
from crewai.project import CrewBase, agent, crew, task

from crew_agents.config.llm import get_llm
from crew_agents.tools.file_tools import (
    DirectoryListTool,
    GameCodeReaderTool,
    GameCodeWriterTool,
)

logger = logging.getLogger(__name__)


def get_knowledge_path() -> Path:
    """Get the knowledge directory path."""
    return Path(__file__).parent.parent.parent.parent.parent / "knowledge"


def load_knowledge_sources() -> list:
    """Load knowledge sources from the knowledge directory.

    NOTE: CrewAI's TextFileKnowledgeSource expects RELATIVE paths from
    a 'knowledge/' directory in the project root. We use relative paths
    like "ecs_patterns/components.md" not absolute paths.
    """
    knowledge_path = get_knowledge_path()
    sources = []

    # Knowledge subdirectories (relative names)
    knowledge_subdirs = [
        "ecs_patterns",
        "rendering_patterns",
        "game_components",
        "otterfall_patterns",
    ]

    # Collect all files with supported extensions
    for subdir in knowledge_subdirs:
        abs_dir = knowledge_path / subdir
        if abs_dir.exists():
            # Load .md and .ts files (TypeScript patterns are knowledge too)
            for ext in ["*.md", "*.ts"]:
                for file_path in abs_dir.glob(ext):
                    # Use RELATIVE path from knowledge/ directory
                    relative_path = f"{subdir}/{file_path.name}"
                    try:
                        sources.append(TextFileKnowledgeSource(file_paths=[relative_path]))
                    except (OSError, ValueError) as e:
                        # Log which files fail to load for debugging
                        logger.warning("Could not load knowledge source %s: %s", relative_path, e)

    return sources


@CrewBase
class GameBuilderCrew:
    """Game Builder Crew.

    Creates ECS components, systems, and R3F rendering code
    following patterns from the working codebase.
    """

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self):
        """Initialize crew with tools."""
        self.code_writer = GameCodeWriterTool()
        self.code_reader = GameCodeReaderTool()
        self.dir_lister = DirectoryListTool()

    @agent
    def senior_typescript_engineer(self) -> Agent:
        """Senior engineer who writes the actual code."""
        return Agent(
            config=self.agents_config["senior_typescript_engineer"],
            llm=get_llm(),
            tools=[self.code_writer, self.code_reader, self.dir_lister],
            allow_code_execution=True,  # Can write and test code
            allow_delegation=False,
            verbose=True,
        )

    @agent
    def qa_engineer(self) -> Agent:
        """QA engineer who reviews code for errors."""
        return Agent(
            config=self.agents_config["qa_engineer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            allow_delegation=False,
            verbose=True,
        )

    @agent
    def chief_engineer(self) -> Agent:
        """Chief engineer who ensures code meets requirements."""
        return Agent(
            config=self.agents_config["chief_engineer"],
            llm=get_llm(),
            tools=[self.code_reader, self.dir_lister],
            allow_delegation=True,  # Can delegate to specialists
            verbose=True,
        )

    @task
    def write_code_task(self) -> Task:
        """Write the requested code component."""
        return Task(
            config=self.tasks_config["write_code_task"],
            agent=self.senior_typescript_engineer(),
        )

    @task
    def review_code_task(self) -> Task:
        """Review code for errors and issues."""
        return Task(
            config=self.tasks_config["review_code_task"],
            agent=self.qa_engineer(),
        )

    @task
    def evaluate_code_task(self) -> Task:
        """Evaluate code completeness and correctness."""
        return Task(
            config=self.tasks_config["evaluate_code_task"],
            agent=self.chief_engineer(),
        )

    @crew
    def crew(self) -> Crew:
        """Creates the Game Builder Crew with planning and memory."""
        knowledge_sources = load_knowledge_sources()

        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            planning=True,  # Enable step-by-step planning
            memory=True,  # Enable memory for learning
            knowledge_sources=knowledge_sources if knowledge_sources else None,
            verbose=True,
        )


def build_component(component_spec: str) -> str:
    """Build a game component based on a specification.

    Args:
        component_spec: Description of what component to build

    Returns:
        The generated code or status message
    """
    crew = GameBuilderCrew()
    result = crew.crew().kickoff(
        inputs={
            "component_spec": component_spec,
            "target_directory": "src/ecs",
        }
    )
    return result.raw if hasattr(result, "raw") else str(result)


def build_entity_factory(entity_spec: str) -> str:
    """Build an entity factory function.

    Args:
        entity_spec: Description of the entity to create

    Returns:
        The generated code or status message
    """
    crew = GameBuilderCrew()
    result = crew.crew().kickoff(
        inputs={
            "component_spec": entity_spec,
            "target_directory": "src/ecs",
        }
    )
    return result.raw if hasattr(result, "raw") else str(result)
