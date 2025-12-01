#!/usr/bin/env node
/**
 * agentic-control CLI
 * 
 * Unified command-line interface for AI agent fleet management,
 * triage, and orchestration across multiple GitHub organizations.
 * 
 * All configuration is user-provided - no hardcoded values.
 */

import { Command, Option, InvalidArgumentError } from "commander";
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { Fleet } from "./fleet/index.js";
import { AIAnalyzer } from "./triage/index.js";
import { HandoffManager } from "./handoff/index.js";
import {
  getTokenSummary,
  validateTokens,
  getConfiguredOrgs,
  extractOrg,
} from "./core/tokens.js";
import { initConfig, getDefaultModel, getConfig } from "./core/config.js";
import type { Agent } from "./core/types.js";
import { VERSION } from "./index.js";

const program = new Command();

program
  .name("agentic")
  .description("Unified AI agent fleet management, triage, and orchestration")
  .version(VERSION);

// ============================================
// CLI Argument Validators
// ============================================

/**
 * Parse and validate an integer argument
 */
function parsePositiveInt(value: string, name: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`${name} must be a positive integer`);
  }
  return parsed;
}

/**
 * Validate git ref format (alphanumeric, hyphens, underscores, slashes, dots)
 */
function validateGitRef(ref: string): string {
  if (!/^[a-zA-Z0-9._/-]+$/.test(ref)) {
    throw new InvalidArgumentError("Invalid git ref format");
  }
  if (ref.length > 200) {
    throw new InvalidArgumentError("Git ref too long (max 200 characters)");
  }
  return ref;
}

/**
 * Validate branch name
 */
function validateBranchName(branch: string): string {
  if (!/^[a-zA-Z0-9._/-]+$/.test(branch)) {
    throw new InvalidArgumentError("Invalid branch name format");
  }
  if (branch.length > 200) {
    throw new InvalidArgumentError("Branch name too long (max 200 characters)");
  }
  return branch;
}

// ============================================
// Helper Functions
// ============================================

