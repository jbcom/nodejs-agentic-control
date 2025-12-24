/**
 * Configuration Management for agentic-control
 *
 * Uses cosmiconfig for standard config file discovery and loading.
 * Searches for configuration in:
 *   - agentic.config.json
 *   - agentic.config.js
 *   - agentic.config.cjs
 *   - .agenticrc
 *   - .agenticrc.json
 *   - package.json "agentic" key
 *
 * Priority: CLI args > env vars > config file > defaults
 *
 * @example Config file (agentic.config.json):
 * ```json
 * {
 *   "tokens": {
 *     "organizations": {
 *       "my-org": { "name": "my-org", "tokenEnvVar": "MY_ORG_TOKEN" }
 *     }
 *   },
 *   "defaultModel": "claude-sonnet-4-20250514",
 *   "fleet": {
 *     "autoCreatePr": true
 *   }
 * }
 * ```
 */

import { cosmiconfigSync } from 'cosmiconfig';
import { setTokenConfig } from './tokens.js';
import type { TokenConfig } from './types.js';
import { validateConfig } from './validation.js';

// ============================================
// Configuration Types
// ============================================

export interface FleetConfig {
  /** Auto-create PR when agent completes */
  autoCreatePr?: boolean;
  /** Open PR as Cursor GitHub App */
  openAsCursorGithubApp?: boolean;
  /** Skip adding user as reviewer */
  skipReviewerRequest?: boolean;
}

export interface TriageConfig {
  /** AI provider: anthropic, openai, google, mistral, azure */
  provider?: string;
  /** Model ID for the provider */
  model?: string;
  /** API key environment variable name */
  apiKeyEnvVar?: string;
}

export interface MCPServerConfig {
  /** Whether this MCP server is enabled */
  enabled?: boolean;
  /** Environment variable name for the API key/token */
  tokenEnvVar?: string;
  /** Fallback env vars to try if primary not found */
  tokenEnvVarFallbacks?: string[];
  /** Transport mode: stdio or proxy */
  mode?: 'stdio' | 'proxy';
  /** Command to run for stdio transport */
  command?: string;
  /** Arguments for the command */
  args?: string[];
  /** Proxy URL for proxy mode */
  proxyUrl?: string;
}

export interface MCPConfig {
  /** Cursor Background Agent MCP */
  cursor?: MCPServerConfig;
  /** GitHub MCP */
  github?: MCPServerConfig;
  /** Context7 documentation MCP */
  context7?: MCPServerConfig;
  /** 21st.dev Magic MCP */
  '21st-magic'?: MCPServerConfig;
  /** Custom MCP servers */
  [key: string]: MCPServerConfig | undefined;
}

export interface AgenticConfig {
  /** Token configuration for multi-org access */
  tokens?: Partial<TokenConfig>;

  /** Default repository for fleet operations */
  defaultRepository?: string;

  /** Coordination PR number for fleet communication */
  coordinationPr?: number;

  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /** Whether to enable verbose output */
  verbose?: boolean;

  /** Cursor API configuration */
  cursor?: {
    /** API key environment variable name */
    apiKeyEnvVar?: string;
    /** Base URL for Cursor API */
    baseUrl?: string;
  };

  /** Fleet default options */
  fleet?: FleetConfig;

  /** Triage (AI analysis) configuration */
  triage?: TriageConfig;

  /** MCP server configuration */
  mcp?: MCPConfig;
}

// ============================================
// Cosmiconfig Setup
// ============================================

const MODULE_NAME = 'agentic';

// Security: Only allow JSON config files to prevent code execution
// JavaScript config files could execute arbitrary code during require()
const explorer = cosmiconfigSync(MODULE_NAME, {
  searchPlaces: ['package.json', 'agentic.config.json', '.agenticrc', '.agenticrc.json'],
  // Security: Disable loaders that execute code
  loaders: {
    '.json': (_filepath: string, content: string) => JSON.parse(content),
  },
});

// ============================================
// Configuration State
// ============================================

let config: AgenticConfig = {};
let configLoaded = false;
let configPath: string | null = null;

// ============================================
// Environment Variable Loading
// ============================================

function loadEnvConfig(): Partial<AgenticConfig> {
  const envConfig: Partial<AgenticConfig> = {};

  // Build triage config from environment variables
  const triageFromEnv: Partial<TriageConfig> = {};
  if (process.env.AGENTIC_MODEL) {
    triageFromEnv.model = process.env.AGENTIC_MODEL;
  }
  if (process.env.AGENTIC_PROVIDER) {
    triageFromEnv.provider = process.env.AGENTIC_PROVIDER;
  }
  if (Object.keys(triageFromEnv).length > 0) {
    envConfig.triage = triageFromEnv;
  }

  if (process.env.AGENTIC_REPOSITORY) {
    envConfig.defaultRepository = process.env.AGENTIC_REPOSITORY;
  }

  if (process.env.AGENTIC_COORDINATION_PR) {
    const parsed = Number.parseInt(process.env.AGENTIC_COORDINATION_PR, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      envConfig.coordinationPr = parsed;
    }
  }

  if (process.env.AGENTIC_LOG_LEVEL) {
    const level = process.env.AGENTIC_LOG_LEVEL.toLowerCase();
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      envConfig.logLevel = level as AgenticConfig['logLevel'];
    }
  }

  if (process.env.AGENTIC_VERBOSE === 'true' || process.env.AGENTIC_VERBOSE === '1') {
    envConfig.verbose = true;
  }

  return envConfig;
}

