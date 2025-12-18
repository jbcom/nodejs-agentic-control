/**
 * Type definitions for agentic-crew CLI integration
 *
 * These types match the JSON output from agentic-crew CLI commands.
 */

import { z } from 'zod';

/**
 * Configuration for crew tool execution
 */
export interface CrewToolConfig {
  /** How to invoke agentic-crew: 'uv' (default) or 'direct' */
  invokeMethod?: 'uv' | 'direct';
  /** Default timeout in milliseconds (default: 300000 = 5 minutes) */
  defaultTimeout?: number;
  /** Environment variables to pass to crew execution */
  env?: Record<string, string>;
}

/**
 * Options for invoking a crew
 */
export interface InvokeCrewOptions {
  /** Package name (e.g., 'otterfall') */
  package: string;
  /** Crew name (e.g., 'game_builder') */
  crew: string;
  /** Input specification for the crew */
  input: string;
  /** Optional timeout override in milliseconds */
  timeout?: number;
  /** Optional additional environment variables */
  env?: Record<string, string>;
}

/**
 * Result from crew execution (matches agentic-crew CLI JSON output)
 */
export interface CrewResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Crew output (if successful) */
  output?: string;
  /** Error message (if failed) */
  error?: string;
  /** Framework that was used */
  framework_used?: string;
  /** Execution time in milliseconds */
  duration_ms: number;
}

/**
 * Information about an available crew (matches agentic-crew CLI JSON output)
 */
export interface CrewInfo {
  /** Package name */
  package: string;
  /** Crew name */
  name: string;
  /** Crew description */
  description: string;
  /** Required framework (null if framework-agnostic) */
  required_framework: string | null;
}

/**
 * List crews response
 */
export interface CrewListResponse {
  crews: CrewInfo[];
}

/**
 * Zod schema for CrewToolConfig validation
 */
export const CrewToolConfigSchema = z.object({
  invokeMethod: z.enum(['uv', 'direct']).default('uv'),
  defaultTimeout: z.number().positive().default(300000),
  env: z.record(z.string(), z.string()).optional(),
});

/**
 * Zod schema for InvokeCrewOptions validation
 */
export const InvokeCrewOptionsSchema = z.object({
  package: z
    .string()
    .min(1)
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Package name must be alphanumeric and may include hyphens, underscores, or dots'
    ),
  crew: z
    .string()
    .min(1)
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      'Crew name must be alphanumeric and may include hyphens, underscores, or dots'
    ),
  input: z.string(),
  timeout: z.number().positive().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

/**
 * Validate CrewToolConfig
 */
export function validateConfig(config: unknown): CrewToolConfig {
  return CrewToolConfigSchema.parse(config);
}

/**
 * Validate InvokeCrewOptions
 */
export function validateInvokeOptions(options: unknown): InvokeCrewOptions {
  return InvokeCrewOptionsSchema.parse(options);
}
