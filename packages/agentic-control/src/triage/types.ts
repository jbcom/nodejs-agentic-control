import { z } from 'zod';

// ============================================================================
// Core Triage Types
// ============================================================================

/**
 * Severity levels for feedback items.
 * Used to prioritize which feedback needs immediate attention.
 *
 * @remarks
 * - `critical` - Must be addressed before merge, blocks deployment
 * - `high` - Should be addressed before merge
 * - `medium` - Should be addressed, but not blocking
 * - `low` - Nice to have improvements
 * - `info` - Informational comments, no action required
 */
export const FeedbackSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

/** Severity level for feedback items */
export type FeedbackSeverity = z.infer<typeof FeedbackSeveritySchema>;

/**
 * Status of a feedback item indicating whether it has been addressed.
 *
 * @remarks
 * - `unaddressed` - Feedback has not been addressed yet
 * - `addressed` - Feedback has been addressed with code changes
 * - `dismissed` - Feedback was reviewed and dismissed as not applicable
 * - `wont_fix` - Feedback acknowledged but won't be fixed in this PR
 */
export const FeedbackStatusSchema = z.enum(['unaddressed', 'addressed', 'dismissed', 'wont_fix']);

/** Status of a feedback item */
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;

/**
 * Types of blockers that can prevent a PR from being merged.
 *
 * @remarks
 * - `ci_failure` - One or more CI checks have failed
 * - `review_feedback` - Unaddressed review comments
 * - `merge_conflict` - Branch has conflicts with base branch
 * - `missing_approval` - Required approvals not yet received
 * - `branch_protection` - Branch protection rules not satisfied
 * - `stale_branch` - Branch is significantly behind base branch
 */
export const BlockerTypeSchema = z.enum([
  'ci_failure',
  'review_feedback',
  'merge_conflict',
  'missing_approval',
  'branch_protection',
  'stale_branch',
]);

/** Type of blocker preventing PR merge */
export type BlockerType = z.infer<typeof BlockerTypeSchema>;

/**
 * Overall status of a pull request in the triage workflow.
 *
 * @remarks
 * - `needs_work` - Has unaddressed blockers requiring code changes
 * - `needs_review` - Waiting for AI or human review
 * - `needs_ci` - Waiting for CI checks to complete
 * - `ready_to_merge` - All checks pass, feedback addressed, ready to merge
 * - `blocked` - Cannot proceed without human intervention
 * - `merged` - PR has been merged
 * - `closed` - PR was closed without merging
 */
export const PRStatusSchema = z.enum([
  'needs_work',
  'needs_review',
  'needs_ci',
  'ready_to_merge',
  'blocked',
  'merged',
  'closed',
]);

/** Overall status of a pull request */
export type PRStatus = z.infer<typeof PRStatusSchema>;

// ============================================================================
// Feedback Item
// ============================================================================

/**
 * Schema for a feedback item from a PR review.
 * Represents a single comment or suggestion from a reviewer.
 */
export const FeedbackItemSchema = z.object({
  /** Unique identifier for the feedback item */
  id: z.string(),
  /** GitHub username of the reviewer */
  author: z.string(),
  /** Content of the feedback comment */
  body: z.string(),
  /** File path the feedback relates to, if any */
  path: z.string().nullable(),
  /** Line number in the file, if applicable */
  line: z.number().nullable(),
  /** Severity level of the feedback */
  severity: FeedbackSeveritySchema,
  /** Current status of the feedback */
  status: FeedbackStatusSchema,
  /** ISO timestamp when the feedback was created */
  createdAt: z.string(),
  /** URL to the feedback comment on GitHub */
  url: z.string(),
  /** Whether AI can automatically resolve this feedback */
  isAutoResolvable: z.boolean(),
  /** AI-suggested action to address the feedback */
  suggestedAction: z.string().nullable(),
  /** Description of how the feedback was resolved */
  resolution: z.string().nullable(),
});

/**
 * A feedback item from a PR review.
 * Contains the review comment details, severity, status, and AI analysis.
 */
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

// ============================================================================
// Blocker
// ============================================================================

/**
 * Schema for a blocker preventing PR merge.
 * Represents an issue that must be resolved before the PR can be merged.
 */
export const BlockerSchema = z.object({
  /** Type of blocker */
  type: BlockerTypeSchema,
  /** Human-readable description of the blocker */
  description: z.string(),
  /** Whether AI can automatically resolve this blocker */
  isAutoResolvable: z.boolean(),
  /** Suggested fix for the blocker, if available */
  suggestedFix: z.string().nullable(),
  /** URL with more information about the blocker */
  url: z.string().nullable(),
  /** Whether the blocker has been resolved */
  resolved: z.boolean(),
});

/**
 * A blocker preventing PR merge.
 * Includes the blocker type, description, and resolution status.
 */
export type Blocker = z.infer<typeof BlockerSchema>;

// ============================================================================
// CI Status
// ============================================================================

