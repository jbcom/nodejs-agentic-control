/**
 * Configuration validation using Zod schemas
 */

import { z } from 'zod';
import { ConfigErrorCode, ConfigurationError } from './errors.js';

// ============================================
// Base Schemas
// ============================================

const TokenOrgSchema = z.object({
  name: z.string().min(1).max(39),
  tokenEnvVar: z.string().min(1),
});

const TokenConfigSchema = z.object({
  organizations: z.record(z.string(), TokenOrgSchema).optional(),
  defaultTokenEnvVar: z.string().optional(),
  prReviewTokenEnvVar: z.string().optional(),
});

const FleetConfigSchema = z.object({
  autoCreatePr: z.boolean().optional(),
  openAsCursorGithubApp: z.boolean().optional(),
  skipReviewerRequest: z.boolean().optional(),
});

const TriageConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'mistral', 'azure']).optional(),
  model: z.string().optional(),
  apiKeyEnvVar: z.string().optional(),
});

const MCPServerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  tokenEnvVar: z.string().optional(),
  tokenEnvVarFallbacks: z.array(z.string()).optional(),
  mode: z.enum(['stdio', 'proxy']).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  proxyUrl: z.string().url().optional(),
});

const MCPConfigSchema = z
  .object({
    cursor: MCPServerConfigSchema.optional(),
    github: MCPServerConfigSchema.optional(),
    context7: MCPServerConfigSchema.optional(),
  })
  .catchall(MCPServerConfigSchema);

const CursorConfigSchema = z.object({
  apiKeyEnvVar: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

// ============================================
// Main Configuration Schema
// ============================================

export const AgenticConfigSchema = z.object({
  tokens: TokenConfigSchema.optional(),
  defaultRepository: z.string().optional(),
  coordinationPr: z.number().int().positive().optional(),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  verbose: z.boolean().optional(),
  cursor: CursorConfigSchema.optional(),
  fleet: FleetConfigSchema.optional(),
  triage: TriageConfigSchema.optional(),
  mcp: MCPConfigSchema.optional(),
});

// ============================================
// Validation Functions
// ============================================

/**
 * Validate configuration object against schema
 */
export function validateConfig(config: unknown): void {
  try {
    AgenticConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      if (firstIssue) {
        const field = firstIssue.path.join('.');
        const message = `Invalid configuration at '${field}': ${firstIssue.message}`;
        throw new ConfigurationError(message, ConfigErrorCode.INVALID_SCHEMA, field);
      }
      throw new ConfigurationError('Invalid configuration', ConfigErrorCode.INVALID_SCHEMA);
    }
    throw error;
  }
}

/**
 * Validate environment variable exists and is not empty
 */
export function validateEnvVar(envVar: string, description?: string): string {
  const value = process.env[envVar];

  if (!value || value.trim() === '') {
    const desc = description ?? envVar;
    throw new ConfigurationError(
      `Missing required environment variable: ${envVar}. Please set ${desc} to continue.`,
      ConfigErrorCode.MISSING_REQUIRED_FIELD,
      envVar
    );
  }

  return value.trim();
}

/**
 * Validate environment variable with clear error message
 */
export function validateEnvVarWithMessage(envVar: string, purpose: string): string {
  const value = process.env[envVar];

  if (!value || value.trim() === '') {
    throw new ConfigurationError(
      `${purpose} requires ${envVar} environment variable. Please set it and try again.`,
      ConfigErrorCode.MISSING_REQUIRED_FIELD,
      envVar
    );
  }

  return value.trim();
}

/**
 * Validate repository format (owner/repo)
 */
export function validateRepository(repo: string): void {
  const repoPattern = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

  if (!repoPattern.test(repo)) {
    throw new ConfigurationError(
      `Invalid repository format: ${repo}. Expected format: owner/repo`,
      ConfigErrorCode.INVALID_VALUE,
      'repository'
    );
  }
}

/**
 * Validate git reference format
 */
export function validateGitRef(ref: string): void {
  if (!/^[a-zA-Z0-9._/-]+$/.test(ref)) {
    throw new ConfigurationError(
      `Invalid git reference format: ${ref}`,
      ConfigErrorCode.INVALID_VALUE,
      'gitRef'
    );
  }

  if (ref.length > 200) {
    throw new ConfigurationError(
      `Git reference too long: ${ref} (max 200 characters)`,
      ConfigErrorCode.INVALID_VALUE,
      'gitRef'
    );
  }
}

/**
 * Validate positive integer
 */
export function validatePositiveInt(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new ConfigurationError(
      `${field} must be a positive integer, got: ${value}`,
      ConfigErrorCode.INVALID_VALUE,
      field
    );
  }

  return parsed;
}
