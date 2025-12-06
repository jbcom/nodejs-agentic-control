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

// Analyzer - unified AI analysis (conversations, PRs, code review)
export {
    Analyzer,
    AIAnalyzer, // Legacy alias
    type AnalyzerOptions,
    type AIAnalyzerOptions, // Legacy alias
} from './analyzer.js';

// Backwards compatibility alias
export { Analyzer as PRAnalyzer } from './analyzer.js';

// MCP client integration
export {
    initializeMCPClients,
    getMCPTools,
    closeMCPClients,
    mcpCredentials,
    MCP_ENV_VARS,
    type MCPClientConfig,
    type MCPClients,
} from './mcp-clients.js';

// Security utilities
export {
    validatePath,
    sanitizeFilename,
    assessCommandSafety,
    type PathValidationResult,
} from './security.js';

// Agent - unified AI agent for all agentic tasks
export {
    Agent,
    runTask,
    runSmartTask,
    TaskAnalysisSchema,
    type AgentConfig,
    type AgentResult,
    type AgentStep,
    type TaskAnalysis,
} from './agent.js';

// PR triage agent (specialized for PR workflows)
export { PRTriageAgent } from './pr-triage-agent.js';

// Issue resolver
export { Resolver, type ResolverConfig } from './resolver.js';

// GitHub client (re-export from github module)
export { GitHubClient, type GitHubConfig } from '../github/client.js';

// Triage orchestrator
export { Triage, type TriageConfig } from './triage.js';

// Types
export * from './types.js';
