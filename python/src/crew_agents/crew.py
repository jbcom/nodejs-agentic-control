#!/usr/bin/env python
"""CrewAI Entry Point

This file is the standard CrewAI entry point that `crewai run` expects.
It loads configuration from crewbase.yaml and executes the crew.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from crewai import Crew


def get_crewbase_path() -> Path:
    """Get path to crewbase.yaml."""
    return Path(__file__).parent.parent.parent / "crewbase.yaml"


class CrewAgents:
    """Wrapper class for CrewAI crew execution.

    Provides a class-based interface for flows to instantiate and run crews.
    This bridges the gap between Flow expectations and the YAML-based crew config.
    """

    def __init__(self, config_path: Path | None = None):
        """Initialize CrewAgents with optional custom config path."""
        self.config_path = config_path or get_crewbase_path()
        self._crew: Crew | None = None
        self._config: dict[str, Any] | None = None

    @property
    def config(self) -> dict[str, Any]:
        """Lazy load configuration."""
        if self._config is None:
            with open(self.config_path) as f:
                self._config = yaml.safe_load(f)
        return self._config

    @property
    def crew(self) -> Crew:
        """Lazy load crew from YAML."""
        if self._crew is None:
            self._crew = Crew.from_yaml(str(self.config_path))
        return self._crew

    def _get_crew_for_task(self, task_name: str | None = None) -> Crew:
        """Get a crew instance, optionally filtered to a specific task.

        When task filtering is needed, creates a fresh crew instance to avoid
        mutating the cached crew's task list.

        Args:
            task_name: Optional task name to filter to

        Returns:
            Crew instance (cached if no filtering, fresh if filtering)

        Raises:
            ValueError: If task_name is provided but not found
        """
        if task_name is None:
            return self.crew

        # Create fresh crew for task filtering to avoid mutating cached instance
        crew = Crew.from_yaml(str(self.config_path))
        matching_tasks = [t for t in crew.tasks if t.name == task_name]

        if not matching_tasks:
            available = [t.name for t in crew.tasks]
            raise ValueError(f"Task '{task_name}' not found. Available: {available}")

        crew.tasks = matching_tasks
        return crew

    def kickoff(self, inputs: dict[str, Any] | None = None) -> Any:
        """Execute the crew with given inputs.

        Args:
            inputs: Optional dict with:
                - task: Specific task name to run (filters crew tasks)
                - Any other inputs passed to crew.kickoff()

        Returns:
            CrewOutput from crew execution

        Note:
            This method does NOT mutate the inputs dict passed by caller.
        """
        task_name = inputs.get("task") if inputs else None
        # Create filtered inputs without mutating original
        filtered_inputs = {k: v for k, v in inputs.items() if k != "task"} if inputs else None
        crew = self._get_crew_for_task(task_name)
        return crew.kickoff(inputs=filtered_inputs)

    def kickoff_async(self, inputs: dict[str, Any] | None = None) -> Any:
        """Async version of kickoff for parallel execution.

        Note:
            This method does NOT mutate the inputs dict passed by caller.
        """
        task_name = inputs.get("task") if inputs else None
        # Create filtered inputs without mutating original
        filtered_inputs = {k: v for k, v in inputs.items() if k != "task"} if inputs else None
        crew = self._get_crew_for_task(task_name)
        return crew.kickoff_async(inputs=filtered_inputs)


def load_crewbase():
    """Load crewbase.yaml configuration."""
    crewbase_path = Path(__file__).parent.parent.parent / "crewbase.yaml"
    with open(crewbase_path) as f:
        return yaml.safe_load(f)


def kickoff(inputs: dict = None):
    """Main entry point for crewai run.

    Args:
        inputs: Optional dict with:
            - task: Specific task name to run
            - All other task inputs from crewbase.yaml

    Note:
        This function does NOT mutate the inputs dict passed by caller.
    """
    load_crewbase()

    # CrewAI will automatically load agents/tasks from crewbase.yaml
    # The MCP tools are declared in crewbase.yaml using mcp:// syntax
    crew = Crew.from_yaml(str(Path(__file__).parent.parent.parent / "crewbase.yaml"))

    # If specific task requested, filter to that task
    # Create filtered inputs without mutating original
    task_name = inputs.get("task") if inputs else None
    filtered_inputs = {k: v for k, v in inputs.items() if k != "task"} if inputs else None

    if task_name:
        crew.tasks = [t for t in crew.tasks if t.name == task_name]
        if not crew.tasks:
            raise ValueError(f"Task '{task_name}' not found in crewbase.yaml")

    return crew.kickoff(inputs=filtered_inputs)


def train(n_iterations: int = 5, inputs: dict = None):
    """Train the crew using memory/learning features."""
    load_crewbase()
    crew = Crew.from_yaml(str(Path(__file__).parent.parent.parent / "crewbase.yaml"))

    crew.train(n_iterations=n_iterations, inputs=inputs)


if __name__ == "__main__":
    # For direct execution
    kickoff()
