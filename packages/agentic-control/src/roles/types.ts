/**
 * Agentic Roles - Configurable AI agent personas for repositories
 *
 * Roles define specialized AI behaviors that can be:
 * - Used as default ecosystem roles (Sage, Harvester, Curator, etc.)
 * - Customized per-repository via agentic.config.json
 * - Extended with custom roles
 */

import type { LanguageModel } from 'ai';

/**
 * Built-in role identifiers
 */
export type BuiltInRoleId = 'sage' | 'harvester' | 'curator' | 'reviewer' | 'fixer' | 'delegator';

/**
 * Trigger types that can activate a role
 */
export type RoleTrigger =
  | { type: 'comment'; pattern: string } // e.g., "@sage" or "/sage"
  | { type: 'schedule'; cron: string } // e.g., "0 2 * * *" (2am daily)
  | { type: 'event'; events: string[] } // e.g., ["pull_request.opened"]
  | { type: 'manual' }; // workflow_dispatch only

/**
 * Agent capabilities a role can use
 */
export type AgentCapability =
  | 'answer_questions'
  | 'decompose_tasks'
  | 'route_to_agent'
  | 'unblock'
  | 'review_code'
  | 'review_pr'
  | 'triage_issue'
  | 'fix_ci'
  | 'create_pr'
  | 'merge_pr'
  | 'spawn_cursor'
  | 'spawn_jules'
  | 'post_comment'
  | 'update_labels'
  | 'assign_users';

/**
 * Role definition
 */
export interface RoleDefinition {
  /** Unique identifier for the role */
  id: string;

  /** Human-readable name */
  name: string;

  /** Emoji icon for the role */
  icon: string;

  /** Description of what the role does */
  description: string;

  /** System prompt for the AI when acting as this role */
  systemPrompt: string;

  /** Triggers that activate this role */
  triggers: RoleTrigger[];

  /** Capabilities this role has */
  capabilities: AgentCapability[];

  /** Whether this role can spawn other agents */
  canSpawnAgents: boolean;

  /** Whether this role can modify the repository */
  canModifyRepo: boolean;

  /** Whether this role can merge PRs */
  canMerge: boolean;

  /** Default model to use (can be overridden in config) */
  defaultModel?: string;

  /** Maximum tokens for responses */
  maxTokens?: number;

  /** Temperature for AI responses */
  temperature?: number;
}

/**
 * Role configuration that can be specified in agentic.config.json
 */
export interface RoleConfig {
  /** Enable/disable the role */
  enabled?: boolean;

  /** Override the system prompt */
  systemPrompt?: string;

  /** Override triggers */
  triggers?: RoleTrigger[];

  /** Additional capabilities to grant */
  additionalCapabilities?: AgentCapability[];

  /** Capabilities to revoke */
  revokedCapabilities?: AgentCapability[];

  /** Model override */
  model?: string;

  /** Custom settings */
  settings?: Record<string, unknown>;
}

/**
 * Roles configuration in agentic.config.json
 */
export interface RolesConfig {
  /** Built-in role overrides */
  sage?: RoleConfig;
  harvester?: RoleConfig;
  curator?: RoleConfig;
  reviewer?: RoleConfig;
  fixer?: RoleConfig;
  delegator?: RoleConfig;

  /** Custom roles */
  custom?: Record<string, RoleDefinition>;
}

/**
 * Context provided to a role when executing
 */
export interface RoleExecutionContext {
  /** The role being executed */
  role: RoleDefinition;

  /** AI model to use */
  model: LanguageModel;

  /** Repository context */
  repo: {
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
  };

  /** Trigger that activated the role */
  trigger: {
    type: RoleTrigger['type'];
    source: string; // comment body, event name, etc.
  };

  /** Issue or PR context if applicable */
  issueContext?: {
    number: number;
    title: string;
    body: string;
    author: string;
    labels: string[];
  };

  /** File context if applicable */
  fileContext?: {
    paths: string[];
    diff?: string;
  };
}

/**
 * Result from role execution
 */
export interface RoleExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Response content */
  response?: string;

  /** Structured data output */
  data?: Record<string, unknown>;

  /** Actions taken */
  actions?: Array<{
    type: string;
    description: string;
    result: 'success' | 'failure' | 'skipped';
  }>;

  /** Error if failed */
  error?: string;

  /** Agents spawned */
  spawnedAgents?: Array<{
    type: 'cursor' | 'jules';
    task: string;
    id?: string;
  }>;
}
