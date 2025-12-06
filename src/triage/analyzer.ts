/**
 * Analyzer - Unified AI-powered analysis
 *
 * Combines conversation analysis, PR triage, and code review into one class.
 * Supports multiple AI providers via Vercel AI SDK.
 *
 * This consolidates the former AIAnalyzer and PRAnalyzer classes.
 */

import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { spawnSync } from 'node:child_process';
import { getConfig, log } from '../core/config.js';
import { getEnvForPRReview } from '../core/tokens.js';
import {
    getOrLoadProvider,
    resolveProviderOptions,
    type ProviderOptions,
    type ModelFactory,
} from '../core/providers.js';
import type {
    Conversation,
    ConversationMessage,
    AnalysisResult,
    Task,
    Blocker as CoreBlocker,
    TriageResult as CoreTriageResult,
    CodeReviewResult,
    ReviewIssue,
    ReviewImprovement,
} from '../core/types.js';
import type { FeedbackItem, Blocker, TriageResult, PRStatus, CIStatus } from './types.js';

// ============================================
// Schemas for Structured AI Output
// ============================================

const TaskAnalysisSchema = z.object({
    completedTasks: z.array(
        z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional(),
            priority: z.enum(['critical', 'high', 'medium', 'low', 'info']),
            category: z.enum([
                'bug',
                'feature',
                'security',
                'performance',
                'documentation',
                'infrastructure',
                'dependency',
                'ci',
                'other',
            ]),
            status: z.literal('completed'),
            evidence: z.string().optional(),
            prNumber: z.number().nullable().optional(),
        })
    ),
    outstandingTasks: z.array(
        z.object({
            id: z.string(),
            title: z.string(),
            description: z.string().optional(),
            priority: z.enum(['critical', 'high', 'medium', 'low', 'info']),
            category: z.enum([
                'bug',
                'feature',
                'security',
                'performance',
                'documentation',
                'infrastructure',
                'dependency',
                'ci',
                'other',
            ]),
            status: z.enum(['pending', 'in_progress', 'blocked']),
            blockers: z.array(z.string()).optional(),
            suggestedLabels: z.array(z.string()).optional(),
        })
    ),
    blockers: z.array(
        z.object({
            issue: z.string(),
            severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
            suggestedResolution: z.string().optional(),
        })
    ),
    summary: z.string(),
    recommendations: z.array(z.string()),
});

const CodeReviewSchema = z.object({
    issues: z.array(
        z.object({
            file: z.string(),
            line: z.number().optional(),
            severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
            category: z.enum([
                'bug',
                'security',
                'performance',
                'style',
                'logic',
                'documentation',
                'test',
                'other',
            ]),
            description: z.string(),
            suggestedFix: z.string().optional(),
        })
    ),
    improvements: z.array(
        z.object({
            area: z.string(),
            suggestion: z.string(),
            effort: z.enum(['low', 'medium', 'high']),
        })
    ),
    overallAssessment: z.string(),
    readyToMerge: z.boolean(),
    mergeBlockers: z.array(z.string()),
});

const QuickTriageSchema = z.object({
    priority: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    category: z.enum([
        'bug',
        'feature',
        'security',
        'performance',
        'documentation',
        'infrastructure',
        'dependency',
        'ci',
        'other',
    ]),
    summary: z.string(),
    suggestedAction: z.string(),
    confidence: z.number().min(0).max(1),
});

// ============================================
// Types
// ============================================

export interface AnalyzerOptions extends ProviderOptions {
    /** Repository for GitHub operations (required for issue creation) */
    repo?: string;
}

/**
 * Interface for GitHub client - allows dependency injection
 */
export interface GitHubClientInterface {
    getPR(prNumber: number): Promise<{
        html_url: string;
        title: string;
        merged: boolean;
        state: string;
        mergeable: boolean | null;
        mergeable_state: string;
    }>;
    getCIStatus(prNumber: number): Promise<CIStatus>;
    collectFeedback(prNumber: number): Promise<FeedbackItem[]>;
    getPRFiles(prNumber: number): Promise<Array<{ filename: string }>>;
}

