import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { spawnSync, spawn } from 'child_process';

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
  return new Promise((resolve, reject) => {
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
      resolve({
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

export { AgenticConfigSchema, ConfigErrorCode, ConfigurationError, DockerBuildError, DockerErrorCode, PROVIDER_CONFIG, SandboxError, SandboxErrorCode, addOrganization, clearProviderCache, createSafeError, extractOrg, getConfig, getConfigPath, getConfigValue, getConfiguredOrgs, getCursorApiKey, getDefaultApiKeyEnvVar, getDefaultModel, getEnvForPRReview, getEnvForRepo, getFleetDefaults, getLogLevel, getOrLoadProvider, getOrgConfig, getPRReviewToken, getPRReviewTokenEnvVar, getSupportedProviders, getTokenConfig, getTokenEnvVar, getTokenForOrg, getTokenForRepo, getTokenSummary, getTriageApiKey, getTriageConfig, hasTokenForOrg, hasTokenForRepo, initConfig, isValidProvider, isVerbose, loadConfigFromPath, loadProvider, log, resetConfig, resolveProviderOptions, safeConsole, safeDockerCommand, safeGitCommand, safeSpawn, safeSpawnSync, sanitizeEnvironment, sanitizeError, setConfig, setTokenConfig, validateCommandArgs, validateConfig, validateEnvVar, validateEnvVarWithMessage, validateGitRef, validatePositiveInt, validateRepository, validateTokens };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map