function output(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

function formatAgent(agent: Agent): string {
  const status = agent.status.padEnd(10);
  const id = agent.id.padEnd(40);
  const repo = (agent.source?.repository?.split("/").pop() ?? "?").padEnd(25);
  const name = (agent.name ?? "").slice(0, 40);
  return `${status} ${id} ${repo} ${name}`;
}

// ============================================
// Token Commands
// ============================================

const tokensCmd = program
  .command("tokens")
  .description("Manage GitHub tokens for multi-org access");

tokensCmd
  .command("status")
  .description("Show token availability status")
  .option("--json", "Output as JSON")
  .action((opts) => {
    const summary = getTokenSummary();
    
    if (opts.json) {
      output(summary, true);
    } else {
      console.log("=== Token Status ===\n");
      for (const [org, info] of Object.entries(summary)) {
        const status = info.available ? "✅" : "❌";
        console.log(`${status} ${org.padEnd(15)} ${info.envVar}`);
      }
    }
  });

tokensCmd
  .command("validate")
  .description("Validate required tokens are available")
  .option("--orgs <orgs>", "Comma-separated org names to validate")
  .action((opts) => {
    const orgs = opts.orgs?.split(",").map((s: string) => s.trim());
    const result = validateTokens(orgs);
    
    if (result.success) {
      console.log("✅ All required tokens are available");
    } else {
      console.error("❌ Missing tokens:");
      for (const missing of result.data ?? []) {
        console.error(`   - ${missing}`);
      }
      process.exit(1);
    }
  });

tokensCmd
  .command("for-repo")
  .description("Show which token would be used for a repository")
  .argument("<repo>", "Repository URL or owner/repo")
  .action((repo) => {
    const org = extractOrg(repo);
    const summary = getTokenSummary();
    const config = org ? summary[org] : null;
    
    console.log(`Repository: ${repo}`);
    console.log(`Organization: ${org ?? "unknown"}`);
    if (config) {
      console.log(`Token Env Var: ${config.envVar}`);
      console.log(`Available: ${config.available ? "✅ Yes" : "❌ No"}`);
    } else {
      console.log("Using default token (GITHUB_TOKEN)");
    }
  });

// ============================================
// Fleet Commands
// ============================================

const fleetCmd = program
  .command("fleet")
  .description("Cursor Background Agent fleet management");

fleetCmd
  .command("list")
  .description("List all agents")
  .option("--running", "Show only running agents")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const fleet = new Fleet();
      const result = opts.running ? await fleet.running() : await fleet.list();
      
      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      if (opts.json) {
        output(result.data, true);
      } else {
        console.log("=== Fleet Status ===\n");
        console.log(`${"STATUS".padEnd(10)} ${"ID".padEnd(40)} ${"REPO".padEnd(25)} NAME`);
        console.log("-".repeat(100));
        for (const agent of result.data ?? []) {
          console.log(formatAgent(agent));
        }
        console.log(`\nTotal: ${result.data?.length ?? 0} agents`);
      }
    } catch (err) {
      console.error("❌ Fleet list failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command("spawn")
  .description("Spawn a new agent")
  .argument("<repo>", "Repository URL (https://github.com/org/repo)")
  .argument("<task>", "Task description")
  .option("--ref <ref>", "Git ref", "main")
  .option("--model <model>", "AI model to use", getDefaultModel())
  .option("--json", "Output as JSON")
  .action(async (repo, task, opts) => {
    try {
      const fleet = new Fleet();
      
      const result = await fleet.spawn({
        repository: repo,
        task,
        ref: opts.ref,
        model: opts.model,
      });

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      if (opts.json) {
        output(result.data, true);
      } else {
        console.log("=== Agent Spawned ===\n");
        console.log(`ID:     ${result.data?.id}`);
        console.log(`Status: ${result.data?.status}`);
        console.log(`Model:  ${opts.model}`);
      }
    } catch (err) {
      console.error("❌ Spawn failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command("followup")
  .description("Send follow-up message to agent")
  .argument("<agent-id>", "Agent ID")
  .argument("<message>", "Message to send")
  .action(async (agentId, message) => {
    try {
      const fleet = new Fleet();
      const result = await fleet.followup(agentId, message);

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      console.log(`✅ Follow-up sent to ${agentId}`);
    } catch (err) {
      console.error("❌ Followup failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command("summary")
  .description("Get fleet summary")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const fleet = new Fleet();
      const result = await fleet.summary();

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      if (opts.json) {
        output(result.data, true);
      } else {
        const s = result.data!;
        console.log("=== Fleet Summary ===\n");
        console.log(`Total:     ${s.total}`);
        console.log(`Running:   ${s.running}`);
        console.log(`Completed: ${s.completed}`);
        console.log(`Failed:    ${s.failed}`);
      }
    } catch (err) {
      console.error("❌ Summary failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command("coordinate")
  .description("Run bidirectional fleet coordinator")
  .addOption(new Option("--pr <number>", "Coordination PR number").argParser((v) => parsePositiveInt(v, "--pr")))
  .requiredOption("--repo <owner/name>", "Repository (owner/repo format)")
  .option("--outbound <ms>", "Outbound poll interval (ms)", "60000")
  .option("--inbound <ms>", "Inbound poll interval (ms)", "15000")
  .option("--agents <ids>", "Comma-separated agent IDs to monitor", "")
  .action(async (opts) => {
    try {
      if (!opts.pr) {
        console.error("❌ --pr is required");
        process.exit(1);
      }

      const outbound = parseInt(opts.outbound, 10);
      const inbound = parseInt(opts.inbound, 10);

      if (isNaN(outbound) || outbound <= 0) {
        console.error("❌ --outbound must be a positive integer");
        process.exit(1);
      }
      if (isNaN(inbound) || inbound <= 0) {
        console.error("❌ --inbound must be a positive integer");
        process.exit(1);
      }

      const fleet = new Fleet();
      
      await fleet.coordinate({
        coordinationPr: opts.pr,
        repo: opts.repo,
        outboundInterval: outbound,
        inboundInterval: inbound,
        agentIds: opts.agents ? opts.agents.split(",").filter(Boolean) : [],
      });
    } catch (err) {
      console.error("❌ Coordinate failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ============================================
// Triage Commands
// ============================================

const triageCmd = program
  .command("triage")
  .description("AI-powered triage and analysis");

triageCmd
  .command("quick")
  .description("Quick AI triage of text input")
  .argument("<input>", "Text to triage (or - for stdin)")
  .option("--model <model>", "Claude model to use", getDefaultModel())
  .action(async (input, opts) => {
    let text = input;
    if (input === "-") {
      text = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) {
        text += chunk;
      }
    }

    try {
      const analyzer = new AIAnalyzer({ model: opts.model });
      const result = await analyzer.quickTriage(text);
      
      console.log("\n=== Triage Result ===\n");
      console.log(`Priority:   ${result.priority.toUpperCase()}`);
      console.log(`Category:   ${result.category}`);
      console.log(`Summary:    ${result.summary}`);
      console.log(`Action:     ${result.suggestedAction}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    } catch (err) {
      console.error("❌ Triage failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

triageCmd
  .command("review")
  .description("AI-powered code review of git diff")
  .option("--base <ref>", "Base ref for diff", "main")
  .option("--head <ref>", "Head ref for diff", "HEAD")
  .option("--model <model>", "Claude model to use", getDefaultModel())
  .action(async (opts) => {
    try {
      // Validate git refs to prevent command injection
      const baseRef = validateGitRef(opts.base);
      const headRef = validateGitRef(opts.head);
      
      // Use spawnSync to safely execute git diff
      const diffProc = spawnSync("git", ["diff", `${baseRef}...${headRef}`], { 
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024, // 10MB max
      });
      
      if (diffProc.error) {
        console.error("❌ git diff failed:", diffProc.error.message);
        process.exit(1);
      }
      
      if (diffProc.status !== 0) {
        console.error("❌ git diff failed:", diffProc.stderr || "Unknown error");
        process.exit(1);
      }
      
      const diff = diffProc.stdout;
      
      if (!diff.trim()) {
        console.log("No changes to review");
        return;
      }

      const analyzer = new AIAnalyzer({ model: opts.model });
      
      console.log(`🔍 Reviewing diff ${baseRef}...${headRef}...`);
      
      const review = await analyzer.reviewCode(diff);
      
      console.log("\n=== Code Review ===\n");
      console.log(`Ready to merge: ${review.readyToMerge ? "✅ YES" : "❌ NO"}`);
      
      if (review.mergeBlockers.length > 0) {
        console.log("\n🚫 Merge Blockers:");
        for (const blocker of review.mergeBlockers) {
          console.log(`   - ${blocker}`);
        }
      }
      
      console.log(`\n📋 Issues (${review.issues.length}):`);
      for (const issue of review.issues) {
        const icon = issue.severity === "critical" ? "🔴" : 
                     issue.severity === "high" ? "🟠" :
                     issue.severity === "medium" ? "🟡" : "⚪";
        console.log(`   ${icon} [${issue.category}] ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
        console.log(`      ${issue.description}`);
      }
      
      console.log("\n📝 Overall Assessment:");
      console.log(`   ${review.overallAssessment}`);
    } catch (err) {
      console.error("❌ Review failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

triageCmd
  .command("analyze")
  .description("Analyze agent conversation")
  .argument("<agent-id>", "Agent ID to analyze")
  .option("-o, --output <path>", "Output report path")
  .option("--create-issues", "Create GitHub issues from outstanding tasks")
  .option("--dry-run", "Show what issues would be created")
  .option("--model <model>", "Claude model to use", getDefaultModel())
  .action(async (agentId, opts) => {
    try {
      const fleet = new Fleet();
      const analyzer = new AIAnalyzer({ model: opts.model });

      console.log(`🔍 Fetching conversation for ${agentId}...`);
      const conv = await fleet.conversation(agentId);
      
      if (!conv.success || !conv.data) {
        console.error(`❌ ${conv.error}`);
        process.exit(1);
      }

      console.log(`📊 Analyzing ${conv.data.messages?.length ?? 0} messages...`);
      
      const analysis = await analyzer.analyzeConversation(conv.data);
      
      console.log("\n=== Analysis Summary ===\n");
      console.log(analysis.summary);
      
      console.log(`\n✅ Completed: ${analysis.completedTasks.length}`);
      console.log(`📋 Outstanding: ${analysis.outstandingTasks.length}`);
      console.log(`⚠️ Blockers: ${analysis.blockers.length}`);

      if (opts.output) {
        const report = await analyzer.generateReport(conv.data);
        writeFileSync(opts.output, report);
        console.log(`\n📝 Report saved to ${opts.output}`);
      }

      if (opts.createIssues || opts.dryRun) {
        console.log("\n🎫 Creating GitHub Issues...");
        const issues = await analyzer.createIssuesFromAnalysis(analysis, { 
          dryRun: opts.dryRun,
        });
        console.log(`Created ${issues.length} issues`);
      }
    } catch (err) {
      console.error("❌ Analysis failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ============================================
// Handoff Commands
// ============================================

const handoffCmd = program
  .command("handoff")
  .description("Station-to-station agent handoff");

handoffCmd
  .command("initiate")
  .description("Initiate handoff to successor agent")
  .argument("<predecessor-id>", "Your agent ID (predecessor)")
  .addOption(new Option("--pr <number>", "Your current PR number").argParser((v) => parsePositiveInt(v, "--pr")))
  .requiredOption("--branch <name>", "Your current branch name")
  .requiredOption("--repo <url>", "Repository URL for successor")
  .option("--ref <ref>", "Git ref for successor", "main")
  .option("--tasks <tasks>", "Comma-separated tasks for successor", "")
  .action(async (predecessorId, opts) => {
    try {
      if (!opts.pr) {
        console.error("❌ --pr is required");
        process.exit(1);
      }

      const manager = new HandoffManager();
      
      console.log("🤝 Initiating station-to-station handoff...\n");
      
      const result = await manager.initiateHandoff(predecessorId, {
        repository: opts.repo,
        ref: opts.ref,
        currentPr: opts.pr,
        currentBranch: validateBranchName(opts.branch),
        tasks: opts.tasks ? opts.tasks.split(",").map((t: string) => t.trim()) : [],
      });

      if (!result.success) {
        console.error(`❌ Handoff failed: ${result.error}`);
        process.exit(1);
      }

      console.log(`\n✅ Handoff initiated`);
      console.log(`   Successor: ${result.successorId}`);
      console.log(`   Healthy: ${result.successorHealthy ? "Yes" : "Pending"}`);
    } catch (err) {
      console.error("❌ Handoff failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

handoffCmd
  .command("confirm")
  .description("Confirm health as successor agent")
  .argument("<predecessor-id>", "Predecessor agent ID")
  .action(async (predecessorId) => {
    try {
      const manager = new HandoffManager();
      const successorId = process.env.CURSOR_AGENT_ID || "successor-agent";
      
      console.log(`🤝 Confirming health to predecessor ${predecessorId}...`);
      await manager.confirmHealthAndBegin(successorId, predecessorId);
      console.log("✅ Health confirmation sent");
    } catch (err) {
      console.error("❌ Confirm failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

handoffCmd
  .command("takeover")
  .description("Merge predecessor PR and take over")
  .argument("<predecessor-id>", "Predecessor agent ID")
  .argument("<pr-number>", "Predecessor PR number", (v) => parsePositiveInt(v, "pr-number"))
  .argument("<new-branch>", "Your new branch name", validateBranchName)
  .option("--admin", "Use admin privileges")
  .option("--auto", "Enable auto-merge")
  .addOption(new Option("--merge-method <method>", "Merge method").choices(["merge", "squash", "rebase"]).default("squash"))
  .action(async (predecessorId, prNumber, newBranch, opts) => {
    try {
      const manager = new HandoffManager();
      
      console.log("🔄 Taking over from predecessor...\n");
      
      const result = await manager.takeover(
        predecessorId,
        prNumber,
        newBranch,
        {
          admin: opts.admin,
          auto: opts.auto,
          mergeMethod: opts.mergeMethod,
          deleteBranch: true,
        }
      );

      if (!result.success) {
        console.error(`❌ Takeover failed: ${result.error}`);
        process.exit(1);
      }

      console.log("✅ Takeover complete!");
    } catch (err) {
      console.error("❌ Takeover failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ============================================
// Config Commands
// ============================================

program
  .command("config")
  .description("Show current configuration")
  .option("--json", "Output as JSON")
  .action((opts) => {
    const cfg = getConfig();
    const configData = {
      defaultModel: getDefaultModel(),
      configuredOrgs: getConfiguredOrgs(),
      tokens: getTokenSummary(),
      defaultRepository: cfg.defaultRepository ?? "(not set)",
      coordinationPr: cfg.coordinationPr ?? "(not set)",
      logLevel: cfg.logLevel,
    };
    
    if (opts.json) {
      output(configData, true);
    } else {
      console.log("=== Configuration ===\n");
      console.log(`Default Model: ${configData.defaultModel}`);
      console.log(`Default Repository: ${configData.defaultRepository}`);
      console.log(`Coordination PR: ${configData.coordinationPr}`);
      console.log(`Log Level: ${configData.logLevel}`);
      console.log(`Configured Orgs: ${configData.configuredOrgs.length > 0 ? configData.configuredOrgs.join(", ") : "(none - configure in agentic.config.json)"}`);
      console.log("\nToken Status:");
      for (const [org, info] of Object.entries(configData.tokens)) {
        const status = info.available ? "✅" : "❌";
        console.log(`  ${status} ${org}: ${info.envVar}`);
      }
    }
  });

program
  .command("init")
  .description("Create a sample configuration file")
  .option("--force", "Overwrite existing config file")
  .action((opts) => {
    const configPath = "agentic.config.json";
    
    if (existsSync(configPath) && !opts.force) {
      console.error(`❌ ${configPath} already exists. Use --force to overwrite.`);
      process.exit(1);
    }
    
    const sampleConfig = {
      "$schema": "https://agentic-control.dev/schema/config.json",
      "tokens": {
        "organizations": {
          "my-org": {
            "name": "my-org",
            "tokenEnvVar": "GITHUB_MY_ORG_TOKEN"
          }
        },
        "defaultTokenEnvVar": "GITHUB_TOKEN",
        "prReviewTokenEnvVar": "GITHUB_TOKEN"
      },
      "defaultModel": "claude-sonnet-4-20250514",
      "defaultRepository": "my-org/my-repo",
      "logLevel": "info"
    };
    
    writeFileSync(configPath, JSON.stringify(sampleConfig, null, 2) + "\n");
    console.log(`✅ Created ${configPath}`);
    console.log("\nEdit this file to configure your organizations and tokens.");
    console.log("See https://github.com/jbcom/agentic-control#configuration for details.");
  });

// ============================================
// Parse and Run
// ============================================

// Initialize config
initConfig();

// Parse CLI
program.parse();
