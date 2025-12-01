/**
 * AI Analyzer - Uses Claude for fast triage and assessment
 * 
 * Automatically analyzes:
 * - Conversation history for completed/outstanding tasks
 * - Code changes for issues and improvements
 * - Creates GitHub issues from analysis
 * 
 * All configuration is user-provided - no hardcoded values.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { spawnSync } from "node:child_process";
import { getDefaultModel, log, getConfig } from "../core/config.js";
import { getEnvForPRReview } from "../core/tokens.js";
import type { 
  Conversation, 
  ConversationMessage,
  AnalysisResult, 
  Task, 
  Blocker,
  TriageResult,
  CodeReviewResult,
  ReviewIssue,
  ReviewImprovement,
} from "../core/types.js";

// ============================================
// Schemas for Structured AI Output
// ============================================

const TaskAnalysisSchema = z.object({
  completedTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["critical", "high", "medium", "low", "info"]),
    category: z.enum(["bug", "feature", "security", "performance", "documentation", "infrastructure", "dependency", "ci", "other"]),
    status: z.literal("completed"),
    evidence: z.string().optional(),
    prNumber: z.number().nullable().optional(),
  })),
  outstandingTasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["critical", "high", "medium", "low", "info"]),
    category: z.enum(["bug", "feature", "security", "performance", "documentation", "infrastructure", "dependency", "ci", "other"]),
    status: z.enum(["pending", "in_progress", "blocked"]),
    blockers: z.array(z.string()).optional(),
    suggestedLabels: z.array(z.string()).optional(),
  })),
  blockers: z.array(z.object({
    issue: z.string(),
    severity: z.enum(["critical", "high", "medium", "low", "info"]),
    suggestedResolution: z.string().optional(),
  })),
  summary: z.string(),
  recommendations: z.array(z.string()),
});

const CodeReviewSchema = z.object({
  issues: z.array(z.object({
    file: z.string(),
    line: z.number().optional(),
    severity: z.enum(["critical", "high", "medium", "low", "info"]),
    category: z.enum(["bug", "security", "performance", "style", "logic", "documentation", "test", "other"]),
    description: z.string(),
    suggestedFix: z.string().optional(),
  })),
  improvements: z.array(z.object({
    area: z.string(),
    suggestion: z.string(),
    effort: z.enum(["low", "medium", "high"]),
  })),
  overallAssessment: z.string(),
  readyToMerge: z.boolean(),
  mergeBlockers: z.array(z.string()),
});

const TriageSchema = z.object({
  priority: z.enum(["critical", "high", "medium", "low", "info"]),
  category: z.enum(["bug", "feature", "security", "performance", "documentation", "infrastructure", "dependency", "ci", "other"]),
  summary: z.string(),
  suggestedAction: z.string(),
  confidence: z.number().min(0).max(1),
});

// ============================================
// Types
// ============================================

export interface AIAnalyzerOptions {
  /** Anthropic API key (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Model to use */
  model?: string;
  /** Repository for GitHub operations (required for issue creation) */
  repo?: string;
}

// ============================================
// AI Analyzer Class
// ============================================

export class AIAnalyzer {
  private anthropic: ReturnType<typeof createAnthropic>;
  private model: string;
  private repo: string | undefined;

  constructor(options: AIAnalyzerOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for AI analysis");
    }

