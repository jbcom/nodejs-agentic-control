/**
 * Fleet management module for agentic-control
 * 
 * Provides Cursor Background Agent fleet management with:
 * - Agent lifecycle management (list, spawn, monitor)
 * - Communication (followup, broadcast)
 * - Coordination patterns (diamond, bidirectional)
 * - Token-aware GitHub integration
 */

export { Fleet, type FleetConfig, type CoordinationConfig, type SpawnContext } from "./fleet.js";
export { CursorAPI, type CursorAPIOptions } from "./cursor-api.js";
