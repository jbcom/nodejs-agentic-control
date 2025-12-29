"""Tests for the discovery module."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch


class TestDiscovery:
    """Tests for package discovery functionality."""

    def test_discover_packages_finds_crewai_directories(self, temp_workspace: Path) -> None:
        """Test that discover_packages finds packages with .crewai directories."""
        from crew_agents.core.discovery import discover_packages

        packages = discover_packages(workspace_root=temp_workspace)

        assert "otterfall" in packages
        assert packages["otterfall"].exists()

    def test_discover_packages_returns_empty_when_no_packages(self, tmp_path: Path) -> None:
        """Test that discover_packages returns empty dict when no .crewai dirs exist."""
        from crew_agents.core.discovery import discover_packages

        # Create empty packages directory
        packages_dir = tmp_path / "packages"
        packages_dir.mkdir()
        (packages_dir / "some_package").mkdir()

        packages = discover_packages(workspace_root=tmp_path)

        assert packages == {}

    def test_list_crews_returns_crews_from_manifest(self, temp_workspace: Path) -> None:
        """Test that list_crews returns crew definitions from manifest."""
        from crew_agents.core.discovery import list_crews

        with patch(
            "crew_agents.core.discovery.discover_packages",
            return_value={"otterfall": temp_workspace / "packages" / "otterfall" / ".crewai"},
        ):
            crews_by_package = list_crews()

        assert "otterfall" in crews_by_package
        crews = crews_by_package["otterfall"]
        assert len(crews) == 1
        assert crews[0]["name"] == "test_crew"

    def test_list_crews_filters_by_package_name(self, temp_workspace: Path) -> None:
        """Test that list_crews can filter to a specific package."""
        from crew_agents.core.discovery import list_crews

        with patch(
            "crew_agents.core.discovery.discover_packages",
            return_value={"otterfall": temp_workspace / "packages" / "otterfall" / ".crewai"},
        ):
            crews_by_package = list_crews(package_name="otterfall")

        assert "otterfall" in crews_by_package
        assert len(crews_by_package) == 1

    def test_list_crews_returns_empty_for_nonexistent_package(self, temp_workspace: Path) -> None:
        """Test that list_crews returns empty for non-existent package."""
        from crew_agents.core.discovery import list_crews

        with patch(
            "crew_agents.core.discovery.discover_packages",
            return_value={"otterfall": temp_workspace / "packages" / "otterfall" / ".crewai"},
        ):
            crews_by_package = list_crews(package_name="nonexistent")

        assert crews_by_package == {}

    def test_load_manifest_parses_yaml(self, temp_workspace: Path) -> None:
        """Test that load_manifest parses YAML correctly."""
        from crew_agents.core.discovery import load_manifest

        crewai_dir = temp_workspace / "packages" / "otterfall" / ".crewai"
        manifest = load_manifest(crewai_dir)

        assert manifest is not None
        assert manifest.get("name") == "otterfall"
        assert "crews" in manifest

    def test_get_workspace_root_finds_root(self) -> None:
        """Test that get_workspace_root finds the workspace root."""
        from crew_agents.core.discovery import get_workspace_root

        # This should find the actual workspace root
        root = get_workspace_root()

        # Verify it looks like a workspace root
        assert (root / "packages").exists() or root == Path.cwd()
