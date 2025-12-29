"""File manipulation tools for CrewAI agents.

These tools enable agents to read and write code to specific directories
in game package codebases (e.g., packages/otterfall).
"""

from __future__ import annotations

import os
from pathlib import Path

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


def _find_workspace_root() -> Path | None:
    """Search upward for workspace root (contains pyproject.toml with workspace)."""
    current = Path(__file__).resolve().parent
    for parent in [current] + list(current.parents):
        pyproject = parent / "pyproject.toml"
        if pyproject.exists():
            # Check if this is the workspace root (has packages/ directory)
            packages_dir = parent / "packages"
            if packages_dir.exists() and packages_dir.is_dir():
                return parent
    return None


def get_workspace_root(package_name: str = None) -> Path:
    """Get the workspace root directory for the target game code package.

    Returns packages/<package_name> as the workspace root, where the game code lives.

    Uses marker file search to find workspace root reliably, regardless of
    where this module is installed or imported from.

    Args:
        package_name: Name of the target package. If not provided,
            uses TARGET_PACKAGE environment variable, or defaults to "otterfall".

    Returns:
        Path to packages/<package_name> directory.
    """
    # Determine the target package name
    if package_name is None:
        package_name = os.environ.get("TARGET_PACKAGE", "otterfall")

    # Find workspace root using marker file search
    workspace_root = _find_workspace_root()
    if workspace_root:
        target_dir = workspace_root / "packages" / package_name
        if target_dir.exists():
            return target_dir

    # Fallback: try environment variable for root directory
    env_root_var = f"{package_name.upper()}_ROOT"
    if env_root_var in os.environ:
        return Path(os.environ[env_root_var]).resolve()

    # Last fallback - current directory (shouldn't happen in normal use)
    return Path.cwd()


# Allowed directories for writing (relative to packages/otterfall)
ALLOWED_WRITE_DIRS = [
    "src/ecs",  # ECS components, world, data
    "src/ecs/data",  # Species definitions, etc.
    "src/ecs/systems",  # ECS systems
    "src/components",  # React/R3F components
    "src/components/ui",  # UI components
    "src/stores",  # Zustand stores
    "src/systems",  # Non-ECS systems
    "src/utils",  # Utility functions
    "src/types",  # TypeScript types
]

# Allowed file extensions
ALLOWED_EXTENSIONS = {".ts", ".tsx", ".json", ".md"}


class WriteFileInput(BaseModel):
    """Input schema for GameCodeWriterTool."""

    file_path: str = Field(
        description="Relative path from workspace root (e.g., 'src/ecs/data/NewComponent.ts')"
    )
    content: str = Field(description="The TypeScript/TSX code content to write")


class GameCodeWriterTool(BaseTool):
    """Tool for writing code files to a game package codebase.

    This tool is restricted to specific directories to ensure agents
    only modify appropriate parts of the codebase.
    """

    name: str = "Write Game Code File"
    description: str = """
    Write a code file to the target game codebase (e.g., packages/<target_package>).

    The target package is configurable via TARGET_PACKAGE environment variable.

    ALLOWED DIRECTORIES:
    - src/ecs - ECS components, world definition
    - src/ecs/data - Species data, biome configs
    - src/ecs/systems - ECS systems
    - src/components - React Three Fiber components
    - src/components/ui - UI components (menus, HUD)
    - src/stores - Zustand state stores
    - src/systems - Non-ECS game systems
    - src/utils - Utility functions
    - src/types - TypeScript type definitions

    ALLOWED EXTENSIONS: .ts, .tsx, .json, .md

    Example:
        file_path: "src/ecs/data/species.ts"
        content: "export const PREDATOR_SPECIES = { ... }"
    """
    args_schema: type[BaseModel] = WriteFileInput

    def _run(self, file_path: str, content: str) -> str:
        """Write the file content to the specified path."""
        try:
            # Validate path
            clean_path = file_path.strip().replace("\\", "/")

            # Check for path traversal
            if ".." in clean_path or clean_path.startswith("/"):
                return f"Error: Invalid path '{clean_path}'. Path traversal not allowed."

            # Check allowed directories
            is_allowed = any(
                clean_path.startswith(allowed_dir) for allowed_dir in ALLOWED_WRITE_DIRS
            )
            if not is_allowed:
                return (
                    f"Error: Path '{clean_path}' is not in an allowed directory. "
                    f"Allowed: {ALLOWED_WRITE_DIRS}"
                )

            # Check extension
            ext = Path(clean_path).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                return f"Error: Extension '{ext}' not allowed. Allowed: {ALLOWED_EXTENSIONS}"

            # Construct full path
            workspace_root = get_workspace_root()
            full_path = workspace_root / clean_path

            # Create parent directories
            full_path.parent.mkdir(parents=True, exist_ok=True)

            # Write content
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

            return f"Successfully wrote {len(content)} bytes to {clean_path}"

        except PermissionError:
            return f"Error: Permission denied writing to {file_path}"
        except Exception as e:
            return f"Error writing file: {e!s}"


