import { execFileSync, spawnSync, execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, realpathSync } from 'fs';
import { dirname, isAbsolute, resolve, relative } from 'path';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs, streamText, generateObject, tool } from 'ai';
import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { writeFile } from 'fs/promises';
import { simpleGit } from 'simple-git';

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

// src/github/client.ts
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
var DEFAULT_MCP_CONFIG = {
  // ───────────────────────────────────────────────────────────────
  // Vendor Connectors (Python) - Jules, Cursor, GitHub, Slack, etc.
  // Provides unified access to all vendor APIs via MCP.
  // Install: pip install vendor-connectors[mcp]
  // ───────────────────────────────────────────────────────────────
  "vendor-connectors": {
    enabled: true,
    tokenEnvVar: "GOOGLE_JULES_API_KEY",
    tokenEnvVarFallbacks: ["JULES_API_KEY", "CURSOR_API_KEY"],
    mode: "stdio",
    command: "python",
    args: ["-m", "vendor_connectors.mcp"]
  },
  cursor: {
    enabled: true,
    tokenEnvVar: "CURSOR_API_KEY",
    tokenEnvVarFallbacks: ["COPILOT_MCP_CURSOR_API_KEY"],
    mode: "stdio",
    command: "npx",
    args: ["-y", "cursor-mcp-server"]
  },
  github: {
    enabled: true,
    tokenEnvVar: "GITHUB_TOKEN",
    tokenEnvVarFallbacks: ["GITHUB_JBCOM_TOKEN", "COPILOT_MCP_GITHUB_TOKEN"],
    mode: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"]
  },
  context7: {
    enabled: true,
    tokenEnvVar: "CONTEXT7_API_KEY",
    tokenEnvVarFallbacks: ["COPILOT_MCP_CONTEXT7_API_KEY"],
    mode: "stdio",
    command: "npx",
    args: ["-y", "@anthropic/context7-mcp"]
  },
  "21st-magic": {
    enabled: true,
    tokenEnvVar: "TWENTY_FIRST_API_KEY",
    tokenEnvVarFallbacks: ["COPILOT_MCP_TWENTY_FIRST_API_KEY"],
    mode: "stdio",
    command: "npx",
    args: ["-y", "@21st-dev/magic-mcp@latest"]
  }
};
function resolveToken(serverConfig) {
  if (serverConfig.tokenEnvVar) {
    const token = process.env[serverConfig.tokenEnvVar];
    if (token) return token;
  }
  if (serverConfig.tokenEnvVarFallbacks) {
    for (const envVar of serverConfig.tokenEnvVarFallbacks) {
      const token = process.env[envVar];
      if (token) return token;
    }
  }
  return void 0;
}
__name(resolveToken, "resolveToken");
function getMCPConfig() {
  const userConfig = getConfig().mcp ?? {};
  const merged = {};
  for (const [name, defaultServer] of Object.entries(DEFAULT_MCP_CONFIG)) {
    const userServer = userConfig[name];
    if (userServer === void 0) {
      merged[name] = defaultServer;
    } else {
      merged[name] = { ...defaultServer, ...userServer };
    }
  }
  for (const [name, server] of Object.entries(userConfig)) {
    if (!(name in merged) && server) {
      merged[name] = server;
    }
  }
  return merged;
}
__name(getMCPConfig, "getMCPConfig");
var MCP_ENV_VARS = {
  cursor: { name: "CURSOR_API_KEY", sources: ["COPILOT_MCP_CURSOR_API_KEY", "CURSOR_API_KEY"] },
  github: {
    name: "GITHUB_TOKEN",
    sources: ["COPILOT_MCP_GITHUB_TOKEN", "GITHUB_JBCOM_TOKEN", "GITHUB_TOKEN"]
  },
  context7: {
    name: "CONTEXT7_API_KEY",
    sources: ["COPILOT_MCP_CONTEXT7_API_KEY", "CONTEXT7_API_KEY"],
    optional: true
  }
};
var mcpCredentials = {
  get cursorApiKey() {
    return resolveToken(getMCPConfig().cursor ?? {});
  },
  get githubToken() {
    return resolveToken(getMCPConfig().github ?? {});
  },
  get context7ApiKey() {
    return resolveToken(getMCPConfig().context7 ?? {});
  }
};
async function initializeMCPClients(overrides = {}) {
  const clients = {};
  const mcpConfig = getMCPConfig();
  for (const [name, serverConfig] of Object.entries(mcpConfig)) {
    if (!serverConfig || serverConfig.enabled === false) continue;
    const override = overrides[name];
    const config2 = override ? { ...serverConfig, ...override } : serverConfig;
    let token = resolveToken(config2);
    if (override) {
      if ("apiKey" in override && override.apiKey) token = override.apiKey;
      if ("token" in override && override.token) token = override.token;
    }
    const optionalServers = ["context7", "21st-magic", "vendor-connectors"];
    if (!token && !optionalServers.includes(name)) {
      continue;
    }
    try {
      if (config2.mode === "stdio" && config2.command) {
        const env = { ...process.env };
        if (token) {
          if (name === "cursor") env.CURSOR_API_KEY = token;
          if (name === "github") env.GITHUB_TOKEN = token;
          if (name === "context7") env.CONTEXT7_API_KEY = token;
          if (name === "21st-magic") env.TWENTY_FIRST_API_KEY = token;
        }
        if (name === "vendor-connectors") {
          const vcOverride = overrides["vendor-connectors"];
          env.GOOGLE_JULES_API_KEY = vcOverride?.julesApiKey ?? process.env.GOOGLE_JULES_API_KEY ?? "";
          env.JULES_API_KEY = vcOverride?.julesApiKey ?? process.env.JULES_API_KEY ?? process.env.GOOGLE_JULES_API_KEY ?? "";
          env.CURSOR_API_KEY = vcOverride?.cursorApiKey ?? process.env.CURSOR_API_KEY ?? "";
          env.OLLAMA_API_KEY = vcOverride?.ollamaApiKey ?? process.env.OLLAMA_API_KEY ?? "";
        }
        clients[name] = await experimental_createMCPClient({
          transport: new Experimental_StdioMCPTransport({
            command: config2.command,
            args: config2.args ?? [],
            env
          })
        });
      }
    } catch (err) {
      console.warn(`Failed to initialize ${name} MCP client:`, err);
    }
  }
  return clients;
}
__name(initializeMCPClients, "initializeMCPClients");
async function getMCPTools(clients) {
  const allTools = {};
  for (const [name, client] of Object.entries(clients)) {
    if (!client) continue;
    try {
      const { tools } = await client.tools();
      if (tools) {
        for (const [toolName, mcpTool] of Object.entries(tools)) {
          allTools[`${name}_${toolName}`] = mcpTool;
        }
      }
    } catch (err) {
      console.warn(`Failed to get tools from ${name}:`, err);
    }
  }
  return allTools;
}
__name(getMCPTools, "getMCPTools");
async function closeMCPClients(clients) {
  for (const [name, client] of Object.entries(clients)) {
    if (!client) continue;
    try {
      await client.close();
    } catch (err) {
      console.warn(`Failed to close ${name} MCP client:`, err);
    }
  }
}
__name(closeMCPClients, "closeMCPClients");
function validatePath(inputPath, workingDirectory) {
  try {
    const fullPath = isAbsolute(inputPath) ? resolve(inputPath) : resolve(workingDirectory, inputPath);
    const realWorkDir = realpathSync(workingDirectory);
    if (existsSync(fullPath)) {
      const realPath = realpathSync(fullPath);
      const relativePath = relative(realWorkDir, realPath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        return {
          valid: false,
          resolvedPath: fullPath,
          error: `Path traversal detected: ${inputPath} resolves outside working directory`
        };
      }
      return { valid: true, resolvedPath: fullPath };
    }
    let pathToCheck = dirname(fullPath);
    while (!existsSync(pathToCheck)) {
      const parent = dirname(pathToCheck);
      if (parent === pathToCheck) {
        break;
      }
      pathToCheck = parent;
    }
    if (existsSync(pathToCheck)) {
      const realPath = realpathSync(pathToCheck);
      const relativePath = relative(realWorkDir, realPath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        return {
          valid: false,
          resolvedPath: fullPath,
          error: `Path traversal detected: ${inputPath} resolves outside working directory`
        };
      }
    } else {
      return {
        valid: false,
        resolvedPath: fullPath,
        error: `Path traversal detected: ${inputPath} resolves outside working directory`
      };
    }
    const normalizedRelative = relative(realWorkDir, fullPath);
    if (normalizedRelative.startsWith("..") || isAbsolute(normalizedRelative)) {
      return {
        valid: false,
        resolvedPath: fullPath,
        error: `Path traversal detected: ${inputPath} resolves outside working directory`
      };
    }
    return { valid: true, resolvedPath: fullPath };
  } catch (error) {
    return {
      valid: false,
      resolvedPath: inputPath,
      error: `Path validation error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
__name(validatePath, "validatePath");
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._\-/]/g, "_");
}
__name(sanitizeFilename, "sanitizeFilename");
function assessCommandSafety(command) {
  const risks = [];
  if (/\brm\s+(-rf?|--recursive)\b/i.test(command)) {
    risks.push("Recursive deletion detected");
  }
  if (/\bsudo\b/i.test(command)) {
    risks.push("Sudo usage detected");
  }
  if (/\bchmod\s+(777|a\+rwx)\b/i.test(command)) {
    risks.push("Dangerous permission change detected");
  }
  if (/>\s*\/etc\//i.test(command)) {
    risks.push("Write to /etc detected");
  }
  if (/\b(curl|wget)\b.*\|\s*(bash|sh|zsh)\b/i.test(command)) {
    risks.push("Remote code execution pattern detected");
  }
  return {
    safe: risks.length === 0,
    risks
  };
}
__name(assessCommandSafety, "assessCommandSafety");

// src/triage/agent.ts
var TaskAnalysisSchema = z.object({
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
var Agent = class {
  static {
    __name(this, "Agent");
  }
  config;
  mcpClients = null;
  initialized = false;
  /** Promise-based lock to prevent concurrent initialization race conditions */
  initializationPromise = null;
  constructor(config2 = {}) {
    this.config = {
      workingDirectory: config2.workingDirectory ?? process.cwd(),
      maxSteps: config2.maxSteps ?? 25,
      model: config2.model ?? "claude-sonnet-4-20250514",
      verbose: config2.verbose ?? false,
      mcp: config2.mcp,
      reasoning: config2.reasoning,
      webSearch: config2.webSearch,
      approval: config2.approval
    };
  }
  // ─────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────
  /**
   * Initialize MCP clients and prepare the agent.
   * Thread-safe: concurrent calls will wait for the same initialization to complete.
   */
  async initialize() {
    if (this.initialized) return;
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    this.initializationPromise = this.doInitialize();
    try {
      await this.initializationPromise;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }
  /**
   * Internal initialization logic - only called once due to promise lock
   */
  async doInitialize() {
    this.log("\u{1F680} Initializing Agent...");
    if (this.config.mcp) {
      this.mcpClients = await initializeMCPClients(this.config.mcp);
    }
    this.initialized = true;
    this.log("\u2705 Agent initialized");
  }
  /**
   * Close all connections and clean up
   */
  async close() {
    if (this.mcpClients) {
      await closeMCPClients(this.mcpClients);
      this.mcpClients = null;
    }
    this.initialized = false;
  }
  // ─────────────────────────────────────────────────────────────────
  // Core Execution Methods
  // ─────────────────────────────────────────────────────────────────
  /**
   * Execute a task with full tool access
   */
  async execute(task, options) {
    await this.initialize();
    const steps = [];
    const recordStep = /* @__PURE__ */ __name((toolName, input, output, approved) => {
      steps.push({ toolName, input, output, timestamp: /* @__PURE__ */ new Date(), approved });
      if (this.config.verbose) {
        console.log(
          `  \u{1F527} ${toolName}:`,
          typeof input === "string" ? input.slice(0, 100) : JSON.stringify(input).slice(0, 100)
        );
      }
    }, "recordStep");
    const tools = await this.buildToolSet(recordStep);
    if ((options?.enableWebSearch ?? this.config.webSearch?.enabled) && this.config.webSearch) {
      const webSearchTool = anthropic.tools.webSearch_20250305({
        maxUses: this.config.webSearch.maxUses ?? 5,
        allowedDomains: this.config.webSearch.allowedDomains,
        blockedDomains: this.config.webSearch.blockedDomains
      });
      tools.web_search = webSearchTool;
    }
    const providerOptions = {};
    if ((options?.enableReasoning ?? this.config.reasoning?.enabled) && this.config.reasoning) {
      providerOptions.anthropic = {
        thinking: {
          type: "enabled",
          budgetTokens: this.config.reasoning.budgetTokens ?? 12e3
        }
      };
    }
    try {
      const result = await generateText({
        model: anthropic(this.config.model),
        tools,
        stopWhen: stepCountIs(this.config.maxSteps),
        system: this.getSystemPrompt(),
        prompt: task,
        providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : void 0
      });
      return {
        success: true,
        result: result.text,
        reasoning: result.reasoning?.map((r) => r.text).join("\n"),
        steps,
        usage: result.usage ? {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0
        } : void 0
      };
    } catch (error) {
      return {
        success: false,
        result: error instanceof Error ? error.message : String(error),
        steps
      };
    }
  }
  /**
   * Execute a task with streaming output.
   * Note: Currently only yields text chunks. Reasoning chunks are not yet supported
   * by the streaming API even when extended thinking is enabled.
   */
  async *stream(task) {
    await this.initialize();
    const recordStep = /* @__PURE__ */ __name((toolName, input, output) => {
    }, "recordStep");
    const tools = await this.buildToolSet(recordStep);
    const providerOptions = {};
    if (this.config.reasoning?.enabled) {
      providerOptions.anthropic = {
        thinking: {
          type: "enabled",
          budgetTokens: this.config.reasoning.budgetTokens ?? 12e3
        }
      };
    }
    const result = streamText({
      model: anthropic(this.config.model),
      tools,
      stopWhen: stepCountIs(this.config.maxSteps),
      system: this.getSystemPrompt(),
      prompt: task,
      providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : void 0
    });
    for await (const chunk of result.textStream) {
      yield { type: "text", content: chunk };
    }
  }
  /**
   * Execute with structured output - combine tool use with schema-constrained response
   */
  async executeWithOutput(task, outputSchema) {
    await this.initialize();
    const steps = [];
    const recordStep = /* @__PURE__ */ __name((toolName, input, output) => {
      steps.push({ toolName, input, output, timestamp: /* @__PURE__ */ new Date() });
    }, "recordStep");
    const tools = await this.buildToolSet(recordStep);
    try {
      const gatherResult = await generateText({
        model: anthropic(this.config.model),
        tools,
        stopWhen: stepCountIs(Math.floor(this.config.maxSteps / 2)),
        system: this.getSystemPrompt(),
        prompt: task
      });
      const structured = await generateObject({
        model: anthropic(this.config.model),
        schema: outputSchema,
        prompt: `Based on this information, provide a structured response:

${gatherResult.text}

Original task: ${task}`
      });
      return {
        success: true,
        output: structured.object,
        steps,
        usage: gatherResult.usage ? {
          inputTokens: gatherResult.usage.inputTokens ?? 0,
          outputTokens: gatherResult.usage.outputTokens ?? 0,
          totalTokens: gatherResult.usage.totalTokens ?? 0
        } : void 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        steps
      };
    }
  }
  // ─────────────────────────────────────────────────────────────────
  // Task Analysis
  // ─────────────────────────────────────────────────────────────────
  /**
   * Analyze a task before executing to determine optimal approach
   */
  async analyzeTask(task) {
    const analysis = await generateObject({
      model: anthropic(this.config.model),
      schema: TaskAnalysisSchema,
      prompt: `Analyze this task and provide a structured assessment:

Task: ${task}

Consider:
1. How complex is this task?
2. How many steps might it take?
3. Would web search help gather current information?
4. Would extended thinking/reasoning help with complex logic?
5. What are the subtasks and their priorities?
6. What are potential risks or blockers?`
    });
    return analysis.object;
  }
  // ─────────────────────────────────────────────────────────────────
  // Convenience Methods
  // ─────────────────────────────────────────────────────────────────
  /**
   * Fix a specific file based on feedback
   */
  async fixFile(filePath, feedback, suggestion) {
    const task = suggestion ? `Fix the file ${filePath} based on this feedback:
${feedback}

Apply this suggested change:
${suggestion}` : `Fix the file ${filePath} based on this feedback:
${feedback}

Analyze the file, understand the issue, and make the appropriate fix.`;
    const result = await this.execute(task);
    let diff;
    if (result.success) {
      try {
        diff = execFileSync("git", ["diff", filePath], {
          cwd: this.config.workingDirectory,
          encoding: "utf-8"
        });
      } catch {
      }
    }
    return {
      success: result.success,
      result: result.result,
      diff
    };
  }
  /**
   * Run tests and fix failures
   */
  async fixTests(testCommand = "npm test") {
    const task = `Run the tests with "${testCommand}" and fix any failures.

Process:
1. Run the test command
2. If tests fail, analyze the failure
3. Fix the code causing the failure
4. Re-run tests
5. Repeat until all tests pass or you've tried 5 times`;
    const result = await this.execute(task);
    const testRuns = result.steps.filter(
      (s) => s.toolName === "bash" && typeof s.input === "object" && s.input !== null && "command" in s.input && String(s.input.command).includes("test")
    ).length;
    return {
      success: result.success,
      result: result.result,
      iterations: testRuns
    };
  }
  /**
   * Commit changes with a message
   */
  async commitChanges(message) {
    const result = await this.execute(
      `Stage all changes and commit with message: "${message}"
      
Use these commands:
1. git add -A
2. git commit -m "${message}"
3. Output the commit SHA`
    );
    const commitStep = result.steps.find(
      (s) => s.toolName === "bash" && s.output.includes("commit")
    );
    let commitSha;
    if (commitStep) {
      const shaMatch = commitStep.output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
      if (shaMatch) {
        commitSha = shaMatch[1];
      }
    }
    return {
      success: result.success,
      commitSha
    };
  }
  // ─────────────────────────────────────────────────────────────────
  // Tool Building
  // ─────────────────────────────────────────────────────────────────
  /**
   * Build the complete tool set
   */
  async buildToolSet(recordStep) {
    const requiresApproval = /* @__PURE__ */ __name((toolName) => {
      return this.config.approval?.requireApproval?.includes(toolName) ?? false;
    }, "requiresApproval");
    const checkApproval = /* @__PURE__ */ __name(async (toolName, input) => {
      if (!requiresApproval(toolName)) return true;
      if (!this.config.approval?.onApprovalRequest) return true;
      return this.config.approval.onApprovalRequest(toolName, input);
    }, "checkApproval");
    const bashTool = anthropic.tools.bash_20250124({
      execute: /* @__PURE__ */ __name(async ({ command, restart }) => {
        if (restart) {
          recordStep("bash", { restart: true }, "Shell restarted");
          return "Shell restarted";
        }
        const safety = assessCommandSafety(command);
        const needsApproval = requiresApproval("bash") || !safety.safe;
        if (needsApproval) {
          const approved = await checkApproval("bash", { command, risks: safety.risks });
          if (!approved) {
            recordStep("bash", { command }, "Command rejected by approval", false);
            return "Command rejected by approval policy";
          }
        }
        try {
          const output = execSync(command, {
            cwd: this.config.workingDirectory,
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024,
            timeout: 12e4
          });
          recordStep("bash", { command }, output, true);
          return output;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          recordStep("bash", { command }, `Error: ${errorMsg}`);
          return `Error: ${errorMsg}`;
        }
      }, "execute")
    });
    const textEditorTool = anthropic.tools.textEditor_20250124({
      execute: /* @__PURE__ */ __name(async ({ command, path, file_text, insert_line, new_str, old_str, view_range }) => {
        const pathValidation = validatePath(path, this.config.workingDirectory);
        if (!pathValidation.valid) {
          recordStep(
            "str_replace_editor",
            { command, path },
            `Security Error: ${pathValidation.error}`
          );
          return `Security Error: ${pathValidation.error}`;
        }
        const fullPath = pathValidation.resolvedPath;
        try {
          let result;
          switch (command) {
            case "view": {
              if (!existsSync(fullPath)) {
                result = `Error: File not found: ${path}`;
              } else {
                const content = readFileSync(fullPath, "utf-8");
                const lines = content.split("\n");
                const start = view_range?.[0];
                const end = view_range?.[1];
                if (start !== void 0 && end !== void 0) {
                  const selectedLines = lines.slice(start - 1, end);
                  result = selectedLines.map((line, i) => `${start + i}: ${line}`).join("\n");
                } else {
                  result = lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
                }
              }
              break;
            }
            case "create": {
              if (!file_text) {
                result = "Error: file_text is required for create command";
              } else {
                const dir = dirname(fullPath);
                if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
                writeFileSync(fullPath, file_text);
                result = `Created file: ${path}`;
              }
              break;
            }
            case "str_replace": {
              if (!old_str || new_str === void 0) {
                result = "Error: old_str and new_str are required for str_replace";
              } else if (!existsSync(fullPath)) {
                result = `Error: File not found: ${path}`;
              } else {
                const content = readFileSync(fullPath, "utf-8");
                if (!content.includes(old_str)) {
                  result = `Error: old_str not found in file`;
                } else {
                  const newContent = content.replace(old_str, new_str);
                  writeFileSync(fullPath, newContent);
                  result = `Replaced text in ${path}`;
                }
              }
              break;
            }
            case "insert": {
              if (insert_line === void 0 || new_str === void 0) {
                result = "Error: insert_line and new_str are required for insert";
              } else if (!existsSync(fullPath)) {
                result = `Error: File not found: ${path}`;
              } else {
                const content = readFileSync(fullPath, "utf-8");
                const lines = content.split("\n");
                lines.splice(insert_line, 0, new_str);
                writeFileSync(fullPath, lines.join("\n"));
                result = `Inserted text at line ${insert_line} in ${path}`;
              }
              break;
            }
            default:
              result = `Unknown command: ${command}`;
          }
          recordStep("str_replace_editor", { command, path }, result);
          return result;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          recordStep("str_replace_editor", { command, path }, `Error: ${errorMsg}`);
          return `Error: ${errorMsg}`;
        }
      }, "execute")
    });
    const tools = {
      bash: bashTool,
      str_replace_editor: textEditorTool
    };
    tools.git_status = tool({
      description: "Get current git status including branch, staged files, and modified files",
      inputSchema: z.object({}),
      execute: /* @__PURE__ */ __name(async () => {
        try {
          const status = execSync("git status --porcelain -b", {
            cwd: this.config.workingDirectory,
            encoding: "utf-8"
          });
          recordStep("git_status", {}, status);
          return status;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          recordStep("git_status", {}, `Error: ${msg}`);
          return `Error: ${msg}`;
        }
      }, "execute")
    });
    tools.git_diff = tool({
      description: "Get git diff for staged or unstaged changes",
      inputSchema: z.object({
        staged: z.boolean().optional().describe("Show staged changes only"),
        file: z.string().optional().describe("Specific file to diff")
      }),
      execute: /* @__PURE__ */ __name(async ({ staged, file }) => {
        try {
          const args = staged ? ["--cached"] : [];
          if (file) {
            const pathValidation = validatePath(file, this.config.workingDirectory);
            if (!pathValidation.valid) {
              recordStep("git_diff", { staged, file }, `Security Error: ${pathValidation.error}`);
              return `Security Error: ${pathValidation.error}`;
            }
            args.push("--", file);
          }
          const diff = execSync(`git diff ${args.join(" ")}`, {
            cwd: this.config.workingDirectory,
            encoding: "utf-8"
          });
          recordStep("git_diff", { staged, file }, diff || "(no changes)");
          return diff || "(no changes)";
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          recordStep("git_diff", { staged, file }, `Error: ${msg}`);
          return `Error: ${msg}`;
        }
      }, "execute")
    });
    tools.delete_file = tool({
      description: "Delete a file (may require approval)",
      inputSchema: z.object({
        path: z.string().describe("Path to the file to delete")
      }),
      execute: /* @__PURE__ */ __name(async ({ path }) => {
        const pathValidation = validatePath(path, this.config.workingDirectory);
        if (!pathValidation.valid) {
          recordStep("delete_file", { path }, `Security Error: ${pathValidation.error}`, false);
          return `Security Error: ${pathValidation.error}`;
        }
        const fullPath = pathValidation.resolvedPath;
        const approved = await checkApproval("delete_file", { path });
        if (!approved) {
          recordStep("delete_file", { path }, "Delete rejected by approval", false);
          return "Delete operation rejected by approval policy";
        }
        try {
          if (!existsSync(fullPath)) {
            recordStep("delete_file", { path }, `File not found: ${path}`);
            return `File not found: ${path}`;
          }
          unlinkSync(fullPath);
          recordStep("delete_file", { path }, `Deleted: ${path}`, true);
          return `Successfully deleted: ${path}`;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          recordStep("delete_file", { path }, `Error: ${msg}`);
          return `Error: ${msg}`;
        }
      }, "execute")
    });
    if (this.mcpClients) {
      const mcpTools = await getMCPTools(this.mcpClients);
      Object.assign(tools, mcpTools);
    }
    return tools;
  }
  // ─────────────────────────────────────────────────────────────────
  // System Prompt
  // ─────────────────────────────────────────────────────────────────
  /**
   * Get the system prompt for the agent
   */
  getSystemPrompt() {
    const features = [];
    if (this.config.reasoning?.enabled) {
      features.push("- Extended thinking enabled for complex reasoning");
    }
    if (this.config.webSearch?.enabled) {
      features.push("- Web search available for current information");
    }
    if (this.mcpClients) {
      features.push("- MCP integrations (Cursor, GitHub, Context7) available");
    }
    return `You are an expert software development agent with access to powerful tools.

## Your Capabilities

### Code Operations (Anthropic Tools)
- **bash**: Execute shell commands for git, tests, builds, etc.
- **str_replace_editor**: View and edit files with precision
- **delete_file**: Delete files (may require approval)

### Git Utilities
- **git_status**: Quick git status check
- **git_diff**: View changes in working directory

${features.length > 0 ? `### Special Features
${features.join("\n")}` : ""}

### MCP Integrations (when available)
- **Cursor Agent MCP**: Spawn and manage background agents
- **GitHub MCP**: PR/issue management, code search
- **Context7 MCP**: Up-to-date library documentation

## Working Directory
${this.config.workingDirectory}

## Guidelines

1. **Be thorough**: Verify your changes work before reporting success
2. **Use appropriate tools**: Prefer MCP tools for GitHub operations
3. **Handle errors gracefully**: Try to understand and fix failures
4. **Document your actions**: Explain what you're doing
5. **Test your changes**: Run tests and linting after code changes
${this.config.approval?.requireApproval?.length ? "\n6. **Respect approval policies**: Some operations require user approval" : ""}

## When Triaging PRs
1. First understand the current state (CI status, feedback, changes)
2. Identify all blockers and unaddressed feedback
3. Fix issues systematically, starting with CI failures
4. Commit and push changes
5. Verify CI passes after your changes`;
  }
  log(message) {
    if (this.config.verbose) {
      console.log(message);
    }
  }
};
async function runTask(task, config2) {
  const agent = new Agent(config2);
  try {
    return await agent.execute(task);
  } finally {
    await agent.close();
  }
}
__name(runTask, "runTask");
async function runSmartTask(task, config2) {
  const agent = new Agent({
    ...config2,
    reasoning: { enabled: false },
    // Disable for analysis
    webSearch: { enabled: false }
  });
  try {
    const analysis = await agent.analyzeTask(task);
    console.log(`\u{1F4CA} Task Analysis:`);
    console.log(`   Complexity: ${analysis.complexity}`);
    console.log(`   Estimated steps: ${analysis.estimatedSteps}`);
    console.log(`   Needs reasoning: ${analysis.requiresReasoning}`);
    console.log(`   Needs web search: ${analysis.requiresWebSearch}`);
    return await agent.execute(task, {
      enableReasoning: analysis.requiresReasoning,
      enableWebSearch: analysis.requiresWebSearch
    });
  } finally {
    await agent.close();
  }
}
__name(runSmartTask, "runSmartTask");

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
var TaskAnalysisSchema2 = z.object({
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
      schema: TaskAnalysisSchema2,
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
var PRAnalysisSchema = z.object({
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
var PRTriageAgent = class {
  static {
    __name(this, "PRTriageAgent");
  }
  config;
  agent;
  mcpClients = null;
  initialized = false;
  /** Promise-based lock to prevent concurrent initialization race conditions */
  initializationPromise = null;
  constructor(config2) {
    this.config = config2;
    this.agent = new Agent(config2);
  }
  /**
   * Initialize the agent and MCP clients.
   * Thread-safe: concurrent calls will wait for the same initialization to complete.
   */
  async initialize() {
    if (this.initialized) return;
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    this.initializationPromise = this.doInitialize();
    try {
      await this.initializationPromise;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }
  /**
   * Internal initialization logic - only called once due to promise lock
   */
  async doInitialize() {
    await this.agent.initialize();
    this.mcpClients = await initializeMCPClients(this.config.mcp);
    this.initialized = true;
  }
  async close() {
    await this.agent.close();
    if (this.mcpClients) {
      await closeMCPClients(this.mcpClients);
      this.mcpClients = null;
    }
    this.initialized = false;
  }
  /**
   * Analyze a PR and return structured analysis
   */
  async analyze(prNumber) {
    await this.initialize();
    const tools = this.mcpClients ? await getMCPTools(this.mcpClients) : {};
    const gatherResult = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      tools,
      stopWhen: stepCountIs(10),
      system: `You are a PR analysis assistant. Gather all relevant information about the PR.`,
      prompt: `Analyze PR #${prNumber} in repository ${this.config.repository}.

Gather:
1. PR title, description, and current state
2. CI/check status (all checks)
3. All review comments and feedback
4. Recent commits
5. Any merge conflicts

Use the available tools to get this information.`
    });
    const analysis = await generateObject({
      model: anthropic("claude-sonnet-4-20250514"),
      schema: PRAnalysisSchema,
      prompt: `Based on this PR information, generate a structured analysis:

${gatherResult.text}

Analyze:
- Overall PR status
- CI status and any failures
- All feedback items (categorize by severity)
- Blockers preventing merge
- Recommended next actions

Be thorough - identify ALL unaddressed feedback items.`
    });
    return analysis.object;
  }
  /**
   * Generate a human-readable triage report
   */
  async generateReport(prNumber) {
    const analysis = await this.analyze(prNumber);
    return this.formatReport(analysis);
  }
  /**
   * Automatically resolve all auto-resolvable issues
   */
  async resolve(prNumber) {
    const analysis = await this.analyze(prNumber);
    const autoResolvable = analysis.blockers.filter((b) => b.autoResolvable);
    const unaddressedFeedback = analysis.feedback.items.filter((f) => !f.addressed);
    if (autoResolvable.length === 0 && unaddressedFeedback.length === 0) {
      return {
        success: true,
        result: "No issues to resolve - PR appears ready",
        steps: []
      };
    }
    const task = `Resolve issues in PR #${prNumber} (${this.config.repository}):

## Blockers to Fix
${autoResolvable.map(
      (b, i) => `${i + 1}. [${b.type}] ${b.description}
   Suggested fix: ${b.suggestedFix || "Analyze and fix"}`
    ).join("\n\n")}

## Unaddressed Feedback
${unaddressedFeedback.map(
      (f, i) => `${i + 1}. [${f.severity}] ${f.source}: ${f.content}
   File: ${f.file || "N/A"}${f.line ? `:${f.line}` : ""}
   ${f.suggestion ? `Suggestion: ${f.suggestion}` : ""}`
    ).join("\n\n")}

## Instructions
1. Fix each issue in order of severity (critical > high > medium > low)
2. For each fix:
   a. Make the code change
   b. Verify it doesn't break anything (run tests if applicable)
   c. Commit with a clear message
3. Push all changes when done
4. Report what was fixed and what couldn't be auto-fixed`;
    return await this.agent.execute(task);
  }
  /**
   * Run the complete triage workflow until PR is ready
   */
  async runUntilReady(prNumber, options = {}) {
    const maxIterations = options.maxIterations ?? 5;
    let iterations = 0;
    let lastAnalysis = null;
    while (iterations < maxIterations) {
      iterations++;
      console.log(`
\u{1F504} Triage iteration ${iterations}/${maxIterations}`);
      const analysis = await this.analyze(prNumber);
      lastAnalysis = analysis;
      console.log(`   Status: ${analysis.status}`);
      console.log(`   CI: ${analysis.ci.status}`);
      console.log(`   Unaddressed feedback: ${analysis.feedback.unaddressed}`);
      if (analysis.status === "ready") {
        if (options.requestReviews) {
          await this.agent.execute(`Request reviews for PR #${prNumber} if not already requested`);
        }
        if (options.autoMerge) {
          await this.agent.execute(
            `Merge PR #${prNumber} using squash merge and delete the branch`
          );
        }
        return {
          success: true,
          finalStatus: "ready",
          iterations,
          report: this.formatReport(analysis)
        };
      }
      const nonResolvableBlockers = analysis.blockers.filter((b) => !b.autoResolvable);
      if (nonResolvableBlockers.length > 0 && analysis.blockers.every((b) => !b.autoResolvable)) {
        return {
          success: false,
          finalStatus: "blocked",
          iterations,
          report: this.formatReport(analysis) + `

## Cannot Auto-Resolve
` + nonResolvableBlockers.map((b) => `- ${b.description}`).join("\n")
        };
      }
      const resolution = await this.resolve(prNumber);
      if (!resolution.success) {
        console.log(`   \u26A0\uFE0F Resolution failed: ${resolution.result}`);
      }
      if (analysis.ci.status === "pending") {
        console.log("   \u23F3 Waiting for CI...");
        await this.waitForCI(prNumber);
      }
    }
    return {
      success: false,
      finalStatus: lastAnalysis?.status ?? "needs_work",
      iterations,
      report: lastAnalysis ? this.formatReport(lastAnalysis) : "Analysis failed"
    };
  }
  /**
   * Wait for CI to complete
   */
  async waitForCI(prNumber, timeout = 3e5) {
    const startTime = Date.now();
    const pollInterval = 3e4;
    while (Date.now() - startTime < timeout) {
      await new Promise((resolve2) => setTimeout(resolve2, pollInterval));
      const analysis = await this.analyze(prNumber);
      if (analysis.ci.status !== "pending") {
        return;
      }
    }
  }
  /**
   * Format analysis as a readable report
   */
  formatReport(analysis) {
    const statusEmoji = {
      ready: "\u2705",
      needs_work: "\u{1F527}",
      blocked: "\u{1F6AB}",
      waiting_ci: "\u23F3",
      waiting_review: "\u{1F440}"
    };
    const severityEmoji = {
      critical: "\u{1F534}",
      high: "\u{1F7E0}",
      medium: "\u{1F7E1}",
      low: "\u{1F7E2}",
      suggestion: "\u{1F4A1}"
    };
    let report = `# PR Triage Report: #${analysis.prNumber}

## ${statusEmoji[analysis.status]} Status: ${analysis.status.toUpperCase()}

**${analysis.prTitle}**
${analysis.prUrl}

## CI Status: ${analysis.ci.status}
${analysis.ci.checks.map((c) => `- ${c.status === "success" ? "\u2705" : c.status === "failure" ? "\u274C" : "\u23F3"} ${c.name}`).join("\n")}
${analysis.ci.failureReasons.length > 0 ? `
### Failures:
${analysis.ci.failureReasons.map((r) => `- ${r}`).join("\n")}` : ""}

## Feedback Summary
- Total: ${analysis.feedback.total}
- Unaddressed: ${analysis.feedback.unaddressed}
- Critical: ${analysis.feedback.critical}

`;
    if (analysis.feedback.items.length > 0) {
      report += `### Feedback Items
`;
      for (const item of analysis.feedback.items) {
        const status = item.addressed ? "\u2705" : "\u274C";
        report += `${status} ${severityEmoji[item.severity]} **${item.source}** [${item.category}]
   ${item.content.slice(0, 200)}${item.content.length > 200 ? "..." : ""}
   ${item.file ? `\u{1F4C1} ${item.file}${item.line ? `:${item.line}` : ""}` : ""}
   ${item.addressed ? `\u2713 Addressed: ${item.addressedBy}` : ""}

`;
      }
    }
    if (analysis.blockers.length > 0) {
      report += `## \u{1F6A7} Blockers
`;
      for (const blocker of analysis.blockers) {
        const autoIcon = blocker.autoResolvable ? "\u{1F916}" : "\u{1F464}";
        report += `${autoIcon} **${blocker.type}**: ${blocker.description}
   ${blocker.suggestedFix ? `\u{1F4A1} Fix: ${blocker.suggestedFix}` : ""}

`;
      }
    }
    report += `## \u{1F4CB} Next Actions
`;
    for (const action of analysis.nextActions) {
      const autoIcon = action.automated ? "\u{1F916}" : "\u{1F464}";
      report += `${autoIcon} [${action.priority}] ${action.action}
   ${action.reason}

`;
    }
    report += `---
*${analysis.summary}*`;
    return report;
  }
};
var Resolver = class {
  static {
    __name(this, "Resolver");
  }
  model = anthropic("claude-sonnet-4-20250514");
  config;
  git;
  constructor(config2) {
    this.config = config2;
    this.git = simpleGit(config2.workingDirectory);
  }
  // ==========================================================================
  // Main Resolution Methods
  // ==========================================================================
  async resolveBlockers(github, triage) {
    const results = [];
    for (const blocker of triage.blockers) {
      if (!blocker.isAutoResolvable) {
        results.push({
          success: false,
          action: `Resolve ${blocker.type}`,
          description: blocker.description,
          error: "Blocker requires human intervention",
          changes: null,
          commitSha: null
        });
        continue;
      }
      const result = await this.resolveBlocker(github, triage.prNumber, blocker);
      results.push(result);
    }
    return results;
  }
  async resolveFeedback(github, triage) {
    const results = [];
    const unaddressed = triage.feedback.items.filter((f) => f.status === "unaddressed");
    for (const feedback of unaddressed) {
      const result = await this.resolveFeedbackItem(github, triage.prNumber, feedback, {
        prTitle: triage.prTitle
      });
      results.push(result);
    }
    return results;
  }
  // ==========================================================================
  // Blocker Resolution
  // ==========================================================================
  async resolveBlocker(github, prNumber, blocker) {
    switch (blocker.type) {
      case "ci_failure":
        return this.fixCIFailure(github, prNumber, blocker);
      case "review_feedback":
        return {
          success: true,
          action: "Resolve review feedback",
          description: "Handled by feedback resolver",
          error: null,
          changes: null,
          commitSha: null
        };
      default:
        return {
          success: false,
          action: `Resolve ${blocker.type}`,
          description: blocker.description,
          error: `Cannot auto-resolve blocker type: ${blocker.type}`,
          changes: null,
          commitSha: null
        };
    }
  }
  async fixCIFailure(github, prNumber, blocker) {
    try {
      const ciUrl = blocker.url;
      if (!ciUrl) {
        return {
          success: false,
          action: "Fix CI failure",
          description: blocker.description,
          error: "No CI URL available to analyze",
          changes: null,
          commitSha: null
        };
      }
      const { text: analysis } = await generateText({
        model: this.model,
        prompt: `Analyze this CI failure and suggest a fix.

CI Failure: ${blocker.description}
URL: ${ciUrl}

Based on common CI failure patterns, what is likely wrong and how should it be fixed?
Be specific about which files to change and what changes to make.`
      });
      await github.postComment(
        prNumber,
        `## CI Failure Analysis

${analysis}

_Auto-generated by ai-triage_`
      );
      return {
        success: true,
        action: "Analyze CI failure",
        description: `Posted analysis for: ${blocker.description}`,
        error: null,
        changes: null,
        commitSha: null
      };
    } catch (error) {
      return {
        success: false,
        action: "Fix CI failure",
        description: blocker.description,
        error: error instanceof Error ? error.message : String(error),
        changes: null,
        commitSha: null
      };
    }
  }
  // ==========================================================================
  // Feedback Resolution
  // ==========================================================================
  async resolveFeedbackItem(github, prNumber, feedback, context) {
    try {
      if (feedback.suggestedAction && feedback.path) {
        return this.applySuggestion(github, prNumber, feedback);
      }
      const response = await this.generateResponse(feedback, context);
      if (response.type === "fix" && feedback.path) {
        return this.applyFix(github, prNumber, feedback, response.content);
      } else {
        return this.postJustification(github, prNumber, feedback, response.content);
      }
    } catch (error) {
      return {
        success: false,
        action: `Address feedback ${feedback.id}`,
        description: feedback.body.slice(0, 100),
        error: error instanceof Error ? error.message : String(error),
        changes: null,
        commitSha: null
      };
    }
  }
  async applySuggestion(_github, _prNumber, feedback) {
    if (!feedback.path || !feedback.suggestedAction) {
      return {
        success: false,
        action: "Apply suggestion",
        description: "Missing path or suggestion",
        error: "Cannot apply suggestion without file path and content",
        changes: null,
        commitSha: null
      };
    }
    const filePath = `${this.config.workingDirectory}/${feedback.path}`;
    if (!existsSync(filePath)) {
      return {
        success: false,
        action: "Apply suggestion",
        description: `File not found: ${feedback.path}`,
        error: "Target file does not exist",
        changes: null,
        commitSha: null
      };
    }
    if (this.config.dryRun) {
      return {
        success: true,
        action: "Apply suggestion (dry run)",
        description: `Would apply suggestion to ${feedback.path}`,
        error: null,
        changes: [{ file: feedback.path, type: "modified" }],
        commitSha: null
      };
    }
    const newContent = feedback.suggestedAction;
    await writeFile(filePath, newContent, "utf-8");
    return {
      success: true,
      action: "Apply suggestion",
      description: `Applied suggestion to ${feedback.path}`,
      error: null,
      changes: [{ file: feedback.path, type: "modified" }],
      commitSha: null
    };
  }
  async generateResponse(feedback, context) {
    const { text } = await generateText({
      model: this.model,
      prompt: `Determine how to respond to this PR feedback.

PR: ${context.prTitle}

Feedback from ${feedback.author} (${feedback.severity} severity):
${feedback.body}

${feedback.path ? `File: ${feedback.path}` : ""}

Should this be fixed or justified? If fixed, what's the fix? If justified, what's the reasoning?

Respond in this format:
TYPE: fix OR justification
CONTENT: <the fix code or justification text>`
    });
    const typeMatch = text.match(/TYPE:\s*(fix|justification)/i);
    const contentMatch = text.match(/CONTENT:\s*([\s\S]+)/i);
    return {
      type: typeMatch?.[1]?.toLowerCase() ?? "justification",
      content: contentMatch?.[1]?.trim() ?? text
    };
  }
  async applyFix(github, prNumber, feedback, fix) {
    if (!feedback.path) {
      return {
        success: false,
        action: "Apply fix",
        description: "No file path for fix",
        error: "Cannot apply fix without target file",
        changes: null,
        commitSha: null
      };
    }
    if (this.config.dryRun) {
      return {
        success: true,
        action: "Apply fix (dry run)",
        description: `Would apply fix to ${feedback.path}`,
        error: null,
        changes: [{ file: feedback.path, type: "modified" }],
        commitSha: null
      };
    }
    try {
      await github.postComment(
        prNumber,
        `## Suggested Fix for ${feedback.path}

\`\`\`
${fix}
\`\`\`

_Responding to feedback from ${feedback.author}_`
      );
      return {
        success: true,
        action: "Suggest fix",
        description: `Posted fix suggestion for ${feedback.path}`,
        error: null,
        changes: null,
        commitSha: null
      };
    } catch (error) {
      return {
        success: false,
        action: "Apply fix",
        description: `Failed to apply fix to ${feedback.path}`,
        error: error instanceof Error ? error.message : String(error),
        changes: null,
        commitSha: null
      };
    }
  }
  async postJustification(github, prNumber, feedback, justification) {
    try {
      const commentIdMatch = feedback.id.match(/comment-(\d+)/);
      const commentId = commentIdMatch?.[1];
      if (commentId) {
        await github.replyToComment(prNumber, Number.parseInt(commentId, 10), justification);
      } else {
        await github.postComment(prNumber, `Re: ${feedback.author}'s feedback

${justification}`);
      }
      return {
        success: true,
        action: "Post justification",
        description: `Responded to ${feedback.author}'s feedback`,
        error: null,
        changes: null,
        commitSha: null
      };
    } catch (error) {
      return {
        success: false,
        action: "Post justification",
        description: `Failed to respond to ${feedback.author}`,
        error: error instanceof Error ? error.message : String(error),
        changes: null,
        commitSha: null
      };
    }
  }
  // ==========================================================================
  // Git Operations
  // ==========================================================================
  async commitAndPush(message) {
    if (this.config.dryRun) {
      return {
        success: true,
        action: "Commit and push (dry run)",
        description: `Would commit: ${message}`,
        error: null,
        changes: null,
        commitSha: null
      };
    }
    try {
      await this.git.add("-A");
      await this.git.commit(message);
      const commitSha = await this.git.revparse(["HEAD"]);
      await this.git.push();
      return {
        success: true,
        action: "Commit and push",
        description: message,
        error: null,
        changes: null,
        commitSha: commitSha.trim()
      };
    } catch (error) {
      return {
        success: false,
        action: "Commit and push",
        description: message,
        error: error instanceof Error ? error.message : String(error),
        changes: null,
        commitSha: null
      };
    }
  }
  /**
   * Get current git status
   */
  async getStatus() {
    const status = await this.git.status();
    return {
      modified: status.modified,
      staged: status.staged,
      untracked: status.not_added
    };
  }
  /**
   * Get diff for files
   */
  async getDiff(staged = false) {
    if (staged) {
      return this.git.diff(["--cached"]);
    }
    return this.git.diff();
  }
};

// src/triage/triage.ts
var Triage = class {
  static {
    __name(this, "Triage");
  }
  github;
  analyzer;
  resolver;
  constructor(config2) {
    this.github = new GitHubClient(config2.github);
    this.analyzer = new Analyzer();
    this.resolver = new Resolver(config2.resolver);
  }
  // ==========================================================================
  // Analysis
  // ==========================================================================
  /**
   * Analyze a PR and return its current triage status
   */
  async analyze(prNumber) {
    return this.analyzer.analyzePR(this.github, prNumber);
  }
  // ==========================================================================
  // Resolution
  // ==========================================================================
  /**
   * Resolve all auto-resolvable blockers and feedback
   */
  async resolve(prNumber) {
    const triage = await this.analyze(prNumber);
    const actions = [];
    const blockerResults = await this.resolver.resolveBlockers(this.github, triage);
    actions.push(...blockerResults);
    const feedbackResults = await this.resolver.resolveFeedback(this.github, triage);
    actions.push(...feedbackResults);
    const updatedTriage = await this.analyze(prNumber);
    return {
      triage: updatedTriage,
      actions
    };
  }
  /**
   * Generate a plan for resolving all issues without executing
   */
  async plan(prNumber) {
    const triage = await this.analyze(prNumber);
    const steps = [];
    let order = 1;
    for (const blocker of triage.blockers.filter((b) => b.type === "ci_failure")) {
      steps.push({
        order: order++,
        action: "Fix CI failure",
        description: blocker.description,
        automated: blocker.isAutoResolvable,
        estimatedDuration: "5-10 minutes",
        dependencies: []
      });
    }
    const feedbackStep = order;
    const unaddressed = triage.feedback.items.filter((f) => f.status === "unaddressed");
    if (unaddressed.length > 0) {
      steps.push({
        order: order++,
        action: "Address feedback",
        description: `${unaddressed.length} feedback items to address`,
        automated: unaddressed.every((f) => f.isAutoResolvable),
        estimatedDuration: `${unaddressed.length * 2}-${unaddressed.length * 5} minutes`,
        dependencies: steps.filter((s) => s.action === "Fix CI failure").map((s) => s.order)
      });
    }
    if (steps.length > 0) {
      steps.push({
        order: order++,
        action: "Request re-review",
        description: "Request AI reviewers to re-review changes",
        automated: true,
        estimatedDuration: "1-5 minutes",
        dependencies: [feedbackStep]
      });
    }
    steps.push({
      order: order++,
      action: "Wait for CI",
      description: "Wait for all CI checks to complete",
      automated: true,
      estimatedDuration: "5-15 minutes",
      dependencies: steps.map((s) => s.order)
    });
    steps.push({
      order: order++,
      action: "Merge PR",
      description: "Merge the PR once all checks pass",
      automated: false,
      // Requires explicit approval
      estimatedDuration: "1 minute",
      dependencies: [order - 1]
    });
    const hasHumanStep = steps.some((s) => !s.automated);
    return {
      prNumber,
      steps,
      estimatedTotalDuration: "15-30 minutes",
      requiresHumanIntervention: hasHumanStep,
      humanInterventionReason: hasHumanStep ? "Some steps require manual review or approval" : null
    };
  }
  // ==========================================================================
  // Workflows
  // ==========================================================================
  /**
   * Run the full workflow until PR is ready to merge
   */
  async runUntilReady(prNumber, options = {}) {
    const maxIterations = options.maxIterations ?? 10;
    const allActions = [];
    let iteration = 0;
    while (iteration < maxIterations) {
      iteration++;
      const triage = await this.analyze(prNumber);
      options.onProgress?.(triage, iteration);
      if (triage.status === "ready_to_merge") {
        return {
          success: true,
          finalTriage: triage,
          iterations: iteration,
          allActions
        };
      }
      if (triage.status === "blocked") {
        return {
          success: false,
          finalTriage: triage,
          iterations: iteration,
          allActions
        };
      }
      if (triage.status === "needs_ci") {
        await this.waitForCI(prNumber);
        continue;
      }
      const { actions } = await this.resolve(prNumber);
      allActions.push(...actions);
      const successfulActions = actions.filter((a) => a.success);
      if (successfulActions.length === 0) {
        return {
          success: false,
          finalTriage: triage,
          iterations: iteration,
          allActions
        };
      }
      const hasChanges = actions.some((a) => a.changes && a.changes.length > 0);
      if (hasChanges) {
        await this.resolver.commitAndPush(`fix: address feedback (iteration ${iteration})`);
      }
      await new Promise((resolve2) => setTimeout(resolve2, 5e3));
    }
    const finalTriage = await this.analyze(prNumber);
    return {
      success: finalTriage.status === "ready_to_merge",
      finalTriage,
      iterations: iteration,
      allActions
    };
  }
  async waitForCI(prNumber, timeoutMs = 6e5) {
    const startTime = Date.now();
    const pollInterval = 3e4;
    while (Date.now() - startTime < timeoutMs) {
      const ci = await this.github.getCIStatus(prNumber);
      if (!ci.anyPending) {
        return;
      }
      await new Promise((resolve2) => setTimeout(resolve2, pollInterval));
    }
    throw new Error("CI timeout exceeded");
  }
  // ==========================================================================
  // Review Requests
  // ==========================================================================
  async requestReviews(prNumber) {
    const reviewCommands = ["/gemini review", "/q review"];
    for (const command of reviewCommands) {
      await this.github.postComment(prNumber, command);
    }
  }
  // ==========================================================================
  // Reporting
  // ==========================================================================
  formatTriageReport(triage) {
    const lines = [];
    lines.push(`# Triage Report: PR #${triage.prNumber}`);
    lines.push("");
    lines.push(`**Title:** ${triage.prTitle}`);
    lines.push(`**Status:** ${triage.status}`);
    lines.push(`**URL:** ${triage.prUrl}`);
    lines.push("");
    lines.push("## CI Status");
    lines.push(triage.ci.allPassing ? "\u2705 All checks passing" : "");
    lines.push(triage.ci.anyPending ? "\u23F3 Checks pending" : "");
    if (triage.ci.failures.length > 0) {
      lines.push(`\u274C ${triage.ci.failures.length} failing checks:`);
      for (const failure of triage.ci.failures) {
        lines.push(`  - ${failure.name}: ${failure.url}`);
      }
    }
    lines.push("");
    lines.push("## Feedback");
    lines.push(`Total: ${triage.feedback.total} | Unaddressed: ${triage.feedback.unaddressed}`);
    if (triage.feedback.unaddressed > 0) {
      lines.push("");
      lines.push("### Unaddressed Items:");
      for (const item of triage.feedback.items.filter((f) => f.status === "unaddressed")) {
        lines.push(`- **${item.severity}** from ${item.author}: ${item.body.slice(0, 100)}...`);
        if (item.isAutoResolvable) {
          lines.push(`  - \u2705 Auto-resolvable`);
        }
      }
    }
    lines.push("");
    lines.push("## Blockers");
    if (triage.blockers.length === 0) {
      lines.push("None");
    } else {
      for (const blocker of triage.blockers) {
        lines.push(`- **${blocker.type}**: ${blocker.description}`);
        lines.push(`  - Auto-resolvable: ${blocker.isAutoResolvable ? "Yes" : "No"}`);
      }
    }
    lines.push("");
    lines.push("## Next Actions");
    for (const action of triage.nextActions) {
      const icon = action.automated ? "\u{1F916}" : "\u{1F464}";
      lines.push(`${icon} [${action.priority}] ${action.action}`);
    }
    lines.push("");
    lines.push("## Summary");
    lines.push(triage.summary);
    lines.push("");
    lines.push(`_Generated: ${triage.timestamp}_`);
    return lines.join("\n");
  }
};
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
var TriageResultSchema = z.object({
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
var ActionResultSchema = z.object({
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
var ResolutionPlanSchema = z.object({
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

export { Analyzer as AIAnalyzer, ActionResultSchema, Agent, Analyzer, BlockerSchema, BlockerTypeSchema, CICheckSchema, CIStatusSchema2 as CIStatusSchema, FeedbackItemSchema2 as FeedbackItemSchema, FeedbackSeveritySchema2 as FeedbackSeveritySchema, FeedbackStatusSchema, GitHubClient, MCP_ENV_VARS, Analyzer as PRAnalyzer, PRStatusSchema, PRTriageAgent, ResolutionPlanSchema, Resolver, TaskAnalysisSchema, Triage, TriageResultSchema, assessCommandSafety, closeMCPClients, getMCPTools, initializeMCPClients, mcpCredentials, runSmartTask, runTask, sanitizeFilename, validatePath };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map