/**
 * Schema for a single CI check result.
 */
export const CICheckSchema = z.object({
  /** Name of the CI check */
  name: z.string(),
  /** Current status of the check */
  status: z.enum(['pending', 'in_progress', 'success', 'failure', 'skipped']),
  /** Final conclusion of the check, if completed */
  conclusion: z.string().nullable(),
  /** URL to the CI check details */
  url: z.string(),
  /** ISO timestamp when the check started */
  startedAt: z.string().nullable(),
  /** ISO timestamp when the check completed */
  completedAt: z.string().nullable(),
});

/**
 * A single CI check result.
 * Contains the check name, status, and timing information.
 */
export type CICheck = z.infer<typeof CICheckSchema>;

/**
 * Schema for the overall CI status of a PR.
 */
export const CIStatusSchema = z.object({
  /** Whether all CI checks are passing */
  allPassing: z.boolean(),
  /** Whether any CI checks are still pending */
  anyPending: z.boolean(),
  /** List of all CI checks */
  checks: z.array(CICheckSchema),
  /** List of failed CI checks */
  failures: z.array(CICheckSchema),
});

/**
 * Overall CI status for a pull request.
 * Aggregates all CI check results with convenience flags.
 */
export type CIStatus = z.infer<typeof CIStatusSchema>;

// ============================================================================
// Triage Result
// ============================================================================

/**
 * Schema for the complete triage result of a PR.
 * This is the main output of the triage process.
 */
export const TriageResultSchema = z.object({
  /** PR number */
  prNumber: z.number(),
  /** URL to the PR on GitHub */
  prUrl: z.string(),
  /** Title of the PR */
  prTitle: z.string(),
  /** Overall status of the PR */
  status: PRStatusSchema,
  /** CI check status */
  ci: CIStatusSchema,
  /** Feedback summary and items */
  feedback: z.object({
    /** Total number of feedback items */
    total: z.number(),
    /** Number of unaddressed feedback items */
    unaddressed: z.number(),
    /** List of all feedback items */
    items: z.array(FeedbackItemSchema),
  }),
  /** List of blockers preventing merge */
  blockers: z.array(BlockerSchema),
  /** Recommended next actions */
  nextActions: z.array(
    z.object({
      /** Action to take */
      action: z.string(),
      /** Priority of the action */
      priority: FeedbackSeveritySchema,
      /** Whether the action can be automated */
      automated: z.boolean(),
      /** Reason for the recommended action */
      reason: z.string(),
    })
  ),
  /** Human-readable summary of the triage result */
  summary: z.string(),
  /** ISO timestamp when the triage was performed */
  timestamp: z.string(),
});

/**
 * Complete triage result for a pull request.
 * Contains PR status, CI results, feedback, blockers, and recommended actions.
 */
export type TriageResult = z.infer<typeof TriageResultSchema>;

// ============================================================================
// Action Result
// ============================================================================

/**
 * Schema for the result of an automated action.
 */
export const ActionResultSchema = z.object({
  /** Whether the action succeeded */
  success: z.boolean(),
  /** Name of the action that was taken */
  action: z.string(),
  /** Description of what was done */
  description: z.string(),
  /** Error message if the action failed */
  error: z.string().nullable(),
  /** List of file changes made by the action */
  changes: z
    .array(
      z.object({
        /** Path to the changed file */
        file: z.string(),
        /** Type of change */
        type: z.enum(['created', 'modified', 'deleted']),
      })
    )
    .nullable(),
  /** Git commit SHA if changes were committed */
  commitSha: z.string().nullable(),
});

/**
 * Result of an automated action.
 * Contains success status, description, and any file changes made.
 */
export type ActionResult = z.infer<typeof ActionResultSchema>;

// ============================================================================
// Resolution Plan
// ============================================================================

/**
 * Schema for a resolution plan to address PR blockers.
 */
export const ResolutionPlanSchema = z.object({
  /** PR number this plan is for */
  prNumber: z.number(),
  /** Ordered list of steps to resolve blockers */
  steps: z.array(
    z.object({
      /** Order of this step (1-based) */
      order: z.number(),
      /** Action to take */
      action: z.string(),
      /** Detailed description of the step */
      description: z.string(),
      /** Whether this step can be automated */
      automated: z.boolean(),
      /** Estimated time to complete this step */
      estimatedDuration: z.string(),
      /** Step orders that must be completed before this step */
      dependencies: z.array(z.number()),
    })
  ),
  /** Estimated total time to complete the plan */
  estimatedTotalDuration: z.string(),
  /** Whether the plan requires human intervention */
  requiresHumanIntervention: z.boolean(),
  /** Reason human intervention is required, if applicable */
  humanInterventionReason: z.string().nullable(),
});

/**
 * A plan to resolve PR blockers.
 * Contains ordered steps with dependencies and time estimates.
 */
export type ResolutionPlan = z.infer<typeof ResolutionPlanSchema>;