class ReadFileInput(BaseModel):
    """Input schema for GameCodeReaderTool."""

    file_path: str = Field(
        description="Relative path from workspace root (e.g., 'src/ecs/components.ts')"
    )


class GameCodeReaderTool(BaseTool):
    """Tool for reading code files from a game package codebase.

    Use this to understand existing patterns before writing new code.
    """

    name: str = "Read Game Code File"
    description: str = """
    Read a code file from the target package's codebase.

    The target package is determined by the TARGET_PACKAGE environment variable.

    Use this tool to:
    - Understand existing patterns
    - See how similar components are structured
    - Check imports and dependencies

    Example:
        file_path: "src/ecs/components.ts"
    """
    args_schema: type[BaseModel] = ReadFileInput

    def _run(self, file_path: str) -> str:
        """Read the file content from the specified path."""
        try:
            clean_path = file_path.strip().replace("\\", "/")

            if ".." in clean_path:
                return f"Error: Path traversal not allowed in '{clean_path}'"

            workspace_root = get_workspace_root()
            full_path = workspace_root / clean_path

            if not full_path.exists():
                return f"Error: File not found: {clean_path}"

            if not full_path.is_file():
                return f"Error: Path is not a file: {clean_path}"

            # Limit file size
            if full_path.stat().st_size > 100_000:  # 100KB limit
                return f"Error: File too large (>{100_000} bytes)"

            with open(full_path, encoding="utf-8") as f:
                content = f.read()

            return content

        except PermissionError:
            return f"Error: Permission denied reading {file_path}"
        except Exception as e:
            return f"Error reading file: {e!s}"


class ListDirInput(BaseModel):
    """Input schema for DirectoryListTool."""

    directory: str = Field(
        description="Relative directory path from workspace root (e.g., 'src/ecs')"
    )


class DirectoryListTool(BaseTool):
    """Tool for listing files in a directory.

    Use this to discover existing files and understand project structure.
    """

    name: str = "List Directory Contents"
    description: str = """
    List files and subdirectories in the target package codebase.

    The target package is determined by the TARGET_PACKAGE environment variable.

    Use this to:
    - Discover existing components
    - Understand project structure
    - Find files to read or reference

    Example:
        directory: "src/ecs/data"
    """
    args_schema: type[BaseModel] = ListDirInput

    def _run(self, directory: str) -> str:
        """List directory contents."""
        try:
            clean_path = directory.strip().replace("\\", "/")

            if ".." in clean_path:
                return "Error: Path traversal not allowed"

            workspace_root = get_workspace_root()
            full_path = workspace_root / clean_path

            if not full_path.exists():
                return f"Error: Directory not found: {clean_path}"

            if not full_path.is_dir():
                return f"Error: Path is not a directory: {clean_path}"

            entries = []
            for entry in sorted(full_path.iterdir()):
                if entry.name.startswith("."):
                    continue
                prefix = "📁" if entry.is_dir() else "📄"
                entries.append(f"{prefix} {entry.name}")

            if not entries:
                return f"Directory {clean_path} is empty"

            return f"Contents of {clean_path}:\n" + "\n".join(entries)

        except PermissionError:
            return f"Error: Permission denied accessing {directory}"
        except Exception as e:
            return f"Error listing directory: {e!s}"
