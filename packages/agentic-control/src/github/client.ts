/**
 * GitHubClient - Unified GitHub API client
 *
 * Provides GitHub API operations with:
 * - Intelligent token switching based on organization
 * - Consistent identity for PR reviews
 * - CI status and feedback collection
 * - Safe git operations (no shell injection)
 *
 * This consolidates the former token-aware client and triage client.
 */

import { spawnSync } from 'node:child_process';
import { Octokit } from '@octokit/rest';
import { log } from '../core/config.js';
import { extractOrg, getPRReviewToken, getTokenForRepo } from '../core/tokens.js';
import type { PRComment, PullRequest, Repository, Result } from '../core/types.js';
import type {
  CICheck,
  CIStatus,
  FeedbackItem,
  FeedbackSeverity,
  FeedbackStatus,
} from '../triage/types.js';

// ============================================
// Octokit Cache (one per token)
// ============================================

const octokitCache = new Map<string, Octokit>();

function getOctokit(token: string): Octokit {
  let octokit = octokitCache.get(token);
  if (!octokit) {
    octokit = new Octokit({ auth: token });
    octokitCache.set(token, octokit);
  }
  return octokit;
}

// ============================================
// Configuration
// ============================================

export interface GitHubClientConfig {
  /** Token for authentication */
  token?: string;
  /** Repository owner */
  owner?: string;
  /** Repository name */
  repo?: string;
}

// ============================================
// GitHub Client Class
// ============================================

export class GitHubClient {
  private token: string | null;
  private owner: string | null;
  private repo: string | null;

  /**
   * Create a new GitHubClient.
   *
   * Can be used in two modes:
   * 1. With explicit config: new GitHubClient({ token, owner, repo })
   * 2. Token-aware mode: new GitHubClient() - uses token based on repo
   */
  constructor(config: GitHubClientConfig = {}) {
    this.token = config.token ?? null;
    this.owner = config.owner ?? null;
    this.repo = config.repo ?? null;
  }

  // ============================================
  // Token Management (Static Methods)
  // ============================================

