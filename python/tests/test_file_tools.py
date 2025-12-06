"""Tests for file manipulation tools."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch


class TestGetWorkspaceRoot:
    """Tests for get_workspace_root function."""

    def test_uses_target_package_env_var(self, temp_workspace: Path) -> None:
        """Test that TARGET_PACKAGE env var is respected."""
        from crew_agents.tools.file_tools import get_workspace_root

        # Create another package
        other_pkg = temp_workspace / "packages" / "other_package"
        other_pkg.mkdir(parents=True)

        # Create pyproject.toml at workspace root
        (temp_workspace / "pyproject.toml").write_text("[project]\nname = 'test'")

        with patch.dict(os.environ, {"TARGET_PACKAGE": "other_package"}):
            with patch(
                "crew_agents.tools.file_tools._find_workspace_root",
                return_value=temp_workspace,
            ):
                root = get_workspace_root()

        assert root == other_pkg

    def test_defaults_to_otterfall(self, temp_workspace: Path) -> None:
        """Test that package defaults to 'otterfall'."""
        from crew_agents.tools.file_tools import get_workspace_root

        # Create otterfall package
        otterfall = temp_workspace / "packages" / "otterfall"
        otterfall.mkdir(parents=True, exist_ok=True)

        with patch(
            "crew_agents.tools.file_tools._find_workspace_root",
            return_value=temp_workspace,
        ):
            # Remove TARGET_PACKAGE if set
            env = os.environ.copy()
            env.pop("TARGET_PACKAGE", None)
            with patch.dict(os.environ, env, clear=True):
                root = get_workspace_root()

        assert root.name == "otterfall"

    def test_explicit_package_name(self, temp_workspace: Path) -> None:
        """Test explicit package name parameter."""
        from crew_agents.tools.file_tools import get_workspace_root

        # Create custom package
        custom_pkg = temp_workspace / "packages" / "custom"
        custom_pkg.mkdir(parents=True)

        with patch(
            "crew_agents.tools.file_tools._find_workspace_root",
            return_value=temp_workspace,
        ):
            root = get_workspace_root(package_name="custom")

        assert root == custom_pkg


class TestGameCodeWriterTool:
    """Tests for GameCodeWriterTool."""

    def test_rejects_path_traversal(self) -> None:
        """Test that path traversal is rejected."""
        from crew_agents.tools.file_tools import GameCodeWriterTool

        tool = GameCodeWriterTool()
        result = tool._run(file_path="../../../etc/passwd", content="malicious")

        assert "Error" in result
        assert "Path traversal" in result or "not allowed" in result

    def test_rejects_absolute_paths(self) -> None:
        """Test that absolute paths are rejected."""
        from crew_agents.tools.file_tools import GameCodeWriterTool

        tool = GameCodeWriterTool()
        result = tool._run(file_path="/etc/passwd", content="malicious")

        assert "Error" in result

    def test_rejects_disallowed_directories(self) -> None:
        """Test that writes to non-allowed directories are rejected."""
        from crew_agents.tools.file_tools import GameCodeWriterTool

        tool = GameCodeWriterTool()
        result = tool._run(file_path="node_modules/test.ts", content="test")

        assert "Error" in result
        assert "not in an allowed directory" in result

    def test_rejects_disallowed_extensions(self) -> None:
        """Test that disallowed file extensions are rejected."""
        from crew_agents.tools.file_tools import GameCodeWriterTool

        tool = GameCodeWriterTool()
        result = tool._run(file_path="src/ecs/test.exe", content="binary")

        assert "Error" in result
        assert "not allowed" in result

    def test_writes_to_allowed_directory(self, temp_workspace: Path) -> None:
        """Test that writing to allowed directories works."""
        from crew_agents.tools.file_tools import GameCodeWriterTool

        # Create the allowed directory structure
        ecs_dir = temp_workspace / "packages" / "otterfall" / "src" / "ecs"
        ecs_dir.mkdir(parents=True)

        tool = GameCodeWriterTool()

        with patch(
            "crew_agents.tools.file_tools.get_workspace_root",
            return_value=temp_workspace / "packages" / "otterfall",
        ):
            result = tool._run(
                file_path="src/ecs/TestComponent.ts", content="export const TestComponent = {};"
            )

        assert "Successfully wrote" in result
        assert (ecs_dir / "TestComponent.ts").exists()


class TestGameCodeReaderTool:
    """Tests for GameCodeReaderTool."""

    def test_rejects_path_traversal(self) -> None:
        """Test that path traversal is rejected."""
        from crew_agents.tools.file_tools import GameCodeReaderTool

        tool = GameCodeReaderTool()
        result = tool._run(file_path="../../../etc/passwd")

        assert "Error" in result
        assert "not allowed" in result

    def test_reads_existing_file(self, temp_workspace: Path) -> None:
        """Test reading an existing file."""
        from crew_agents.tools.file_tools import GameCodeReaderTool

        # Create a test file
        test_file = temp_workspace / "packages" / "otterfall" / "src" / "test.ts"
        test_file.parent.mkdir(parents=True, exist_ok=True)
        test_file.write_text("export const Test = 'hello';")

        tool = GameCodeReaderTool()

        with patch(
            "crew_agents.tools.file_tools.get_workspace_root",
            return_value=temp_workspace / "packages" / "otterfall",
        ):
            result = tool._run(file_path="src/test.ts")

        assert "export const Test" in result

    def test_returns_error_for_missing_file(self, temp_workspace: Path) -> None:
        """Test that missing files return an error."""
        from crew_agents.tools.file_tools import GameCodeReaderTool

        tool = GameCodeReaderTool()

        with patch(
            "crew_agents.tools.file_tools.get_workspace_root",
            return_value=temp_workspace / "packages" / "otterfall",
        ):
            result = tool._run(file_path="src/nonexistent.ts")

        assert "Error" in result
        assert "not found" in result


class TestDirectoryListTool:
    """Tests for DirectoryListTool."""

    def test_lists_directory_contents(self, temp_workspace: Path) -> None:
        """Test listing directory contents."""
        from crew_agents.tools.file_tools import DirectoryListTool

        # Create some test files
        src_dir = temp_workspace / "packages" / "otterfall" / "src"
        src_dir.mkdir(parents=True)
        (src_dir / "index.ts").write_text("export {};")
        (src_dir / "utils").mkdir()

        tool = DirectoryListTool()

        with patch(
            "crew_agents.tools.file_tools.get_workspace_root",
            return_value=temp_workspace / "packages" / "otterfall",
        ):
            result = tool._run(directory="src")

        assert "index.ts" in result
        assert "utils" in result

    def test_rejects_path_traversal(self) -> None:
        """Test that path traversal is rejected."""
        from crew_agents.tools.file_tools import DirectoryListTool

        tool = DirectoryListTool()
        result = tool._run(directory="../../../etc")

        assert "Error" in result
        assert "not allowed" in result
