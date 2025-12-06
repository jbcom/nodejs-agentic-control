/**
 * Handoff module for agentic-control
 *
 * Provides station-to-station agent handoff:
 * - Context preservation across sessions
 * - PR takeover protocols
 * - Health confirmation
 */

export { HandoffManager, type TakeoverOptions } from './manager.js';
