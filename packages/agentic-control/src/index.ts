/**
 * @agentic-dev-library/control
 *
 * Orchestration layer for AI agent fleet management consuming @agentic/triage primitives.
 *
 * Features:
 * - Multi-agent orchestration (Ollama/Jules/Cursor routing)
 * - CI resolution and PR lifecycle pipelines
 * - GitHub Marketplace actions integration
 * - Intelligent token switching (auto-selects org-appropriate tokens)
 * - Fleet management (spawn, monitor, coordinate agents)
 * - AI-powered triage (conversation analysis, code review)
 * - Station-to-station handoff (agent continuity)
 * - Token-aware GitHub operations
 *
 * @packageDocumentation
 */

// GitHub Actions integration
export * from './actions/index.js';

// Core exports (maintaining existing API surface)
export * from './core/index.js';

// Crew tool (agentic-crew CLI integration)
export * from './crews/index.js';

// Fleet management
export {
  type CoordinationConfig,
  CursorAPI,
  type CursorAPIOptions,
  Fleet,
  type FleetConfig,
} from './fleet/index.js';
// GitHub operations
export { cloneRepo, GitHubClient, isValidGitRef, isValidRepoFormat } from './github/index.js';
// Handoff protocols
export { HandoffManager, type TakeoverOptions } from './handoff/index.js';
// Orchestration layer - Multi-agent routing
export * from './orchestrators/index.js';
// Pipeline automation - CI resolution, PR lifecycle
export * from './pipelines/index.js';
// Roles - Configurable AI agent personas
export * from './roles/index.js';
// Sandbox execution
export type { ContainerConfig, ContainerResult, SandboxOptions } from './sandbox/index.js';
export { ContainerManager, SandboxExecutor } from './sandbox/index.js';
// AI Triage
export { AIAnalyzer, type AIAnalyzerOptions } from './triage/index.js';

// Version - read from package.json at runtime
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };
export const VERSION = pkg.version;
