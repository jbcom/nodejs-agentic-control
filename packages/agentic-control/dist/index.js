import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { spawnSync, spawn } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { Octokit } from '@octokit/rest';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { generateObject, generateText } from 'ai';
import '@ai-sdk/anthropic';
import '@ai-sdk/mcp';
import '@ai-sdk/mcp/mcp-stdio';
import 'simple-git';
import { createRequire } from 'module';

/* @agentic-dev-library/control - ESM Build */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/core/tokens.ts
var DEFAULT_CONFIG = {
  organizations: {},
  // Empty by default - users configure their own
  defaultTokenEnvVar: "GITHUB_TOKEN",
  prReviewTokenEnvVar: "GITHUB_TOKEN"
};
var currentConfig = { ...DEFAULT_CONFIG };
function loadEnvConfig() {
  const orgPattern = /^AGENTIC_ORG_([A-Z0-9_]+)_TOKEN$/;
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(orgPattern);
    if (match?.[1] && value) {
      const orgName = match[1].toLowerCase().replace(/_/g, "-");
      if (!currentConfig.organizations[orgName]) {
        currentConfig.organizations[orgName] = {
          name: orgName,
          tokenEnvVar: value
        };
      }
    }
  }
  if (process.env.AGENTIC_PR_REVIEW_TOKEN) {
    currentConfig.prReviewTokenEnvVar = process.env.AGENTIC_PR_REVIEW_TOKEN;
  }
  if (process.env.AGENTIC_DEFAULT_TOKEN) {
    currentConfig.defaultTokenEnvVar = process.env.AGENTIC_DEFAULT_TOKEN;
  }
}
__name(loadEnvConfig, "loadEnvConfig");
loadEnvConfig();
function getTokenConfig() {
  return { ...currentConfig };
}
__name(getTokenConfig, "getTokenConfig");
function setTokenConfig(config2) {
  currentConfig = {
    ...currentConfig,
    ...config2,
    organizations: {
      ...currentConfig.organizations,
      ...config2.organizations
    }
  };
}
__name(setTokenConfig, "setTokenConfig");
function addOrganization(org) {
  currentConfig.organizations[org.name] = org;
}
__name(addOrganization, "addOrganization");
function extractOrg(repoUrl) {
  const urlMatch = repoUrl.match(/github\.com[/:]([a-zA-Z0-9_.-]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }
  const shortMatch = repoUrl.match(/^([a-zA-Z0-9_.-]+)\//);
  if (shortMatch?.[1]) {
    return shortMatch[1];
  }
  return null;
}
__name(extractOrg, "extractOrg");
function getTokenEnvVar(org) {
  const config2 = currentConfig.organizations[org];
  if (config2?.tokenEnvVar) {
    return config2.tokenEnvVar;
  }
  const lowerOrg = org.toLowerCase();
  for (const [key, value] of Object.entries(currentConfig.organizations)) {
    if (key.toLowerCase() === lowerOrg && value.tokenEnvVar) {
      return value.tokenEnvVar;
    }
  }
  return currentConfig.defaultTokenEnvVar;
}
__name(getTokenEnvVar, "getTokenEnvVar");
function getTokenForOrg(org) {
  const envVar = getTokenEnvVar(org);
  return process.env[envVar];
}
__name(getTokenForOrg, "getTokenForOrg");
function getTokenForRepo(repoUrl) {
  const org = extractOrg(repoUrl);
  if (!org) {
    return process.env[currentConfig.defaultTokenEnvVar];
  }
  return getTokenForOrg(org);
}
__name(getTokenForRepo, "getTokenForRepo");
function getPRReviewToken() {
  return process.env[currentConfig.prReviewTokenEnvVar];
}
__name(getPRReviewToken, "getPRReviewToken");
function getPRReviewTokenEnvVar() {
  return currentConfig.prReviewTokenEnvVar;
}
__name(getPRReviewTokenEnvVar, "getPRReviewTokenEnvVar");
function validateTokens(orgs) {
  const missing = [];
  const orgsToCheck = orgs ?? Object.keys(currentConfig.organizations);
  for (const org of orgsToCheck) {
    const token = getTokenForOrg(org);
    if (!token) {
      const envVar = getTokenEnvVar(org);
      missing.push(`${org}: ${envVar} not set`);
    }
  }
  if (!getPRReviewToken()) {
    missing.push(`PR Review: ${currentConfig.prReviewTokenEnvVar} not set`);
  }
  if (!process.env[currentConfig.defaultTokenEnvVar]) {
    missing.push(`Default: ${currentConfig.defaultTokenEnvVar} not set`);
  }
  return {
    success: missing.length === 0,
    data: missing,
    error: missing.length > 0 ? `Missing tokens: ${missing.join(", ")}` : void 0
  };
}
__name(validateTokens, "validateTokens");
function getOrgConfig(org) {
  if (currentConfig.organizations[org]) {
    return currentConfig.organizations[org];
  }
  const lowerOrg = org.toLowerCase();
  for (const [key, value] of Object.entries(currentConfig.organizations)) {
    if (key.toLowerCase() === lowerOrg) {
      return value;
    }
  }
  return void 0;
}
__name(getOrgConfig, "getOrgConfig");
function getConfiguredOrgs() {
  return Object.keys(currentConfig.organizations);
}
__name(getConfiguredOrgs, "getConfiguredOrgs");
function getEnvForRepo(repoUrl) {
  const token = getTokenForRepo(repoUrl);
  if (!token) {
    return {};
  }
  return {
    GH_TOKEN: token,
    GITHUB_TOKEN: token
  };
}
__name(getEnvForRepo, "getEnvForRepo");
function getEnvForPRReview() {
  const token = getPRReviewToken();
  if (!token) {
    return {};
  }
  return {
    GH_TOKEN: token,
    GITHUB_TOKEN: token
  };
}
__name(getEnvForPRReview, "getEnvForPRReview");
function hasTokenForOrg(org) {
  return !!getTokenForOrg(org);
}
__name(hasTokenForOrg, "hasTokenForOrg");
function hasTokenForRepo(repoUrl) {
  return !!getTokenForRepo(repoUrl);
}
__name(hasTokenForRepo, "hasTokenForRepo");
function getTokenSummary() {
  const summary = {};
  for (const org of getConfiguredOrgs()) {
    const envVar = getTokenEnvVar(org);
    summary[org] = {
      envVar,
      available: !!process.env[envVar],
      configured: true
    };
  }
  summary._default = {
    envVar: currentConfig.defaultTokenEnvVar,
    available: !!process.env[currentConfig.defaultTokenEnvVar],
    configured: true
  };
  summary._pr_review = {
    envVar: currentConfig.prReviewTokenEnvVar,
    available: !!getPRReviewToken(),
    configured: true
  };
  return summary;
}
__name(getTokenSummary, "getTokenSummary");

// src/core/errors.ts
var SandboxErrorCode = /* @__PURE__ */ ((SandboxErrorCode2) => {
  SandboxErrorCode2["CONTAINER_CREATE_FAILED"] = "CONTAINER_CREATE_FAILED";
  SandboxErrorCode2["CONTAINER_START_FAILED"] = "CONTAINER_START_FAILED";
  SandboxErrorCode2["EXECUTION_TIMEOUT"] = "EXECUTION_TIMEOUT";
  SandboxErrorCode2["MEMORY_LIMIT_EXCEEDED"] = "MEMORY_LIMIT_EXCEEDED";
  SandboxErrorCode2["WORKSPACE_MOUNT_FAILED"] = "WORKSPACE_MOUNT_FAILED";
  SandboxErrorCode2["OUTPUT_EXTRACTION_FAILED"] = "OUTPUT_EXTRACTION_FAILED";
  SandboxErrorCode2["RUNTIME_NOT_FOUND"] = "RUNTIME_NOT_FOUND";
  return SandboxErrorCode2;
})(SandboxErrorCode || {});
var SandboxError = class extends Error {
  constructor(message, code, containerId, cause) {
    super(message);
    this.code = code;
    this.containerId = containerId;
    this.cause = cause;
    this.name = "SandboxError";
  }
  static {
    __name(this, "SandboxError");
  }
};
var DockerErrorCode = /* @__PURE__ */ ((DockerErrorCode2) => {
  DockerErrorCode2["BUILD_FAILED"] = "BUILD_FAILED";
  DockerErrorCode2["PUSH_FAILED"] = "PUSH_FAILED";
  DockerErrorCode2["PLATFORM_NOT_SUPPORTED"] = "PLATFORM_NOT_SUPPORTED";
  DockerErrorCode2["REGISTRY_AUTH_FAILED"] = "REGISTRY_AUTH_FAILED";
  return DockerErrorCode2;
})(DockerErrorCode || {});
var DockerBuildError = class extends Error {
  constructor(message, code, dockerfile, cause) {
    super(message);
    this.code = code;
    this.dockerfile = dockerfile;
    this.cause = cause;
    this.name = "DockerBuildError";
  }
  static {
    __name(this, "DockerBuildError");
  }
};
var ConfigErrorCode = /* @__PURE__ */ ((ConfigErrorCode2) => {
  ConfigErrorCode2["INVALID_SCHEMA"] = "INVALID_SCHEMA";
  ConfigErrorCode2["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
  ConfigErrorCode2["INVALID_VALUE"] = "INVALID_VALUE";
  ConfigErrorCode2["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
  return ConfigErrorCode2;
})(ConfigErrorCode || {});
var ConfigurationError = class extends Error {
  constructor(message, code, field, cause) {
    super(message);
    this.code = code;
    this.field = field;
    this.cause = cause;
    this.name = "ConfigurationError";
  }
  static {
    __name(this, "ConfigurationError");
  }
};

// src/core/validation.ts
var TokenOrgSchema = z.object({
  name: z.string().min(1).max(39),
  tokenEnvVar: z.string().min(1)
});
var TokenConfigSchema = z.object({
  organizations: z.record(z.string(), TokenOrgSchema).optional(),
  defaultTokenEnvVar: z.string().optional(),
  prReviewTokenEnvVar: z.string().optional()
});
var FleetConfigSchema = z.object({
  autoCreatePr: z.boolean().optional(),
  openAsCursorGithubApp: z.boolean().optional(),
  skipReviewerRequest: z.boolean().optional()
});
var TriageConfigSchema = z.object({
  provider: z.enum(["anthropic", "openai", "google", "mistral", "azure"]).optional(),
  model: z.string().optional(),
  apiKeyEnvVar: z.string().optional()
});
var MCPServerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  tokenEnvVar: z.string().optional(),
  tokenEnvVarFallbacks: z.array(z.string()).optional(),
  mode: z.enum(["stdio", "proxy"]).optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  proxyUrl: z.string().url().optional()
});
var MCPConfigSchema = z.object({
  cursor: MCPServerConfigSchema.optional(),
  github: MCPServerConfigSchema.optional(),
  context7: MCPServerConfigSchema.optional(),
  "21st-magic": MCPServerConfigSchema.optional()
}).catchall(MCPServerConfigSchema);
var CursorConfigSchema = z.object({
  apiKeyEnvVar: z.string().optional(),
  baseUrl: z.string().url().optional()
});
var AgenticConfigSchema = z.object({
  tokens: TokenConfigSchema.optional(),
  defaultRepository: z.string().optional(),
  coordinationPr: z.number().int().positive().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).optional(),
  verbose: z.boolean().optional(),
  cursor: CursorConfigSchema.optional(),
  fleet: FleetConfigSchema.optional(),
  triage: TriageConfigSchema.optional(),
  mcp: MCPConfigSchema.optional()
});
function validateConfig(config2) {
  try {
    AgenticConfigSchema.parse(config2);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      if (firstIssue) {
        const field = firstIssue.path.join(".");
        const message = `Invalid configuration at '${field}': ${firstIssue.message}`;
        throw new ConfigurationError(message, "INVALID_SCHEMA" /* INVALID_SCHEMA */, field);
      }
      throw new ConfigurationError("Invalid configuration", "INVALID_SCHEMA" /* INVALID_SCHEMA */);
    }
    throw error;
  }
}
__name(validateConfig, "validateConfig");
function validateEnvVar(envVar, description) {
  const value = process.env[envVar];
  if (!value || value.trim() === "") {
    const desc = description ?? envVar;
    throw new ConfigurationError(
      `Missing required environment variable: ${envVar}. Please set ${desc} to continue.`,
      "MISSING_REQUIRED_FIELD" /* MISSING_REQUIRED_FIELD */,
      envVar
    );
  }
  return value.trim();
}
__name(validateEnvVar, "validateEnvVar");
function validateEnvVarWithMessage(envVar, purpose) {
  const value = process.env[envVar];
  if (!value || value.trim() === "") {
    throw new ConfigurationError(
      `${purpose} requires ${envVar} environment variable. Please set it and try again.`,
      "MISSING_REQUIRED_FIELD" /* MISSING_REQUIRED_FIELD */,
      envVar
    );
  }
  return value.trim();
}
__name(validateEnvVarWithMessage, "validateEnvVarWithMessage");
function validateRepository(repo) {
  const repoPattern = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
  if (!repoPattern.test(repo)) {
    throw new ConfigurationError(
      `Invalid repository format: ${repo}. Expected format: owner/repo`,
      "INVALID_VALUE" /* INVALID_VALUE */,
      "repository"
    );
  }
}
__name(validateRepository, "validateRepository");
function validateGitRef(ref) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(ref)) {
    throw new ConfigurationError(
      `Invalid git reference format: ${ref}`,
      "INVALID_VALUE" /* INVALID_VALUE */,
      "gitRef"
    );
  }
  if (ref.length > 200) {
    throw new ConfigurationError(
      `Git reference too long: ${ref} (max 200 characters)`,
      "INVALID_VALUE" /* INVALID_VALUE */,
      "gitRef"
    );
  }
}
__name(validateGitRef, "validateGitRef");
function validatePositiveInt(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new ConfigurationError(
      `${field} must be a positive integer, got: ${value}`,
      "INVALID_VALUE" /* INVALID_VALUE */,
      field
    );
  }
  return parsed;
}
__name(validatePositiveInt, "validatePositiveInt");

