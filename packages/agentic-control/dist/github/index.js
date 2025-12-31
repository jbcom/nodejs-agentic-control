import { spawnSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';

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

export { GitHubClient, cloneRepo, isValidGitRef, isValidRepoFormat };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map