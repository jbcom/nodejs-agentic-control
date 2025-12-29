"""Pytest configuration for crew-agents tests."""

from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def mock_llm_env() -> Generator[None, Any, None]:
    """Set up test environment with mocked LLM credentials."""
    # Set dummy API keys for testing (will be mocked anyway)
    with patch.dict(
        os.environ,
        {
            "OPENAI_API_KEY": "sk-test-mock-key",
            "ANTHROPIC_API_KEY": "sk-ant-test-mock-key",
            "CREWAI_TESTING": "true",
        },
    ):
        yield


@pytest.fixture
def temp_workspace(tmp_path: Path) -> Path:
    """Create a temporary workspace with package structure."""
    # Create packages directory structure
    packages_dir = tmp_path / "packages"
    packages_dir.mkdir()

    # Create a mock otterfall package with .crewai structure
    otterfall_dir = packages_dir / "otterfall"
    otterfall_dir.mkdir()

    crewai_dir = otterfall_dir / ".crewai"
    crewai_dir.mkdir()

    # Create minimal manifest (dict format, not list)
    manifest = crewai_dir / "manifest.yaml"
    manifest.write_text("""
name: otterfall
description: Test package
crews:
  test_crew:
    description: A test crew
    agents: crews/test_crew/agents.yaml
    tasks: crews/test_crew/tasks.yaml
""")

    # Create crews directory
    crews_dir = crewai_dir / "crews" / "test_crew"
    crews_dir.mkdir(parents=True)

    # Create minimal agent and task configs
    (crews_dir / "agents.yaml").write_text("""
test_agent:
  role: Test Agent
  goal: Test goal
  backstory: Test backstory
""")

    (crews_dir / "tasks.yaml").write_text("""
test_task:
  description: Test task description
  expected_output: Test output
  agent: test_agent
""")

    return tmp_path


@pytest.fixture
def mock_crew() -> MagicMock:
    """Create a mock crew result."""
    result = MagicMock()
    result.raw = {"output": "test output", "success": True}
    return result
