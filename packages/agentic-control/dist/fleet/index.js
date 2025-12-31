import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import 'child_process';
import { Octokit } from '@octokit/rest';

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
z.object({
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

// src/core/config.ts
var MODULE_NAME = "agentic";
cosmiconfigSync(MODULE_NAME, {
  searchPlaces: ["package.json", "agentic.config.json", ".agenticrc", ".agenticrc.json"],
  // Security: Disable loaders that execute code
  loaders: {
    ".json": /* @__PURE__ */ __name((_filepath, content) => JSON.parse(content), ".json")
  }
});
var config = {};
function getLogLevel() {
  return config.logLevel ?? "info";
}
__name(getLogLevel, "getLogLevel");
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

export { CursorAPI, Fleet };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map