/**
 * Fleet management module for agentic-control
 *
 * Provides Cursor Background Agent fleet management with:
 * - Agent lifecycle management (list, spawn, monitor)
 * - Communication (followup, broadcast)
 * - Coordination patterns (diamond, bidirectional)
 * - Token-aware GitHub integration
 */

export { CursorAPI, type CursorAPIOptions } from './cursor-api.js';
export { type CoordinationConfig, Fleet, type FleetConfig, type SpawnContext } from './fleet.js';
