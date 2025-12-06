/**
 * Intelligent Token Management for Multi-Organization GitHub Access
 *
 * This module provides automatic token switching based on repository organization.
 * ALL configuration is user-provided - no hardcoded organizations or tokens.
 *
 * Configuration methods (in priority order):
 * 1. Programmatic: setTokenConfig() / addOrganization()
 * 2. Config file: agentic.config.json with "tokens" section
 * 3. Environment variables: AGENTIC_ORG_<NAME>_TOKEN pattern
 *
 * @example Config file (agentic.config.json):
 * ```json
 * {
 *   "tokens": {
 *     "organizations": {
 *       "MyOrg": { "name": "MyOrg", "tokenEnvVar": "GITHUB_MYORG_TOKEN" },
 *       "AnotherOrg": { "name": "AnotherOrg", "tokenEnvVar": "ANOTHER_TOKEN" }
 *     },
 *     "defaultTokenEnvVar": "GITHUB_TOKEN",
 *     "prReviewTokenEnvVar": "GITHUB_TOKEN"
 *   }
 * }
 * ```
 *
 * @example Environment variables:
 * ```bash
 * # Define org-to-token mappings
 * export AGENTIC_ORG_MYORG_TOKEN=GITHUB_MYORG_TOKEN
 * export AGENTIC_ORG_ANOTHER_TOKEN=ANOTHER_ORG_PAT
 *
 * # Override defaults
 * export AGENTIC_DEFAULT_TOKEN=GITHUB_TOKEN
 * export AGENTIC_PR_REVIEW_TOKEN=GITHUB_TOKEN
 * ```
 */

import type { TokenConfig, OrganizationConfig, Result } from './types.js';

// ============================================
// Configuration State (NO HARDCODED VALUES)
// ============================================

/**
 * Default token configuration - uses standard GITHUB_TOKEN
 * Users MUST configure their own organizations
 */
const DEFAULT_CONFIG: TokenConfig = {
    organizations: {}, // Empty by default - users configure their own
    defaultTokenEnvVar: 'GITHUB_TOKEN',
    prReviewTokenEnvVar: 'GITHUB_TOKEN',
};

let currentConfig: TokenConfig = { ...DEFAULT_CONFIG };

// ============================================
// Environment Configuration Loading
// ============================================

/**
 * Load organization configs from environment variables
 *
 * Pattern: AGENTIC_ORG_<NAME>_TOKEN=<TOKEN_ENV_VAR_NAME>
 *
 * @example
 * AGENTIC_ORG_MYCOMPANY_TOKEN=GITHUB_MYCOMPANY_TOKEN
 * This maps "mycompany" org to use the value from GITHUB_MYCOMPANY_TOKEN env var
 */
function loadEnvConfig(): void {
    const orgPattern = /^AGENTIC_ORG_([A-Z0-9_]+)_TOKEN$/;

    for (const [key, value] of Object.entries(process.env)) {
        const match = key.match(orgPattern);
        if (match && value) {
            // Convert UPPER_CASE to kebab-case for org name
            const orgName = match[1].toLowerCase().replace(/_/g, '-');
            if (!currentConfig.organizations[orgName]) {
                currentConfig.organizations[orgName] = {
                    name: orgName,
                    tokenEnvVar: value,
                };
            }
        }
    }

    // Override PR review token if specified
    if (process.env.AGENTIC_PR_REVIEW_TOKEN) {
        currentConfig.prReviewTokenEnvVar = process.env.AGENTIC_PR_REVIEW_TOKEN;
    }

    // Override default token if specified
    if (process.env.AGENTIC_DEFAULT_TOKEN) {
        currentConfig.defaultTokenEnvVar = process.env.AGENTIC_DEFAULT_TOKEN;
    }
}

// Load env config on module initialization
loadEnvConfig();

// ============================================
// Public Configuration API
// ============================================

/**
 * Get the current token configuration
 */
export function getTokenConfig(): TokenConfig {
    return { ...currentConfig };
}

/**
 * Update the token configuration
 *
 * @example
 * setTokenConfig({
 *   organizations: {
 *     "my-org": { name: "my-org", tokenEnvVar: "MY_ORG_TOKEN" }
 *   },
 *   prReviewTokenEnvVar: "PR_REVIEW_TOKEN"
 * });
 */
