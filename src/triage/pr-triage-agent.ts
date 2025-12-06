/**
 * PR Triage Agent
 *
 * Specialized agent for triaging and resolving Pull Requests.
 * Combines MCP tools with AI analysis to:
 * - Analyze PR state and feedback
 * - Identify and fix blockers
 * - Address reviewer comments
 * - Ensure CI passes
 * - Prepare PRs for merge
 */

import { generateText, generateObject, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { Agent, type AgentConfig, type AgentResult } from './agent.js';
import {
    initializeMCPClients,
    getMCPTools,
    closeMCPClients,
    type MCPClients,
} from './mcp-clients.js';

// ─────────────────────────────────────────────────────────────────
// Schemas for structured AI output
// ─────────────────────────────────────────────────────────────────

const FeedbackSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'suggestion']);

const FeedbackItemSchema = z.object({
    id: z.string(),
    source: z.string().describe('Who provided this feedback (e.g., gemini-code-assist, copilot)'),
    severity: FeedbackSeveritySchema,
    category: z.enum([
        'bug',
        'security',
        'performance',
        'style',
        'documentation',
        'suggestion',
        'question',
    ]),
    file: z.string().optional(),
    line: z.number().optional(),
    content: z.string(),
    suggestion: z.string().optional().describe('Specific fix suggestion if provided'),
    addressed: z.boolean(),
    addressedBy: z
        .string()
        .optional()
        .describe('How it was addressed (commit SHA, response, etc.)'),
});

const CIStatusSchema = z.object({
    status: z.enum(['passing', 'failing', 'pending', 'unknown']),
    checks: z.array(
        z.object({
            name: z.string(),
            status: z.enum(['success', 'failure', 'pending', 'skipped']),
            url: z.string().optional(),
            summary: z.string().optional(),
        })
    ),
    failureReasons: z.array(z.string()),
});

const PRAnalysisSchema = z.object({
    prNumber: z.number(),
    prUrl: z.string(),
    prTitle: z.string(),
    status: z.enum(['ready', 'needs_work', 'blocked', 'waiting_ci', 'waiting_review']),
    ci: CIStatusSchema,
    feedback: z.object({
        total: z.number(),
        unaddressed: z.number(),
        critical: z.number(),
        items: z.array(FeedbackItemSchema),
    }),
    blockers: z.array(
        z.object({
            type: z.enum([
                'ci_failure',
                'unaddressed_feedback',
                'merge_conflict',
                'missing_approval',
                'other',
            ]),
            description: z.string(),
            autoResolvable: z.boolean(),
            suggestedFix: z.string().optional(),
        })
    ),
    summary: z.string(),
    nextActions: z.array(
        z.object({
            action: z.string(),
            priority: z.enum(['critical', 'high', 'medium', 'low']),
            automated: z.boolean(),
            reason: z.string(),
        })
    ),
});

export type PRAnalysis = z.infer<typeof PRAnalysisSchema>;
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

// ─────────────────────────────────────────────────────────────────
// PR Triage Agent
// ─────────────────────────────────────────────────────────────────

export interface PRTriageConfig extends AgentConfig {
    /** Repository in format owner/repo */
    repository: string;
}

export class PRTriageAgent {
    private config: PRTriageConfig;
    private agent: Agent;
    private mcpClients: MCPClients | null = null;
    private initialized = false;
    /** Promise-based lock to prevent concurrent initialization race conditions */
    private initializationPromise: Promise<void> | null = null;

    constructor(config: PRTriageConfig) {
        this.config = config;
        this.agent = new Agent(config);
    }

    /**
     * Initialize the agent and MCP clients.
     * Thread-safe: concurrent calls will wait for the same initialization to complete.
     */
    async initialize(): Promise<void> {
        // Fast path: already initialized
        if (this.initialized) return;

        // If initialization is in progress, wait for it to complete
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // Start initialization and store the promise so concurrent calls can wait
        this.initializationPromise = this.doInitialize();

        try {
            await this.initializationPromise;
        } catch (error) {
            // Reset on failure so retry is possible
            this.initializationPromise = null;
            throw error;
        }
    }