// src/core/config.ts
var MODULE_NAME = "agentic";
var explorer = cosmiconfigSync(MODULE_NAME, {
  searchPlaces: ["package.json", "agentic.config.json", ".agenticrc", ".agenticrc.json"],
  // Security: Disable loaders that execute code
  loaders: {
    ".json": /* @__PURE__ */ __name((_filepath, content) => JSON.parse(content), ".json")
  }
});
var config = {};
var configLoaded = false;
var configPath = null;
function loadEnvConfig2() {
  const envConfig = {};
  const triageFromEnv = {};
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
    if (["debug", "info", "warn", "error"].includes(level)) {
      envConfig.logLevel = level;
    }
  }
  if (process.env.AGENTIC_VERBOSE === "true" || process.env.AGENTIC_VERBOSE === "1") {
    envConfig.verbose = true;
  }
  return envConfig;
}
__name(loadEnvConfig2, "loadEnvConfig");
function mergeConfig(base, overrides) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === void 0) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const baseValue = base[key];
      const baseObj = typeof baseValue === "object" && baseValue !== null && !Array.isArray(baseValue) ? baseValue : {};
      result[key] = {
        ...baseObj,
        ...value
      };
    } else {
      result[key] = value;
    }
  }
  return result;
}
__name(mergeConfig, "mergeConfig");
function initConfig(overrides) {
  const result = explorer.search();
  if (result && !result.isEmpty) {
    validateConfig(result.config);
    config = result.config;
    configPath = result.filepath;
  } else {
    config = {};
    configPath = null;
  }
  const envConfig = loadEnvConfig2();
  config = mergeConfig(config, envConfig);
  if (overrides) {
    config = mergeConfig(config, overrides);
  }
  validateConfig(config);
  if (config.tokens) {
    setTokenConfig(config.tokens);
  }
  configLoaded = true;
  return config;
}
__name(initConfig, "initConfig");
function loadConfigFromPath(filepath) {
  const result = explorer.load(filepath);
  if (result && !result.isEmpty) {
    validateConfig(result.config);
    config = result.config;
    configPath = result.filepath;
    if (config.tokens) {
      setTokenConfig(config.tokens);
    }
    configLoaded = true;
    return config;
  }
  throw new Error(`Failed to load config from ${filepath}`);
}
__name(loadConfigFromPath, "loadConfigFromPath");
function getConfig() {
  if (!configLoaded) {
    initConfig();
  }
  return { ...config };
}
__name(getConfig, "getConfig");
function getConfigPath() {
  return configPath;
}
__name(getConfigPath, "getConfigPath");
function setConfig(updates) {
  config = mergeConfig(config, updates);
  if (updates.tokens) {
    setTokenConfig(updates.tokens);
  }
}
__name(setConfig, "setConfig");
function resetConfig() {
  config = {};
  configLoaded = false;
  configPath = null;
}
__name(resetConfig, "resetConfig");
function getConfigValue(key) {
  if (!configLoaded) {
    initConfig();
  }
  return config[key];
}
__name(getConfigValue, "getConfigValue");
function isVerbose() {
  return config.verbose ?? false;
}
__name(isVerbose, "isVerbose");
function getTriageConfig() {
  if (!configLoaded) {
    initConfig();
  }
  return config.triage ?? {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKeyEnvVar: "ANTHROPIC_API_KEY"
  };
}
__name(getTriageConfig, "getTriageConfig");
function getDefaultModel() {
  return getTriageConfig().model ?? "claude-sonnet-4-20250514";
}
__name(getDefaultModel, "getDefaultModel");
function getFleetDefaults() {
  if (!configLoaded) {
    initConfig();
  }
  return config.fleet ?? {};
}
__name(getFleetDefaults, "getFleetDefaults");
function getLogLevel() {
  return config.logLevel ?? "info";
}
__name(getLogLevel, "getLogLevel");
function getCursorApiKey() {
  const envVar = config.cursor?.apiKeyEnvVar ?? "CURSOR_API_KEY";
  return process.env[envVar];
}
__name(getCursorApiKey, "getCursorApiKey");
function getDefaultApiKeyEnvVar(provider) {
  switch (provider) {
    case "openai":
      return "OPENAI_API_KEY";
    case "google":
      return "GOOGLE_API_KEY";
    case "mistral":
      return "MISTRAL_API_KEY";
    case "azure":
      return "AZURE_API_KEY";
    case "ollama":
      return "OLLAMA_API_KEY";
    default:
      return "ANTHROPIC_API_KEY";
  }
}
__name(getDefaultApiKeyEnvVar, "getDefaultApiKeyEnvVar");
function getTriageApiKey(providerOverride) {
  const triageConfig = getTriageConfig();
  const provider = providerOverride ?? triageConfig.provider;
  const envVar = triageConfig.apiKeyEnvVar ?? getDefaultApiKeyEnvVar(provider);
  return process.env[envVar];
}
__name(getTriageApiKey, "getTriageApiKey");
var LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
function shouldLog(level) {
  const currentLevel = LOG_LEVELS[getLogLevel()] ?? 1;
  return LOG_LEVELS[level] >= currentLevel;
}
__name(shouldLog, "shouldLog");
var log = {
  debug: /* @__PURE__ */ __name((...args) => {
    if (shouldLog("debug")) {
      console.debug("[agentic:debug]", ...args);
    }
  }, "debug"),
  info: /* @__PURE__ */ __name((...args) => {
    if (shouldLog("info")) {
      console.log("[agentic:info]", ...args);
    }
  }, "info"),
  warn: /* @__PURE__ */ __name((...args) => {
    if (shouldLog("warn")) {
      console.warn("[agentic:warn]", ...args);
    }
  }, "warn"),
  error: /* @__PURE__ */ __name((...args) => {
    if (shouldLog("error")) {
      console.error("[agentic:error]", ...args);
    }
  }, "error")
};

// src/core/providers.ts
var PROVIDER_CONFIG = {
  anthropic: { package: "@ai-sdk/anthropic", factory: "createAnthropic" },
  openai: { package: "@ai-sdk/openai", factory: "createOpenAI" },
  google: { package: "@ai-sdk/google", factory: "createGoogleGenerativeAI" },
  mistral: { package: "@ai-sdk/mistral", factory: "createMistral" },
  azure: { package: "@ai-sdk/azure", factory: "createAzure" },
  ollama: { package: "ai-sdk-ollama", factory: "createOllama" }
};
var OLLAMA_CONFIG = {
  /** Default model for Ollama Cloud (qwen3-coder has excellent tool support) */
  defaultModel: "qwen3-coder:480b-cloud",
  /** Ollama Cloud API URL (SDK appends /api paths automatically) */
  cloudHost: "https://ollama.com",
  /** Local Ollama API URL (SDK appends /api paths automatically) */
  localHost: "http://localhost:11434",
  /** Enable reliable object generation with automatic JSON repair (v3.0.0+) */
  reliableObjectGeneration: true,
  /** Object generation options for better reliability */
  objectGenerationOptions: {
    /** Enable automatic JSON repair for malformed outputs */
    enableTextRepair: true,
    /** Maximum retries for object generation */
    maxRetries: 3
  }
};
function isValidProvider(name) {
  return name in PROVIDER_CONFIG;
}
__name(isValidProvider, "isValidProvider");
function getSupportedProviders() {
  return Object.keys(PROVIDER_CONFIG);
}
__name(getSupportedProviders, "getSupportedProviders");
async function loadProvider(providerName, apiKey) {
  if (!isValidProvider(providerName)) {
    throw new Error(
      `Unknown provider: ${providerName}
Supported providers: ${getSupportedProviders().join(", ")}`
    );
  }
  const config2 = PROVIDER_CONFIG[providerName];
  try {
    let module;
    switch (providerName) {
      case "anthropic":
        module = await import('@ai-sdk/anthropic');
        break;
      case "openai":
        module = await import('@ai-sdk/openai');
        break;
      case "google":
        module = await import('@ai-sdk/google');
        break;
      case "mistral":
        module = await import('@ai-sdk/mistral');
        break;
      case "azure":
        module = await import('@ai-sdk/azure');
        break;
      case "ollama":
        module = await import('ai-sdk-ollama');
        break;
      default:
        throw new Error(`Provider ${providerName} not implemented`);
    }
    const factory = module[config2.factory];
    if (typeof factory !== "function") {
      throw new Error(`Factory ${config2.factory} not found in ${config2.package}`);
    }
    if (providerName === "ollama") {
      const host = process.env.OLLAMA_HOST || (apiKey ? OLLAMA_CONFIG.cloudHost : OLLAMA_CONFIG.localHost);
      const normalizedHost = host.replace(/\/api\/?$/, "").replace(/\/$/, "");
      const provider2 = factory({
        baseURL: normalizedHost,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : void 0
      });
      return (model) => provider2(model, {
        // Enable reliable object generation with automatic JSON repair
        reliableObjectGeneration: OLLAMA_CONFIG.reliableObjectGeneration,
        objectGenerationOptions: OLLAMA_CONFIG.objectGenerationOptions
      });
    }
    const provider = factory({ apiKey });
    return (model) => provider(model);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        `Provider package not installed: ${config2.package}
Install it with: pnpm add ${config2.package}`
      );
    }
    throw err;
  }
}
__name(loadProvider, "loadProvider");
var providerCache = /* @__PURE__ */ new Map();
async function getOrLoadProvider(providerName, apiKey) {
  const cacheKey = `${providerName}:${apiKey.slice(0, 8)}`;
  let provider = providerCache.get(cacheKey);
  if (!provider) {
    provider = await loadProvider(providerName, apiKey);
    providerCache.set(cacheKey, provider);
  }
  return provider;
}
__name(getOrLoadProvider, "getOrLoadProvider");
function clearProviderCache() {
  providerCache.clear();
}
__name(clearProviderCache, "clearProviderCache");
function resolveProviderOptions(options = {}) {
  const triageConfig = getTriageConfig();
  const providerName = options.provider ?? triageConfig.provider ?? "anthropic";
  const model = options.model ?? triageConfig.model ?? "claude-sonnet-4-20250514";
  const effectiveProvider = options.provider ?? triageConfig.provider ?? "anthropic";
  const envVarName = options.provider && options.provider !== triageConfig.provider ? getDefaultApiKeyEnvVar(effectiveProvider) : triageConfig.apiKeyEnvVar ?? getDefaultApiKeyEnvVar(effectiveProvider);
  const apiKey = options.apiKey ?? process.env[envVarName] ?? "";
  if (!apiKey) {
    const hint = getDefaultApiKeyEnvVar(effectiveProvider);
    throw new Error(
      `API key required for ${providerName} provider.
Set ${hint} environment variable or pass apiKey option.`
    );
  }
  return { providerName, model, apiKey };
}
__name(resolveProviderOptions, "resolveProviderOptions");

// src/core/security.ts
function sanitizeError(error) {
  const message = error instanceof Error ? error.message : error;
  const tokenPatterns = [
    // GitHub tokens: ghp_, gho_, ghu_, ghs_, ghr_
    /gh[pous]_[A-Za-z0-9_]{36,}/g,
    // GitHub fine-grained tokens: github_pat_
    /github_pat_[A-Za-z0-9_]{82}/g,
    // Anthropic API keys: sk-ant-
    /sk-ant-[A-Za-z0-9_-]{95,}/g,
    // OpenAI API keys: sk-
    /sk-[A-Za-z0-9]{48,}/g,
    // Generic API key patterns
    /[A-Za-z0-9_-]{32,}/g
  ];
  let sanitized = message;
  for (const pattern of tokenPatterns) {
    sanitized = sanitized.replace(pattern, "[REDACTED_TOKEN]");
  }
  return sanitized;
}
__name(sanitizeError, "sanitizeError");
function sanitizeEnvironment(env) {
  const sanitized = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === void 0) {
      sanitized[key] = "undefined";
    } else if (key.toLowerCase().includes("token") || key.toLowerCase().includes("key") || key.toLowerCase().includes("secret")) {
      sanitized[key] = value ? "[REDACTED]" : "(not set)";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
__name(sanitizeEnvironment, "sanitizeEnvironment");
function createSafeError(message, originalError) {
  const sanitizedMessage = sanitizeError(message);
  const error = new Error(sanitizedMessage);
  if (originalError) {
    error.cause = new Error(sanitizeError(originalError.message));
    error.stack = originalError.stack ? sanitizeError(originalError.stack) : void 0;
  }
  return error;
}
__name(createSafeError, "createSafeError");
var safeConsole = {
  log: /* @__PURE__ */ __name((message, ...args) => {
    console.log(
      sanitizeError(message),
      ...args.map((arg) => typeof arg === "string" ? sanitizeError(arg) : arg)
    );
  }, "log"),
  error: /* @__PURE__ */ __name((message, ...args) => {
    console.error(
      sanitizeError(message),
      ...args.map((arg) => typeof arg === "string" ? sanitizeError(arg) : arg)
    );
  }, "error"),
  warn: /* @__PURE__ */ __name((message, ...args) => {
    console.warn(
      sanitizeError(message),
      ...args.map((arg) => typeof arg === "string" ? sanitizeError(arg) : arg)
    );
  }, "warn")
};
function safeSpawnSync(command, args = [], options = {}) {
  if (typeof command !== "string" || command.trim() === "") {
    throw new Error("Command must be a non-empty string");
  }
  if (!Array.isArray(args)) {
    throw new Error("Arguments must be an array");
  }
  const safeOptions = {
    ...options,
    shell: false,
    // Explicitly disable shell to prevent injection
    encoding: "utf-8"
  };
  try {
    const result = spawnSync(command, args, safeOptions);
    return {
      success: result.status === 0,
      stdout: result.stdout?.toString() ?? "",
      stderr: result.stderr?.toString() ?? "",
      code: result.status
    };
  } catch (error) {
    const sanitizedError = sanitizeError(error instanceof Error ? error.message : String(error));
    throw new Error(`Command execution failed: ${sanitizedError}`);
  }
}
__name(safeSpawnSync, "safeSpawnSync");
function safeSpawn(command, args = [], options = {}) {
  return new Promise((resolve2, reject) => {
    if (typeof command !== "string" || command.trim() === "") {
      reject(new Error("Command must be a non-empty string"));
      return;
    }
    if (!Array.isArray(args)) {
      reject(new Error("Arguments must be an array"));
      return;
    }
    const safeOptions = {
      ...options,
      shell: false
      // Explicitly disable shell to prevent injection
    };
    const child = spawn(command, args, safeOptions);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      resolve2({
        success: code === 0,
        stdout,
        stderr,
        code
      });
    });
    child.on("error", (error) => {
      const sanitizedError = sanitizeError(error.message);
      reject(new Error(`Command execution failed: ${sanitizedError}`));
    });
  });
}
__name(safeSpawn, "safeSpawn");
function validateCommandArgs(args) {
  for (const arg of args) {
    if (typeof arg !== "string") {
      throw new Error("All command arguments must be strings");
    }
    if (arg.includes("\n") || arg.includes("\r")) {
      throw new Error("Command arguments cannot contain newline characters");
    }
    if (arg.includes("\0")) {
      throw new Error("Command arguments cannot contain null bytes");
    }
  }
}
__name(validateCommandArgs, "validateCommandArgs");
function safeGitCommand(args, options = {}) {
  validateCommandArgs(args);
  const allowedGitCommands = [
    "diff",
    "log",
    "show",
    "status",
    "branch",
    "remote",
    "config",
    "rev-parse",
    "ls-remote",
    "fetch",
    "pull",
    "push",
    "clone",
    "checkout",
    "merge",
    "rebase",
    "commit",
    "add",
    "reset"
  ];
  const firstArg = args[0];
  if (!firstArg || !allowedGitCommands.includes(firstArg)) {
    throw new Error(`Git command not allowed: ${firstArg ?? "(empty)"}`);
  }
  return safeSpawnSync("git", args, options);
}
__name(safeGitCommand, "safeGitCommand");
function safeDockerCommand(args, options = {}) {
  validateCommandArgs(args);
  const allowedDockerCommands = [
    "build",
    "run",
    "exec",
    "ps",
    "images",
    "pull",
    "push",
    "start",
    "stop",
    "restart",
    "rm",
    "rmi",
    "logs",
    "inspect",
    "create",
    "cp",
    "stats",
    "top",
    "version",
    "info"
  ];
  const firstArg = args[0];
  if (!firstArg || !allowedDockerCommands.includes(firstArg)) {
    throw new Error(`Docker command not allowed: ${firstArg ?? "(empty)"}`);
  }
  return safeSpawnSync("docker", args, options);
}
__name(safeDockerCommand, "safeDockerCommand");

