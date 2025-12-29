"""Main entry point for CrewAI - Package-Agnostic Crew Runner.

This is a generic CrewAI runner that discovers and executes crews
defined in packages' .crewai/ directories.

Usage:
    # List all available packages with crews
    crewai list

    # List crews in a specific package
    crewai list otterfall

    # Run a crew
    crewai run otterfall game_builder --input "Create a BiomeComponent"

    # Run with input from file
    crewai run otterfall game_builder --file tasks.md

    # Legacy: Direct build (uses otterfall game_builder)
    crewai build "Create a BiomeComponent"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from crew_agents.core.discovery import discover_packages, get_crew_config, list_crews
from crew_agents.core.runner import run_crew


def cmd_list(args):
    """List available packages and crews."""
    crews_by_package = list_crews(args.package if hasattr(args, "package") else None)

    if not crews_by_package:
        print("No packages with .crewai/ directories found.")
        print("\nTo add crews to a package, create:")
        print("  packages/<name>/.crewai/manifest.yaml")
        return

    print("=" * 60)
    print("AVAILABLE CREWS")
    print("=" * 60)

    for pkg_name, crews in crews_by_package.items():
        print(f"\n📦 {pkg_name}")
        for crew in crews:
            desc = crew.get("description", "")
            print(f"   • {crew['name']}: {desc}")


def cmd_run(args):
    """Run a specific crew."""
    print("=" * 60)
    print(f"🚀 Running {args.package}/{args.crew}")
    print("=" * 60)

    # Get input
    if args.file:
        input_text = Path(args.file).read_text()
    elif args.input:
        input_text = args.input
    else:
        input_text = ""

    inputs = {"spec": input_text, "component_spec": input_text}

    try:
        result = run_crew(args.package, args.crew, inputs)
        print("\n" + "=" * 60)
        print("📄 RESULT")
        print("=" * 60)
        print(result)
    except ValueError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


def cmd_build(args):
    """Legacy build command - runs otterfall game_builder."""
    print("=" * 60)
    print("🎮 OTTERFALL GAME BUILDER")
    print("=" * 60)
    print()
    print(f"Building: {args.spec[:100]}...")

    inputs = {"spec": args.spec, "component_spec": args.spec}

    try:
        result = run_crew("otterfall", "game_builder", inputs)
        print("\n" + "=" * 60)
        print("📄 RESULT")
        print("=" * 60)
        print(result)
    except ValueError as e:
        print(f"❌ Error: {e}")
        print("\nNote: The 'build' command requires packages/otterfall/.crewai/")
        sys.exit(1)


def cmd_info(args):
    """Show detailed info about a crew."""
    packages = discover_packages()

    if args.package not in packages:
        print(f"❌ Package '{args.package}' not found.")
        print(f"Available: {list(packages.keys())}")
        sys.exit(1)

    crewai_dir = packages[args.package]

    try:
        config = get_crew_config(crewai_dir, args.crew)
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)

    print("=" * 60)
    print(f"CREW: {args.package}/{args.crew}")
    print("=" * 60)
    print(f"\nDescription: {config.get('description', 'N/A')}")

    print("\n📋 Agents:")
    for name, cfg in config.get("agents", {}).items():
        role = cfg.get("role", name)
        print(f"   • {name}: {role}")

    print("\n📝 Tasks:")
    for name, cfg in config.get("tasks", {}).items():
        desc = cfg.get("description", "")[:60]
        print(f"   • {name}: {desc}...")

    print("\n📚 Knowledge:")
    for kp in config.get("knowledge_paths", []):
        print(f"   • {kp}")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="CrewAI - Package-Agnostic Crew Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # List all packages with crews
    crewai list

    # List crews in a package
    crewai list otterfall

    # Run a crew
    crewai run otterfall game_builder --input "Create a QuestComponent"

    # Show crew details
    crewai info otterfall game_builder

    # Legacy: Direct build (uses otterfall game_builder)
    crewai build "Create a QuestComponent"
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # List command
    list_parser = subparsers.add_parser("list", help="List available crews")
    list_parser.add_argument("package", nargs="?", help="Package to list crews for")

    # Run command
    run_parser = subparsers.add_parser("run", help="Run a crew")
    run_parser.add_argument("package", help="Package name (e.g., otterfall)")
    run_parser.add_argument("crew", help="Crew name (e.g., game_builder)")
    run_parser.add_argument("--input", "-i", help="Input specification")
    run_parser.add_argument("--file", "-f", help="Read input from file")

    # Info command
    info_parser = subparsers.add_parser("info", help="Show crew details")
    info_parser.add_argument("package", help="Package name")
    info_parser.add_argument("crew", help="Crew name")

    # Legacy build command (for backwards compatibility)
    build_parser = subparsers.add_parser("build", help="Build a game component (legacy)")
    build_parser.add_argument("spec", help="Component specification")

    # Legacy commands
    subparsers.add_parser("list-knowledge", help="List knowledge sources (legacy)")
    subparsers.add_parser("test-tools", help="Test file tools (legacy)")

    args = parser.parse_args()

    if args.command == "list":
        cmd_list(args)
    elif args.command == "run":
        cmd_run(args)
    elif args.command == "info":
        cmd_info(args)
    elif args.command == "build":
        cmd_build(args)
    elif args.command == "list-knowledge":
        # Legacy - list knowledge from otterfall
        packages = discover_packages()
        if "otterfall" in packages:
            config = get_crew_config(packages["otterfall"], "game_builder")
            print("Knowledge sources:")
            for kp in config.get("knowledge_paths", []):
                print(f"  • {kp}")
        else:
            print("No otterfall package found.")
    elif args.command == "test-tools":
        from crew_agents.tools.file_tools import DirectoryListTool, get_workspace_root

        print(f"Workspace root: {get_workspace_root()}")
        tool = DirectoryListTool()
        print(tool._run("packages"))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
