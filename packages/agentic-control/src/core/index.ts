/**
 * Core module for agentic-control
 *
 * Exports types, token management, configuration, and AI providers
 */

// Configuration
export {
  type AgenticConfig,
  type FleetConfig,
  getConfig,
  getConfigPath,
  getConfigValue,
  getCursorApiKey,
  getDefaultApiKeyEnvVar,
  getDefaultModel,
  getFleetDefaults,
  getLogLevel,
  getTriageApiKey,
  getTriageConfig,
  initConfig,
  isVerbose,
  loadConfigFromPath,
  log,
  resetConfig,
  setConfig,
  type TriageConfig,
} from './config.js';
// Typed errors
export {
  ConfigErrorCode,
  ConfigurationError,
  DockerBuildError,
  DockerErrorCode,
  SandboxError,
  SandboxErrorCode,
} from './errors.js';
// AI Provider loading
export {
  clearProviderCache,
  getOrLoadProvider,
  getSupportedProviders,
  isValidProvider,
  loadProvider,
  type ModelFactory,
  PROVIDER_CONFIG,
  type ProviderOptions,
  resolveProviderOptions,
  type SupportedProvider,
} from './providers.js';
// Security utilities
export { createSafeError, safeConsole, sanitizeEnvironment, sanitizeError } from './security.js';
// Safe subprocess execution
export {
  safeDockerCommand,
  safeGitCommand,
  safeSpawn,
  safeSpawnSync,
  validateCommandArgs,
} from './subprocess.js';
// Token management
export {
  addOrganization,
  extractOrg,
  getConfiguredOrgs,
  getEnvForPRReview,
  getEnvForRepo,
  getOrgConfig,
  getPRReviewToken,
  getPRReviewTokenEnvVar,
  getTokenConfig,
  getTokenEnvVar,
  getTokenForOrg,
  getTokenForRepo,
  getTokenSummary,
  hasTokenForOrg,
  hasTokenForRepo,
  setTokenConfig,
  validateTokens,
} from './tokens.js';
// Types
export * from './types.js';
// Configuration validation
export {
  AgenticConfigSchema,
  validateConfig,
  validateEnvVar,
  validateEnvVarWithMessage,
  validateGitRef,
  validatePositiveInt,
  validateRepository,
} from './validation.js';
