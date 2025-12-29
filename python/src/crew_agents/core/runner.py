"""Runner module - executes crews with inputs."""

from __future__ import annotations

from pathlib import Path

from crew_agents.core.discovery import discover_packages, get_crew_config
from crew_agents.core.loader import load_crew_from_config


def run_crew(
    package_name: str,
    crew_name: str,
    inputs: dict | None = None,
    workspace_root: Path | None = None,
) -> str:
    """Run a crew from a package with the given inputs.

    Args:
        package_name: Name of the package (e.g., 'otterfall').
        crew_name: Name of the crew to run (e.g., 'game_builder').
        inputs: Optional dict of inputs to pass to the crew.
        workspace_root: Optional workspace root path.

    Returns:
        The crew's output as a string.

    Raises:
        ValueError: If package or crew not found.
    """
    # Discover packages
    packages = discover_packages(workspace_root)

    if package_name not in packages:
        available = list(packages.keys())
        raise ValueError(f"Package '{package_name}' not found. Available: {available}")

    crewai_dir = packages[package_name]

    # Load crew configuration
    crew_config = get_crew_config(crewai_dir, crew_name)

    # Build the crew
    crew = load_crew_from_config(crew_config)

    # Run it
    result = crew.kickoff(inputs=inputs or {})

    return result.raw if hasattr(result, "raw") else str(result)


def run_crew_from_path(
    crewai_dir: Path,
    crew_name: str,
    inputs: dict | None = None,
) -> str:
    """Run a crew directly from a .crewai/ directory path.

    Args:
        crewai_dir: Path to the .crewai/ directory.
        crew_name: Name of the crew to run.
        inputs: Optional dict of inputs to pass to the crew.

    Returns:
        The crew's output as a string.
    """
    crew_config = get_crew_config(crewai_dir, crew_name)
    crew = load_crew_from_config(crew_config)
    result = crew.kickoff(inputs=inputs or {})
    return result.raw if hasattr(result, "raw") else str(result)