export function setTokenConfig(config: Partial<TokenConfig>): void {
    currentConfig = {
        ...currentConfig,
        ...config,
        organizations: {
            ...currentConfig.organizations,
            ...config.organizations,
        },
    };
}

/**
 * Reset configuration to defaults (useful for testing)
 */
export function resetTokenConfig(): void {
    currentConfig = { ...DEFAULT_CONFIG, organizations: {} };
    loadEnvConfig();
}

/**
 * Add or update an organization configuration
 *
 * @example
 * addOrganization({
 *   name: "my-company",
 *   tokenEnvVar: "GITHUB_MYCOMPANY_TOKEN",
 *   defaultBranch: "main",
 *   isEnterprise: true
 * });
 */
export function addOrganization(org: OrganizationConfig): void {
    currentConfig.organizations[org.name] = org;
}

/**
 * Remove an organization configuration
 */
export function removeOrganization(orgName: string): void {
    delete currentConfig.organizations[orgName];
}

// ============================================
// Organization Extraction
// ============================================

/**
 * Extract organization name from a repository URL or full name
 * Uses a safe regex pattern to prevent ReDoS attacks
 *
 * @example
 * extractOrg("https://github.com/my-org/my-repo") // "my-org"
 * extractOrg("my-org/my-repo") // "my-org"
 * extractOrg("git@github.com:my-org/my-repo.git") // "my-org"
 */