// src/fleet/cursor-api.ts
var DEFAULT_BASE_URL = "https://api.cursor.com/v0";
var RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
var DEFAULT_MAX_RETRIES = 3;
var DEFAULT_RETRY_DELAY = 1e3;
var AGENT_ID_PATTERN = /^[a-zA-Z0-9-]+$/;
var MAX_PROMPT_LENGTH = 1e5;
var MAX_REPO_LENGTH = 200;
function validateAgentId(agentId) {
  if (!agentId || typeof agentId !== "string") {
    throw new Error("Agent ID is required and must be a string");
  }
  if (agentId.length > 100) {
    throw new Error("Agent ID exceeds maximum length (100 characters)");
  }
  if (!AGENT_ID_PATTERN.test(agentId)) {
    throw new Error("Agent ID contains invalid characters (only alphanumeric and hyphens allowed)");
  }
}
__name(validateAgentId, "validateAgentId");
function validatePromptText(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Prompt text is required and must be a string");
  }
  if (text.trim().length === 0) {
    throw new Error("Prompt text cannot be empty");
  }
  if (text.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt text exceeds maximum length (${MAX_PROMPT_LENGTH} characters)`);
  }
}
__name(validatePromptText, "validatePromptText");
function validateRepository2(repository) {
  if (!repository || typeof repository !== "string") {
    throw new Error("Repository is required and must be a string");
  }
  if (repository.length > MAX_REPO_LENGTH) {
    throw new Error(`Repository name exceeds maximum length (${MAX_REPO_LENGTH} characters)`);
  }
  if (!repository.includes("/")) {
    throw new Error("Repository must be in format 'owner/repo' or a valid URL");
  }
}
__name(validateRepository2, "validateRepository");
function validateWebhookUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("Webhook URL is required and must be a string");
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Webhook URL is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS protocol");
  }
  const hostname = parsed.hostname.toLowerCase();
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^\[::1\]$/,
    /^\[fc/i,
    /^\[fd/i,
    /^\[fe80:/i,
    /^metadata\./i,
    /^internal\./i,
    /\.local$/i,
    /\.internal$/i
  ];
  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error("Webhook URL cannot point to internal/private addresses");
    }
  }
  if (hostname === "169.254.169.254" || hostname.includes("metadata.google")) {
    throw new Error("Webhook URL cannot point to cloud metadata services");
  }
}
__name(validateWebhookUrl, "validateWebhookUrl");
function sanitizeError2(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED]").replace(/api[_-]?key[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, "api_key=[REDACTED]").replace(/token[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, "token=[REDACTED]");
}
__name(sanitizeError2, "sanitizeError");
var CursorAPI = class {
  static {
    __name(this, "CursorAPI");
  }
  apiKey;
  timeout;
  baseUrl;
  maxRetries;
  retryDelay;
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.CURSOR_API_KEY ?? "";
    this.timeout = options.timeout ?? 6e4;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;
    if (!this.apiKey) {
      throw new Error("CURSOR_API_KEY is required. Set it in environment or pass to constructor.");
    }
  }
  /**
   * Check if API key is available
   */
  static isAvailable() {
    return !!process.env.CURSOR_API_KEY;
  }
  async request(endpoint, method = "GET", body, attempt = 0) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : void 0,
        signal: controller.signal
      });
      if (!response.ok) {
        if (attempt < this.maxRetries && RETRYABLE_STATUS_CODES.includes(response.status)) {
          const delay = this.retryDelay * 2 ** attempt;
          log.warn(
            `API Error ${response.status} on ${method} ${endpoint}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${this.maxRetries})`
          );
          await new Promise((resolve2) => setTimeout(resolve2, delay));
          return this.request(endpoint, method, body, attempt + 1);
        }
        const errorText = await response.text();
        let details;
        try {
          const parsed = JSON.parse(errorText);
          details = parsed.message || parsed.error || "Unknown API error";
        } catch {
          details = sanitizeError2(errorText);
        }
        return {
          success: false,
          error: `API Error ${response.status}: ${details}`
        };
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { success: true, data: {} };
      }
      const text = await response.text();
      if (!text || text.trim() === "") {
        return { success: true, data: {} };
      }
      try {
        const data = JSON.parse(text);
        return { success: true, data };
      } catch {
        return {
          success: false,
          error: "Invalid JSON response from API"
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * 2 ** attempt;
          log.warn(
            `Request timeout on ${method} ${endpoint}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${this.maxRetries})`
          );
          await new Promise((resolve2) => setTimeout(resolve2, delay));
          return this.request(endpoint, method, body, attempt + 1);
        }
        return { success: false, error: `Request timeout after ${this.timeout}ms` };
      }
      if (attempt < this.maxRetries && (error instanceof TypeError || error instanceof Error && (error.message.includes("network") || error.message.includes("fetch") || error.message.includes("connection")))) {
        const delay = this.retryDelay * 2 ** attempt;
        log.warn(
          `Network error on ${method} ${endpoint}: ${sanitizeError2(error)}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${this.maxRetries})`
        );
        await new Promise((resolve2) => setTimeout(resolve2, delay));
        return this.request(endpoint, method, body, attempt + 1);
      }
      return { success: false, error: sanitizeError2(error) };
    } finally {
      clearTimeout(timeoutId);
    }
  }
  /**
   * List all agents
   */
  async listAgents() {
    const result = await this.request("/agents");
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.agents ?? [] };
  }
  /**
   * Get status of a specific agent
   */
  async getAgentStatus(agentId) {
    validateAgentId(agentId);
    const encodedId = encodeURIComponent(agentId);
    return this.request(`/agents/${encodedId}`);
  }
  /**
   * Get conversation history for an agent
   */
  async getAgentConversation(agentId) {
    validateAgentId(agentId);
    const encodedId = encodeURIComponent(agentId);
    return this.request(`/agents/${encodedId}/conversation`);
  }
  /**
   * Launch a new agent
   *
   * API Spec: https://cursor.com/docs/cloud-agent/api/endpoints
   */
  async launchAgent(options) {
    validatePromptText(options.prompt.text);
    validateRepository2(options.source.repository);
    if (options.source.ref !== void 0) {
      if (typeof options.source.ref !== "string" || options.source.ref.length > 200) {
        throw new Error("Invalid ref: must be a string under 200 characters");
      }
    }
    if (options.webhook?.url) {
      validateWebhookUrl(options.webhook.url);
    }
    return this.request("/agents", "POST", options);
  }
  /**
   * Send a follow-up message to an agent
   */
  async addFollowup(agentId, prompt) {
    validateAgentId(agentId);
    validatePromptText(prompt.text);
    const encodedId = encodeURIComponent(agentId);
    return this.request(`/agents/${encodedId}/followup`, "POST", { prompt });
  }
  /**
   * List available repositories
   */
  async listRepositories() {
    const result = await this.request("/repositories");
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.repositories ?? [] };
  }
  /**
   * List available models
   *
   * API Spec: https://cursor.com/docs/cloud-agent/api/endpoints#list-models
   */
  async listModels() {
    const result = await this.request("/models");
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.models ?? [] };
  }
};
var octokitCache = /* @__PURE__ */ new Map();
function getOctokit(token) {
  let octokit = octokitCache.get(token);
  if (!octokit) {
    octokit = new Octokit({ auth: token });
    octokitCache.set(token, octokit);
  }
  return octokit;
}
__name(getOctokit, "getOctokit");
var GitHubClient = class _GitHubClient {
  static {
    __name(this, "GitHubClient");
  }
  token;
  owner;
  repo;
  /**
   * Create a new GitHubClient.
   *
   * Can be used in two modes:
   * 1. With explicit config: new GitHubClient({ token, owner, repo })
   * 2. Token-aware mode: new GitHubClient() - uses token based on repo
   */
  constructor(config2 = {}) {
    this.token = config2.token ?? null;
    this.owner = config2.owner ?? null;
    this.repo = config2.repo ?? null;
  }
  // ============================================
  // Token Management (Static Methods)
  // ============================================
  /**
   * Get an Octokit instance for a repository.
   * Automatically selects the correct token based on org.
   */
  static forRepo(repoUrl) {
    const token = getTokenForRepo(repoUrl);
    if (!token) {
      log.warn(`No token available for repo: ${repoUrl}`);
      return null;
    }
    return getOctokit(token);
  }
  /**
   * Get an Octokit instance for PR review operations.
   * Always uses the consistent PR review identity.
   */
  static forPRReview() {
    const token = getPRReviewToken();
    if (!token) {
      log.warn("No PR review token available");
      return null;
    }
    return getOctokit(token);
  }
  // ============================================
  // Instance Helpers
  // ============================================
  getOctokitInstance() {
    if (this.token) {
      return getOctokit(this.token);
    }
    if (this.owner && this.repo) {
      const octokit = _GitHubClient.forRepo(`${this.owner}/${this.repo}`);
      if (!octokit) {
        throw new Error(`No token available for ${this.owner}/${this.repo}`);
      }
      return octokit;
    }
    throw new Error("GitHubClient requires either token or owner/repo");
  }
  ensureRepo() {
    if (!this.owner || !this.repo) {
      throw new Error("owner and repo are required for this operation");
    }
    return { owner: this.owner, repo: this.repo };
  }
  // ============================================
  // Repository Operations (Static)
  // ============================================
  /**
   * Get repository information
   */
  static async getRepo(owner, repo) {
    const octokit = _GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: "No token available for this repository" };
    }
    try {
      const { data } = await octokit.repos.get({ owner, repo });
      return {
        success: true,
        data: {
          owner: data.owner.login,
          name: data.name,
          fullName: data.full_name,
          defaultBranch: data.default_branch,
          isPrivate: data.private,
          url: data.html_url
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  /**
   * List repositories for an organization
   */
  static async listOrgRepos(org, options) {
    const octokit = _GitHubClient.forRepo(`${org}/any`);
    if (!octokit) {
      return { success: false, error: `No token available for org: ${org}` };
    }
    try {
      const { data } = await octokit.repos.listForOrg({
        org,
        type: options?.type ?? "all",
        per_page: options?.perPage ?? 100
      });
      return {
        success: true,
        data: data.map((r) => ({
          owner: r.owner.login,
          name: r.name,
          fullName: r.full_name,
          defaultBranch: r.default_branch ?? "main",
          isPrivate: r.private,
          url: r.html_url
        }))
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  // ============================================
  // Pull Request Operations
  // ============================================
  /**
   * Get pull request information (static version)
   */
  static async getPRStatic(owner, repo, prNumber) {
    const octokit = _GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: "No token available for this repository" };
    }
    try {
      const { data } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
      return {
        success: true,
        data: {
          number: data.number,
          title: data.title,
          body: data.body ?? void 0,
          state: data.state,
          draft: data.draft ?? false,
          url: data.html_url,
          headBranch: data.head.ref,
          baseBranch: data.base.ref,
          author: data.user?.login ?? "unknown"
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  /**
   * Get pull request (instance version with full data)
   */
  async getPR(prNumber) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });
    return data;
  }
  /**
   * Get files changed in a PR
   */
  async getPRFiles(prNumber) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    });
    return data;
  }
  /**
   * Create a pull request
   */
  static async createPR(owner, repo, options) {
    const octokit = _GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: "No token available for this repository" };
    }
    try {
      const { data } = await octokit.pulls.create({
        owner,
        repo,
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base,
        draft: options.draft
      });
      return {
        success: true,
        data: {
          number: data.number,
          title: data.title,
          body: data.body ?? void 0,
          state: data.state,
          draft: data.draft ?? false,
          url: data.html_url,
          headBranch: data.head.ref,
          baseBranch: data.base.ref,
          author: data.user?.login ?? "unknown"
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  /**
   * Merge a pull request
   */
  static async mergePRStatic(owner, repo, prNumber, options) {
    const octokit = _GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: "No token available for this repository" };
    }
    try {
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: options?.mergeMethod ?? "squash",
        commit_title: options?.commitTitle,
        commit_message: options?.commitMessage
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  /**
   * Merge a pull request (instance version)
   */
  async mergePR(prNumber, method = "squash") {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: method
    });
    return data;
  }
  // ============================================
  // Reviews and Comments
  // ============================================
  /**
   * Get reviews on a PR
   */
  async getReviews(prNumber) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber
    });
    return data;
  }
  /**
   * Get review comments on a PR
   */
  async getReviewComments(prNumber) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber
    });
    return data;
  }
  /**
   * Get issue comments on a PR
   */
  async getIssueComments(prNumber) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber
    });
    return data;
  }
  /**
   * List PR comments (static version)
   */
  static async listPRComments(owner, repo, prNumber) {
    const octokit = _GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: "No token available for this repository" };
    }
    try {
      const { data } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100
      });
      return {
        success: true,
        data: data.map((c) => ({
          id: c.id,
          body: c.body ?? "",
          author: c.user?.login ?? "unknown",
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }))
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  /**
   * Post a PR comment (ALWAYS uses PR review identity)
   */
  static async postPRComment(owner, repo, prNumber, body) {
    const octokit = _GitHubClient.forPRReview();
    if (!octokit) {
      return { success: false, error: "No PR review token available" };
    }
    try {
      const { data } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body
      });
      return {
        success: true,
        data: {
          id: data.id,
          body: data.body ?? "",
          author: data.user?.login ?? "unknown",
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  /**
   * Post a comment (instance version)
   */
  async postComment(prNumber, body) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });
    return data;
  }
  /**
   * Reply to a review comment
   */
  async replyToComment(prNumber, commentId, body) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      comment_id: commentId,
      body
    });
    return data;
  }
  /**
   * Request a review on a PR (ALWAYS uses PR review identity)
   */
  static async requestReview(owner, repo, prNumber, reviewers) {
    const octokit = _GitHubClient.forPRReview();
    if (!octokit) {
      return { success: false, error: "No PR review token available" };
    }
    try {
      await octokit.pulls.requestReviewers({
        owner,
        repo,
        pull_number: prNumber,
        reviewers
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  // ============================================
  // CI Status
  // ============================================
  /**
   * Get CI status for a PR
   */
  async getCIStatus(prNumber) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const pr = await this.getPR(prNumber);
    const ref = pr.head.sha;
    const { data: checkRuns } = await octokit.checks.listForRef({
      owner,
      repo,
      ref
    });
    const checks = checkRuns.check_runs.map((run) => ({
      name: run.name,
      status: this.mapCheckStatus(run.status, run.conclusion),
      conclusion: run.conclusion,
      url: run.html_url ?? "",
      startedAt: run.started_at,
      completedAt: run.completed_at
    }));
    const failures = checks.filter((c) => c.status === "failure");
    const pending = checks.filter((c) => c.status === "pending" || c.status === "in_progress");
    return {
      allPassing: failures.length === 0 && pending.length === 0,
      anyPending: pending.length > 0,
      checks,
      failures
    };
  }
  mapCheckStatus(status, conclusion) {
    if (status === "queued" || status === "pending") return "pending";
    if (status === "in_progress") return "in_progress";
    if (conclusion === "success") return "success";
    if (conclusion === "failure" || conclusion === "timed_out") return "failure";
    if (conclusion === "skipped" || conclusion === "cancelled") return "skipped";
    return "pending";
  }
  // ============================================
  // Feedback Collection
  // ============================================
  /**
   * Collect all feedback on a PR
   */
  async collectFeedback(prNumber) {
    const [reviewComments, reviews] = await Promise.all([
      this.getReviewComments(prNumber),
      this.getReviews(prNumber)
    ]);
    const feedbackItems = [];
    for (const comment of reviewComments) {
      const severity = this.inferSeverity(comment.body);
      feedbackItems.push({
        id: `comment-${comment.id}`,
        author: comment.user?.login ?? "unknown",
        body: comment.body,
        path: comment.path,
        line: comment.line ?? comment.original_line ?? null,
        severity,
        status: this.inferStatus(comment),
        createdAt: comment.created_at,
        url: comment.html_url,
        isAutoResolvable: this.isAutoResolvable(comment.body, severity),
        suggestedAction: this.extractSuggestion(comment.body),
        resolution: null
      });
    }
    for (const review of reviews) {
      if (!review.body || review.body.trim() === "") continue;
      const severity = this.inferSeverity(review.body);
      feedbackItems.push({
        id: `review-${review.id}`,
        author: review.user?.login ?? "unknown",
        body: review.body,
        path: null,
        line: null,
        severity,
        status: "addressed",
        // Review summaries are informational
        createdAt: review.submitted_at ?? (/* @__PURE__ */ new Date()).toISOString(),
        url: review.html_url,
        isAutoResolvable: false,
        suggestedAction: null,
        resolution: null
      });
    }
    return feedbackItems;
  }
  inferSeverity(body) {
    const lower = body.toLowerCase();
    if (body.includes("\u{1F6D1}") || body.includes(":stop_sign:") || lower.includes("critical")) {
      return "critical";
    }
    if (body.includes("medium-priority") || lower.includes("high severity")) {
      return "high";
    }
    if (body.includes("medium") || lower.includes("should")) {
      return "medium";
    }
    if (body.includes("nitpick") || body.includes("nit:") || lower.includes("consider")) {
      return "low";
    }
    if (body.includes("info") || body.includes("note:")) {
      return "info";
    }
    if (lower.includes("error") || lower.includes("bug") || lower.includes("fix")) {
      return "high";
    }
    return "medium";
  }
  inferStatus(comment) {
    if (comment.in_reply_to_id) {
      return "addressed";
    }
    return "unaddressed";
  }
  isAutoResolvable(body, severity) {
    if (body.includes("```suggestion")) return true;
    if (severity === "low" || severity === "info") return true;
    const lower = body.toLowerCase();
    if (lower.includes("formatting") || lower.includes("typo") || lower.includes("spelling")) {
      return true;
    }
    return false;
  }
  extractSuggestion(body) {
    const suggestionMatch = body.match(/```suggestion\n([\s\S]*?)```/);
    const suggestion = suggestionMatch?.[1];
    if (suggestion !== void 0) {
      return suggestion.trim();
    }
    return null;
  }
};
function cloneRepo(repoUrl, destPath) {
  const token = getTokenForRepo(repoUrl);
  if (!token) {
    return { success: false, error: `No token available for repo: ${repoUrl}` };
  }
  let cloneUrl = repoUrl;
  if (cloneUrl.startsWith("https://github.com/")) {
    cloneUrl = cloneUrl.replace("https://github.com/", `https://oauth2:${token}@github.com/`);
  } else if (!cloneUrl.includes("@") && !cloneUrl.startsWith("https://")) {
    const org = extractOrg(repoUrl);
    const repoName = repoUrl.replace(`${org}/`, "");
    cloneUrl = `https://oauth2:${token}@github.com/${org}/${repoName}.git`;
  }
  const proc = spawnSync("git", ["clone", cloneUrl, destPath], {
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 12e4
  });
  if (proc.error) {
    return { success: false, error: `Git clone error: ${proc.error.message}` };
  }
  if (proc.status !== 0) {
    const errorOutput = (proc.stderr || "Unknown error").replace(
      /oauth2:[^@]+@/g,
      "oauth2:[REDACTED]@"
    );
    return { success: false, error: `Git clone failed: ${errorOutput}` };
  }
  return { success: true };
}
__name(cloneRepo, "cloneRepo");
function isValidGitRef(ref) {
  return /^[a-zA-Z0-9._/-]+$/.test(ref) && ref.length <= 200;
}
__name(isValidGitRef, "isValidGitRef");
function isValidRepoFormat(repo) {
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo) && repo.length <= 200;
}
__name(isValidRepoFormat, "isValidRepoFormat");