// ============================================
// Analyzer Class
// ============================================

export class Analyzer {
    private providerName: string;
    private model: string;
    private apiKey: string;
    private repo: string | undefined;
    private providerFn: ModelFactory | null = null;

    constructor(options: AnalyzerOptions = {}) {
        const resolved = resolveProviderOptions(options);
        this.providerName = resolved.providerName;
        this.model = resolved.model;
        this.apiKey = resolved.apiKey;
        this.repo = options.repo ?? getConfig().defaultRepository;
    }

    private async getModel(): Promise<unknown> {
        if (!this.providerFn) {
            this.providerFn = await getOrLoadProvider(this.providerName, this.apiKey);
        }
        return this.providerFn(this.model);
    }

    /**
     * Set the repository for GitHub operations
     */
    setRepo(repo: string): void {
        this.repo = repo;
    }

    // ============================================
    // Conversation Analysis
    // ============================================

    /**
     * Analyze a conversation to extract completed/outstanding tasks
     */
    async analyzeConversation(conversation: Conversation): Promise<AnalysisResult> {
        const messages = conversation.messages || [];
        const conversationText = this.prepareConversationText(messages);

        const { object } = await generateObject({
            model: (await this.getModel()) as Parameters<typeof generateObject>[0]['model'],
            schema: TaskAnalysisSchema,
            prompt: `Analyze this agent conversation and extract:
1. COMPLETED TASKS - What was actually finished and merged/deployed
2. OUTSTANDING TASKS - What remains to be done
3. BLOCKERS - Any issues preventing progress
4. SUMMARY - Brief overall assessment
5. RECOMMENDATIONS - What should be done next

Be thorough and specific. Reference PR numbers, file paths, and specific changes where possible.
Generate unique IDs for tasks (e.g., task-001, task-002).

CONVERSATION:
${conversationText}`,
        });

        // Map to our types
        const completedTasks: Task[] = object.completedTasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            category: t.category,
            status: 'completed' as const,
        }));

        const outstandingTasks: Task[] = object.outstandingTasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            category: t.category,
            status: t.status === 'blocked' ? ('blocked' as const) : ('pending' as const),
            blockers: t.blockers,
        }));

        const blockers: CoreBlocker[] = object.blockers.map((b) => ({
            issue: b.issue,
            severity: b.severity,
            suggestedResolution: b.suggestedResolution,
        }));

        return {
            summary: object.summary,
            completedTasks,
            outstandingTasks,
            blockers,
            recommendations: object.recommendations,
        };
    }

    // ============================================
    // Code Review
    // ============================================

    /**
     * Review code changes and identify issues
     */
    async reviewCode(diff: string, context?: string): Promise<CodeReviewResult> {
        const { object } = await generateObject({
            model: (await this.getModel()) as Parameters<typeof generateObject>[0]['model'],
            schema: CodeReviewSchema,
            prompt: `Review this code diff and identify:
1. ISSUES - Security, bugs, performance problems
2. IMPROVEMENTS - Suggestions for better code
3. OVERALL ASSESSMENT - Is this ready to merge?

Be specific about file paths and line numbers.
Focus on real issues, not style nitpicks.

${context ? `CONTEXT:\n${context}\n\n` : ''}DIFF:
${diff}`,
        });

        const issues: ReviewIssue[] = object.issues.map((i) => ({
            file: i.file,
            line: i.line,
            severity: i.severity,
            category: i.category,
            description: i.description,
            suggestedFix: i.suggestedFix,
        }));

        const improvements: ReviewImprovement[] = object.improvements.map((i) => ({
            area: i.area,
            suggestion: i.suggestion,
            effort: i.effort,
        }));

        return {
            readyToMerge: object.readyToMerge,
            mergeBlockers: object.mergeBlockers,
            issues,
            improvements,
            overallAssessment: object.overallAssessment,
        };
    }

    // ============================================
    // Quick Triage
    // ============================================

    /**
     * Quick triage - fast assessment of what needs attention
     */
    async quickTriage(input: string): Promise<CoreTriageResult> {
        const { object } = await generateObject({
            model: (await this.getModel()) as Parameters<typeof generateObject>[0]['model'],
            schema: QuickTriageSchema,
            prompt: `Quickly triage this input and determine:
1. Priority level (critical/high/medium/low/info)
2. Category (bug, feature, documentation, infrastructure, etc.)
3. Brief summary
4. Suggested immediate action
5. Confidence level (0-1)

INPUT:
${input}`,
        });

        return {
            priority: object.priority,
            category: object.category,
            summary: object.summary,
            suggestedAction: object.suggestedAction,
            confidence: object.confidence,
        };
    }

    // ============================================
    // PR Analysis
    // ============================================

    /**
     * Analyze a Pull Request for triage
     */
    async analyzePR(github: GitHubClientInterface, prNumber: number): Promise<TriageResult> {
        // Gather all data
        const [pr, ci, feedback] = await Promise.all([
            github.getPR(prNumber),
            github.getCIStatus(prNumber),
            github.collectFeedback(prNumber),
        ]);

        // Analyze feedback for unaddressed items
        const analyzedFeedback = await this.analyzeFeedback(feedback);
        const unaddressedFeedback = analyzedFeedback.filter((f) => f.status === 'unaddressed');

        // Identify blockers
        const blockers = await this.identifyBlockers(pr, ci, unaddressedFeedback);

        // Determine status
        const status = this.determineStatus(pr, ci, blockers, unaddressedFeedback);

        // Generate next actions
        const nextActions = this.generateNextActions(status, blockers, unaddressedFeedback);

        // Generate summary
        const summary = await this.generatePRSummary(pr, ci, blockers, unaddressedFeedback);

        return {
            prNumber,
            prUrl: pr.html_url,
            prTitle: pr.title,
            status,
            ci,
            feedback: {
                total: feedback.length,
                unaddressed: unaddressedFeedback.length,
                items: analyzedFeedback,
            },
            blockers,
            nextActions,
            summary,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Generate a response for feedback (fix or justification)
     */
    async generateFeedbackResponse(
        feedback: FeedbackItem,
        context: { prTitle: string; files: string[] }
    ): Promise<{ type: 'fix' | 'justification'; content: string }> {
        const { object } = await generateObject({
            model: (await this.getModel()) as Parameters<typeof generateObject>[0]['model'],
            schema: z.object({
                type: z.enum(['fix', 'justification']),
                content: z.string(),
                reasoning: z.string(),
            }),
            prompt: `Determine how to address this PR feedback.

PR: ${context.prTitle}
Files changed: ${context.files.join(', ')}

Feedback from ${feedback.author}:
${feedback.body}

${feedback.path ? `File: ${feedback.path}` : ''}
${feedback.line ? `Line: ${feedback.line}` : ''}

Options:
1. "fix" - Generate code/text to fix the issue
2. "justification" - Explain why this feedback should not be implemented

Choose "fix" if:
- There's a clear suggestion to implement
- The issue is valid and should be fixed
- It's a straightforward change

Choose "justification" if:
- The feedback is a false positive
- It conflicts with project conventions
- It's out of scope for this PR

Provide the content (code fix or justification text) and your reasoning.`,
        });

        return {
            type: object.type,
            content: object.content,
        };
    }

    // ============================================
    // Issue Creation
    // ============================================

    /**
     * Create GitHub issues from analysis.
     * Always uses PR review token for consistent identity.
     */
    async createIssuesFromAnalysis(
        analysis: AnalysisResult,
        options?: {
            dryRun?: boolean;
            labels?: string[];
            assignCopilot?: boolean;
            repo?: string;
        }
    ): Promise<string[]> {
        const repo = options?.repo ?? this.repo;
        if (!repo) {
            throw new Error(
                'Repository is required for issue creation. Set via:\n' +
                    "  - Analyzer constructor: new Analyzer({ repo: 'owner/repo' })\n" +
                    '  - setRepo() method\n' +
                    "  - createIssuesFromAnalysis() options: { repo: 'owner/repo' }\n" +
                    '  - Config file: defaultRepository in agentic.config.json'
            );
        }

        const createdIssues: string[] = [];
        const env = { ...process.env, ...getEnvForPRReview() };

        for (const task of analysis.outstandingTasks) {
            const labels: string[] = [...(options?.labels || [])];

            if (options?.assignCopilot !== false) {
                labels.push('copilot');
            }

            if (task.priority === 'critical' || task.priority === 'high') {
                labels.push(`priority:${task.priority}`);
            }

            const body = `## Summary
${task.description || task.title}

## Priority
\`${task.priority.toUpperCase()}\`

${task.blockers?.length ? `## Blocked By\n${task.blockers.join('\n')}\n` : ''}

## Acceptance Criteria
- [ ] Implementation complete
- [ ] Tests added/updated
- [ ] Documentation updated if needed
- [ ] CI passes

## Context for AI Agents
This issue was auto-generated from agent session analysis.
- Follow your project's contribution guidelines
- Versioning is typically managed automatically — avoid manual version bumps

---
*Generated by agentic-control Analyzer*`;

            if (options?.dryRun) {
                log.info(`[DRY RUN] Would create issue: ${task.title}`);
                createdIssues.push(`[DRY RUN] ${task.title}`);
                continue;
            }

            try {
                // Build args array safely - no shell interpolation
                const args = [
                    'issue',
                    'create',
                    '--repo',
                    repo,
                    '--title',
                    task.title,
                    '--body-file',
                    '-',
                ];

                // Add labels if any
                if (labels.length > 0) {
                    args.push('--label', labels.join(','));
                }

                // Use spawnSync for safe command execution (no shell injection)
                const proc = spawnSync('gh', args, {
                    input: body,
                    encoding: 'utf-8',
                    env,
                    maxBuffer: 10 * 1024 * 1024, // 10MB
                });

                if (proc.error) {
                    throw proc.error;
                }

                if (proc.status !== 0) {
                    throw new Error(proc.stderr || 'gh issue create failed');
                }

                const result = proc.stdout.trim();
                createdIssues.push(result);
                log.info(`✅ Created issue: ${result}`);
            } catch (err) {
                log.error(`❌ Failed to create issue: ${task.title}`, err);
            }
        }

        return createdIssues;
    }

    // ============================================
    // Report Generation
    // ============================================

    /**
     * Generate a comprehensive assessment report
     */
    async generateReport(conversation: Conversation): Promise<string> {
        const analysis = await this.analyzeConversation(conversation);

        return `# Agent Session Assessment Report

## Summary
${analysis.summary}

## Completed Tasks (${analysis.completedTasks.length})
${analysis.completedTasks
    .map(
        (t) => `
### ✅ ${t.title}
${t.description || ''}
`
    )
    .join('\n')}

## Outstanding Tasks (${analysis.outstandingTasks.length})
${analysis.outstandingTasks
    .map(
        (t) => `
### 📋 ${t.title}
**Priority**: ${t.priority}
${t.description || ''}
${t.blockers?.length ? `**Blocked By**: ${t.blockers.join(', ')}` : ''}
`
    )
    .join('\n')}

## Blockers (${analysis.blockers.length})
${analysis.blockers
    .map(
        (b) => `
### ⚠️ ${b.issue}
**Severity**: ${b.severity}
**Suggested Resolution**: ${b.suggestedResolution || 'None provided'}
`
    )
    .join('\n')}

## Recommendations
${analysis.recommendations.map((r) => `- ${r}`).join('\n')}

---
*Generated by agentic-control Analyzer using ${this.providerName}/${this.model}*
*Timestamp: ${new Date().toISOString()}*
`;
    }

    // ============================================
    // Private Helper Methods
    // ============================================

    private prepareConversationText(messages: ConversationMessage[], maxTokens = 100000): string {
        const maxChars = maxTokens * 4;
        const APPROX_CHARS_PER_MESSAGE = 500;

        let text = messages
            .map((m, i) => {
                const role = m.type === 'user_message' ? 'USER' : 'ASSISTANT';
                return `[${i + 1}] ${role}:\n${m.text}\n`;
            })
            .join('\n---\n');

        if (text.length > maxChars) {
            const firstPart = text.slice(0, Math.floor(maxChars * 0.2));
            const lastPart = text.slice(-Math.floor(maxChars * 0.8));
            const truncatedChars = text.length - (firstPart.length + lastPart.length);
            const estimatedMessages = Math.ceil(truncatedChars / APPROX_CHARS_PER_MESSAGE);
            text = `${firstPart}\n\n[... approximately ${estimatedMessages} messages truncated (${truncatedChars} chars) ...]\n\n${lastPart}`;
        }

        return text;
    }

    private async analyzeFeedback(feedback: FeedbackItem[]): Promise<FeedbackItem[]> {
        if (feedback.length === 0) return [];

        const { object } = await generateObject({
            model: (await this.getModel()) as Parameters<typeof generateObject>[0]['model'],
            schema: z.object({
                items: z.array(
                    z.object({
                        id: z.string(),
                        status: z.enum(['unaddressed', 'addressed', 'dismissed', 'wont_fix']),
                        isAutoResolvable: z.boolean(),
                        suggestedAction: z.string().nullable(),
                    })
                ),
            }),
            prompt: `Analyze these PR feedback items and determine their status.

Feedback items:
${feedback
    .map(
        (f) => `
ID: ${f.id}
Author: ${f.author}
Severity: ${f.severity}
Path: ${f.path ?? 'general'}
Body: ${f.body}
---`
    )
    .join('\n')}

For each item:
1. Determine if it's addressed (has been fixed/responded to), unaddressed (needs action), dismissed (explicitly dismissed with reason), or wont_fix
2. Determine if it can be auto-resolved (has suggestion block, is simple fix, etc.)
3. Suggest the action needed if unaddressed

Return analysis for each item by ID.`,
        });

        return feedback.map((item) => {
            const analysis = object.items.find((a) => a.id === item.id);
            if (analysis) {
                return {
                    ...item,
                    status: analysis.status,
                    isAutoResolvable: analysis.isAutoResolvable,
                    suggestedAction: analysis.suggestedAction,
                };
            }
            return item;
        });
    }

    private async identifyBlockers(
        pr: { mergeable: boolean | null; mergeable_state: string },
        ci: CIStatus,
        unaddressedFeedback: FeedbackItem[]
    ): Promise<Blocker[]> {
        const blockers: Blocker[] = [];

        // CI failures
        for (const failure of ci.failures) {
            blockers.push({
                type: 'ci_failure',
                description: `CI check "${failure.name}" failed`,
                isAutoResolvable: true,
                suggestedFix: `Analyze failure logs at ${failure.url} and fix the issue`,
                url: failure.url,
                resolved: false,
            });
        }

        // Unaddressed critical/high feedback
        const criticalFeedback = unaddressedFeedback.filter(
            (f) => f.severity === 'critical' || f.severity === 'high'
        );
        if (criticalFeedback.length > 0) {
            blockers.push({
                type: 'review_feedback',
                description: `${criticalFeedback.length} critical/high severity feedback items unaddressed`,
                isAutoResolvable: criticalFeedback.some((f) => f.isAutoResolvable),
                suggestedFix: 'Address each feedback item with a fix or justified response',
                url: null,
                resolved: false,
            });
        }

        // Merge conflicts
        if (pr.mergeable === false && pr.mergeable_state === 'dirty') {
            blockers.push({
                type: 'merge_conflict',
                description: 'PR has merge conflicts that must be resolved',
                isAutoResolvable: false,
                suggestedFix: 'Rebase or merge main branch and resolve conflicts',
                url: null,
                resolved: false,
            });
        }

        // Branch protection
        if (pr.mergeable_state === 'blocked') {
            blockers.push({
                type: 'branch_protection',
                description: 'Branch protection rules prevent merge',
                isAutoResolvable: false,
                suggestedFix: 'Ensure all required checks pass and approvals are obtained',
                url: null,
                resolved: false,
            });
        }

        return blockers;
    }

    private determineStatus(
        pr: { merged: boolean; state: string },
        ci: CIStatus,
        blockers: Blocker[],
        unaddressedFeedback: FeedbackItem[]
    ): PRStatus {
        if (pr.merged) return 'merged';
        if (pr.state === 'closed') return 'closed';

        const hardBlockers = blockers.filter((b) => !b.isAutoResolvable);
        if (hardBlockers.length > 0) return 'blocked';

        if (ci.anyPending) return 'needs_ci';

        if (ci.failures.length > 0 || unaddressedFeedback.length > 0) {
            return 'needs_work';
        }

        if (ci.allPassing && unaddressedFeedback.length === 0) {
            return 'ready_to_merge';
        }

        return 'needs_review';
    }

    private generateNextActions(
        status: PRStatus,
        blockers: Blocker[],
        unaddressedFeedback: FeedbackItem[]
    ): TriageResult['nextActions'] {
        const actions: TriageResult['nextActions'] = [];

        if (status === 'needs_work') {
            const ciBlockers = blockers.filter((b) => b.type === 'ci_failure');
            for (const blocker of ciBlockers) {
                actions.push({
                    action: `Fix CI failure: ${blocker.description}`,
                    priority: 'critical',
                    automated: true,
                    reason: 'CI must pass before merge',
                });
            }

            for (const feedback of unaddressedFeedback) {
                actions.push({
                    action: feedback.isAutoResolvable
                        ? `Auto-fix: ${feedback.suggestedAction ?? feedback.body.slice(0, 100)}`
                        : `Address feedback from ${feedback.author}: ${feedback.body.slice(0, 100)}`,
                    priority: feedback.severity,
                    automated: feedback.isAutoResolvable,
                    reason: `${feedback.severity} severity feedback requires resolution`,
                });
            }
        }

        if (status === 'needs_review') {
            actions.push({
                action: 'Request AI reviews: /gemini review, /q review',
                priority: 'high',
                automated: true,
                reason: 'AI review required before merge',
            });
        }

        if (status === 'ready_to_merge') {
            actions.push({
                action: 'Merge PR',
                priority: 'high',
                automated: false,
                reason: 'All checks pass and feedback addressed',
            });
        }

        return actions;
    }

    private async generatePRSummary(
        pr: { title: string },
        ci: CIStatus,
        blockers: Blocker[],
        unaddressedFeedback: FeedbackItem[]
    ): Promise<string> {
        const { text } = await generateText({
            model: (await this.getModel()) as Parameters<typeof generateText>[0]['model'],
            prompt: `Generate a concise summary of this PR's triage status.

PR: ${pr.title}
CI: ${ci.allPassing ? '✅ All passing' : ci.anyPending ? '⏳ Pending' : `❌ ${ci.failures.length} failures`}
Blockers: ${blockers.length > 0 ? blockers.map((b) => b.description).join(', ') : 'None'}
Unaddressed feedback: ${unaddressedFeedback.length} items

Write 2-3 sentences summarizing the current state and what needs to happen next.`,
        });

        return text;
    }
}

// ============================================
// Legacy Aliases for backwards compatibility
// ============================================

/** @deprecated Use Analyzer instead */
export { Analyzer as AIAnalyzer };
export type { AnalyzerOptions as AIAnalyzerOptions };