export function extractOrg(repoUrl: string): string | null {
    // Handle full GitHub URLs - safe pattern with character class restriction
    const urlMatch = repoUrl.match(/github\.com[/:]([a-zA-Z0-9_.-]+)/);
    if (urlMatch) {
        return urlMatch[1];
    }

    // Handle owner/repo format
    const shortMatch = repoUrl.match(/^([a-zA-Z0-9_.-]+)\//);
    if (shortMatch) {
        return shortMatch[1];
    }

    return null;
}

// ============================================
// Token Resolution
// ============================================

/**
 * Get the token environment variable name for a given organization
 * Returns the default if org is not configured
 *
 * @param org - Organization name (case-insensitive)
 */
export function getTokenEnvVar(org: string): string {
    // Try exact match first
    const config = currentConfig.organizations[org];
    if (config?.tokenEnvVar) {
        return config.tokenEnvVar;
    }

    // Try case-insensitive match
    const lowerOrg = org.toLowerCase();
    for (const [key, value] of Object.entries(currentConfig.organizations)) {
        if (key.toLowerCase() === lowerOrg && value.tokenEnvVar) {
            return value.tokenEnvVar;
        }
    }

    return currentConfig.defaultTokenEnvVar;
}

/**
 * Get the actual token value for an organization
 *
 * @param org - Organization name
 * @returns Token value or undefined if not set
 */
export function getTokenForOrg(org: string): string | undefined {
    const envVar = getTokenEnvVar(org);
    return process.env[envVar];
}

/**
 * Get the token for a repository URL
 * Automatically extracts the organization and returns the appropriate token
 *
 * @param repoUrl - Repository URL or owner/repo format
 * @returns Token value or undefined if not set
 *
 * @example
 * // If configured: addOrganization({ name: "myorg", tokenEnvVar: "MYORG_TOKEN" })
 * getTokenForRepo("https://github.com/myorg/my-repo")
 * // Returns value of MYORG_TOKEN
 */
export function getTokenForRepo(repoUrl: string): string | undefined {
    const org = extractOrg(repoUrl);
    if (!org) {
        return process.env[currentConfig.defaultTokenEnvVar];
    }
    return getTokenForOrg(org);
}

/**
 * Get the token that should be used for PR reviews
 * Ensures a consistent identity across all PR interactions
 *
 * @returns Token value or undefined if not set
 */
export function getPRReviewToken(): string | undefined {
    return process.env[currentConfig.prReviewTokenEnvVar];
}

/**
 * Get the PR review token environment variable name
 */
export function getPRReviewTokenEnvVar(): string {
    return currentConfig.prReviewTokenEnvVar;
}

// ============================================
// Validation
// ============================================

/**
 * Validate that required tokens are available
 *
 * @param orgs - Organization names to validate (optional, validates all configured if not specified)
 * @returns Validation result with any missing tokens
 */
export function validateTokens(orgs?: string[]): Result<string[]> {
    const missing: string[] = [];
    const orgsToCheck = orgs ?? Object.keys(currentConfig.organizations);

    for (const org of orgsToCheck) {
        const token = getTokenForOrg(org);
        if (!token) {
            const envVar = getTokenEnvVar(org);
            missing.push(`${org}: ${envVar} not set`);
        }
    }

    // Check PR review token
    if (!getPRReviewToken()) {
        missing.push(`PR Review: ${currentConfig.prReviewTokenEnvVar} not set`);
    }

    // Check default token
    if (!process.env[currentConfig.defaultTokenEnvVar]) {
        missing.push(`Default: ${currentConfig.defaultTokenEnvVar} not set`);
    }

    return {
        success: missing.length === 0,
        data: missing,
        error: missing.length > 0 ? `Missing tokens: ${missing.join(', ')}` : undefined,
    };
}

// ============================================
// Organization Configuration Access
// ============================================

/**
 * Get organization configuration (case-insensitive)
 */
export function getOrgConfig(org: string): OrganizationConfig | undefined {
    // Try exact match first
    if (currentConfig.organizations[org]) {
        return currentConfig.organizations[org];
    }

    // Try case-insensitive match
    const lowerOrg = org.toLowerCase();
    for (const [key, value] of Object.entries(currentConfig.organizations)) {
        if (key.toLowerCase() === lowerOrg) {
            return value;
        }
    }

    return undefined;
}

/**
 * Get all configured organizations
 */
export function getConfiguredOrgs(): string[] {
    return Object.keys(currentConfig.organizations);
}

/**
 * Check if an organization is configured (case-insensitive)
 */
export function isOrgConfigured(org: string): boolean {
    if (org in currentConfig.organizations) {
        return true;
    }

    const lowerOrg = org.toLowerCase();
    for (const key of Object.keys(currentConfig.organizations)) {
        if (key.toLowerCase() === lowerOrg) {
            return true;
        }
    }

    return false;
}

// ============================================
// Environment Helpers for Subprocesses
// ============================================

/**
 * Create environment variables object for a subprocess targeting a specific org
 * Useful when spawning child processes that need the correct GitHub token
 *
 * @param repoUrl - Repository URL to get token for
 * @returns Object with GH_TOKEN and GITHUB_TOKEN set
 *
 * @example
 * import { spawnSync } from 'node:child_process';
 * const proc = spawnSync('gh', ['pr', 'list'], {
 *   env: { ...process.env, ...getEnvForRepo("owner/repo") }
 * });
 */
export function getEnvForRepo(repoUrl: string): Record<string, string> {
    const token = getTokenForRepo(repoUrl);
    if (!token) {
        return {};
    }
    return {
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
    };
}

/**
 * Create environment variables for PR review operations
 * Uses the configured PR review identity
 *
 * @returns Object with GH_TOKEN and GITHUB_TOKEN set for PR review
 */
export function getEnvForPRReview(): Record<string, string> {
    const token = getPRReviewToken();
    if (!token) {
        return {};
    }
    return {
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
    };
}

// ============================================
// Convenience Utilities
// ============================================

/**
 * Check if we have a valid token for an organization
 */
export function hasTokenForOrg(org: string): boolean {
    return !!getTokenForOrg(org);
}

/**
 * Check if we have a valid token for a repository
 */
export function hasTokenForRepo(repoUrl: string): boolean {
    return !!getTokenForRepo(repoUrl);
}

/**
 * Get a summary of token availability for debugging/display
 */
export function getTokenSummary(): Record<
    string,
    { envVar: string; available: boolean; configured: boolean }
> {
    const summary: Record<string, { envVar: string; available: boolean; configured: boolean }> = {};

    for (const org of getConfiguredOrgs()) {
        const envVar = getTokenEnvVar(org);
        summary[org] = {
            envVar,
            available: !!process.env[envVar],
            configured: true,
        };
    }

    summary['_default'] = {
        envVar: currentConfig.defaultTokenEnvVar,
        available: !!process.env[currentConfig.defaultTokenEnvVar],
        configured: true,
    };

    summary['_pr_review'] = {
        envVar: currentConfig.prReviewTokenEnvVar,
        available: !!getPRReviewToken(),
        configured: true,
    };

    return summary;
}
