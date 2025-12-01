/**
 * Configuration Management for agentic-control
 * 
 * Handles loading configuration from multiple sources:
 * 1. Programmatic configuration (highest priority)
 * 2. Environment variables
 * 3. Config files (agentic.config.json, .agenticrc)
 * 4. Built-in defaults (lowest priority)
 * 
 * NO hardcoded organization or token values - all user-configurable.
 * 
 * @example Config file (agentic.config.json):
 * ```json
 * {
 *   "tokens": {
 *     "organizations": {
 *       "my-org": { "name": "my-org", "tokenEnvVar": "MY_ORG_TOKEN" }
 *     },
 *     "defaultTokenEnvVar": "GITHUB_TOKEN",
 *     "prReviewTokenEnvVar": "GITHUB_TOKEN"
 *   },
 *   "defaultModel": "claude-sonnet-4-20250514",
 *   "defaultRepository": "my-org/my-repo",
 *   "logLevel": "info"
 * }
 * ```
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TokenConfig } from "./types.js";
import { setTokenConfig } from "./tokens.js";

// ============================================
// Configuration Types
// ============================================

export interface AgenticConfig {
  /** Token configuration for multi-org access */
  tokens?: Partial<TokenConfig>;
  
  /** Default model for AI operations (user-configurable) */
  defaultModel?: string;
  
  /** Default repository for fleet operations */
  defaultRepository?: string;
  
  /** Coordination PR number for fleet communication */
  coordinationPr?: number;
  
  /** Log level */
  logLevel?: "debug" | "info" | "warn" | "error";
  
  /** Whether to enable verbose output */
  verbose?: boolean;
  
  /** Cursor API configuration */
  cursor?: {
    /** API key environment variable name (NOT the key itself!) */
    apiKeyEnvVar?: string;
    /** Base URL for Cursor API (defaults to official API) */
    baseUrl?: string;
  };
  
  /** MCP server configuration */
  mcp?: {
    serverPath?: string;
    command?: string;
    args?: string[];
  };

  /** Anthropic API configuration */
  anthropic?: {
    /** API key environment variable name (NOT the key itself!) */
    apiKeyEnvVar?: string;
    /** Default model for AI operations */
    defaultModel?: string;
  };
}

// ============================================
// Default Configuration (NO HARDCODED VALUES)
// ============================================

const DEFAULT_CONFIG: AgenticConfig = {
  // AI model - uses Claude 4 Opus as sensible default for Cursor
  defaultModel: "claude-4-opus",
  logLevel: "info",
  verbose: false,
  // Cursor defaults
  cursor: {
    apiKeyEnvVar: "CURSOR_API_KEY",
  },
  // Anthropic defaults
  anthropic: {
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
  },
};

// ============================================
// Configuration State
// ============================================

let config: AgenticConfig = { ...DEFAULT_CONFIG };
let configLoaded = false;

// ============================================
// Configuration Loading
// ============================================

/**
 * Load configuration from a JSON file
 */
function loadJsonConfig(filePath: string): Partial<AgenticConfig> | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): Partial<AgenticConfig> {
  const envConfig: Partial<AgenticConfig> = {};

  if (process.env.AGENTIC_MODEL) {
    envConfig.defaultModel = process.env.AGENTIC_MODEL;
  }

  if (process.env.AGENTIC_REPOSITORY) {
    envConfig.defaultRepository = process.env.AGENTIC_REPOSITORY;
  }

  if (process.env.AGENTIC_COORDINATION_PR) {
    const parsed = parseInt(process.env.AGENTIC_COORDINATION_PR, 10);
    if (!isNaN(parsed) && parsed > 0) {
      envConfig.coordinationPr = parsed;
    }
  }

  if (process.env.AGENTIC_LOG_LEVEL) {
    const level = process.env.AGENTIC_LOG_LEVEL.toLowerCase();
    if (["debug", "info", "warn", "error"].includes(level)) {
      envConfig.logLevel = level as AgenticConfig["logLevel"];
    }
  }

  if (process.env.AGENTIC_VERBOSE === "true" || process.env.AGENTIC_VERBOSE === "1") {
    envConfig.verbose = true;
  }

  // Cursor API configuration
  if (process.env.AGENTIC_CURSOR_API_KEY_VAR) {
    envConfig.cursor = {
      ...envConfig.cursor,
      apiKeyEnvVar: process.env.AGENTIC_CURSOR_API_KEY_VAR,
    };
  }

  // Anthropic configuration
  if (process.env.AGENTIC_ANTHROPIC_API_KEY_VAR) {
    envConfig.anthropic = {
      ...envConfig.anthropic,
      apiKeyEnvVar: process.env.AGENTIC_ANTHROPIC_API_KEY_VAR,
    };
  }

  return envConfig;
}

