/**
 * Core types for agentic-control
 * 
 * These types are shared across all submodules (fleet, triage, github, handoff)
 */

// ============================================
// Organization & Token Types
// ============================================

/**
 * GitHub organization configuration for multi-org token management
 */
export interface OrganizationConfig {
  /** Organization name (e.g., "FlipsideCrypto", "jbcom") */
  name: string;
  /** Environment variable name for the token */
  tokenEnvVar: string;
  /** Default branch for repos in this org */
  defaultBranch?: string;
  /** Whether this is a GitHub Enterprise org */
  isEnterprise?: boolean;
}

/**
 * Token configuration for intelligent switching between orgs
 */
export interface TokenConfig {
  /** Mapping of org name to configuration */
  organizations: Record<string, OrganizationConfig>;
  /** Default token env var when org is unknown */
  defaultTokenEnvVar: string;
  /** Token env var to ALWAYS use for PR reviews (ensures consistent identity) */
  prReviewTokenEnvVar: string;
}

// ============================================
// Agent Types
// ============================================

/**
 * Status of a background agent
 */
export type AgentStatus = 
  | "RUNNING"
  | "FINISHED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "PENDING"
  | "UNKNOWN";

/**
 * Agent source information
 */
export interface AgentSource {
  repository: string;
  ref?: string;
  commitSha?: string;
}

/**
 * Agent target information
 */
export interface AgentTarget {
  branchName?: string;
  url?: string;
  prUrl?: string;
  prNumber?: number;
}

/**
 * Represents a Cursor Background Agent
 */
export interface Agent {
  id: string;
  name?: string;
  status: AgentStatus;
  source: AgentSource;
  target?: AgentTarget;
  createdAt?: string;
  updatedAt?: string;
  summary?: string;
  error?: string;
}

/**
 * Conversation message from an agent
 */
export interface ConversationMessage {
  type: "user_message" | "assistant_message";
  text: string;
  timestamp?: string;
}

/**
 * Full conversation from an agent
 */
export interface Conversation {
  agentId: string;
  messages: ConversationMessage[];
  totalMessages: number;
}

// ============================================
// Result Types
// ============================================

/**
 * Generic result wrapper for operations
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Async result type
 */
export type AsyncResult<T> = Promise<Result<T>>;

// ============================================
// Triage Types
// ============================================

/**
 * Priority levels for triage
 */
export type Priority = "critical" | "high" | "medium" | "low" | "info";

/**
 * Categories for triage items
 */
export type TriageCategory = 
  | "bug"
  | "feature"
  | "security"
  | "performance"
  | "documentation"
  | "infrastructure"
  | "dependency"
  | "ci"
  | "other";

/**
 * Triage result from AI analysis
 */
export interface TriageResult {
  priority: Priority;
  category: TriageCategory;
  summary: string;
  suggestedAction: string;
  confidence: number;
}

/**
 * Task identified from agent conversation analysis
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  category: TriageCategory;
  status: "pending" | "in_progress" | "completed" | "blocked";
  blockers?: string[];
}

/**
 * Blocker identified from analysis
 */
export interface Blocker {
  issue: string;
  severity: Priority;
  suggestedResolution?: string;
}

/**
 * Full analysis result from AI
 */
export interface AnalysisResult {
  summary: string;
  completedTasks: Task[];
  outstandingTasks: Task[];
  blockers: Blocker[];
  recommendations: string[];
}

// ============================================
// Code Review Types
// ============================================

/**
 * Severity of a code review issue
 */
export type ReviewSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Code review issue category
 */
export type ReviewCategory = 
  | "bug"
  | "security"
  | "performance"
  | "style"
  | "logic"
  | "documentation"
  | "test"
  | "other";

/**
 * Individual issue found in code review
 */
export interface ReviewIssue {
  file: string;
  line?: number;
  severity: ReviewSeverity;
  category: ReviewCategory;
  description: string;
  suggestedFix?: string;
}

/**
 * Suggested improvement from code review
 */
export interface ReviewImprovement {
  area: string;
  suggestion: string;
  effort: "low" | "medium" | "high";
}

/**
 * Full code review result
 */
export interface CodeReviewResult {
  readyToMerge: boolean;
  mergeBlockers: string[];
  issues: ReviewIssue[];
  improvements: ReviewImprovement[];
  overallAssessment: string;
}

// ============================================
// Handoff Types
// ============================================

/**
 * Context passed during agent handoff
 */
export interface HandoffContext {
  predecessorId: string;
  predecessorPr: number;
  predecessorBranch: string;
  handoffTime: string;
  completedWork: Task[];
  outstandingTasks: Task[];
  decisions: string[];
  notes?: string;
}

/**
 * Handoff initiation options
 */
export interface HandoffOptions {
  repository: string;
  ref?: string;
  currentPr: number;
  currentBranch: string;
  tasks?: string[];
  healthCheckTimeout?: number;
}

/**
 * Handoff result
 */
export interface HandoffResult {
  success: boolean;
  successorId?: string;
  successorHealthy?: boolean;
  error?: string;
}

// ============================================
// Spawn Types
// ============================================

/**
 * Options for spawning a new agent
 */
export interface SpawnOptions {
  repository: string;
  task: string;
  ref?: string;
  context?: Record<string, unknown>;
  model?: string;
}

/**
 * Diamond pattern orchestration config
 */
export interface DiamondConfig {
  targetRepos: SpawnOptions[];
  counterparty: SpawnOptions;
  controlCenter: string;
}

// ============================================
// GitHub Types
// ============================================

/**
 * GitHub repository info
 */
export interface Repository {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  url: string;
}

/**
 * Pull request info
 */
export interface PullRequest {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  url: string;
  headBranch: string;
  baseBranch: string;
  author: string;
}

/**
 * PR comment for coordination
 */
export interface PRComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}