  /**
   * Get an Octokit instance for a repository.
   * Automatically selects the correct token based on org.
   */
  static forRepo(repoUrl: string): Octokit | null {
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
  static forPRReview(): Octokit | null {
    const token = getPRReviewToken();
    if (!token) {
      log.warn('No PR review token available');
      return null;
    }
    return getOctokit(token);
  }

  // ============================================
  // Instance Helpers
  // ============================================

  private getOctokitInstance(): Octokit {
    if (this.token) {
      return getOctokit(this.token);
    }
    if (this.owner && this.repo) {
      const octokit = GitHubClient.forRepo(`${this.owner}/${this.repo}`);
      if (!octokit) {
        throw new Error(`No token available for ${this.owner}/${this.repo}`);
      }
      return octokit;
    }
    throw new Error('GitHubClient requires either token or owner/repo');
  }

  private ensureRepo(): { owner: string; repo: string } {
    if (!this.owner || !this.repo) {
      throw new Error('owner and repo are required for this operation');
    }
    return { owner: this.owner, repo: this.repo };
  }

  // ============================================
  // Repository Operations (Static)
  // ============================================

  /**
   * Get repository information
   */
  static async getRepo(owner: string, repo: string): Promise<Result<Repository>> {
    const octokit = GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: 'No token available for this repository' };
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
          url: data.html_url,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * List repositories for an organization
   */
  static async listOrgRepos(
    org: string,
    options?: {
      type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
      perPage?: number;
    }
  ): Promise<Result<Repository[]>> {
    const octokit = GitHubClient.forRepo(`${org}/any`);
    if (!octokit) {
      return { success: false, error: `No token available for org: ${org}` };
    }

    try {
      const { data } = await octokit.repos.listForOrg({
        org,
        type: options?.type ?? 'all',
        per_page: options?.perPage ?? 100,
      });

      return {
        success: true,
        data: data.map((r) => ({
          owner: r.owner.login,
          name: r.name,
          fullName: r.full_name,
          defaultBranch: r.default_branch ?? 'main',
          isPrivate: r.private,
          url: r.html_url,
        })),
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
  static async getPRStatic(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<Result<PullRequest>> {
    const octokit = GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: 'No token available for this repository' };
    }

    try {
      const { data } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
      return {
        success: true,
        data: {
          number: data.number,
          title: data.title,
          body: data.body ?? undefined,
          state: data.state as 'open' | 'closed',
          draft: data.draft ?? false,
          url: data.html_url,
          headBranch: data.head.ref,
          baseBranch: data.base.ref,
          author: data.user?.login ?? 'unknown',
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get pull request (instance version with full data)
   */
  async getPR(prNumber: number) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  /**
   * Get files changed in a PR
   */
  async getPRFiles(prNumber: number) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  /**
   * Create a pull request
   */
  static async createPR(
    owner: string,
    repo: string,
    options: {
      title: string;
      body?: string;
      head: string;
      base: string;
      draft?: boolean;
    }
  ): Promise<Result<PullRequest>> {
    const octokit = GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: 'No token available for this repository' };
    }

    try {
      const { data } = await octokit.pulls.create({
        owner,
        repo,
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base,
        draft: options.draft,
      });

      return {
        success: true,
        data: {
          number: data.number,
          title: data.title,
          body: data.body ?? undefined,
          state: data.state as 'open' | 'closed',
          draft: data.draft ?? false,
          url: data.html_url,
          headBranch: data.head.ref,
          baseBranch: data.base.ref,
          author: data.user?.login ?? 'unknown',
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Merge a pull request
   */
  static async mergePRStatic(
    owner: string,
    repo: string,
    prNumber: number,
    options?: {
      mergeMethod?: 'merge' | 'squash' | 'rebase';
      commitTitle?: string;
      commitMessage?: string;
    }
  ): Promise<Result<void>> {
    const octokit = GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: 'No token available for this repository' };
    }

    try {
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: options?.mergeMethod ?? 'squash',
        commit_title: options?.commitTitle,
        commit_message: options?.commitMessage,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Merge a pull request (instance version)
   */
  async mergePR(prNumber: number, method: 'merge' | 'squash' | 'rebase' = 'squash') {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: method,
    });
    return data;
  }

  // ============================================
  // Reviews and Comments
  // ============================================

  /**
   * Get reviews on a PR
   */
  async getReviews(prNumber: number) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  /**
   * Get review comments on a PR
   */
  async getReviewComments(prNumber: number) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  /**
   * Get issue comments on a PR
   */
  async getIssueComments(prNumber: number) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });
    return data;
  }

  /**
   * List PR comments (static version)
   */
  static async listPRComments(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<Result<PRComment[]>> {
    const octokit = GitHubClient.forRepo(`${owner}/${repo}`);
    if (!octokit) {
      return { success: false, error: 'No token available for this repository' };
    }

    try {
      const { data } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
      });

      return {
        success: true,
        data: data.map((c) => ({
          id: c.id,
          body: c.body ?? '',
          author: c.user?.login ?? 'unknown',
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Post a PR comment (ALWAYS uses PR review identity)
   */
  static async postPRComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<Result<PRComment>> {
    const octokit = GitHubClient.forPRReview();
    if (!octokit) {
      return { success: false, error: 'No PR review token available' };
    }

    try {
      const { data } = await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });

      return {
        success: true,
        data: {
          id: data.id,
          body: data.body ?? '',
          author: data.user?.login ?? 'unknown',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Post a comment (instance version)
   */
  async postComment(prNumber: number, body: string) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    return data;
  }

  /**
   * Reply to a review comment
   */
  async replyToComment(prNumber: number, commentId: number, body: string) {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();
    const { data } = await octokit.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      comment_id: commentId,
      body,
    });
    return data;
  }

  /**
   * Request a review on a PR (ALWAYS uses PR review identity)
   */
  static async requestReview(
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: string[]
  ): Promise<Result<void>> {
    const octokit = GitHubClient.forPRReview();
    if (!octokit) {
      return { success: false, error: 'No PR review token available' };
    }

    try {
      await octokit.pulls.requestReviewers({
        owner,
        repo,
        pull_number: prNumber,
        reviewers,
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
  async getCIStatus(prNumber: number): Promise<CIStatus> {
    const { owner, repo } = this.ensureRepo();
    const octokit = this.getOctokitInstance();

    const pr = await this.getPR(prNumber);
    const ref = pr.head.sha;

    const { data: checkRuns } = await octokit.checks.listForRef({
      owner,
      repo,
      ref,
    });

    const checks: CICheck[] = checkRuns.check_runs.map((run) => ({
      name: run.name,
      status: this.mapCheckStatus(run.status, run.conclusion),
      conclusion: run.conclusion,
      url: run.html_url ?? '',
      startedAt: run.started_at,
      completedAt: run.completed_at,
    }));

    const failures = checks.filter((c) => c.status === 'failure');
    const pending = checks.filter((c) => c.status === 'pending' || c.status === 'in_progress');

    return {
      allPassing: failures.length === 0 && pending.length === 0,
      anyPending: pending.length > 0,
      checks,
      failures,
    };
  }

  private mapCheckStatus(status: string, conclusion: string | null): CICheck['status'] {
    if (status === 'queued' || status === 'pending') return 'pending';
    if (status === 'in_progress') return 'in_progress';
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure' || conclusion === 'timed_out') return 'failure';
    if (conclusion === 'skipped' || conclusion === 'cancelled') return 'skipped';
    return 'pending';
  }

  // ============================================
  // Feedback Collection
  // ============================================

  /**
   * Collect all feedback on a PR
   */
  async collectFeedback(prNumber: number): Promise<FeedbackItem[]> {
    const [reviewComments, reviews] = await Promise.all([
      this.getReviewComments(prNumber),
      this.getReviews(prNumber),
    ]);

    const feedbackItems: FeedbackItem[] = [];

    // Process inline review comments
    for (const comment of reviewComments) {
      const severity = this.inferSeverity(comment.body);
      feedbackItems.push({
        id: `comment-${comment.id}`,
        author: comment.user?.login ?? 'unknown',
        body: comment.body,
        path: comment.path,
        line: comment.line ?? comment.original_line ?? null,
        severity,
        status: this.inferStatus(comment),
        createdAt: comment.created_at,
        url: comment.html_url,
        isAutoResolvable: this.isAutoResolvable(comment.body, severity),
        suggestedAction: this.extractSuggestion(comment.body),
        resolution: null,
      });
    }

    // Process review bodies (summary comments)
    for (const review of reviews) {
      if (!review.body || review.body.trim() === '') continue;

      const severity = this.inferSeverity(review.body);
      feedbackItems.push({
        id: `review-${review.id}`,
        author: review.user?.login ?? 'unknown',
        body: review.body,
        path: null,
        line: null,
        severity,
        status: 'addressed', // Review summaries are informational
        createdAt: review.submitted_at ?? new Date().toISOString(),
        url: review.html_url,
        isAutoResolvable: false,
        suggestedAction: null,
        resolution: null,
      });
    }

    return feedbackItems;
  }

  private inferSeverity(body: string): FeedbackSeverity {
    const lower = body.toLowerCase();

    if (body.includes('🛑') || body.includes(':stop_sign:') || lower.includes('critical')) {
      return 'critical';
    }
    if (body.includes('medium-priority') || lower.includes('high severity')) {
      return 'high';
    }
    if (body.includes('medium') || lower.includes('should')) {
      return 'medium';
    }
    if (body.includes('nitpick') || body.includes('nit:') || lower.includes('consider')) {
      return 'low';
    }
    if (body.includes('info') || body.includes('note:')) {
      return 'info';
    }

    if (lower.includes('error') || lower.includes('bug') || lower.includes('fix')) {
      return 'high';
    }

    return 'medium';
  }

  private inferStatus(comment: { body: string; in_reply_to_id?: number }): FeedbackStatus {
    if (comment.in_reply_to_id) {
      return 'addressed';
    }
    return 'unaddressed';
  }

  private isAutoResolvable(body: string, severity: FeedbackSeverity): boolean {
    if (body.includes('```suggestion')) return true;
    if (severity === 'low' || severity === 'info') return true;

    const lower = body.toLowerCase();
    if (lower.includes('formatting') || lower.includes('typo') || lower.includes('spelling')) {
      return true;
    }

    return false;
  }

  private extractSuggestion(body: string): string | null {
    const suggestionMatch = body.match(/```suggestion\n([\s\S]*?)```/);
    const suggestion = suggestionMatch?.[1];
    if (suggestion !== undefined) {
      return suggestion.trim();
    }
    return null;
  }
}

// ============================================
// Safe Git Operations
// ============================================

/**
 * Clone a repository with appropriate token.
 * Uses spawnSync for safe command execution (no shell injection).
 */
export function cloneRepo(repoUrl: string, destPath: string): Result<void> {
  const token = getTokenForRepo(repoUrl);
  if (!token) {
    return { success: false, error: `No token available for repo: ${repoUrl}` };
  }

  let cloneUrl = repoUrl;
  if (cloneUrl.startsWith('https://github.com/')) {
    cloneUrl = cloneUrl.replace('https://github.com/', `https://oauth2:${token}@github.com/`);
  } else if (!cloneUrl.includes('@') && !cloneUrl.startsWith('https://')) {
    const org = extractOrg(repoUrl);
    const repoName = repoUrl.replace(`${org}/`, '');
    cloneUrl = `https://oauth2:${token}@github.com/${org}/${repoName}.git`;
  }

  const proc = spawnSync('git', ['clone', cloneUrl, destPath], {
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 120000,
  });

  if (proc.error) {
    return { success: false, error: `Git clone error: ${proc.error.message}` };
  }

  if (proc.status !== 0) {
    const errorOutput = (proc.stderr || 'Unknown error').replace(
      /oauth2:[^@]+@/g,
      'oauth2:[REDACTED]@'
    );
    return { success: false, error: `Git clone failed: ${errorOutput}` };
  }

  return { success: true };
}

/**
 * Validate a git ref/branch name to prevent injection
 */
export function isValidGitRef(ref: string): boolean {
  return /^[a-zA-Z0-9._/-]+$/.test(ref) && ref.length <= 200;
}

/**
 * Validate owner/repo format
 */
export function isValidRepoFormat(repo: string): boolean {
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo) && repo.length <= 200;
}

// ============================================
// Configuration Type Export
// ============================================

export type { GitHubClientConfig as GitHubConfig };