/**
 * Find and load configuration from the filesystem
 * Searches in order: current directory, workspace root, home directory
 */
function findConfigFile(): string | null {
  const configNames = [
    "agentic.config.json",
    ".agenticrc",
    ".agenticrc.json",
    ".agentic-control.json",
  ];
  
  const searchPaths = [
    process.cwd(),
    process.env.WORKSPACE_PATH,
    process.env.HOME,
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  for (const searchPath of searchPaths) {
    for (const configName of configNames) {
      const filePath = join(searchPath, configName);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
  }

  return null;
}

/**
 * Initialize configuration from all sources
 * Priority: programmatic overrides > env vars > config file > defaults
 */
export function initConfig(overrides?: Partial<AgenticConfig>): AgenticConfig {
  // Start with defaults
  config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Load from config file if found
  const configFile = findConfigFile();
  if (configFile) {
    const fileConfig = loadJsonConfig(configFile);
    if (fileConfig) {
      config = mergeConfig(config, fileConfig);
    }
  }

  // Load from environment
  const envConfig = loadEnvConfig();
  config = mergeConfig(config, envConfig);

  // Apply programmatic overrides
  if (overrides) {
    config = mergeConfig(config, overrides);
  }

  // Apply token configuration
  if (config.tokens) {
    setTokenConfig(config.tokens);
  }

  configLoaded = true;
  return config;
}

/**
 * Deep merge configuration objects
 */
function mergeConfig(base: AgenticConfig, overrides: Partial<AgenticConfig>): AgenticConfig {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Deep merge objects
      (result as Record<string, unknown>)[key] = {
        ...(base as Record<string, unknown>)[key] as object,
        ...value,
      };
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  
  return result;
}

// ============================================
// Public API
// ============================================

/**
 * Get the current configuration
 * Initializes if not already done
 */
export function getConfig(): AgenticConfig {
  if (!configLoaded) {
    initConfig();
  }
  return { ...config };
}

/**
 * Update configuration
 */
export function setConfig(updates: Partial<AgenticConfig>): void {
  config = mergeConfig(config, updates);
  
  // Also update token config if provided
  if (updates.tokens) {
    setTokenConfig(updates.tokens);
  }
}

/**
 * Reset configuration to defaults (useful for testing)
 */
export function resetConfig(): void {
  config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  configLoaded = false;
}

/**
 * Get a specific configuration value
 */
export function getConfigValue<K extends keyof AgenticConfig>(key: K): AgenticConfig[K] {
  if (!configLoaded) {
    initConfig();
  }
  return config[key];
}

/**
 * Check if verbose mode is enabled
 */
export function isVerbose(): boolean {
  return config.verbose ?? false;
}

/**
 * Get the default model for AI operations
 */
export function getDefaultModel(): string {
  return config.defaultModel ?? DEFAULT_CONFIG.defaultModel!;
}

/**
 * Get the log level
 */
export function getLogLevel(): string {
  return config.logLevel ?? "info";
}

/**
 * Get Cursor API key from configured environment variable
 */
export function getCursorApiKey(): string | undefined {
  const envVar = config.cursor?.apiKeyEnvVar ?? "CURSOR_API_KEY";
  return process.env[envVar];
}

/**
 * Get Anthropic API key from configured environment variable
 */
export function getAnthropicApiKey(): string | undefined {
  const envVar = config.anthropic?.apiKeyEnvVar ?? "ANTHROPIC_API_KEY";
  return process.env[envVar];
}

// ============================================
// Logging Utilities
// ============================================

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: keyof typeof LOG_LEVELS): boolean {
  const currentLevel = LOG_LEVELS[getLogLevel() as keyof typeof LOG_LEVELS] ?? 1;
  return LOG_LEVELS[level] >= currentLevel;
}

export const log = {
  debug: (...args: unknown[]): void => {
    if (shouldLog("debug")) {
      console.debug("[agentic:debug]", ...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (shouldLog("info")) {
      console.log("[agentic:info]", ...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (shouldLog("warn")) {
      console.warn("[agentic:warn]", ...args);
    }
  },
  error: (...args: unknown[]): void => {
    if (shouldLog("error")) {
      console.error("[agentic:error]", ...args);
    }
  },
};

// Initialize lazily - don't auto-init on import to avoid side effects