// src/fleet/fleet.ts
var Fleet = class {
  static {
    __name(this, "Fleet");
  }
  api;
  archivePath;
  useDirectApi;
  /**
   * Create a new Fleet instance
   *
   * @param config - Fleet configuration options including API key and timeout
   */
  constructor(config2 = {}) {
    this.archivePath = config2.archivePath ?? "./memory-bank/recovery";
    try {
      this.api = new CursorAPI({
        apiKey: config2.apiKey,
        timeout: config2.timeout,
        maxRetries: config2.maxRetries,
        retryDelay: config2.retryDelay
      });
      this.useDirectApi = true;
    } catch {
      this.api = null;
      this.useDirectApi = false;
      log.debug("CursorAPI not available, some operations will fail");
    }
  }
  /**
   * Check if direct API is available
   */
  isApiAvailable() {
    return this.useDirectApi && this.api !== null;
  }
  // ============================================
  // Agent Discovery
  // ============================================
  /**
   * List all agents
   */
  async list() {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.listAgents();
  }
  /**
   * List agents filtered by status
   */
  async listByStatus(status) {
    const result = await this.list();
    if (!result.success) return result;
    return {
      success: true,
      data: result.data?.filter((a) => a.status === status) ?? []
    };
  }
  /**
   * Get running agents only
   */
  async running() {
    return this.listByStatus("RUNNING");
  }
  /**
   * Find agent by ID
   */
  async find(agentId) {
    const result = await this.list();
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.find((a) => a.id === agentId) };
  }
  /**
   * Get agent status
   */
  async status(agentId) {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.getAgentStatus(agentId);
  }
  // ============================================
  // Agent Spawning
  // ============================================
  /**
   * Spawn a new agent
   *
   * API Spec: https://cursor.com/docs/cloud-agent/api/endpoints
   *
   * @param options - Spawn options including repository, task, ref, target, and webhook
   */
  async spawn(options) {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    const task = this.buildTaskWithContext(options.task, options.context);
    log.info(`Spawning agent in ${options.repository}`);
    return this.api.launchAgent({
      prompt: { text: task },
      source: {
        repository: options.repository,
        ref: options.ref ?? "main"
      },
      target: options.target,
      webhook: options.webhook
    });
  }
  /**
   * Build task string with coordination context
   */
  buildTaskWithContext(task, context) {
    if (!context) return task;
    const lines = [task, "", "--- COORDINATION CONTEXT ---"];
    if (context.controlManagerId) {
      lines.push(`Control Manager Agent: ${context.controlManagerId}`);
    }
    if (context.controlCenter) {
      lines.push(`Control Center: ${context.controlCenter}`);
    }
    if (context.relatedAgents?.length) {
      lines.push(`Related Agents: ${context.relatedAgents.join(", ")}`);
    }
    if (context.metadata) {
      lines.push(`Metadata: ${JSON.stringify(context.metadata)}`);
    }
    lines.push("Report progress via PR comments and addFollowup.");
    lines.push("--- END CONTEXT ---");
    return lines.join("\n");
  }
  // ============================================
  // Agent Communication
  // ============================================
  /**
   * Send a follow-up message to an agent
   */
  async followup(agentId, message) {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.addFollowup(agentId, { text: message });
  }
  /**
   * Broadcast message to multiple agents
   */
  async broadcast(agentIds, message) {
    const results = /* @__PURE__ */ new Map();
    await Promise.all(
      agentIds.map(async (id) => {
        results.set(id, await this.followup(id, message));
      })
    );
    return results;
  }
  // ============================================
  // Conversations
  // ============================================
  /**
   * Get agent conversation
   */
  async conversation(agentId) {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.getAgentConversation(agentId);
  }
  /**
   * Archive agent conversation to disk
   */
  async archive(agentId, outputPath) {
    const conv = await this.conversation(agentId);
    if (!conv.success) return { success: false, error: conv.error };
    const path = outputPath ?? join(this.archivePath, `conversation-${agentId}.json`);
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(conv.data, null, 2));
      return { success: true, data: path };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
  // ============================================
  // Repositories
  // ============================================
  /**
   * List available repositories
   */
  async repositories() {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.listRepositories();
  }
  /**
   * List available Cursor models
   */
  async listModels() {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.listModels();
  }
  // ============================================
  // Diamond Pattern Orchestration
  // ============================================
  /**
   * Create a diamond pattern orchestration
   */
  async createDiamond(config2) {
    const runningResult = await this.running();
    const myId = runningResult.data?.[0]?.id ?? "control-manager";
    const targetAgents = [];
    for (const target of config2.targetRepos) {
      const result = await this.spawn({
        ...target,
        context: {
          controlManagerId: myId,
          controlCenter: config2.controlCenter
        }
      });
      if (result.success && result.data) {
        targetAgents.push(result.data);
      }
    }
    const counterpartyResult = await this.spawn({
      ...config2.counterparty,
      context: {
        controlManagerId: myId,
        controlCenter: config2.controlCenter,
        relatedAgents: targetAgents.map((a) => a.id),
        metadata: {
          pattern: "diamond",
          targetRepos: config2.targetRepos.map((t) => t.repository)
        }
      }
    });
    if (!counterpartyResult.success || !counterpartyResult.data) {
      return {
        success: false,
        error: counterpartyResult.error ?? "Failed to spawn counterparty"
      };
    }
    for (const agent of targetAgents) {
      await this.followup(
        agent.id,
        `Counterparty agent spawned: ${counterpartyResult.data.id}
You may receive direct communication from this agent for coordination.`
      );
    }
    return {
      success: true,
      data: {
        targetAgents,
        counterpartyAgent: counterpartyResult.data
      }
    };
  }
  // ============================================
  // Fleet Monitoring
  // ============================================
  /**
   * Get fleet summary
   */
  async summary() {
    const result = await this.list();
    if (!result.success) return { success: false, error: result.error };
    const agents = result.data ?? [];
    return {
      success: true,
      data: {
        total: agents.length,
        running: agents.filter((a) => a.status === "RUNNING").length,
        completed: agents.filter((a) => a.status === "COMPLETED" || a.status === "FINISHED").length,
        failed: agents.filter((a) => a.status === "FAILED").length,
        agents
      }
    };
  }
  /**
   * Wait for agent to complete
   */
  async waitFor(agentId, options) {
    const timeout = options?.timeout ?? 3e5;
    const pollInterval = options?.pollInterval ?? 1e4;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await this.status(agentId);
      if (!result.success) return result;
      if (result.data?.status !== "RUNNING") {
        return result;
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    return { success: false, error: `Timeout waiting for agent ${agentId}` };
  }
  /**
   * Monitor specific agents until all complete
   */
  async monitorAgents(agentIds, options) {
    const pollInterval = options?.pollInterval ?? 15e3;
    const results = /* @__PURE__ */ new Map();
    const pending = new Set(agentIds);
    const nonTerminalStates = /* @__PURE__ */ new Set(["RUNNING", "PENDING"]);
    while (pending.size > 0) {
      const statusMap = /* @__PURE__ */ new Map();
      for (const id of pending) {
        const result = await this.status(id);
        if (result.success && result.data) {
          statusMap.set(id, result.data.status);
          if (!nonTerminalStates.has(result.data.status)) {
            results.set(id, result.data);
            pending.delete(id);
          }
        }
      }
      options?.onProgress?.(statusMap);
      if (pending.size > 0) {
        await new Promise((r) => setTimeout(r, pollInterval));
      }
    }
    return results;
  }
  // ============================================
  // GitHub Coordination (Token-Aware, Using GitHubClient)
  // ============================================
  /**
   * Run bidirectional coordination loop with intelligent token switching
   */
  async coordinate(config2) {
    const outboundInterval = config2.outboundInterval ?? 6e4;
    const inboundInterval = config2.inboundInterval ?? 15e3;
    const agentIds = new Set(config2.agentIds ?? []);
    const processedCommentIds = /* @__PURE__ */ new Set();
    const [owner, repo] = config2.repo.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid repo format. Expected 'owner/repo'");
    }
    log.info("=== Fleet Coordinator Started ===");
    log.info(`Coordination PR: #${config2.coordinationPr}`);
    log.info(`Monitoring ${agentIds.size} agents`);
    log.info(`Using token for org: ${extractOrg(config2.repo)}`);
    await Promise.all([
      this.outboundLoop(config2, agentIds, outboundInterval),
      this.inboundLoop(config2, owner, repo, agentIds, processedCommentIds, inboundInterval)
    ]);
  }
  async outboundLoop(config2, agentIds, interval) {
    while (true) {
      try {
        log.debug(`[OUTBOUND] Checking ${agentIds.size} agents...`);
        for (const agentId of [...agentIds]) {
          const result = await this.status(agentId);
          if (!result.success || !result.data) {
            log.warn(`${agentId.slice(0, 12)}: Unable to fetch status`);
            continue;
          }
          const agent = result.data;
          if (agent.status === "RUNNING") {
            const message = [
              "\u{1F4CA} STATUS CHECK from Fleet Coordinator",
              "",
              "Report progress by commenting on the coordination PR:",
              `https://github.com/${config2.repo}/pull/${config2.coordinationPr}`
            ].join("\n");
            await this.followup(agentId, message);
          } else {
            agentIds.delete(agentId);
          }
        }
      } catch (err) {
        log.error("[OUTBOUND ERROR]", err);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  async inboundLoop(config2, owner, repo, agentIds, processedIds, interval) {
    while (true) {
      try {
        const commentsResult = await GitHubClient.listPRComments(
          owner,
          repo,
          config2.coordinationPr
        );
        if (!commentsResult.success || !commentsResult.data) {
          log.warn("[INBOUND] Failed to fetch comments:", commentsResult.error);
          await new Promise((r) => setTimeout(r, interval));
          continue;
        }
        for (const comment of commentsResult.data) {
          if (processedIds.has(comment.id)) continue;
          if (comment.body.includes("@cursor")) {
            log.info(`[INBOUND] New @cursor mention from ${comment.author}`);
            await this.processCoordinationComment(owner, repo, config2, agentIds, comment);
          }
          processedIds.add(comment.id);
        }
      } catch (err) {
        log.error("[INBOUND ERROR]", err);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  async processCoordinationComment(owner, repo, config2, agentIds, comment) {
    const body = comment.body;
    if (body.includes("\u2705 DONE:")) {
      const match = body.match(/✅ DONE:\s*(bc-[\w-]+)\s*(.*)/);
      const agentId = match?.[1];
      const summary = match?.[2];
      if (agentId && summary !== void 0) {
        log.info(`Agent ${agentId} completed: ${summary}`);
        agentIds.delete(agentId);
        await GitHubClient.postPRComment(
          owner,
          repo,
          config2.coordinationPr,
          `\u2705 Acknowledged completion from ${agentId.slice(0, 12)}. Summary: ${summary}`
        );
      }
    } else if (body.includes("\u26A0\uFE0F BLOCKED:")) {
      const match = body.match(/⚠️ BLOCKED:\s*(bc-[\w-]+)\s*(.*)/);
      const agentId = match?.[1];
      const issue = match?.[2];
      if (agentId && issue !== void 0) {
        log.warn(`Agent ${agentId} blocked: ${issue}`);
        await GitHubClient.postPRComment(
          owner,
          repo,
          config2.coordinationPr,
          `\u26A0\uFE0F Agent ${agentId.slice(0, 12)} blocked: ${issue}

Manual intervention may be required.`
        );
      }
    }
  }
};
var TaskAnalysisSchema = z.object({
  completedTasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low", "info"]),
      category: z.enum([
        "bug",
        "feature",
        "security",
        "performance",
        "documentation",
        "infrastructure",
        "dependency",
        "ci",
        "other"
      ]),
      status: z.literal("completed"),
      evidence: z.string().optional(),
      prNumber: z.number().nullable().optional()
    })
  ),
  outstandingTasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      priority: z.enum(["critical", "high", "medium", "low", "info"]),
      category: z.enum([
        "bug",
        "feature",
        "security",
        "performance",
        "documentation",
        "infrastructure",
        "dependency",
        "ci",
        "other"
      ]),
      status: z.enum(["pending", "in_progress", "blocked"]),
      blockers: z.array(z.string()).optional(),
      suggestedLabels: z.array(z.string()).optional()
    })
  ),
  blockers: z.array(
    z.object({
      issue: z.string(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      suggestedResolution: z.string().optional()
    })
  ),
  summary: z.string(),
  recommendations: z.array(z.string())
});
var CodeReviewSchema = z.object({
  issues: z.array(
    z.object({
      file: z.string(),
      line: z.number().optional(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      category: z.enum([
        "bug",
        "security",
        "performance",
        "style",
        "logic",
        "documentation",
        "test",
        "other"
      ]),
      description: z.string(),
      suggestedFix: z.string().optional()
    })
  ),
  improvements: z.array(
    z.object({
      area: z.string(),
      suggestion: z.string(),
      effort: z.enum(["low", "medium", "high"])
    })
  ),
  overallAssessment: z.string(),
  readyToMerge: z.boolean(),
  mergeBlockers: z.array(z.string())
});
var QuickTriageSchema = z.object({
  priority: z.enum(["critical", "high", "medium", "low", "info"]),
  category: z.enum([
    "bug",
    "feature",
    "security",
    "performance",
    "documentation",
    "infrastructure",
    "dependency",
    "ci",
    "other"
  ]),
  summary: z.string(),
  suggestedAction: z.string(),
  confidence: z.number().min(0).max(1)
});
var Analyzer = class {
  static {
    __name(this, "Analyzer");
  }
  providerName;
  model;
  apiKey;
  repo;
  providerFn = null;
  constructor(options = {}) {
    const resolved = resolveProviderOptions(options);
    this.providerName = resolved.providerName;
    this.model = resolved.model;
    this.apiKey = resolved.apiKey;
    this.repo = options.repo ?? getConfig().defaultRepository;
  }
  async getModel() {
    if (!this.providerFn) {
      this.providerFn = await getOrLoadProvider(this.providerName, this.apiKey);
    }
    return this.providerFn(this.model);
  }
  /**
   * Set the repository for GitHub operations
   */
  setRepo(repo) {
    this.repo = repo;
  }
  // ============================================
  // Conversation Analysis
  // ============================================
  /**
   * Analyze a conversation to extract completed/outstanding tasks
   */
  async analyzeConversation(conversation) {
    const messages = conversation.messages || [];
    const conversationText = this.prepareConversationText(messages);
    const { object } = await generateObject({
      model: await this.getModel(),
      schema: TaskAnalysisSchema,
      prompt: `Analyze this agent conversation and extract:
1. COMPLETED TASKS - What was actually finished and merged/deployed
2. OUTSTANDING TASKS - What remains to be done
3. BLOCKERS - Any issues preventing progress
4. SUMMARY - Brief overall assessment
5. RECOMMENDATIONS - What should be done next

Be thorough and specific. Reference PR numbers, file paths, and specific changes where possible.
Generate unique IDs for tasks (e.g., task-001, task-002).

CONVERSATION:
${conversationText}`
    });
    const completedTasks = object.completedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      category: t.category,
      status: "completed"
    }));
    const outstandingTasks = object.outstandingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      category: t.category,
      status: t.status === "blocked" ? "blocked" : "pending",
      blockers: t.blockers
    }));
    const blockers = object.blockers.map((b) => ({
      issue: b.issue,
      severity: b.severity,
      suggestedResolution: b.suggestedResolution
    }));
    return {
      summary: object.summary,
      completedTasks,
      outstandingTasks,
      blockers,
      recommendations: object.recommendations
    };
  }
  // ============================================
  // Code Review
  // ============================================
  /**
   * Review code changes and identify issues
   */
  async reviewCode(diff, context) {
    const { object } = await generateObject({
      model: await this.getModel(),
      schema: CodeReviewSchema,
      prompt: `Review this code diff and identify:
1. ISSUES - Security, bugs, performance problems
2. IMPROVEMENTS - Suggestions for better code
3. OVERALL ASSESSMENT - Is this ready to merge?

Be specific about file paths and line numbers.
Focus on real issues, not style nitpicks.

${context ? `CONTEXT:
${context}

` : ""}DIFF:
${diff}`
    });
    const issues = object.issues.map((i) => ({
      file: i.file,
      line: i.line,
      severity: i.severity,
      category: i.category,
      description: i.description,
      suggestedFix: i.suggestedFix
    }));
    const improvements = object.improvements.map((i) => ({
      area: i.area,
      suggestion: i.suggestion,
      effort: i.effort
    }));
    return {
      readyToMerge: object.readyToMerge,
      mergeBlockers: object.mergeBlockers,
      issues,
      improvements,
      overallAssessment: object.overallAssessment
    };
  }
  // ============================================
  // Quick Triage
  // ============================================
  /**
   * Quick triage - fast assessment of what needs attention
   */
  async quickTriage(input) {
    const { object } = await generateObject({
      model: await this.getModel(),
      schema: QuickTriageSchema,
      prompt: `Quickly triage this input and determine:
1. Priority level (critical/high/medium/low/info)
2. Category (bug, feature, documentation, infrastructure, etc.)
3. Brief summary
4. Suggested immediate action
5. Confidence level (0-1)

INPUT:
${input}`
    });
    return {
      priority: object.priority,
      category: object.category,
      summary: object.summary,
      suggestedAction: object.suggestedAction,
      confidence: object.confidence
    };
  }
  // ============================================
  // PR Analysis
  // ============================================
  /**
   * Analyze a Pull Request for triage
   */
  async analyzePR(github, prNumber) {
    const [pr, ci, feedback] = await Promise.all([
      github.getPR(prNumber),
      github.getCIStatus(prNumber),
      github.collectFeedback(prNumber)
    ]);
    const analyzedFeedback = await this.analyzeFeedback(feedback);
    const unaddressedFeedback = analyzedFeedback.filter((f) => f.status === "unaddressed");
    const blockers = await this.identifyBlockers(pr, ci, unaddressedFeedback);
    const status = this.determineStatus(pr, ci, blockers, unaddressedFeedback);
    const nextActions = this.generateNextActions(status, blockers, unaddressedFeedback);
    const summary = await this.generatePRSummary(pr, ci, blockers, unaddressedFeedback);
    return {
      prNumber,
      prUrl: pr.html_url,
      prTitle: pr.title,
      status,
      ci,
      feedback: {
        total: feedback.length,
        unaddressed: unaddressedFeedback.length,
        items: analyzedFeedback
      },
      blockers,
      nextActions,
      summary,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Generate a response for feedback (fix or justification)
   */
  async generateFeedbackResponse(feedback, context) {
    const { object } = await generateObject({
      model: await this.getModel(),
      schema: z.object({
        type: z.enum(["fix", "justification"]),
        content: z.string(),
        reasoning: z.string()
      }),
      prompt: `Determine how to address this PR feedback.

PR: ${context.prTitle}
Files changed: ${context.files.join(", ")}

Feedback from ${feedback.author}:
${feedback.body}

${feedback.path ? `File: ${feedback.path}` : ""}
${feedback.line ? `Line: ${feedback.line}` : ""}

Options:
1. "fix" - Generate code/text to fix the issue
2. "justification" - Explain why this feedback should not be implemented

Choose "fix" if:
- There's a clear suggestion to implement
- The issue is valid and should be fixed
- It's a straightforward change

Choose "justification" if:
- The feedback is a false positive
- It conflicts with project conventions
- It's out of scope for this PR

Provide the content (code fix or justification text) and your reasoning.`
    });
    return {
      type: object.type,
      content: object.content
    };
  }
  // ============================================
  // Issue Creation
  // ============================================
  /**
   * Create GitHub issues from analysis.
   * Always uses PR review token for consistent identity.
   */
  async createIssuesFromAnalysis(analysis, options) {
    const repo = options?.repo ?? this.repo;
    if (!repo) {
      throw new Error(
        "Repository is required for issue creation. Set via:\n  - Analyzer constructor: new Analyzer({ repo: 'owner/repo' })\n  - setRepo() method\n  - createIssuesFromAnalysis() options: { repo: 'owner/repo' }\n  - Config file: defaultRepository in agentic.config.json"
      );
    }
    const createdIssues = [];
    const env = { ...process.env, ...getEnvForPRReview() };
    for (const task of analysis.outstandingTasks) {
      const labels = [...options?.labels || []];
      if (options?.assignCopilot !== false) {
        labels.push("copilot");
      }
      if (task.priority === "critical" || task.priority === "high") {
        labels.push(`priority:${task.priority}`);
      }
      const body = `## Summary
${task.description || task.title}

## Priority
\`${task.priority.toUpperCase()}\`

${task.blockers?.length ? `## Blocked By
${task.blockers.join("\n")}
` : ""}

## Acceptance Criteria
- [ ] Implementation complete
- [ ] Tests added/updated
- [ ] Documentation updated if needed
- [ ] CI passes

## Context for AI Agents
This issue was auto-generated from agent session analysis.
- Follow your project's contribution guidelines
- Versioning is typically managed automatically \u2014 avoid manual version bumps

---
*Generated by agentic-control Analyzer*`;
      if (options?.dryRun) {
        log.info(`[DRY RUN] Would create issue: ${task.title}`);
        createdIssues.push(`[DRY RUN] ${task.title}`);
        continue;
      }
      try {
        const args = ["issue", "create", "--repo", repo, "--title", task.title, "--body-file", "-"];
        if (labels.length > 0) {
          args.push("--label", labels.join(","));
        }
        const proc = spawnSync("gh", args, {
          input: body,
          encoding: "utf-8",
          env,
          maxBuffer: 10 * 1024 * 1024
          // 10MB
        });
        if (proc.error) {
          throw proc.error;
        }
        if (proc.status !== 0) {
          throw new Error(proc.stderr || "gh issue create failed");
        }
        const result = proc.stdout.trim();
        createdIssues.push(result);
        log.info(`\u2705 Created issue: ${result}`);
      } catch (err) {
        log.error(`\u274C Failed to create issue: ${task.title}`, err);
      }
    }
    return createdIssues;
  }
  // ============================================
  // Report Generation
  // ============================================
  /**
   * Generate a comprehensive assessment report
   */
  async generateReport(conversation) {
    const analysis = await this.analyzeConversation(conversation);
    return `# Agent Session Assessment Report

## Summary
${analysis.summary}

## Completed Tasks (${analysis.completedTasks.length})
${analysis.completedTasks.map(
      (t) => `
### \u2705 ${t.title}
${t.description || ""}
`
    ).join("\n")}

## Outstanding Tasks (${analysis.outstandingTasks.length})
${analysis.outstandingTasks.map(
      (t) => `
### \u{1F4CB} ${t.title}
**Priority**: ${t.priority}
${t.description || ""}
${t.blockers?.length ? `**Blocked By**: ${t.blockers.join(", ")}` : ""}
`
    ).join("\n")}

## Blockers (${analysis.blockers.length})
${analysis.blockers.map(
      (b) => `
### \u26A0\uFE0F ${b.issue}
**Severity**: ${b.severity}
**Suggested Resolution**: ${b.suggestedResolution || "None provided"}
`
    ).join("\n")}

## Recommendations
${analysis.recommendations.map((r) => `- ${r}`).join("\n")}

---
*Generated by agentic-control Analyzer using ${this.providerName}/${this.model}*
*Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}*
`;
  }
  // ============================================
  // Private Helper Methods
  // ============================================
  prepareConversationText(messages, maxTokens = 1e5) {
    const maxChars = maxTokens * 4;
    const APPROX_CHARS_PER_MESSAGE = 500;
    let text = messages.map((m, i) => {
      const role = m.type === "user_message" ? "USER" : "ASSISTANT";
      return `[${i + 1}] ${role}:
${m.text}
`;
    }).join("\n---\n");
    if (text.length > maxChars) {
      const firstPart = text.slice(0, Math.floor(maxChars * 0.2));
      const lastPart = text.slice(-Math.floor(maxChars * 0.8));
      const truncatedChars = text.length - (firstPart.length + lastPart.length);
      const estimatedMessages = Math.ceil(truncatedChars / APPROX_CHARS_PER_MESSAGE);
      text = `${firstPart}

[... approximately ${estimatedMessages} messages truncated (${truncatedChars} chars) ...]

${lastPart}`;
    }
    return text;
  }
  async analyzeFeedback(feedback) {
    if (feedback.length === 0) return [];
    const { object } = await generateObject({
      model: await this.getModel(),
      schema: z.object({
        items: z.array(
          z.object({
            id: z.string(),
            status: z.enum(["unaddressed", "addressed", "dismissed", "wont_fix"]),
            isAutoResolvable: z.boolean(),
            suggestedAction: z.string().nullable()
          })
        )
      }),
      prompt: `Analyze these PR feedback items and determine their status.

Feedback items:
${feedback.map(
        (f) => `
ID: ${f.id}
Author: ${f.author}
Severity: ${f.severity}
Path: ${f.path ?? "general"}
Body: ${f.body}
---`
      ).join("\n")}

For each item:
1. Determine if it's addressed (has been fixed/responded to), unaddressed (needs action), dismissed (explicitly dismissed with reason), or wont_fix
2. Determine if it can be auto-resolved (has suggestion block, is simple fix, etc.)
3. Suggest the action needed if unaddressed

Return analysis for each item by ID.`
    });
    return feedback.map((item) => {
      const analysis = object.items.find((a) => a.id === item.id);
      if (analysis) {
        return {
          ...item,
          status: analysis.status,
          isAutoResolvable: analysis.isAutoResolvable,
          suggestedAction: analysis.suggestedAction
        };
      }
      return item;
    });
  }
  async identifyBlockers(pr, ci, unaddressedFeedback) {
    const blockers = [];
    for (const failure of ci.failures) {
      blockers.push({
        type: "ci_failure",
        description: `CI check "${failure.name}" failed`,
        isAutoResolvable: true,
        suggestedFix: `Analyze failure logs at ${failure.url} and fix the issue`,
        url: failure.url,
        resolved: false
      });
    }
    const criticalFeedback = unaddressedFeedback.filter(
      (f) => f.severity === "critical" || f.severity === "high"
    );
    if (criticalFeedback.length > 0) {
      blockers.push({
        type: "review_feedback",
        description: `${criticalFeedback.length} critical/high severity feedback items unaddressed`,
        isAutoResolvable: criticalFeedback.some((f) => f.isAutoResolvable),
        suggestedFix: "Address each feedback item with a fix or justified response",
        url: null,
        resolved: false
      });
    }
    if (pr.mergeable === false && pr.mergeable_state === "dirty") {
      blockers.push({
        type: "merge_conflict",
        description: "PR has merge conflicts that must be resolved",
        isAutoResolvable: false,
        suggestedFix: "Rebase or merge main branch and resolve conflicts",
        url: null,
        resolved: false
      });
    }
    if (pr.mergeable_state === "blocked") {
      blockers.push({
        type: "branch_protection",
        description: "Branch protection rules prevent merge",
        isAutoResolvable: false,
        suggestedFix: "Ensure all required checks pass and approvals are obtained",
        url: null,
        resolved: false
      });
    }
    return blockers;
  }
  determineStatus(pr, ci, blockers, unaddressedFeedback) {
    if (pr.merged) return "merged";
    if (pr.state === "closed") return "closed";
    const hardBlockers = blockers.filter((b) => !b.isAutoResolvable);
    if (hardBlockers.length > 0) return "blocked";
    if (ci.anyPending) return "needs_ci";
    if (ci.failures.length > 0 || unaddressedFeedback.length > 0) {
      return "needs_work";
    }
    if (ci.allPassing && unaddressedFeedback.length === 0) {
      return "ready_to_merge";
    }
    return "needs_review";
  }
  generateNextActions(status, blockers, unaddressedFeedback) {
    const actions = [];
    if (status === "needs_work") {
      const ciBlockers = blockers.filter((b) => b.type === "ci_failure");
      for (const blocker of ciBlockers) {
        actions.push({
          action: `Fix CI failure: ${blocker.description}`,
          priority: "critical",
          automated: true,
          reason: "CI must pass before merge"
        });
      }
      for (const feedback of unaddressedFeedback) {
        actions.push({
          action: feedback.isAutoResolvable ? `Auto-fix: ${feedback.suggestedAction ?? feedback.body.slice(0, 100)}` : `Address feedback from ${feedback.author}: ${feedback.body.slice(0, 100)}`,
          priority: feedback.severity,
          automated: feedback.isAutoResolvable,
          reason: `${feedback.severity} severity feedback requires resolution`
        });
      }
    }
    if (status === "needs_review") {
      actions.push({
        action: "Request AI reviews: /gemini review, /q review",
        priority: "high",
        automated: true,
        reason: "AI review required before merge"
      });
    }
    if (status === "ready_to_merge") {
      actions.push({
        action: "Merge PR",
        priority: "high",
        automated: false,
        reason: "All checks pass and feedback addressed"
      });
    }
    return actions;
  }
  async generatePRSummary(pr, ci, blockers, unaddressedFeedback) {
    const { text } = await generateText({
      model: await this.getModel(),
      prompt: `Generate a concise summary of this PR's triage status.

PR: ${pr.title}
CI: ${ci.allPassing ? "\u2705 All passing" : ci.anyPending ? "\u23F3 Pending" : `\u274C ${ci.failures.length} failures`}
Blockers: ${blockers.length > 0 ? blockers.map((b) => b.description).join(", ") : "None"}
Unaddressed feedback: ${unaddressedFeedback.length} items

Write 2-3 sentences summarizing the current state and what needs to happen next.`
    });
    return text;
  }
};

// src/handoff/manager.ts
function isValidBranchName(branch) {
  return /^[a-zA-Z0-9._/-]+$/.test(branch) && branch.length <= 200;
}
__name(isValidBranchName, "isValidBranchName");
var HandoffManager = class {
  static {
    __name(this, "HandoffManager");
  }
  api;
  analyzer;
  repo;
  constructor(options) {
    try {
      this.api = new CursorAPI({ apiKey: options?.cursorApiKey });
    } catch {
      this.api = null;
      log.warn("Cursor API not available for handoff operations");
    }
    try {
      this.analyzer = new Analyzer({ apiKey: options?.anthropicKey });
    } catch {
      this.analyzer = null;
      log.warn("AI Analyzer not available for handoff analysis");
    }
    this.repo = options?.repo ?? getConfig().defaultRepository;
  }
  /**
   * Set the repository for GitHub operations
   */
  setRepo(repo) {
    this.repo = repo;
  }
  /**
   * Initiate handoff to successor agent
   */
  async initiateHandoff(predecessorId, options) {
    log.info("=== Station-to-Station Handoff Initiated ===");
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    log.info("\u{1F4CA} Analyzing predecessor conversation...");
    const convResult = await this.api.getAgentConversation(predecessorId);
    if (!convResult.success || !convResult.data) {
      return { success: false, error: `Failed to get conversation: ${convResult.error}` };
    }
    let completedWork = [];
    let outstandingTasks = options.tasks ?? [];
    let decisions = [];
    if (this.analyzer) {
      try {
        const analysis = await this.analyzer.analyzeConversation(convResult.data);
        completedWork = analysis.completedTasks.map((t) => t.title);
        outstandingTasks = [
          ...analysis.outstandingTasks.map((t) => `[${t.priority}] ${t.title}`),
          ...outstandingTasks
        ];
        decisions = analysis.recommendations;
      } catch (err) {
        log.warn("AI analysis failed, using minimal context:", err);
      }
    }
    const handoffContext = {
      predecessorId,
      predecessorPr: options.currentPr,
      predecessorBranch: options.currentBranch,
      handoffTime: (/* @__PURE__ */ new Date()).toISOString(),
      completedWork: completedWork.map((w) => ({
        id: `completed-${randomUUID()}`,
        title: w,
        description: w,
        priority: "medium",
        category: "other",
        status: "completed"
      })),
      outstandingTasks: outstandingTasks.map((t) => ({
        id: `task-${randomUUID()}`,
        title: t,
        description: t,
        priority: "medium",
        category: "other",
        status: "pending"
      })),
      decisions
    };
    const handoffDir = join(".cursor", "handoff", predecessorId);
    if (!existsSync(handoffDir)) {
      mkdirSync(handoffDir, { recursive: true });
    }
    writeFileSync(join(handoffDir, "context.json"), JSON.stringify(handoffContext, null, 2));
    const successorPrompt = this.buildSuccessorPrompt(handoffContext, options);
    log.info("\u{1F680} Spawning successor agent...");
    const spawnResult = await this.api.launchAgent({
      prompt: { text: successorPrompt },
      source: {
        repository: options.repository,
        ref: options.ref ?? "main"
      }
    });
    if (!spawnResult.success || !spawnResult.data) {
      return { success: false, error: `Failed to spawn successor: ${spawnResult.error}` };
    }
    const successorId = spawnResult.data.id;
    log.info(`\u2705 Successor spawned: ${successorId}`);
    log.info("\u23F3 Waiting for successor health confirmation...");
    const healthCheckResult = await this.waitForHealthCheck(
      successorId,
      options.healthCheckTimeout ?? 3e5
    );
    return {
      success: true,
      successorId,
      successorHealthy: healthCheckResult.healthy
    };
  }
  /**
   * Called by successor to confirm health
   */
  async confirmHealthAndBegin(successorId, predecessorId) {
    if (!this.api) {
      throw new Error("Cursor API not available");
    }
    await this.api.addFollowup(predecessorId, {
      text: `\u{1F91D} HANDOFF CONFIRMED

Successor agent ${successorId} is healthy and beginning work.

I will now:
1. Review your conversation history
2. Merge your PR
3. Open my own PR
4. Continue the outstanding tasks

You can safely conclude your session.

@cursor \u{1F91D} HANDOFF: ${successorId} confirmed healthy`
    });
  }
  /**
   * Called by successor to merge predecessor and take over
   */
  async takeover(predecessorId, predecessorPr, newBranchName, options) {
    log.info("=== Successor Takeover ===");
    if (!this.repo) {
      return {
        success: false,
        error: "Repository is required. Set via constructor options or setRepo()"
      };
    }
    if (!isValidBranchName(newBranchName)) {
      return { success: false, error: "Invalid branch name format" };
    }
    if (options?.admin && options?.auto) {
      return { success: false, error: "Cannot use --admin and --auto simultaneously" };
    }
    const env = { ...process.env, ...getEnvForRepo(this.repo) };
    log.info(`\u{1F4E5} Merging predecessor PR #${predecessorPr}...`);
    try {
      const mergeMethod = options?.mergeMethod ?? "squash";
      const deleteBranch = options?.deleteBranch !== false;
      const mergeArgs = [
        "pr",
        "merge",
        String(predecessorPr),
        `--${mergeMethod}`,
        "--repo",
        this.repo
      ];
      if (deleteBranch) {
        mergeArgs.push("--delete-branch");
      }
      if (options?.admin) {
        mergeArgs.push("--admin");
      } else if (options?.auto) {
        mergeArgs.push("--auto");
      }
      const mergeProc = spawnSync("gh", mergeArgs, { encoding: "utf-8", env });
      if (mergeProc.error || mergeProc.status !== 0) {
        return {
          success: false,
          error: `Failed to merge PR: ${mergeProc.stderr || mergeProc.error}`
        };
      }
      log.info("\u2705 Predecessor PR merged");
    } catch (err) {
      return { success: false, error: `Failed to merge PR: ${err}` };
    }
    log.info("\u{1F4E5} Pulling latest main...");
    try {
      const checkoutMain = spawnSync("git", ["checkout", "main"], { encoding: "utf-8" });
      if (checkoutMain.error || checkoutMain.status !== 0) {
        return {
          success: false,
          error: `Failed to checkout main: ${checkoutMain.stderr || checkoutMain.error}`
        };
      }
      const pullProc = spawnSync("git", ["pull"], { encoding: "utf-8" });
      if (pullProc.error || pullProc.status !== 0) {
        return {
          success: false,
          error: `Failed to pull main: ${pullProc.stderr || pullProc.error}`
        };
      }
    } catch (err) {
      return { success: false, error: `Failed to pull main: ${err}` };
    }
    log.info(`\u{1F33F} Creating branch: ${newBranchName}...`);
    try {
      const branchProc = spawnSync("git", ["checkout", "-b", newBranchName], {
        encoding: "utf-8"
      });
      if (branchProc.error || branchProc.status !== 0) {
        return {
          success: false,
          error: `Failed to create branch: ${branchProc.stderr || branchProc.error}`
        };
      }
    } catch (err) {
      return { success: false, error: `Failed to create branch: ${err}` };
    }
    if (this.api) {
      await this.api.addFollowup(predecessorId, {
        text: `\u2705 TAKEOVER COMPLETE

I have:
1. Merged your PR #${predecessorPr}
2. Created my own branch: ${newBranchName}
3. Loaded your context

Your session is now complete. Thank you!

@cursor \u2705 DONE: ${predecessorId} successfully handed off`
      });
    }
    log.info("\u2705 Takeover complete");
    return { success: true };
  }
  /**
   * Build successor prompt
   */
  buildSuccessorPrompt(context, options) {
    return `# STATION-TO-STATION HANDOFF

You are a SUCCESSOR AGENT taking over from predecessor ${context.predecessorId}.

## CRITICAL FIRST STEPS

1. **IMMEDIATELY** send health confirmation:
   \`\`\`
   agentic handoff confirm ${context.predecessorId}
   \`\`\`

2. **LOAD** predecessor context from:
   \`.cursor/handoff/${context.predecessorId}/\`

3. **TAKEOVER** from predecessor:
   \`\`\`
   agentic handoff takeover ${context.predecessorId} ${context.predecessorPr} successor/continue-work-$(date +%Y%m%d)
   \`\`\`

4. **CREATE YOUR OWN HOLD-OPEN PR** and continue work.

## PREDECESSOR SUMMARY

### Completed Work
${context.completedWork.map((t) => `- ${t.title}`).join("\n")}

### Outstanding Tasks (YOUR WORK)
${context.outstandingTasks.map((t) => `- ${t.title}`).join("\n")}

### Recommendations
${context.decisions.map((d) => `- ${d}`).join("\n")}

## IMPORTANT

- You are NOT a sub-agent - you are an independent master agent
- Predecessor PR #${context.predecessorPr} on branch \`${context.predecessorBranch}\`
- Repository: ${options.repository}
- Handoff time: ${context.handoffTime}

BEGIN by sending health confirmation NOW.
`;
  }
  /**
   * Wait for health check from successor
   */
  async waitForHealthCheck(successorId, timeout) {
    if (!this.api) {
      return { healthy: false };
    }
    const start = Date.now();
    const interval = 15e3;
    while (Date.now() - start < timeout) {
      const status = await this.api.getAgentStatus(successorId);
      if (status.success && status.data) {
        if (status.data.status === "RUNNING") {
          const conv = await this.api.getAgentConversation(successorId);
          if (conv.success && conv.data) {
            const messages = conv.data.messages || [];
            for (const msg of messages) {
              if (msg.text?.includes("HANDOFF CONFIRMED")) {
                return { healthy: true };
              }
            }
          }
        } else if (status.data.status === "FAILED") {
          return { healthy: false };
        }
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    return { healthy: false };
  }
};
var ContainerManager = class {
  static {
    __name(this, "ContainerManager");
  }
  async create(config2) {
    const containerId = `agentic-sandbox-${randomUUID().slice(0, 8)}`;
    const dockerArgs = [
      "create",
      "--name",
      containerId,
      "--rm",
      "--workdir",
      "/workspace",
      "-v",
      `${config2.workspace}:/workspace:ro`,
      "-v",
      `${config2.outputDir}:/output`
    ];
    if (config2.memory) {
      dockerArgs.push("-m", `${config2.memory}m`);
    }
    if (config2.env) {
      for (const [key, value] of Object.entries(config2.env)) {
        dockerArgs.push("-e", `${key}=${value}`);
      }
    }
    const image = this.getImageForRuntime(config2.runtime);
    dockerArgs.push(image);
    const result = safeDockerCommand(dockerArgs);
    if (!result.success) {
      throw new Error(`Failed to create container: ${result.stderr}`);
    }
    return containerId;
  }
  async start(containerId) {
    const result = safeDockerCommand(["start", containerId]);
    if (!result.success) {
      throw new Error(`Failed to start container ${containerId}: ${result.stderr}`);
    }
  }
  async stop(containerId) {
    const result = safeDockerCommand(["stop", containerId]);
    if (!result.success) {
      console.warn(`Warning: Could not stop container ${containerId}: ${result.stderr}`);
    }
  }
  async remove(containerId) {
    const result = safeDockerCommand(["rm", "-f", containerId]);
    if (!result.success) {
      console.warn(`Warning: Could not remove container ${containerId}: ${result.stderr}`);
    }
  }
  async exec(containerId, command) {
    const startTime = Date.now();
    const dockerArgs = ["exec", containerId, ...command];
    try {
      const result = await safeSpawn("docker", dockerArgs);
      const duration = Date.now() - startTime;
      return {
        success: result.success,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.code || 0,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration
      };
    }
  }
  async logs(containerId) {
    const result = safeDockerCommand(["logs", containerId]);
    if (!result.success) {
      throw new Error(`Failed to get logs for container ${containerId}: ${result.stderr}`);
    }
    return result.stdout;
  }
  getImageForRuntime(runtime) {
    switch (runtime) {
      case "claude":
      case "cursor":
        return "jbcom/agentic-control:latest";
      case "custom":
        return "jbcom/agentic-control:latest";
      default:
        return "jbcom/agentic-control:latest";
    }
  }
};

// src/sandbox/runtime/claude.ts
var ClaudeRuntime = class {
  static {
    __name(this, "ClaudeRuntime");
  }
  name = "claude";
  image = "jbcom/agentic-control:latest";
  prepareCommand(prompt, options) {
    const command = ["npx", "@anthropic-ai/claude-agent-sdk", "query", "--prompt", prompt];
    if (options.timeout) {
      command.push("--timeout", options.timeout.toString());
    }
    return command;
  }
  parseOutput(stdout, stderr) {
    try {
      const parsed = JSON.parse(stdout);
      return {
        result: parsed.result || stdout,
        files: parsed.files || [],
        error: stderr || parsed.error
      };
    } catch {
      return {
        result: stdout,
        files: [],
        error: stderr
      };
    }
  }
  async validateEnvironment() {
    return !!process.env.ANTHROPIC_API_KEY;
  }
};

// src/sandbox/runtime/cursor.ts
var CursorRuntime = class {
  static {
    __name(this, "CursorRuntime");
  }
  name = "cursor";
  image = "jbcom/agentic-control:latest";
  prepareCommand(prompt, options) {
    const command = ["cursor-agent", "run", "--task", prompt];
    if (options.timeout) {
      command.push("--timeout", options.timeout.toString());
    }
    return command;
  }
  parseOutput(stdout, stderr) {
    try {
      const parsed = JSON.parse(stdout);
      return {
        result: parsed.result || stdout,
        files: parsed.files || [],
        error: stderr || parsed.error
      };
    } catch {
      return {
        result: stdout,
        files: [],
        error: stderr
      };
    }
  }
  async validateEnvironment() {
    return !!process.env.CURSOR_API_KEY;
  }
};

// src/sandbox/executor.ts
var SandboxExecutor = class {
  static {
    __name(this, "SandboxExecutor");
  }
  containerManager;
  runtimes;
  constructor() {
    this.containerManager = new ContainerManager();
    this.runtimes = /* @__PURE__ */ new Map([
      ["claude", new ClaudeRuntime()],
      ["cursor", new CursorRuntime()]
    ]);
  }
  async execute(options) {
    const runtime = this.runtimes.get(options.runtime);
    if (!runtime) {
      throw new Error(`Unknown runtime: ${options.runtime}`);
    }
    const isValid = await runtime.validateEnvironment();
    if (!isValid) {
      throw new Error(`Environment validation failed for runtime: ${options.runtime}`);
    }
    const containerId = await this.containerManager.create({
      runtime: options.runtime,
      workspace: options.workspace,
      outputDir: options.outputDir,
      memory: options.memory,
      timeout: options.timeout,
      env: options.env
    });
    try {
      await this.containerManager.start(containerId);
      const command = runtime.prepareCommand(options.prompt, {
        timeout: options.timeout,
        memory: options.memory,
        env: options.env
      });
      const result = await this.containerManager.exec(containerId, command);
      if (result.success && result.output) {
        const parsed = runtime.parseOutput(result.output, result.error || "");
        return {
          ...result,
          output: JSON.stringify(parsed)
        };
      }
      return result;
    } finally {
      await this.containerManager.stop(containerId);
      await this.containerManager.remove(containerId);
    }
  }
  async executeFleet(options) {
    const promises = options.map((option) => this.execute(option));
    return Promise.all(promises);
  }
};

// src/triage/agent.ts
z.object({
  complexity: z.enum(["simple", "moderate", "complex"]).describe("Task complexity assessment"),
  estimatedSteps: z.number().describe("Estimated number of steps to complete"),
  requiresWebSearch: z.boolean().describe("Whether web search might help"),
  requiresReasoning: z.boolean().describe("Whether extended thinking would help"),
  subtasks: z.array(
    z.object({
      description: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      tools: z.array(z.string()).describe("Tools likely needed")
    })
  ),
  risks: z.array(z.string()).describe("Potential risks or blockers")
});
var FeedbackSeveritySchema = z.enum(["critical", "high", "medium", "low", "suggestion"]);
var FeedbackItemSchema = z.object({
  id: z.string(),
  source: z.string().describe("Who provided this feedback (e.g., gemini-code-assist, copilot)"),
  severity: FeedbackSeveritySchema,
  category: z.enum([
    "bug",
    "security",
    "performance",
    "style",
    "documentation",
    "suggestion",
    "question"
  ]),
  file: z.string().optional(),
  line: z.number().optional(),
  content: z.string(),
  suggestion: z.string().optional().describe("Specific fix suggestion if provided"),
  addressed: z.boolean(),
  addressedBy: z.string().optional().describe("How it was addressed (commit SHA, response, etc.)")
});
var CIStatusSchema = z.object({
  status: z.enum(["passing", "failing", "pending", "unknown"]),
  checks: z.array(
    z.object({
      name: z.string(),
      status: z.enum(["success", "failure", "pending", "skipped"]),
      url: z.string().optional(),
      summary: z.string().optional()
    })
  ),
  failureReasons: z.array(z.string())
});
z.object({
  prNumber: z.number(),
  prUrl: z.string(),
  prTitle: z.string(),
  status: z.enum(["ready", "needs_work", "blocked", "waiting_ci", "waiting_review"]),
  ci: CIStatusSchema,
  feedback: z.object({
    total: z.number(),
    unaddressed: z.number(),
    critical: z.number(),
    items: z.array(FeedbackItemSchema)
  }),
  blockers: z.array(
    z.object({
      type: z.enum([
        "ci_failure",
        "unaddressed_feedback",
        "merge_conflict",
        "missing_approval",
        "other"
      ]),
      description: z.string(),
      autoResolvable: z.boolean(),
      suggestedFix: z.string().optional()
    })
  ),
  summary: z.string(),
  nextActions: z.array(
    z.object({
      action: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      automated: z.boolean(),
      reason: z.string()
    })
  )
});
var FeedbackSeveritySchema2 = z.enum(["critical", "high", "medium", "low", "info"]);
var FeedbackStatusSchema = z.enum(["unaddressed", "addressed", "dismissed", "wont_fix"]);
var BlockerTypeSchema = z.enum([
  "ci_failure",
  "review_feedback",
  "merge_conflict",
  "missing_approval",
  "branch_protection",
  "stale_branch"
]);
var PRStatusSchema = z.enum([
  "needs_work",
  "needs_review",
  "needs_ci",
  "ready_to_merge",
  "blocked",
  "merged",
  "closed"
]);
var FeedbackItemSchema2 = z.object({
  /** Unique identifier for the feedback item */
  id: z.string(),
  /** GitHub username of the reviewer */
  author: z.string(),
  /** Content of the feedback comment */
  body: z.string(),
  /** File path the feedback relates to, if any */
  path: z.string().nullable(),
  /** Line number in the file, if applicable */
  line: z.number().nullable(),
  /** Severity level of the feedback */
  severity: FeedbackSeveritySchema2,
  /** Current status of the feedback */
  status: FeedbackStatusSchema,
  /** ISO timestamp when the feedback was created */
  createdAt: z.string(),
  /** URL to the feedback comment on GitHub */
  url: z.string(),
  /** Whether AI can automatically resolve this feedback */
  isAutoResolvable: z.boolean(),
  /** AI-suggested action to address the feedback */
  suggestedAction: z.string().nullable(),
  /** Description of how the feedback was resolved */
  resolution: z.string().nullable()
});
var BlockerSchema = z.object({
  /** Type of blocker */
  type: BlockerTypeSchema,
  /** Human-readable description of the blocker */
  description: z.string(),
  /** Whether AI can automatically resolve this blocker */
  isAutoResolvable: z.boolean(),
  /** Suggested fix for the blocker, if available */
  suggestedFix: z.string().nullable(),
  /** URL with more information about the blocker */
  url: z.string().nullable(),
  /** Whether the blocker has been resolved */
  resolved: z.boolean()
});
var CICheckSchema = z.object({
  /** Name of the CI check */
  name: z.string(),
  /** Current status of the check */
  status: z.enum(["pending", "in_progress", "success", "failure", "skipped"]),
  /** Final conclusion of the check, if completed */
  conclusion: z.string().nullable(),
  /** URL to the CI check details */
  url: z.string(),
  /** ISO timestamp when the check started */
  startedAt: z.string().nullable(),
  /** ISO timestamp when the check completed */
  completedAt: z.string().nullable()
});
var CIStatusSchema2 = z.object({
  /** Whether all CI checks are passing */
  allPassing: z.boolean(),
  /** Whether any CI checks are still pending */
  anyPending: z.boolean(),
  /** List of all CI checks */
  checks: z.array(CICheckSchema),
  /** List of failed CI checks */
  failures: z.array(CICheckSchema)
});
z.object({
  /** PR number */
  prNumber: z.number(),
  /** URL to the PR on GitHub */
  prUrl: z.string(),
  /** Title of the PR */
  prTitle: z.string(),
  /** Overall status of the PR */
  status: PRStatusSchema,
  /** CI check status */
  ci: CIStatusSchema2,
  /** Feedback summary and items */
  feedback: z.object({
    /** Total number of feedback items */
    total: z.number(),
    /** Number of unaddressed feedback items */
    unaddressed: z.number(),
    /** List of all feedback items */
    items: z.array(FeedbackItemSchema2)
  }),
  /** List of blockers preventing merge */
  blockers: z.array(BlockerSchema),
  /** Recommended next actions */
  nextActions: z.array(
    z.object({
      /** Action to take */
      action: z.string(),
      /** Priority of the action */
      priority: FeedbackSeveritySchema2,
      /** Whether the action can be automated */
      automated: z.boolean(),
      /** Reason for the recommended action */
      reason: z.string()
    })
  ),
  /** Human-readable summary of the triage result */
  summary: z.string(),
  /** ISO timestamp when the triage was performed */
  timestamp: z.string()
});
z.object({
  /** Whether the action succeeded */
  success: z.boolean(),
  /** Name of the action that was taken */
  action: z.string(),
  /** Description of what was done */
  description: z.string(),
  /** Error message if the action failed */
  error: z.string().nullable(),
  /** List of file changes made by the action */
  changes: z.array(
    z.object({
      /** Path to the changed file */
      file: z.string(),
      /** Type of change */
      type: z.enum(["created", "modified", "deleted"])
    })
  ).nullable(),
  /** Git commit SHA if changes were committed */
  commitSha: z.string().nullable()
});
z.object({
  /** PR number this plan is for */
  prNumber: z.number(),
  /** Ordered list of steps to resolve blockers */
  steps: z.array(
    z.object({
      /** Order of this step (1-based) */
      order: z.number(),
      /** Action to take */
      action: z.string(),
      /** Detailed description of the step */
      description: z.string(),
      /** Whether this step can be automated */
      automated: z.boolean(),
      /** Estimated time to complete this step */
      estimatedDuration: z.string(),
      /** Step orders that must be completed before this step */
      dependencies: z.array(z.number())
    })
  ),
  /** Estimated total time to complete the plan */
  estimatedTotalDuration: z.string(),
  /** Whether the plan requires human intervention */
  requiresHumanIntervention: z.boolean(),
  /** Reason human intervention is required, if applicable */
  humanInterventionReason: z.string().nullable()
});
var CrewToolConfigSchema = z.object({
  invokeMethod: z.enum(["uv", "direct"]).default("uv"),
  defaultTimeout: z.number().positive().default(3e5),
  env: z.record(z.string(), z.string()).optional()
});
var InvokeCrewOptionsSchema = z.object({
  package: z.string().min(1).regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Package name must be alphanumeric and may include hyphens, underscores, or dots"
  ),
  crew: z.string().min(1).regex(
    /^[a-zA-Z0-9_.-]+$/,
    "Crew name must be alphanumeric and may include hyphens, underscores, or dots"
  ),
  input: z.string(),
  timeout: z.number().positive().optional(),
  env: z.record(z.string(), z.string()).optional()
});
function validateConfig2(config2) {
  return CrewToolConfigSchema.parse(config2);
}
__name(validateConfig2, "validateConfig");
function validateInvokeOptions(options) {
  return InvokeCrewOptionsSchema.parse(options);
}
__name(validateInvokeOptions, "validateInvokeOptions");

// src/crews/crew-tool.ts
var CrewToolError = class extends Error {
  constructor(message, category, details) {
    super(message);
    this.category = category;
    this.details = details;
    this.name = "CrewToolError";
  }
  static {
    __name(this, "CrewToolError");
  }
};
var SIGKILL_GRACE_PERIOD_MS = 5e3;
var CrewTool = class {
  static {
    __name(this, "CrewTool");
  }
  config;
  constructor(config2) {
    const validated = validateConfig2(config2 ?? {});
    this.config = {
      invokeMethod: validated.invokeMethod ?? "uv",
      defaultTimeout: validated.defaultTimeout ?? 3e5,
      env: validated.env ?? {}
    };
  }
  /**
   * List all available crews across all packages
   */
  async listCrews() {
    const result = await this.executeCommand(["list", "--json"]);
    if (!result.success) {
      throw new CrewToolError(`Failed to list crews: ${result.error}`, "crew", {
        exitCode: result.exitCode
      });
    }
    if (!result.output) {
      throw new CrewToolError("Missing output from list command", "subprocess", {
        exitCode: result.exitCode
      });
    }
    try {
      const response = JSON.parse(result.output);
      return response.crews ?? [];
    } catch {
      throw new CrewToolError("Failed to parse crew list response", "subprocess", {
        output: result.output
      });
    }
  }
  /**
   * Get detailed information about a specific crew
   */
  async getCrewInfo(packageName, crewName) {
    const result = await this.executeCommand(["info", packageName, crewName, "--json"]);
    if (!result.success) {
      throw new CrewToolError(`Failed to get crew info: ${result.error}`, "crew", {
        package: packageName,
        crew: crewName,
        exitCode: result.exitCode
      });
    }
    if (!result.output) {
      throw new CrewToolError("Missing output from info command", "subprocess", {
        package: packageName,
        crew: crewName,
        exitCode: result.exitCode
      });
    }
    try {
      return JSON.parse(result.output);
    } catch {
      throw new CrewToolError("Failed to parse crew info response", "subprocess", {
        output: result.output
      });
    }
  }
  /**
   * Invoke a crew with the given input
   */
  async invokeCrew(options) {
    const startTime = Date.now();
    try {
      const validated = validateInvokeOptions(options);
      const result = await this.executeCommand(
        ["run", validated.package, validated.crew, "--input", validated.input, "--json"],
        {
          timeout: validated.timeout ?? this.config.defaultTimeout,
          env: { ...this.config.env, ...validated.env }
        }
      );
      if (result.success && result.output) {
        try {
          const parsed = JSON.parse(result.output);
          return {
            ...parsed,
            duration_ms: parsed.duration_ms ?? Date.now() - startTime
          };
        } catch {
          return {
            success: true,
            output: result.output,
            duration_ms: Date.now() - startTime
          };
        }
      }
      return {
        success: false,
        error: result.error ?? "Unknown error",
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return {
          success: false,
          error: `Invalid options provided: ${validationErrors}`,
          duration_ms: Date.now() - startTime
        };
      }
      if (error instanceof CrewToolError) {
        return {
          success: false,
          error: error.message,
          duration_ms: Date.now() - startTime
        };
      }
      return {
        success: false,
        error: `Unexpected error: ${error.message}`,
        duration_ms: Date.now() - startTime
      };
    }
  }
  /**
   * Execute an agentic-crew CLI command
   *
   * Security notes:
   * - Uses spawn() with argument array (no shell interpretation)
   * - Package/crew names are validated via Zod regex: /^[a-zA-Z0-9_.-]+$/
   * - Input strings are passed as single array elements (not shell-interpolated)
   * - No shell=true option is used, preventing command injection
   */
  async executeCommand(args, options) {
    return new Promise((resolve2) => {
      const timeout = options?.timeout ?? this.config.defaultTimeout;
      const env = { ...process.env, ...this.config.env, ...options?.env };
      const executable = this.config.invokeMethod === "uv" ? "uv" : "agentic-crew";
      const commandArgs = this.config.invokeMethod === "uv" ? ["run", "agentic-crew", ...args] : args;
      const proc = spawn(executable, commandArgs, { env, shell: false });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let exited = false;
      let sigkillHandle = null;
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGTERM");
        sigkillHandle = setTimeout(() => {
          if (!exited) {
            proc.kill("SIGKILL");
          }
        }, SIGKILL_GRACE_PERIOD_MS);
      }, timeout);
      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
      proc.on("exit", (code, signal) => {
        exited = true;
        clearTimeout(timeoutHandle);
        if (sigkillHandle) {
          clearTimeout(sigkillHandle);
        }
        if (timedOut) {
          resolve2({
            success: false,
            error: `Crew execution timed out after ${timeout}ms`,
            output: stdout.trim(),
            exitCode: code ?? 1
          });
          return;
        }
        if (signal) {
          resolve2({
            success: false,
            error: `Process terminated by signal: ${signal}`,
            output: stdout.trim(),
            exitCode: code ?? 1
          });
          return;
        }
        if (code === 0) {
          resolve2({
            success: true,
            output: stdout.trim(),
            exitCode: code
          });
        } else {
          resolve2({
            success: false,
            error: stderr.trim() || stdout.trim() || "Crew execution failed",
            output: stdout.trim(),
            exitCode: code ?? 1
          });
        }
      });
      proc.on("close", () => {
        exited = true;
        clearTimeout(timeoutHandle);
        if (sigkillHandle) {
          clearTimeout(sigkillHandle);
        }
      });
      proc.on("error", (error) => {
        exited = true;
        clearTimeout(timeoutHandle);
        if (sigkillHandle) {
          clearTimeout(sigkillHandle);
        }
        if (error.code === "ENOENT") {
          const executableName = this.config.invokeMethod === "uv" ? "uv" : "agentic-crew";
          resolve2({
            success: false,
            error: `${executableName} not found. Install with: ${this.config.invokeMethod === "uv" ? "curl -LsSf https://astral.sh/uv/install.sh | sh (or pip install uv)" : "pip install agentic-crew (or uv pip install agentic-crew)"}`
          });
        } else {
          resolve2({
            success: false,
            error: `Failed to spawn process: ${error.message}`
          });
        }
      });
    });
  }
};

