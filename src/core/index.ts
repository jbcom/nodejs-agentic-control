/**
 * Core module for agentic-control
 *
 * Exports types, token management, configuration, and AI providers
 */

// Types
export * from './types.js';

// Token management
export {
    getTokenConfig,
    setTokenConfig,
    addOrganization,
    extractOrg,
    getTokenEnvVar,
    getTokenForOrg,
    getTokenForRepo,
    getPRReviewToken,
    getPRReviewTokenEnvVar,
    validateTokens,
    getOrgConfig,
    getConfiguredOrgs,
    getEnvForRepo,
    getEnvForPRReview,
    hasTokenForOrg,
    hasTokenForRepo,
    getTokenSummary,
} from './tokens.js';

// Configuration
export {
    initConfig,
    getConfig,
    getConfigPath,
    loadConfigFromPath,
    setConfig,
    resetConfig,
    getConfigValue,
    isVerbose,
    getDefaultModel,
    getFleetDefaults,
    getTriageConfig,
    getLogLevel,
    getCursorApiKey,
    getTriageApiKey,
    getDefaultApiKeyEnvVar,
    log,
    type AgenticConfig,
    type FleetConfig,
    type TriageConfig,
} from './config.js';

// AI Provider loading
export {
    loadProvider,
    getOrLoadProvider,
    clearProviderCache,
    resolveProviderOptions,
    isValidProvider,
    getSupportedProviders,
    PROVIDER_CONFIG,
    type ProviderOptions,
    type SupportedProvider,
    type ModelFactory,
} from './providers.js';
