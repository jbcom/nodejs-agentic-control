/**
 * AI Triage module for agentic-control
 *
 * Unified AI-powered triage and analysis:
 * - Conversation analysis and task extraction
 * - PR triage with MCP integration
 * - Code review and issue creation
 * - GitHub operations
 * - Multi-provider AI support
 */

// GitHub client (re-export from github module)
export { GitHubClient, type GitHubConfig } from '../github/client.js';
// Agent - unified AI agent for all agentic tasks
export {
  Agent,
  type AgentConfig,
  type AgentResult,
  type AgentStep,
  runSmartTask,
  runTask,
  type TaskAnalysis,
  TaskAnalysisSchema,
} from './agent.js';
// Analyzer - unified AI analysis (conversations, PRs, code review)
// Backwards compatibility alias
export {
  AIAnalyzer, // Legacy alias
  type AIAnalyzerOptions, // Legacy alias
  Analyzer,
  Analyzer as PRAnalyzer,
  type AnalyzerOptions,
} from './analyzer.js';
// MCP client integration
export {
  closeMCPClients,
  getMCPTools,
  initializeMCPClients,
  MCP_ENV_VARS,
  type MCPClientConfig,
  type MCPClients,
  mcpCredentials,
} from './mcp-clients.js';

// PR triage agent (specialized for PR workflows)
export { PRTriageAgent } from './pr-triage-agent.js';

// Issue resolver
export { Resolver, type ResolverConfig } from './resolver.js';
// Security utilities
export {
  assessCommandSafety,
  type PathValidationResult,
  sanitizeFilename,
  validatePath,
} from './security.js';

// Triage orchestrator
export { Triage, type TriageConfig } from './triage.js';

// Types
export * from './types.js';