// src/roles/defaults.ts
var SAGE_ROLE = {
  id: "sage",
  name: "Ecosystem Sage",
  icon: "\u{1F52E}",
  description: "Intelligent advisor for Q&A, task decomposition, and agent routing",
  systemPrompt: `You are the Ecosystem Sage - an intelligent advisor for software development.

Your role:
1. Answer technical questions accurately and concisely
2. Provide code review feedback when asked
3. Decompose complex tasks into actionable subtasks
4. Help unblock stuck developers and agents
5. Route work to the appropriate agent

Agent Capabilities:
- CURSOR: Best for quick fixes, single-file changes, debugging, CI fixes
- JULES: Best for multi-file refactors, documentation, complex features
- HUMAN: Required for product decisions, security reviews, architecture changes

Guidelines:
- Be concise and actionable
- Reference specific files when relevant
- Never hallucinate - if unsure, say so
- Provide confidence levels honestly
- Format responses in Markdown`,
  triggers: [
    { type: "comment", pattern: "@sage" },
    { type: "comment", pattern: "/sage" },
    { type: "manual" }
  ],
  capabilities: [
    "answer_questions",
    "decompose_tasks",
    "route_to_agent",
    "unblock",
    "post_comment"
  ],
  canSpawnAgents: true,
  canModifyRepo: false,
  canMerge: false,
  defaultModel: "claude-sonnet-4-20250514",
  temperature: 0.3
};
var HARVESTER_ROLE = {
  id: "harvester",
  name: "Ecosystem Harvester",
  icon: "\u{1F33E}",
  description: "Monitors PRs, manages reviews, and harvests completed work",
  systemPrompt: `You are the Ecosystem Harvester - responsible for PR lifecycle management.

Your role:
1. Monitor open PRs across the ecosystem
2. Request AI reviews when PRs are ready
3. Process review feedback and track resolution
4. Auto-merge PRs when all criteria are met
5. Escalate blocked PRs for human attention

Merge Criteria:
- All CI checks passing
- At least one AI review completed
- All critical/high feedback addressed
- No unresolved conflicts

Guidelines:
- Be systematic and thorough
- Follow the AI QA Engagement Protocol
- Document all decisions
- Never force-merge without proper review`,
  triggers: [
    { type: "schedule", cron: "*/15 * * * *" },
    // Every 15 minutes
    {
      type: "event",
      events: ["pull_request.opened", "pull_request.synchronize", "check_run.completed"]
    },
    { type: "manual" }
  ],
  capabilities: ["review_pr", "post_comment", "merge_pr", "update_labels", "assign_users"],
  canSpawnAgents: false,
  canModifyRepo: false,
  canMerge: true,
  defaultModel: "claude-sonnet-4-20250514",
  temperature: 0.1
};
var CURATOR_ROLE = {
  id: "curator",
  name: "Ecosystem Curator",
  icon: "\u{1F3AD}",
  description: "Nightly triage, issue assessment, and agent orchestration",
  systemPrompt: `You are the Ecosystem Curator - responsible for nightly orchestration.

Your role:
1. Scan all repositories for open issues and PRs
2. Triage issues by priority and complexity
3. Spawn appropriate agents for work:
   - Jules for complex multi-file tasks
   - Cursor for quick fixes and CI failures
4. Process stuck PRs and unblock them
5. Generate daily ecosystem status reports

Triage Guidelines:
- Critical: Security issues, production bugs, blocking issues
- High: Important features, significant bugs
- Medium: Improvements, non-critical bugs
- Low: Nice-to-haves, polish items

Agent Selection:
- Lines changed < 50: Cursor
- Multiple files: Jules
- Documentation: Jules
- CI fixes: Cursor
- Security: Human review required`,
  triggers: [
    { type: "schedule", cron: "0 2 * * *" },
    // 2am UTC daily
    { type: "manual" }
  ],
  capabilities: [
    "triage_issue",
    "review_pr",
    "spawn_cursor",
    "spawn_jules",
    "post_comment",
    "update_labels",
    "assign_users"
  ],
  canSpawnAgents: true,
  canModifyRepo: false,
  canMerge: false,
  defaultModel: "claude-sonnet-4-20250514",
  temperature: 0.2
};
var REVIEWER_ROLE = {
  id: "reviewer",
  name: "Ecosystem Reviewer",
  icon: "\u{1F50D}",
  description: "AI-powered code review for pull requests",
  systemPrompt: `You are the Ecosystem Reviewer - an expert code reviewer.

Your role:
1. Review code changes for quality, security, and correctness
2. Identify bugs, security issues, and performance problems
3. Suggest improvements and best practices
4. Provide actionable feedback with severity levels

Review Categories:
- \u{1F534} Critical: Security vulnerabilities, data loss risks, breaking changes
- \u{1F7E0} High: Bugs, significant issues
- \u{1F7E1} Medium: Code quality, maintainability
- \u26AA Low: Style, minor suggestions

Guidelines:
- Be constructive and specific
- Reference line numbers and files
- Provide code suggestions when helpful
- Consider the broader context of changes
- Don't nitpick on style if there's a formatter`,
  triggers: [
    { type: "event", events: ["pull_request.opened", "pull_request.synchronize"] },
    { type: "comment", pattern: "/review" },
    { type: "manual" }
  ],
  capabilities: ["review_code", "review_pr", "post_comment"],
  canSpawnAgents: false,
  canModifyRepo: false,
  canMerge: false,
  defaultModel: "claude-sonnet-4-20250514",
  temperature: 0.2
};
var FIXER_ROLE = {
  id: "fixer",
  name: "Ecosystem Fixer",
  icon: "\u{1F527}",
  description: "Automatic CI failure resolution",
  systemPrompt: `You are the Ecosystem Fixer - specialized in resolving CI failures.

Your role:
1. Analyze CI failure logs
2. Identify the root cause
3. Apply fixes when safe to do so
4. Escalate complex issues to appropriate agents

Fixable Issues (auto-fix):
- Lint errors
- Formatting issues
- Type errors (simple)
- Missing imports
- Test assertion updates (snapshots)
- Dependency conflicts (minor versions)

Escalate To Human:
- Security-related failures
- Architecture changes needed
- Breaking API changes
- Unclear root cause

Guidelines:
- Always verify fixes don't introduce new issues
- Run tests locally before pushing
- Document what was fixed and why
- If unsure, escalate rather than guess`,
  triggers: [
    { type: "event", events: ["check_run.completed", "workflow_run.completed"] },
    { type: "comment", pattern: "/fix" },
    { type: "manual" }
  ],
  capabilities: ["fix_ci", "create_pr", "post_comment", "spawn_cursor"],
  canSpawnAgents: true,
  canModifyRepo: true,
  canMerge: false,
  defaultModel: "claude-sonnet-4-20250514",
  temperature: 0.1
};
var DELEGATOR_ROLE = {
  id: "delegator",
  name: "Ecosystem Delegator",
  icon: "\u{1F4CB}",
  description: "Delegates issues and tasks to AI agents",
  systemPrompt: `You are the Ecosystem Delegator - responsible for routing work to agents.

Your role:
1. Analyze issues and determine the best agent
2. Create clear, actionable instructions for agents
3. Spawn agents with proper context
4. Track delegated work

Agent Selection:
- Cursor: Quick fixes, single files, debugging, CI
- Jules: Multi-file, refactoring, documentation, features

Before Delegating:
- Ensure issue has clear requirements
- Check for dependencies or blockers
- Verify the task is appropriate for automation
- Add labels for tracking

Guidelines:
- Include relevant context in agent instructions
- Reference related issues/PRs
- Set appropriate labels for tracking
- Update issue with delegation status`,
  triggers: [
    { type: "comment", pattern: "/cursor" },
    { type: "comment", pattern: "/jules" },
    { type: "comment", pattern: "/delegate" },
    { type: "manual" }
  ],
  capabilities: ["route_to_agent", "spawn_cursor", "spawn_jules", "post_comment", "update_labels"],
  canSpawnAgents: true,
  canModifyRepo: false,
  canMerge: false,
  defaultModel: "claude-sonnet-4-20250514",
  temperature: 0.2
};
var DEFAULT_ROLES = {
  sage: SAGE_ROLE,
  harvester: HARVESTER_ROLE,
  curator: CURATOR_ROLE,
  reviewer: REVIEWER_ROLE,
  fixer: FIXER_ROLE,
  delegator: DELEGATOR_ROLE
};
function getDefaultRole(id) {
  return DEFAULT_ROLES[id];
}
__name(getDefaultRole, "getDefaultRole");
function getDefaultRoleIds() {
  return Object.keys(DEFAULT_ROLES);
}
__name(getDefaultRoleIds, "getDefaultRoleIds");
function applyRoleConfig(role, config2) {
  if (!config2) return role;
  const merged = { ...role };
  if (config2.systemPrompt) {
    merged.systemPrompt = config2.systemPrompt;
  }
  if (config2.triggers) {
    merged.triggers = config2.triggers;
  }
  if (config2.model) {
    merged.defaultModel = config2.model;
  }
  let capabilities = [...role.capabilities];
  if (config2.additionalCapabilities) {
    capabilities = [.../* @__PURE__ */ new Set([...capabilities, ...config2.additionalCapabilities])];
  }
  if (config2.revokedCapabilities) {
    capabilities = capabilities.filter((c) => !config2.revokedCapabilities?.includes(c));
  }
  merged.capabilities = capabilities;
  return merged;
}
__name(applyRoleConfig, "applyRoleConfig");
function getEffectiveRole(roleId, rolesConfig) {
  const defaultRole = getDefaultRole(roleId);
  if (!defaultRole) {
    return rolesConfig?.custom?.[roleId];
  }
  const roleConfig = rolesConfig?.[roleId];
  if (roleConfig?.enabled === false) {
    return void 0;
  }
  return applyRoleConfig(defaultRole, roleConfig);
}
__name(getEffectiveRole, "getEffectiveRole");
function roleHasCapability(role, capability) {
  return role.capabilities.includes(capability);
}
__name(roleHasCapability, "roleHasCapability");
async function executeRole(context) {
  const { role, model, trigger } = context;
  const actions = [];
  try {
    let userPrompt = `Trigger: ${trigger.type}
Source: ${trigger.source}
`;
    if (context.repo) {
      userPrompt += `
Repository: ${context.repo.fullName}`;
    }
    if (context.issueContext) {
      userPrompt += `

Issue #${context.issueContext.number}: ${context.issueContext.title}`;
      userPrompt += `
Author: ${context.issueContext.author}`;
      userPrompt += `
Labels: ${context.issueContext.labels.join(", ") || "none"}`;
      userPrompt += `

${context.issueContext.body}`;
    }
    if (context.fileContext?.diff) {
      userPrompt += `

Diff:
\`\`\`
${context.fileContext.diff.slice(0, 1e4)}
\`\`\``;
    }
    const { text } = await generateText({
      model,
      system: role.systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: role.maxTokens ?? 4096,
      temperature: role.temperature ?? 0.3
    });
    actions.push({
      type: "generate_response",
      description: "Generated AI response",
      result: "success"
    });
    return {
      success: true,
      response: text,
      actions
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      actions
    };
  }
}
__name(executeRole, "executeRole");
async function executeSageRole(query, model, context) {
  const role = getDefaultRole("sage");
  if (!role) {
    return { success: false, error: "Sage role not found" };
  }
  try {
    const analyzer = new Analyzer();
    let contextStr = query;
    if (context?.issueContext) {
      contextStr = `Issue #${context.issueContext.number}: ${context.issueContext.title}

${context.issueContext.body}

Query: ${query}`;
    }
    const triage = await analyzer.quickTriage(contextStr);
    const response = `**Priority**: ${triage.priority} | **Category**: ${triage.category}

${triage.summary}

**Suggested Action**: ${triage.suggestedAction}

*(Confidence: ${Math.round(triage.confidence * 100)}%)*`;
    return {
      success: true,
      response,
      data: triage,
      actions: [
        { type: "quick_triage", description: "Performed quick triage analysis", result: "success" }
      ]
    };
  } catch (_error) {
    const { text } = await generateText({
      model,
      system: role.systemPrompt,
      prompt: query,
      temperature: role.temperature ?? 0.3
    });
    return {
      success: true,
      response: text,
      actions: [
        {
          type: "fallback_generation",
          description: "Used fallback text generation",
          result: "success"
        }
      ]
    };
  }
}
__name(executeSageRole, "executeSageRole");
function listRoles(rolesConfig) {
  const roles = [];
  for (const [id, role] of Object.entries(DEFAULT_ROLES)) {
    const config2 = rolesConfig?.[id];
    if (config2?.enabled !== false) {
      roles.push(applyRoleConfig(role, config2));
    }
  }
  if (rolesConfig?.custom) {
    for (const role of Object.values(rolesConfig.custom)) {
      roles.push(role);
    }
  }
  return roles;
}
__name(listRoles, "listRoles");
function findRoleByTrigger(pattern, rolesConfig) {
  const normalizedPattern = pattern.toLowerCase().trim();
  for (const role of listRoles(rolesConfig)) {
    for (const trigger of role.triggers) {
      if (trigger.type === "comment") {
        if (normalizedPattern.startsWith(trigger.pattern.toLowerCase())) {
          return role;
        }
      }
    }
  }
  return void 0;
}
__name(findRoleByTrigger, "findRoleByTrigger");
var require2 = createRequire(import.meta.url);
var pkg = require2("../package.json");
var VERSION = pkg.version;

