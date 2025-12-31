import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { generateObject, generateText } from 'ai';

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

// src/core/errors.ts
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
    result.filepath;
  } else {
    config = {};
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
function getConfig() {
  if (!configLoaded) {
    initConfig();
  }
  return { ...config };
}
__name(getConfig, "getConfig");
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
function getLogLevel() {
  return config.logLevel ?? "info";
}
__name(getLogLevel, "getLogLevel");
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
function validateRepository(repository) {
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
__name(validateRepository, "validateRepository");
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
function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED]").replace(/api[_-]?key[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, "api_key=[REDACTED]").replace(/token[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, "token=[REDACTED]");
}
__name(sanitizeError, "sanitizeError");
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
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request(endpoint, method, body, attempt + 1);
        }
        const errorText = await response.text();
        let details;
        try {
          const parsed = JSON.parse(errorText);
          details = parsed.message || parsed.error || "Unknown API error";
        } catch {
          details = sanitizeError(errorText);
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
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request(endpoint, method, body, attempt + 1);
        }
        return { success: false, error: `Request timeout after ${this.timeout}ms` };
      }
      if (attempt < this.maxRetries && (error instanceof TypeError || error instanceof Error && (error.message.includes("network") || error.message.includes("fetch") || error.message.includes("connection")))) {
        const delay = this.retryDelay * 2 ** attempt;
        log.warn(
          `Network error on ${method} ${endpoint}: ${sanitizeError(error)}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${this.maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request(endpoint, method, body, attempt + 1);
      }
      return { success: false, error: sanitizeError(error) };
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
    validateRepository(options.source.repository);
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

// src/triage/analyzer.ts
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

export { HandoffManager };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map