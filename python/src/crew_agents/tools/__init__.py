"""Custom tools for CrewAI game development crews.

This module provides file manipulation tools for reading/writing game code.

For Meshy 3D asset generation tools, use mesh-toolkit directly:
    from mesh_toolkit.agent_tools.crewai import get_tools as get_meshy_tools

Usage:
    from crew_agents.tools import (
        GameCodeReaderTool,
        GameCodeWriterTool,
        DirectoryListTool,
        get_all_tools,
    )
"""

from __future__ import annotations

from crew_agents.tools.file_tools import (
    DirectoryListTool,
    GameCodeReaderTool,
    GameCodeWriterTool,
)


def get_file_tools():
    """Get the standard file manipulation tools.

    Returns:
        List of file tool instances
    """
    return [
        GameCodeReaderTool(),
        GameCodeWriterTool(),
        DirectoryListTool(),
    ]


def get_all_tools():
    """Get all available tools.

    Returns file tools. For Meshy tools, use mesh_toolkit.agent_tools.crewai.

    Returns:
        List of file tool instances
    """
    tools = get_file_tools()

    # Try to load mesh-toolkit tools if available
    try:
        from mesh_toolkit.agent_tools.crewai import get_tools as get_meshy_tools

        tools.extend(get_meshy_tools())
    except ImportError:
        pass  # mesh-toolkit not installed with crewai extra

    return tools


__all__ = [
    "DirectoryListTool",
    "GameCodeReaderTool",
    "GameCodeWriterTool",
    "get_file_tools",
    "get_all_tools",
]