export { Analyzer as AIAnalyzer, AgenticConfigSchema, CURATOR_ROLE, ConfigErrorCode, ConfigurationError, ContainerManager, CrewTool, CrewToolError, CursorAPI, DEFAULT_ROLES, DELEGATOR_ROLE, DockerBuildError, DockerErrorCode, FIXER_ROLE, Fleet, GitHubClient, HARVESTER_ROLE, HandoffManager, PROVIDER_CONFIG, REVIEWER_ROLE, SAGE_ROLE, SandboxError, SandboxErrorCode, SandboxExecutor, VERSION, addOrganization, applyRoleConfig, clearProviderCache, cloneRepo, createSafeError, executeRole, executeSageRole, extractOrg, findRoleByTrigger, getConfig, getConfigPath, getConfigValue, getConfiguredOrgs, getCursorApiKey, getDefaultApiKeyEnvVar, getDefaultModel, getDefaultRole, getDefaultRoleIds, getEffectiveRole, getEnvForPRReview, getEnvForRepo, getFleetDefaults, getLogLevel, getOrLoadProvider, getOrgConfig, getPRReviewToken, getPRReviewTokenEnvVar, getSupportedProviders, getTokenConfig, getTokenEnvVar, getTokenForOrg, getTokenForRepo, getTokenSummary, getTriageApiKey, getTriageConfig, hasTokenForOrg, hasTokenForRepo, initConfig, isValidGitRef, isValidProvider, isValidRepoFormat, isVerbose, listRoles, loadConfigFromPath, loadProvider, log, resetConfig, resolveProviderOptions, roleHasCapability, safeConsole, safeDockerCommand, safeGitCommand, safeSpawn, safeSpawnSync, sanitizeEnvironment, sanitizeError, setConfig, setTokenConfig, validateCommandArgs, validateConfig, validateEnvVar, validateEnvVarWithMessage, validateGitRef, validatePositiveInt, validateRepository, validateTokens };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map