    this.anthropic = createAnthropic({ apiKey });
    this.model = options.model ?? getDefaultModel();
    // No hardcoded default - repo must be explicitly configured for issue creation
    this.repo = options.repo ?? getConfig().defaultRepository;
  }

  /**
   * Set the repository for GitHub operations
   */
  setRepo(repo: string): void {
    this.repo = repo;
  }

  /**
   * Analyze a conversation to extract completed/outstanding tasks
   */
  async analyzeConversation(conversation: Conversation): Promise<AnalysisResult> {
    const messages = conversation.messages || [];
    const conversationText = this.prepareConversationText(messages);

    const { object } = await generateObject({
      model: this.anthropic(this.model),
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
    const completedTasks: Task[] = object.completedTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      category: t.category,
      status: "completed" as const,
    }));

    const outstandingTasks: Task[] = object.outstandingTasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      category: t.category,
      status: t.status === "blocked" ? "blocked" as const : "pending" as const,
      blockers: t.blockers,
    }));

    const blockers: Blocker[] = object.blockers.map(b => ({
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

  /**
   * Review code changes and identify issues
   */
  async reviewCode(diff: string, context?: string): Promise<CodeReviewResult> {
    const { object } = await generateObject({
      model: this.anthropic(this.model),
      schema: CodeReviewSchema,
      prompt: `Review this code diff and identify:
1. ISSUES - Security, bugs, performance problems
2. IMPROVEMENTS - Suggestions for better code
3. OVERALL ASSESSMENT - Is this ready to merge?

Be specific about file paths and line numbers.
Focus on real issues, not style nitpicks.

${context ? `CONTEXT:\n${context}\n\n` : ""}DIFF:
${diff}`,
    });

    const issues: ReviewIssue[] = object.issues.map(i => ({
      file: i.file,
      line: i.line,
      severity: i.severity,
      category: i.category,
      description: i.description,
      suggestedFix: i.suggestedFix,
    }));

    const improvements: ReviewImprovement[] = object.improvements.map(i => ({
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

  /**
   * Quick triage - fast assessment of what needs attention
   */
  async quickTriage(input: string): Promise<TriageResult> {
    const { object } = await generateObject({
      model: this.anthropic(this.model),
      schema: TriageSchema,
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

  /**
   * Create GitHub issues from analysis
   * Always uses PR review token for consistent identity
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
        "Repository is required for issue creation. Set via:\n" +
        "  - AIAnalyzer constructor: new AIAnalyzer({ repo: 'owner/repo' })\n" +
        "  - setRepo() method\n" +
        "  - createIssuesFromAnalysis() options: { repo: 'owner/repo' }\n" +
        "  - Config file: defaultRepository in agentic.config.json"
      );
    }

    const createdIssues: string[] = [];
    const env = { ...process.env, ...getEnvForPRReview() };

    for (const task of analysis.outstandingTasks) {
      const labels: string[] = [
        ...(options?.labels || []),
      ];
      
      if (options?.assignCopilot !== false) {
        labels.push("copilot");
      }
      
      if (task.priority === "critical" || task.priority === "high") {
        labels.push(`priority:${task.priority}`);
      }
      
      const body = `## Summary
${task.description || task.title}

## Priority
\`${task.priority.toUpperCase()}\`

${task.blockers?.length ? `## Blocked By\n${task.blockers.join("\n")}\n` : ""}

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
*Generated by agentic-control AI Analyzer*`;

      if (options?.dryRun) {
        log.info(`[DRY RUN] Would create issue: ${task.title}`);
        createdIssues.push(`[DRY RUN] ${task.title}`);
        continue;
      }

      try {
        // Build args array safely - no shell interpolation
        const args = ["issue", "create", "--repo", repo, "--title", task.title, "--body-file", "-"];
        
        // Add labels if any
        if (labels.length > 0) {
          args.push("--label", labels.join(","));
        }

        // Use spawnSync for safe command execution (no shell injection)
        const proc = spawnSync("gh", args, { 
          input: body, 
          encoding: "utf-8", 
          env,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });

        if (proc.error) {
          throw proc.error;
        }

        if (proc.status !== 0) {
          throw new Error(proc.stderr || "gh issue create failed");
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

  /**
   * Generate a comprehensive assessment report
   */
  async generateReport(conversation: Conversation): Promise<string> {
    const analysis = await this.analyzeConversation(conversation);
    
    return `# Agent Session Assessment Report

## Summary
${analysis.summary}

## Completed Tasks (${analysis.completedTasks.length})
${analysis.completedTasks.map(t => `
### ✅ ${t.title}
${t.description || ""}
`).join("\n")}

## Outstanding Tasks (${analysis.outstandingTasks.length})
${analysis.outstandingTasks.map(t => `
### 📋 ${t.title}
**Priority**: ${t.priority}
${t.description || ""}
${t.blockers?.length ? `**Blocked By**: ${t.blockers.join(", ")}` : ""}
`).join("\n")}

## Blockers (${analysis.blockers.length})
${analysis.blockers.map(b => `
### ⚠️ ${b.issue}
**Severity**: ${b.severity}
**Suggested Resolution**: ${b.suggestedResolution || "None provided"}
`).join("\n")}

## Recommendations
${analysis.recommendations.map(r => `- ${r}`).join("\n")}

---
*Generated by agentic-control AI Analyzer using Claude ${this.model}*
*Timestamp: ${new Date().toISOString()}*
`;
  }

  /**
   * Prepare conversation text for analysis
   */
  private prepareConversationText(messages: ConversationMessage[], maxTokens = 100000): string {
    const maxChars = maxTokens * 4;
    const APPROX_CHARS_PER_MESSAGE = 500;
    
    let text = messages
      .map((m, i) => {
        const role = m.type === "user_message" ? "USER" : "ASSISTANT";
        return `[${i + 1}] ${role}:\n${m.text}\n`;
      })
      .join("\n---\n");

    if (text.length > maxChars) {
      const firstPart = text.slice(0, Math.floor(maxChars * 0.2));
      const lastPart = text.slice(-Math.floor(maxChars * 0.8));
      const truncatedChars = text.length - (firstPart.length + lastPart.length);
      const estimatedMessages = Math.ceil(truncatedChars / APPROX_CHARS_PER_MESSAGE);
      text = `${firstPart}\n\n[... approximately ${estimatedMessages} messages truncated (${truncatedChars} chars) ...]\n\n${lastPart}`;
    }

    return text;
  }
}
