import { z } from 'zod';

// ============================================================================
// Core Triage Types
// ============================================================================

export const FeedbackSeverity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type FeedbackSeverity = z.infer<typeof FeedbackSeverity>;

export const FeedbackStatus = z.enum(['unaddressed', 'addressed', 'dismissed', 'wont_fix']);
export type FeedbackStatus = z.infer<typeof FeedbackStatus>;

export const BlockerType = z.enum([
    'ci_failure',
    'review_feedback',
    'merge_conflict',
    'missing_approval',
    'branch_protection',
    'stale_branch',
]);
export type BlockerType = z.infer<typeof BlockerType>;

export const PRStatus = z.enum([
    'needs_work', // Has unaddressed blockers
    'needs_review', // Waiting for AI/human review
    'needs_ci', // Waiting for CI to complete
    'ready_to_merge', // All checks pass, feedback addressed
    'blocked', // Cannot proceed without human intervention
    'merged', // Already merged
    'closed', // Closed without merge
]);
export type PRStatus = z.infer<typeof PRStatus>;

// ============================================================================
// Feedback Item
// ============================================================================

export const FeedbackItemSchema = z.object({
    id: z.string(),
    author: z.string(),
    body: z.string(),
    path: z.string().nullable(),
    line: z.number().nullable(),
    severity: FeedbackSeverity,
    status: FeedbackStatus,
    createdAt: z.string(),
    url: z.string(),

    // AI analysis
    isAutoResolvable: z.boolean(),
    suggestedAction: z.string().nullable(),
    resolution: z.string().nullable(),
});
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

// ============================================================================
// Blocker
// ============================================================================

export const BlockerSchema = z.object({
    type: BlockerType,
    description: z.string(),
    isAutoResolvable: z.boolean(),
    suggestedFix: z.string().nullable(),
    url: z.string().nullable(),
    resolved: z.boolean(),
});
export type Blocker = z.infer<typeof BlockerSchema>;

// ============================================================================
// CI Status
// ============================================================================

export const CICheckSchema = z.object({
    name: z.string(),
    status: z.enum(['pending', 'in_progress', 'success', 'failure', 'skipped']),
    conclusion: z.string().nullable(),
    url: z.string(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
});
export type CICheck = z.infer<typeof CICheckSchema>;

export const CIStatusSchema = z.object({
    allPassing: z.boolean(),
    anyPending: z.boolean(),
    checks: z.array(CICheckSchema),
    failures: z.array(CICheckSchema),
});
export type CIStatus = z.infer<typeof CIStatusSchema>;

// ============================================================================
// Triage Result
// ============================================================================

export const TriageResultSchema = z.object({
    prNumber: z.number(),
    prUrl: z.string(),
    prTitle: z.string(),
    status: PRStatus,

    ci: CIStatusSchema,

    feedback: z.object({
        total: z.number(),
        unaddressed: z.number(),
        items: z.array(FeedbackItemSchema),
    }),

    blockers: z.array(BlockerSchema),

    nextActions: z.array(
        z.object({
            action: z.string(),
            priority: FeedbackSeverity,
            automated: z.boolean(),
            reason: z.string(),
        })
    ),

    summary: z.string(),

    timestamp: z.string(),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

// ============================================================================
// Action Result
// ============================================================================

export const ActionResultSchema = z.object({
    success: z.boolean(),
    action: z.string(),
    description: z.string(),
    error: z.string().nullable(),
    changes: z
        .array(
            z.object({
                file: z.string(),
                type: z.enum(['created', 'modified', 'deleted']),
            })
        )
        .nullable(),
    commitSha: z.string().nullable(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

// ============================================================================
// Resolution Plan
// ============================================================================

export const ResolutionPlanSchema = z.object({
    prNumber: z.number(),
    steps: z.array(
        z.object({
            order: z.number(),
            action: z.string(),
            description: z.string(),
            automated: z.boolean(),
            estimatedDuration: z.string(),
            dependencies: z.array(z.number()), // Step orders this depends on
        })
    ),
    estimatedTotalDuration: z.string(),
    requiresHumanIntervention: z.boolean(),
    humanInterventionReason: z.string().nullable(),
});
export type ResolutionPlan = z.infer<typeof ResolutionPlanSchema>;
