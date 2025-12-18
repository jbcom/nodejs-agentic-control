/**
 * GitHub integration module for agentic-control
 *
 * Provides token-aware GitHub operations:
 * - Automatic token selection based on organization
 * - Consistent identity for PR reviews
 * - Repository and PR management
 */

export { cloneRepo, GitHubClient, isValidGitRef, isValidRepoFormat } from './client.js';
