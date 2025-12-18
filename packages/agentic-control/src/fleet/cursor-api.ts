/**
 * CursorAPI - Direct HTTP client for Cursor Background Agent API
 *
 * Bypasses MCP for direct API access with better performance and reliability.
 * Adapted from cursor-fleet with enhanced error handling.
 */

import type { Agent, Conversation, Repository, Result } from '../core/types.js';

/** Default API base URL - configurable for testing/staging */
const DEFAULT_BASE_URL = 'https://api.cursor.com/v0';

/** Validation regex for agent IDs (alphanumeric with hyphens) */
const AGENT_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

/** Maximum prompt text length */
const MAX_PROMPT_LENGTH = 100000;

/** Maximum repository name length */
const MAX_REPO_LENGTH = 200;

export interface CursorAPIOptions {
  /** API key (defaults to CURSOR_API_KEY env var) */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** API base URL (default: https://api.cursor.com/v0) */
  baseUrl?: string;
}

/**
 * Validates an agent ID to prevent injection attacks
 */
function validateAgentId(agentId: string): void {
  if (!agentId || typeof agentId !== 'string') {
    throw new Error('Agent ID is required and must be a string');
  }
  if (agentId.length > 100) {
    throw new Error('Agent ID exceeds maximum length (100 characters)');
  }
  if (!AGENT_ID_PATTERN.test(agentId)) {
    throw new Error('Agent ID contains invalid characters (only alphanumeric and hyphens allowed)');
  }
}

/**
 * Validates prompt text
 */
function validatePromptText(text: string): void {
  if (!text || typeof text !== 'string') {
    throw new Error('Prompt text is required and must be a string');
  }
  if (text.trim().length === 0) {
    throw new Error('Prompt text cannot be empty');
  }
  if (text.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompt text exceeds maximum length (${MAX_PROMPT_LENGTH} characters)`);
  }
}

/**
 * Validates repository name
 */
function validateRepository(repository: string): void {
  if (!repository || typeof repository !== 'string') {
    throw new Error('Repository is required and must be a string');
  }
  if (repository.length > MAX_REPO_LENGTH) {
    throw new Error(`Repository name exceeds maximum length (${MAX_REPO_LENGTH} characters)`);
  }
  // Basic format check: owner/repo or URL
  if (!repository.includes('/')) {
    throw new Error("Repository must be in format 'owner/repo' or a valid URL");
  }
}

/**
 * Validates webhook URL to prevent SSRF attacks
 * Only allows HTTPS URLs to external hosts
 */
function validateWebhookUrl(url: string): void {
  if (!url || typeof url !== 'string') {
    throw new Error('Webhook URL is required and must be a string');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Webhook URL is not a valid URL');
  }

  // Security: Only allow HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS protocol');
  }

  // Security: Block internal/private IP ranges
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
    /\.internal$/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('Webhook URL cannot point to internal/private addresses');
    }
  }

  // Security: Block common cloud metadata endpoints
  if (hostname === '169.254.169.254' || hostname.includes('metadata.google')) {
    throw new Error('Webhook URL cannot point to cloud metadata services');
  }
}

/**
 * Sanitizes error messages to prevent sensitive data leakage
 */
function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Remove potential API keys, tokens, or sensitive patterns
  return message
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/api[_-]?key[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, 'api_key=[REDACTED]')
    .replace(/token[=:]\s*["']?[a-zA-Z0-9._-]+["']?/gi, 'token=[REDACTED]');
}

export class CursorAPI {
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly baseUrl: string;

  constructor(options: CursorAPIOptions = {}) {
    // Check for API key in order: options, CURSOR_API_KEY
    this.apiKey = options.apiKey ?? process.env.CURSOR_API_KEY ?? '';
    this.timeout = options.timeout ?? 60000;
    // Security: Only allow baseUrl via explicit programmatic configuration
    // Do NOT allow env var override to prevent SSRF attacks
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

    if (!this.apiKey) {
      throw new Error('CURSOR_API_KEY is required. Set it in environment or pass to constructor.');
    }
  }

  /**
   * Check if API key is available
   */
  static isAvailable(): boolean {
    return !!process.env.CURSOR_API_KEY;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: object
  ): Promise<Result<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let details: string;
        try {
          const parsed = JSON.parse(errorText);
          details = parsed.message || parsed.error || 'Unknown API error';
        } catch {
          details = sanitizeError(errorText);
        }

        return {
          success: false,
          error: `API Error ${response.status}: ${details}`,
        };
      }

      // Handle empty responses (e.g., 204 No Content)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return { success: true, data: {} as T };
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        return { success: true, data: {} as T };
      }

      try {
        const data = JSON.parse(text) as T;
        return { success: true, data };
      } catch {
        return {
          success: false,
          error: 'Invalid JSON response from API',
        };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: `Request timeout after ${this.timeout}ms` };
      }
      return { success: false, error: sanitizeError(error) };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * List all agents
   */
  async listAgents(): Promise<Result<Agent[]>> {
    const result = await this.request<{ agents: Agent[]; nextCursor?: string }>('/agents');
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.agents ?? [] };
  }

  /**
   * Get status of a specific agent
   */
  async getAgentStatus(agentId: string): Promise<Result<Agent>> {
    validateAgentId(agentId);
    const encodedId = encodeURIComponent(agentId);
    return this.request<Agent>(`/agents/${encodedId}`);
  }

  /**
   * Get conversation history for an agent
   */
  async getAgentConversation(agentId: string): Promise<Result<Conversation>> {
    validateAgentId(agentId);
    const encodedId = encodeURIComponent(agentId);
    return this.request<Conversation>(`/agents/${encodedId}/conversation`);
  }

  /**
   * Launch a new agent
   *
   * API Spec: https://cursor.com/docs/cloud-agent/api/endpoints
   */
  async launchAgent(options: {
    prompt: {
      text: string;
      images?: Array<{ data: string; dimension?: { width: number; height: number } }>;
    };
    source: {
      repository: string;
      ref?: string;
    };
    target?: {
      autoCreatePr?: boolean;
      branchName?: string;
      openAsCursorGithubApp?: boolean;
      skipReviewerRequest?: boolean;
    };
    webhook?: {
      url: string;
      secret?: string;
    };
  }): Promise<Result<Agent>> {
    validatePromptText(options.prompt.text);
    validateRepository(options.source.repository);

    if (options.source.ref !== undefined) {
      if (typeof options.source.ref !== 'string' || options.source.ref.length > 200) {
        throw new Error('Invalid ref: must be a string under 200 characters');
      }
    }

    // Security: Validate webhook URL to prevent SSRF
    if (options.webhook?.url) {
      validateWebhookUrl(options.webhook.url);
    }

    return this.request<Agent>('/agents', 'POST', options);
  }

  /**
   * Send a follow-up message to an agent
   */
  async addFollowup(agentId: string, prompt: { text: string }): Promise<Result<void>> {
    validateAgentId(agentId);
    validatePromptText(prompt.text);
    const encodedId = encodeURIComponent(agentId);
    return this.request<void>(`/agents/${encodedId}/followup`, 'POST', { prompt });
  }

  /**
   * List available repositories
   */
  async listRepositories(): Promise<Result<Repository[]>> {
    const result = await this.request<{ repositories: Repository[] }>('/repositories');
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.repositories ?? [] };
  }

  /**
   * List available models
   *
   * API Spec: https://cursor.com/docs/cloud-agent/api/endpoints#list-models
   */
  async listModels(): Promise<Result<string[]>> {
    const result = await this.request<{ models: string[] }>('/models');
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.models ?? [] };
  }
}