// ============================================
// Configuration Loading
// ============================================

/**
 * Deep merge configuration objects
 */
function mergeConfig(base: AgenticConfig, overrides: Partial<AgenticConfig>): AgenticConfig {
  const result = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const baseValue = (base as Record<string, unknown>)[key];
      // Only spread baseValue if it's a non-null object
      const baseObj =
        typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)
          ? baseValue
          : {};
      (result as Record<string, unknown>)[key] = {
        ...baseObj,
        ...value,
      };
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}

/**
 * Initialize configuration from all sources
 * Priority: programmatic overrides > env vars > config file
 */
export function initConfig(overrides?: Partial<AgenticConfig>): AgenticConfig {
  // Search for config file using cosmiconfig
  const result = explorer.search();

  if (result && !result.isEmpty) {
    // Validate configuration before using it
    validateConfig(result.config);
    config = result.config as AgenticConfig;
    configPath = result.filepath;
  } else {
    config = {};
    configPath = null;
  }

  // Merge environment variables
  const envConfig = loadEnvConfig();
  config = mergeConfig(config, envConfig);

  // Apply programmatic overrides
  if (overrides) {
    config = mergeConfig(config, overrides);
  }

  // Validate final configuration
  validateConfig(config);

  // Apply token configuration
  if (config.tokens) {
    setTokenConfig(config.tokens);
  }

  configLoaded = true;
  return config;
}

/**
 * Load config from a specific file path
 */
export function loadConfigFromPath(filepath: string): AgenticConfig {
  const result = explorer.load(filepath);

  if (result && !result.isEmpty) {
    // Validate configuration before using it
    validateConfig(result.config);
    config = result.config as AgenticConfig;
    configPath = result.filepath;

    if (config.tokens) {
      setTokenConfig(config.tokens);
    }

    configLoaded = true;
    return config;
  }

  throw new Error(`Failed to load config from ${filepath}`);
}

// ============================================
// Public API
// ============================================

/**
 * Get the current configuration
 */
export function getConfig(): AgenticConfig {
  if (!configLoaded) {
    initConfig();
  }
  return { ...config };
}

/**
 * Get path to loaded config file
 */
export function getConfigPath(): string | null {
  return configPath;
}

/**
 * Update configuration at runtime
 */
export function setConfig(updates: Partial<AgenticConfig>): void {
  config = mergeConfig(config, updates);

  if (updates.tokens) {
    setTokenConfig(updates.tokens);
  }
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
  config = {};
  configLoaded = false;
  configPath = null;
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
 * Get triage configuration
 */
export function getTriageConfig(): TriageConfig {
  if (!configLoaded) {
    initConfig();
  }
  return (
    config.triage ?? {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    }
  );
}

/**
 * Get the default model for triage operations
 * @deprecated Use getTriageConfig() instead
 */
export function getDefaultModel(): string {
  return getTriageConfig().model ?? 'claude-sonnet-4-20250514';
}

/**
 * Get fleet defaults
 */
export function getFleetDefaults(): FleetConfig {
  if (!configLoaded) {
    initConfig();
  }
  return config.fleet ?? {};
}

/**
 * Get the log level
 */
export function getLogLevel(): string {
  return config.logLevel ?? 'info';
}

/**
 * Get Cursor API key from configured environment variable
 */
export function getCursorApiKey(): string | undefined {
  const envVar = config.cursor?.apiKeyEnvVar ?? 'CURSOR_API_KEY';
  return process.env[envVar];
}

/**
 * Get default API key env var for a provider
 */
export function getDefaultApiKeyEnvVar(provider?: string): string {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'google':
      return 'GOOGLE_API_KEY';
    case 'mistral':
      return 'MISTRAL_API_KEY';
    case 'azure':
      return 'AZURE_API_KEY';
    case 'ollama':
      return 'OLLAMA_API_KEY';
    default:
      return 'ANTHROPIC_API_KEY';
  }
}

/**
 * Get triage API key from configured environment variable
 * @param providerOverride - Optional provider to use instead of config value
 */
export function getTriageApiKey(providerOverride?: string): string | undefined {
  const triageConfig = getTriageConfig();
  const provider = providerOverride ?? triageConfig.provider;
  const envVar = triageConfig.apiKeyEnvVar ?? getDefaultApiKeyEnvVar(provider);
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
    if (shouldLog('debug')) {
      console.debug('[agentic:debug]', ...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (shouldLog('info')) {
      console.log('[agentic:info]', ...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn('[agentic:warn]', ...args);
    }
  },
  error: (...args: unknown[]): void => {
    if (shouldLog('error')) {
      console.error('[agentic:error]', ...args);
    }
  },
};