    /**
     * Internal initialization logic - only called once due to promise lock
     */
    private async doInitialize(): Promise<void> {
        await this.agent.initialize();
        this.mcpClients = await initializeMCPClients(this.config.mcp);
        this.initialized = true;
    }

    async close(): Promise<void> {
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
    async analyze(prNumber: number): Promise<PRAnalysis> {
        await this.initialize();

        const tools = this.mcpClients ? await getMCPTools(this.mcpClients) : {};

        // Use AI with tools to gather PR information
        const gatherResult = await generateText({
            model: anthropic('claude-sonnet-4-20250514'),
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

Use the available tools to get this information.`,
        });

        // Now generate structured analysis
        const analysis = await generateObject({
            model: anthropic('claude-sonnet-4-20250514'),
            schema: PRAnalysisSchema,
            prompt: `Based on this PR information, generate a structured analysis:

${gatherResult.text}

Analyze:
- Overall PR status
- CI status and any failures
- All feedback items (categorize by severity)
- Blockers preventing merge
- Recommended next actions

Be thorough - identify ALL unaddressed feedback items.`,
        });

        return analysis.object;
    }

    /**
     * Generate a human-readable triage report
     */
    async generateReport(prNumber: number): Promise<string> {
        const analysis = await this.analyze(prNumber);
        return this.formatReport(analysis);
    }

    /**
     * Automatically resolve all auto-resolvable issues
     */
    async resolve(prNumber: number): Promise<AgentResult> {
        const analysis = await this.analyze(prNumber);

        const autoResolvable = analysis.blockers.filter((b) => b.autoResolvable);
        const unaddressedFeedback = analysis.feedback.items.filter((f) => !f.addressed);

        if (autoResolvable.length === 0 && unaddressedFeedback.length === 0) {
            return {
                success: true,
                result: 'No issues to resolve - PR appears ready',
                steps: [],
            };
        }

        // Build resolution task
        const task = `Resolve issues in PR #${prNumber} (${this.config.repository}):

## Blockers to Fix
${autoResolvable
    .map(
        (b, i) => `${i + 1}. [${b.type}] ${b.description}
   Suggested fix: ${b.suggestedFix || 'Analyze and fix'}`
    )
    .join('\n\n')}

## Unaddressed Feedback
${unaddressedFeedback
    .map(
        (f, i) => `${i + 1}. [${f.severity}] ${f.source}: ${f.content}
   File: ${f.file || 'N/A'}${f.line ? `:${f.line}` : ''}
   ${f.suggestion ? `Suggestion: ${f.suggestion}` : ''}`
    )
    .join('\n\n')}

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
    async runUntilReady(
        prNumber: number,
        options: {
            maxIterations?: number;
            requestReviews?: boolean;
            autoMerge?: boolean;
        } = {}
    ): Promise<{
        success: boolean;
        finalStatus: PRAnalysis['status'];
        iterations: number;
        report: string;
    }> {
        const maxIterations = options.maxIterations ?? 5;
        let iterations = 0;
        let lastAnalysis: PRAnalysis | null = null;

        while (iterations < maxIterations) {
            iterations++;
            console.log(`\n🔄 Triage iteration ${iterations}/${maxIterations}`);

            // Analyze current state
            const analysis = await this.analyze(prNumber);
            lastAnalysis = analysis;

            console.log(`   Status: ${analysis.status}`);
            console.log(`   CI: ${analysis.ci.status}`);
            console.log(`   Unaddressed feedback: ${analysis.feedback.unaddressed}`);

            // Check if ready
            if (analysis.status === 'ready') {
                if (options.requestReviews) {
                    await this.agent.execute(
                        `Request reviews for PR #${prNumber} if not already requested`
                    );
                }

                if (options.autoMerge) {
                    await this.agent.execute(
                        `Merge PR #${prNumber} using squash merge and delete the branch`
                    );
                }

                return {
                    success: true,
                    finalStatus: 'ready',
                    iterations,
                    report: this.formatReport(analysis),
                };
            }

            // Check if blocked by non-auto-resolvable issues
            const nonResolvableBlockers = analysis.blockers.filter((b) => !b.autoResolvable);
            if (
                nonResolvableBlockers.length > 0 &&
                analysis.blockers.every((b) => !b.autoResolvable)
            ) {
                return {
                    success: false,
                    finalStatus: 'blocked',
                    iterations,
                    report:
                        this.formatReport(analysis) +
                        `\n\n## Cannot Auto-Resolve\n` +
                        nonResolvableBlockers.map((b) => `- ${b.description}`).join('\n'),
                };
            }

            // Try to resolve issues
            const resolution = await this.resolve(prNumber);

            if (!resolution.success) {
                console.log(`   ⚠️ Resolution failed: ${resolution.result}`);
            }

            // Wait for CI if needed
            if (analysis.ci.status === 'pending') {
                console.log('   ⏳ Waiting for CI...');
                await this.waitForCI(prNumber);
            }
        }

        return {
            success: false,
            finalStatus: lastAnalysis?.status ?? 'needs_work',
            iterations,
            report: lastAnalysis ? this.formatReport(lastAnalysis) : 'Analysis failed',
        };
    }

    /**
     * Wait for CI to complete
     */
    private async waitForCI(prNumber: number, timeout = 300000): Promise<void> {
        const startTime = Date.now();
        const pollInterval = 30000;

        while (Date.now() - startTime < timeout) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));

            const analysis = await this.analyze(prNumber);
            if (analysis.ci.status !== 'pending') {
                return;
            }
        }
    }

    /**
     * Format analysis as a readable report
     */
    private formatReport(analysis: PRAnalysis): string {
        const statusEmoji = {
            ready: '✅',
            needs_work: '🔧',
            blocked: '🚫',
            waiting_ci: '⏳',
            waiting_review: '👀',
        };

        const severityEmoji = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢',
            suggestion: '💡',
        };

        let report = `# PR Triage Report: #${analysis.prNumber}

## ${statusEmoji[analysis.status]} Status: ${analysis.status.toUpperCase()}

**${analysis.prTitle}**
${analysis.prUrl}

## CI Status: ${analysis.ci.status}
${analysis.ci.checks.map((c) => `- ${c.status === 'success' ? '✅' : c.status === 'failure' ? '❌' : '⏳'} ${c.name}`).join('\n')}
${analysis.ci.failureReasons.length > 0 ? `\n### Failures:\n${analysis.ci.failureReasons.map((r) => `- ${r}`).join('\n')}` : ''}

## Feedback Summary
- Total: ${analysis.feedback.total}
- Unaddressed: ${analysis.feedback.unaddressed}
- Critical: ${analysis.feedback.critical}

`;

        if (analysis.feedback.items.length > 0) {
            report += `### Feedback Items\n`;
            for (const item of analysis.feedback.items) {
                const status = item.addressed ? '✅' : '❌';
                report += `${status} ${severityEmoji[item.severity]} **${item.source}** [${item.category}]
   ${item.content.slice(0, 200)}${item.content.length > 200 ? '...' : ''}
   ${item.file ? `📁 ${item.file}${item.line ? `:${item.line}` : ''}` : ''}
   ${item.addressed ? `✓ Addressed: ${item.addressedBy}` : ''}

`;
            }
        }

        if (analysis.blockers.length > 0) {
            report += `## 🚧 Blockers\n`;
            for (const blocker of analysis.blockers) {
                const autoIcon = blocker.autoResolvable ? '🤖' : '👤';
                report += `${autoIcon} **${blocker.type}**: ${blocker.description}
   ${blocker.suggestedFix ? `💡 Fix: ${blocker.suggestedFix}` : ''}

`;
            }
        }

        report += `## 📋 Next Actions\n`;
        for (const action of analysis.nextActions) {
            const autoIcon = action.automated ? '🤖' : '👤';
            report += `${autoIcon} [${action.priority}] ${action.action}
   ${action.reason}

`;
        }

        report += `---
*${analysis.summary}*`;

        return report;
    }
}

/**
 * Convenience function for quick PR triage
 */
export async function triagePR(
    repository: string,
    prNumber: number,
    options?: Partial<PRTriageConfig>
): Promise<PRAnalysis> {
    const agent = new PRTriageAgent({
        repository,
        ...options,
    });

    try {
        return await agent.analyze(prNumber);
    } finally {
        await agent.close();
    }
}
