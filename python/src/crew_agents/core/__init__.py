"""Core CrewAI engine - discovery, loading, and running of package-defined crews."""

from __future__ import annotations

from crew_agents.core.discovery import discover_packages, get_crew_config, load_manifest
from crew_agents.core.loader import load_crew_from_config
from crew_agents.core.runner import run_crew

__all__ = [
    "discover_packages",
    "load_manifest",
    "get_crew_config",
    "load_crew_from_config",
    "run_crew",
]
