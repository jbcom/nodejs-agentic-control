#!/bin/bash
# =============================================================================
# agentic-control entrypoint
# =============================================================================
# Supports multiple modes:
#   1. CLI mode (default): Run agentic CLI commands
#   2. Sandbox mode: Execute agent in isolated environment
#   3. Daemon mode: Long-running agent service
# =============================================================================

set -euo pipefail

# Detect mode from first argument
MODE="${1:-cli}"

case "$MODE" in
  sandbox)
    # Shift off 'sandbox' and run sandbox executor
    shift
    exec node /app/sandbox/execute.js "$@"
    ;;
  daemon)
    # Long-running daemon mode for persistent agents
    shift
    exec node /app/sandbox/daemon.js "$@"
    ;;
  --help|-h)
    echo "agentic-control - AI Agent Fleet Management"
    echo ""
    echo "Usage:"
    echo "  agentic [command] [options]     Run CLI command"
    echo "  agentic sandbox [options]       Execute agent in sandbox"
    echo "  agentic daemon [options]        Run persistent agent daemon"
    echo ""
    echo "Commands:"
    echo "  fleet       Manage agent fleet (remote + local)"
    echo "  triage      Triage and recover agents"
    echo "  sandbox     Execute in isolated container (local)"
    echo "  github      GitHub integration"
    echo "  handoff     Agent handoff operations"
    echo ""
    exec agentic --help
    ;;
  *)
    # Default: pass through to agentic CLI
    exec agentic "$@"
    ;;
esac
