#!/usr/bin/env node

/**
 * agentic-control CLI
 *
 * Unified command-line interface for AI agent fleet management,
 * triage, and orchestration across multiple GitHub organizations.
 *
 * All configuration is user-provided - no hardcoded values.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { Command, InvalidArgumentError, Option } from 'commander';
import { getConfig, getDefaultModel, getFleetDefaults, initConfig } from './core/config.js';
import { safeGitCommand } from './core/subprocess.js';
import {
  extractOrg,
  getConfiguredOrgs,
  getTokenForRepo,
  getTokenSummary,
  validateTokens,
} from './core/tokens.js';
import type { Agent, Result } from './core/types.js';
import { Fleet } from './fleet/index.js';
import { HandoffManager } from './handoff/index.js';
import { VERSION } from './index.js';
import {
  DEFAULT_ROLES,
  executeSageRole,
  findRoleByTrigger,
  getDefaultRoleIds,
  getEffectiveRole,
  listRoles,
} from './roles/index.js';
import { AIAnalyzer } from './triage/index.js';

const program = new Command();

program
  .name('agentic')
  .description('Unified AI agent fleet management, triage, and orchestration')
  .version(VERSION);

// ============================================
// CLI Argument Validators
// ============================================

/**
 * Parse and validate an integer argument
 */
function parsePositiveInt(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(`${name} must be a positive integer`);
  }
  return parsed;
}

/**
 * Validate git ref format (alphanumeric, hyphens, underscores, slashes, dots)
 */
function validateGitRef(ref: string): string {
  if (!/^[a-zA-Z0-9._/-]+$/.test(ref)) {
    throw new InvalidArgumentError('Invalid git ref format');
  }
  if (ref.length > 200) {
    throw new InvalidArgumentError('Git ref too long (max 200 characters)');
  }
  return ref;
}

/**
 * Validate branch name
 */
function validateBranchName(branch: string): string {
  if (!/^[a-zA-Z0-9._/-]+$/.test(branch)) {
    throw new InvalidArgumentError('Invalid branch name format');
  }
  if (branch.length > 200) {
    throw new InvalidArgumentError('Branch name too long (max 200 characters)');
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
  const repo = (agent.source?.repository?.split('/').pop() ?? '?').padEnd(25);
  const name = (agent.name ?? '').slice(0, 40);
  return `${status} ${id} ${repo} ${name}`;
}

// ============================================
// Token Commands
// ============================================

const tokensCmd = program
  .command('tokens')
  .description('Manage GitHub tokens for multi-org access');

tokensCmd
  .command('status')
  .description('Show token availability status')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const summary = getTokenSummary();

    if (opts.json) {
      output(summary, true);
    } else {
      console.log('=== Token Status ===\n');
      for (const [org, info] of Object.entries(summary)) {
        const status = info.available ? '✅' : '❌';
        console.log(`${status} ${org.padEnd(15)} ${info.envVar}`);
      }
    }
  });

tokensCmd
  .command('validate')
  .description('Validate required tokens are available')
  .option('--orgs <orgs>', 'Comma-separated org names to validate')
  .action((opts) => {
    const orgs = opts.orgs?.split(',').map((s: string) => s.trim());
    const result = validateTokens(orgs);

    if (result.success) {
      console.log('✅ All required tokens are available');
    } else {
      console.error('❌ Missing tokens:');
      for (const missing of result.data ?? []) {
        console.error(`   - ${missing}`);
      }
      process.exit(1);
    }
  });

tokensCmd
  .command('for-repo')
  .description('Show which token would be used for a repository')
  .argument('<repo>', 'Repository URL or owner/repo')
  .action((repo) => {
    const org = extractOrg(repo);
    const summary = getTokenSummary();
    const config = org ? summary[org] : null;

    console.log(`Repository: ${repo}`);
    console.log(`Organization: ${org ?? 'unknown'}`);
    if (config) {
      console.log(`Token Env Var: ${config.envVar}`);
      console.log(`Available: ${config.available ? '✅ Yes' : '❌ No'}`);
    } else {
      console.log('Using default token (GITHUB_TOKEN)');
    }
  });

// ============================================
// Fleet Commands
// ============================================

const fleetCmd = program.command('fleet').description('Cursor Background Agent fleet management');

fleetCmd
  .command('list')
  .description('List all agents')
  .option('--running', 'Show only running agents')
  .option('--status <status>', 'Filter by status (RUNNING, COMPLETED, FAILED, CANCELLED)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const fleet = new Fleet();
      let result: Result<Agent[]>;

      if (opts.running) {
        result = await fleet.running();
      } else if (opts.status) {
        result = await fleet.listByStatus(opts.status.toUpperCase());
      } else {
        result = await fleet.list();
      }

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      if (opts.json) {
        output(result.data, true);
      } else {
        console.log('=== Fleet Status ===\n');
        console.log(`${'STATUS'.padEnd(10)} ${'ID'.padEnd(40)} ${'REPO'.padEnd(25)} NAME`);
        console.log('-'.repeat(100));
        for (const agent of result.data ?? []) {
          console.log(formatAgent(agent));
        }
        console.log(`\nTotal: ${result.data?.length ?? 0} agents`);
      }
    } catch (err) {
      console.error('❌ Fleet list failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('repos')
  .description('List available repositories')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const fleet = new Fleet();
      const result = await fleet.repositories();

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      if (opts.json) {
        output(result.data, true);
      } else {
        console.log('=== Available Repositories ===\n');
        for (const repo of result.data ?? []) {
          const visibility = repo.isPrivate ? '🔒' : '🌍';
          console.log(`${visibility} ${repo.fullName} (${repo.defaultBranch})`);
        }
        console.log(`\nTotal: ${result.data?.length ?? 0} repositories`);
      }
    } catch (err) {
      console.error('❌ Failed to list repositories:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('get')
  .description('Get details for a specific agent')
  .argument('<agent-id>', 'Agent ID')
  .option('--json', 'Output as JSON')
  .action(async (agentId, opts) => {
    try {
      const fleet = new Fleet();
      const result = await fleet.status(agentId);

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      const agent = result.data;
      if (!agent) {
        console.error(`❌ Agent not found: ${agentId}`);
        process.exit(1);
      }

      if (opts.json) {
        output(agent, true);
      } else {
        console.log('=== Agent Details ===\n');
        console.log(`ID:         ${agent.id}`);
        console.log(`Name:       ${agent.name ?? '(unnamed)'}`);
        console.log(`Status:     ${agent.status}`);
        console.log(`Repository: ${agent.source?.repository ?? 'N/A'}`);
        console.log(`Ref:        ${agent.source?.ref ?? 'N/A'}`);
        if (agent.target?.branchName) {
          console.log(`Branch:     ${agent.target.branchName}`);
        }
        if (agent.target?.prUrl) {
          console.log(`PR:         ${agent.target.prUrl}`);
        }
        if (agent.target?.url) {
          console.log(`URL:        ${agent.target.url}`);
        }
        if (agent.createdAt) {
          console.log(`Created:    ${agent.createdAt}`);
        }
        if (agent.summary) {
          console.log(`\nSummary:\n${agent.summary}`);
        }
        if (agent.error) {
          console.log(`\n❌ Error:\n${agent.error}`);
        }
      }
    } catch (err) {
      console.error('❌ Failed to get agent:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('conversation')
  .description('Get conversation history for an agent')
  .argument('<agent-id>', 'Agent ID')
  .option('--json', 'Output as JSON')
  .option('-o, --output <path>', 'Save to file')
  .action(async (agentId, opts) => {
    try {
      const fleet = new Fleet();
      const result = await fleet.conversation(agentId);

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      const conv = result.data;
      if (!conv) {
        console.error(`❌ Conversation not found for agent: ${agentId}`);
        process.exit(1);
      }

      if (opts.output) {
        writeFileSync(opts.output, JSON.stringify(conv, null, 2));
        console.log(`✅ Saved conversation to ${opts.output}`);
        return;
      }

      if (opts.json) {
        output(conv, true);
      } else {
        console.log(`=== Conversation (${conv.totalMessages} messages) ===\n`);
        for (const msg of conv.messages ?? []) {
          const role = msg.type === 'user_message' ? '👤 USER' : '🤖 ASSISTANT';
          const time = msg.timestamp ? ` (${msg.timestamp})` : '';
          console.log(`${role}${time}:`);
          console.log(msg.text);
          console.log(`\n${'-'.repeat(60)}\n`);
        }
      }
    } catch (err) {
      console.error('❌ Failed to get conversation:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('spawn')
  .description('Spawn a new agent')
  .argument('<repo>', 'Repository URL (https://github.com/org/repo)')
  .argument('<task>', 'Task description')
  .option('--ref <ref>', 'Git ref (branch, tag, commit)', 'main')
  .option('--auto-pr', 'Auto-create PR when agent completes (or set in config)')
  .option('--no-auto-pr', 'Disable auto-create PR')
  .option('--branch <name>', 'Custom branch name for the agent')
  .option('--as-app', 'Open PR as Cursor GitHub App (or set in config)')
  .option('--json', 'Output as JSON')
  .action(async (repo, task, opts) => {
    try {
      const fleet = new Fleet();
      const defaults = getFleetDefaults();

      // Merge CLI options with config defaults
      // Note: Commander sets opts.autoPr to false for --no-auto-pr, true for --auto-pr, undefined for neither
      // We need to check if it was explicitly set (not undefined) before falling back to defaults
      const autoCreatePr =
        opts.autoPr !== undefined ? opts.autoPr : (defaults.autoCreatePr ?? false);
      const openAsCursorGithubApp = opts.asApp ?? defaults.openAsCursorGithubApp ?? false;

      const result = await fleet.spawn({
        repository: repo,
        task,
        ref: opts.ref,
        target: {
          autoCreatePr,
          branchName: opts.branch,
          openAsCursorGithubApp,
        },
      });

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      if (opts.json) {
        output(result.data, true);
      } else {
        console.log('=== Agent Spawned ===\n');
        console.log(`ID:     ${result.data?.id}`);
        console.log(`Status: ${result.data?.status}`);
        console.log(`Repo:   ${repo}`);
        console.log(`Ref:    ${opts.ref}`);
        if (opts.branch) console.log(`Branch: ${opts.branch}`);
        if (autoCreatePr) console.log(`Auto PR: enabled`);
      }
    } catch (err) {
      console.error('❌ Spawn failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('followup')
  .description('Send follow-up message to agent')
  .argument('<agent-id>', 'Agent ID')
  .argument('<message>', 'Message to send')
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
      console.error('❌ Followup failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('models')
  .description('List available Cursor models')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const fleet = new Fleet();
      const result = await fleet.listModels();

      if (!result.success) {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }

      if (opts.json) {
        output(result.data, true);
      } else {
        console.log('=== Available Cursor Models ===\n');
        for (const model of result.data ?? []) {
          console.log(`  - ${model}`);
        }
      }
    } catch (err) {
      console.error('❌ Failed to list models:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('summary')
  .description('Get fleet summary')
  .option('--json', 'Output as JSON')
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
      } else if (result.data) {
        const s = result.data;
        if (!s || Array.isArray(s)) {
          console.error('❌ Invalid summary data');
          process.exit(1);
        }
        console.log('=== Fleet Summary ===\n');
        console.log(`Total:     ${s.total}`);
        console.log(`Running:   ${s.running}`);
        console.log(`Completed: ${s.completed}`);
        console.log(`Failed:    ${s.failed}`);
      }
    } catch (err) {
      console.error('❌ Summary failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

fleetCmd
  .command('coordinate')
  .description('Run bidirectional fleet coordinator')
  .addOption(
    new Option('--pr <number>', 'Coordination PR number').argParser((v) =>
      parsePositiveInt(v, '--pr')
    )
  )
  .requiredOption('--repo <owner/name>', 'Repository (owner/repo format)')
  .option('--outbound <ms>', 'Outbound poll interval (ms)', '60000')
  .option('--inbound <ms>', 'Inbound poll interval (ms)', '15000')
  .option('--agents <ids>', 'Comma-separated agent IDs to monitor', '')
  .action(async (opts) => {
    try {
      if (!opts.pr) {
        console.error('❌ --pr is required');
        process.exit(1);
      }

      const outbound = Number.parseInt(opts.outbound, 10);
      const inbound = Number.parseInt(opts.inbound, 10);

      if (Number.isNaN(outbound) || outbound <= 0) {
        console.error('❌ --outbound must be a positive integer');
        process.exit(1);
      }
      if (Number.isNaN(inbound) || inbound <= 0) {
        console.error('❌ --inbound must be a positive integer');
        process.exit(1);
      }

      const fleet = new Fleet();

      await fleet.coordinate({
        coordinationPr: opts.pr,
        repo: opts.repo,
        outboundInterval: outbound,
        inboundInterval: inbound,
        agentIds: opts.agents ? opts.agents.split(',').filter(Boolean) : [],
      });
    } catch (err) {
      console.error('❌ Coordinate failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ============================================
// Triage Commands
// ============================================

const triageCmd = program.command('triage').description('AI-powered triage and analysis');

triageCmd
  .command('models')
  .description('List available AI models for triage')
  .option('--provider <name>', 'Provider to list models for (anthropic, openai, google, mistral)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    // Common models by provider
    const modelsByProvider: Record<string, { id: string; name: string; description: string }[]> = {
      anthropic: [
        {
          id: 'claude-sonnet-4-20250514',
          name: 'Claude Sonnet 4',
          description: 'Balanced performance (recommended)',
        },
        {
          id: 'claude-opus-4-20250514',
          name: 'Claude Opus 4',
          description: 'Most capable, complex reasoning',
        },
        {
          id: 'claude-sonnet-4-5-20250929',
          name: 'Claude Sonnet 4.5',
          description: 'Latest Sonnet release',
        },
        {
          id: 'claude-opus-4-5-20251101',
          name: 'Claude Opus 4.5',
          description: 'Latest Opus release',
        },
        {
          id: 'claude-haiku-4-5-20251001',
          name: 'Claude Haiku 4.5',
          description: 'Fastest, lightweight tasks',
        },
      ],
      openai: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship multimodal (recommended)' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous flagship' },
        { id: 'gpt-4', name: 'GPT-4', description: 'Original GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast, cost-effective' },
        { id: 'o1', name: 'o1', description: 'Advanced reasoning' },
        { id: 'o1-mini', name: 'o1-mini', description: 'Fast reasoning' },
      ],
      google: [
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          description: 'Most capable (recommended)',
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          description: 'Fast and efficient',
        },
        {
          id: 'gemini-1.5-flash-8b',
          name: 'Gemini 1.5 Flash 8B',
          description: 'Lightweight, high volume',
        },
        {
          id: 'gemini-1.0-pro',
          name: 'Gemini 1.0 Pro',
          description: 'Previous generation',
        },
      ],
      mistral: [
        {
          id: 'mistral-large-latest',
          name: 'Mistral Large',
          description: 'Most capable (recommended)',
        },
        { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced' },
        {
          id: 'mistral-small-latest',
          name: 'Mistral Small',
          description: 'Fast and efficient',
        },
        { id: 'codestral-latest', name: 'Codestral', description: 'Code-optimized' },
        { id: 'open-mixtral-8x22b', name: 'Mixtral 8x22B', description: 'Open-weight MoE' },
      ],
      azure: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Use your Azure deployment name' },
        { id: 'gpt-4', name: 'GPT-4', description: 'Use your Azure deployment name' },
        {
          id: 'gpt-35-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'Use your Azure deployment name',
        },
      ],
    };

    const providers = opts.provider ? [opts.provider] : Object.keys(modelsByProvider);

    if (opts.json) {
      const result = providers.reduce(
        (acc, p) => {
          if (modelsByProvider[p]) {
            acc[p] = modelsByProvider[p];
          }
          return acc;
        },
        {} as Record<string, typeof modelsByProvider.anthropic>
      );
      output(result, true);
      return;
    }

    console.log('=== Available AI Models for Triage ===\n');

    for (const provider of providers) {
      const models = modelsByProvider[provider];
      if (!models) {
        console.log(`Unknown provider: ${provider}\n`);
        continue;
      }

      console.log(`📦 ${provider.toUpperCase()}`);
      console.log('-'.repeat(60));
      for (const model of models) {
        console.log(`  ${model.id.padEnd(30)} ${model.description}`);
      }
      console.log();
    }

    console.log('💡 Configure in agentic.config.json:');
    console.log(
      '   { "triage": { "provider": "anthropic", "model": "claude-sonnet-4-20250514" } }'
    );
    console.log();
    console.log('📚 For live model lists, check provider documentation:');
    console.log('   Anthropic: https://docs.anthropic.com/en/docs/about-claude/models');
    console.log('   OpenAI:    https://platform.openai.com/docs/models');
    console.log('   Google:    https://ai.google.dev/gemini-api/docs/models/gemini');
    console.log('   Mistral:   https://docs.mistral.ai/getting-started/models/');
  });

triageCmd
  .command('quick')
  .description('Quick AI triage of text input')
  .argument('<input>', 'Text to triage (or - for stdin)')
  .option('--model <model>', 'Claude model to use', getDefaultModel())
  .action(async (input, opts) => {
    let text = input;
    if (input === '-') {
      text = '';
      process.stdin.setEncoding('utf8');
      for await (const chunk of process.stdin) {
        text += chunk;
      }
    }

    try {
      const analyzer = new AIAnalyzer({ model: opts.model });
      const result = await analyzer.quickTriage(text);

      console.log('\n=== Triage Result ===\n');
      console.log(`Priority:   ${result.priority.toUpperCase()}`);
      console.log(`Category:   ${result.category}`);
      console.log(`Summary:    ${result.summary}`);
      console.log(`Action:     ${result.suggestedAction}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    } catch (err) {
      console.error('❌ Triage failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

triageCmd
  .command('review')
  .description('AI-powered code review of git diff')
  .option('--base <ref>', 'Base ref for diff', 'main')
  .option('--head <ref>', 'Head ref for diff', 'HEAD')
  .option('--model <model>', 'Claude model to use', getDefaultModel())
  .action(async (opts) => {
    try {
      // Validate git refs to prevent command injection
      const baseRef = validateGitRef(opts.base);
      const headRef = validateGitRef(opts.head);

      // Use safe git command to execute git diff
      const diffResult = safeGitCommand(['diff', `${baseRef}...${headRef}`]);

      if (!diffResult.success) {
        console.error('❌ git diff failed:', diffResult.stderr || 'Unknown error');
        process.exit(1);
      }

      const diff = diffResult.stdout;

      if (!diff.trim()) {
        console.log('No changes to review');
        return;
      }

      const analyzer = new AIAnalyzer({ model: opts.model });

      console.log(`🔍 Reviewing diff ${baseRef}...${headRef}...`);

      const review = await analyzer.reviewCode(diff);

      console.log('\n=== Code Review ===\n');
      console.log(`Ready to merge: ${review.readyToMerge ? '✅ YES' : '❌ NO'}`);

      if (review.mergeBlockers.length > 0) {
        console.log('\n🚫 Merge Blockers:');
        for (const blocker of review.mergeBlockers) {
          console.log(`   - ${blocker}`);
        }
      }

      console.log(`\n📋 Issues (${review.issues.length}):`);
      for (const issue of review.issues) {
        const icon =
          issue.severity === 'critical'
            ? '🔴'
            : issue.severity === 'high'
              ? '🟠'
              : issue.severity === 'medium'
                ? '🟡'
                : '⚪';
        console.log(
          `   ${icon} [${issue.category}] ${issue.file}${issue.line ? `:${issue.line}` : ''}`
        );
        console.log(`      ${issue.description}`);
      }

      console.log('\n📝 Overall Assessment:');
      console.log(`   ${review.overallAssessment}`);
    } catch (err) {
      console.error('❌ Review failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

triageCmd
  .command('pr')
  .description('AI-powered PR triage and analysis')
  .argument('<pr-number>', 'PR number to triage', (v) => parsePositiveInt(v, 'pr-number'))
  .option('--repo <owner/repo>', 'Repository (defaults to config)')
  .option('--json', 'Output as JSON')
  .action(async (prNumber, opts) => {
    try {
      const { Triage } = await import('./triage/triage.js');
      const cfg = getConfig();
      const repo = opts.repo || cfg.defaultRepository;

      if (!repo) {
        console.error('❌ Repository is required. Use --repo or set defaultRepository in config.');
        process.exit(1);
      }

      const token = getTokenForRepo(repo);
      if (!token) {
        console.error(
          `❌ Token not found for repository "${repo}". Check your configuration or GITHUB_TOKEN environment variable.`
        );
        process.exit(1);
      }

      const triage = new Triage({
        github: {
          token,
          repo,
        },
        resolver: {
          workingDirectory: process.cwd(),
        },
      });

      console.log(`🔍 Triaging PR #${prNumber} in ${repo}...`);
      const result = await triage.analyze(prNumber);

      if (opts.json) {
        output(result, true);
      } else {
        console.log(triage.formatTriageReport(result));
      }
    } catch (err) {
      console.error('❌ PR triage failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

triageCmd
  .command('fix')
  .description('Automatically resolve issues in a Pull Request')
  .argument('<pr-number>', 'PR number to fix', (v) => parsePositiveInt(v, 'pr-number'))
  .option('--repo <owner/repo>', 'Repository (defaults to config)')
  .option('--iterations <number>', 'Max iterations', '5')
  .action(async (prNumber, opts) => {
    try {
      const { Triage } = await import('./triage/triage.js');
      const cfg = getConfig();
      const repo = opts.repo || cfg.defaultRepository;

      if (!repo) {
        console.error('❌ Repository is required. Use --repo or set defaultRepository in config.');
        process.exit(1);
      }

      const token = getTokenForRepo(repo);
      if (!token) {
        console.error(
          `❌ Token not found for repository "${repo}". Check your configuration or GITHUB_TOKEN environment variable.`
        );
        process.exit(1);
      }

      const triage = new Triage({
        github: {
          token,
          repo,
        },
        resolver: {
          workingDirectory: process.cwd(),
        },
      });

      console.log(`🚀 Starting CI/PR resolution for PR #${prNumber} in ${repo}...`);

      const result = await triage.runUntilReady(prNumber, {
        maxIterations: Number.parseInt(opts.iterations, 10),
        onProgress: (t, i) => {
          console.log(`\nIteration ${i}: Status = ${t.status}`);
          console.log(`Unaddressed feedback: ${t.feedback.unaddressed}`);
          console.log(`Blockers: ${t.blockers.length}`);
        },
      });

      console.log('\n=== Resolution Summary ===\n');
      console.log(`Success: ${result.success ? '✅' : '❌'}`);
      console.log(`Iterations: ${result.iterations}`);
      console.log(`Final Status: ${result.finalTriage.status}`);

      if (result.allActions.length > 0) {
        console.log(`\nActions Taken (${result.allActions.length}):`);
        for (const action of result.allActions) {
          console.log(
            `- [${action.success ? '✅' : '❌'}] ${action.action}: ${action.description}`
          );
        }
      }

      if (!result.success) {
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ PR resolution failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

triageCmd
  .command('analyze')
  .description('Analyze agent conversation')
  .argument('<agent-id>', 'Agent ID to analyze')
  .option('-o, --output <path>', 'Output report path')
  .option('--create-issues', 'Create GitHub issues from outstanding tasks')
  .option('--dry-run', 'Show what issues would be created')
  .option('--model <model>', 'Claude model to use', getDefaultModel())
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

      console.log('\n=== Analysis Summary ===\n');
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
        console.log('\n🎫 Creating GitHub Issues...');
        const issues = await analyzer.createIssuesFromAnalysis(analysis, {
          dryRun: opts.dryRun,
        });
        console.log(`Created ${issues.length} issues`);
      }
    } catch (err) {
      console.error('❌ Analysis failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ============================================
// Roles Commands
// ============================================

const rolesCmd = program.command('roles').description('Configurable AI agent personas');

rolesCmd
  .command('list')
  .description('List available roles')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const cfg = getConfig();
    const roles = listRoles(cfg.roles);

    if (opts.json) {
      output(roles, true);
    } else {
      console.log('=== Available Roles ===\n');
      for (const role of roles) {
        const triggers = role.triggers
          .filter((t) => t.type === 'comment')
          .map((t) => (t as { pattern: string }).pattern)
          .join(', ');

        console.log(`${role.icon} ${role.name} (${role.id})`);
        console.log(`   ${role.description}`);
        console.log(`   Triggers: ${triggers || 'manual only'}`);
        console.log(
          `   Capabilities: ${role.capabilities.slice(0, 3).join(', ')}${role.capabilities.length > 3 ? '...' : ''}`
        );
        console.log();
      }
    }
  });

rolesCmd
  .command('info')
  .description('Show detailed information about a role')
  .argument('<role-id>', 'Role ID (sage, harvester, curator, reviewer, fixer, delegator)')
  .option('--json', 'Output as JSON')
  .action((roleId, opts) => {
    const cfg = getConfig();
    const role = getEffectiveRole(roleId, cfg.roles);

    if (!role) {
      console.error(`❌ Role not found: ${roleId}`);
      console.error(`Available roles: ${getDefaultRoleIds().join(', ')}`);
      process.exit(1);
    }

    if (opts.json) {
      output(role, true);
    } else {
      console.log(`\n${role.icon} ${role.name}\n`);
      console.log(`ID: ${role.id}`);
      console.log(`Description: ${role.description}`);
      console.log(`\nCapabilities:`);
      for (const cap of role.capabilities) {
        console.log(`  • ${cap}`);
      }
      console.log(`\nTriggers:`);
      for (const trigger of role.triggers) {
        if (trigger.type === 'comment') {
          console.log(`  💬 Comment: ${(trigger as { pattern: string }).pattern}`);
        } else if (trigger.type === 'schedule') {
          console.log(`  ⏰ Schedule: ${(trigger as { cron: string }).cron}`);
        } else if (trigger.type === 'event') {
          console.log(`  🎯 Events: ${(trigger as { events: string[] }).events.join(', ')}`);
        } else {
          console.log(`  🖐️ Manual`);
        }
      }
      console.log(`\nPermissions:`);
      console.log(`  Can spawn agents: ${role.canSpawnAgents ? '✅' : '❌'}`);
      console.log(`  Can modify repo: ${role.canModifyRepo ? '✅' : '❌'}`);
      console.log(`  Can merge PRs: ${role.canMerge ? '✅' : '❌'}`);
      console.log(`\nDefault Model: ${role.defaultModel || 'provider default'}`);
      console.log(`Temperature: ${role.temperature ?? 0.3}`);
      console.log(`\nSystem Prompt (first 500 chars):`);
      console.log(`  ${role.systemPrompt.slice(0, 500).replace(/\n/g, '\n  ')}...`);
    }
  });

rolesCmd
  .command('sage')
  .description('Run the Sage advisor')
  .argument('<query>', 'Question or request')
  .option('--repo <owner/repo>', 'Repository context')
  .option('--issue <number>', 'Issue number for context')
  .option('--json', 'Output as JSON')
  .action(async (query, opts) => {
    try {
      const { getOrLoadProvider } = await import('./core/providers.js');
      const { getConfig, getTriageApiKey } = await import('./core/config.js');

      const cfg = getConfig();
      const role = getEffectiveRole('sage', cfg.roles);

      if (!role) {
        console.error('❌ Sage role is disabled or not found');
        process.exit(1);
      }

      const apiKey = getTriageApiKey();

      if (!apiKey) {
        console.error(
          '❌ No API key found. Set ANTHROPIC_API_KEY or configure in agentic.config.json'
        );
        process.exit(1);
      }

      const providerFn = await getOrLoadProvider(cfg.triage?.provider || 'anthropic', apiKey);
      const model = providerFn(
        role.defaultModel || cfg.triage?.model || 'claude-sonnet-4-20250514'
      );

      console.log('🔮 Sage is thinking...\n');

      const result = await executeSageRole(query, model as Parameters<typeof executeSageRole>[1], {
        role,
      });

      if (opts.json) {
        output(result, true);
      } else {
        if (result.success && result.response) {
          console.log('## 🔮 Sage Response\n');
          console.log(result.response);
        } else {
          console.error(`❌ ${result.error || 'Unknown error'}`);
          process.exit(1);
        }
      }
    } catch (err) {
      console.error('❌ Sage failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

rolesCmd
  .command('match')
  .description('Find which role matches a trigger pattern')
  .argument('<pattern>', 'Trigger pattern (e.g., @sage, /cursor)')
  .action((pattern) => {
    const cfg = getConfig();
    const role = findRoleByTrigger(pattern, cfg.roles);

    if (role) {
      console.log(`✅ Matched: ${role.icon} ${role.name} (${role.id})`);
      console.log(`   ${role.description}`);
    } else {
      console.log(`❌ No role matches pattern: ${pattern}`);
      console.log(`\nAvailable trigger patterns:`);
      for (const r of Object.values(DEFAULT_ROLES)) {
        for (const trigger of r.triggers) {
          if (trigger.type === 'comment') {
            console.log(`  ${(trigger as { pattern: string }).pattern} → ${r.icon} ${r.name}`);
          }
        }
      }
    }
  });

// ============================================
// Handoff Commands
// ============================================

const handoffCmd = program.command('handoff').description('Station-to-station agent handoff');

handoffCmd
  .command('initiate')
  .description('Initiate handoff to successor agent')
  .argument('<predecessor-id>', 'Your agent ID (predecessor)')
  .addOption(
    new Option('--pr <number>', 'Your current PR number').argParser((v) =>
      parsePositiveInt(v, '--pr')
    )
  )
  .requiredOption('--branch <name>', 'Your current branch name')
  .requiredOption('--repo <url>', 'Repository URL for successor')
  .option('--ref <ref>', 'Git ref for successor', 'main')
  .option('--tasks <tasks>', 'Comma-separated tasks for successor', '')
  .action(async (predecessorId, opts) => {
    try {
      if (!opts.pr) {
        console.error('❌ --pr is required');
        process.exit(1);
      }

      const manager = new HandoffManager();

      console.log('🤝 Initiating station-to-station handoff...\n');

      const result = await manager.initiateHandoff(predecessorId, {
        repository: opts.repo,
        ref: opts.ref,
        currentPr: opts.pr,
        currentBranch: validateBranchName(opts.branch),
        tasks: opts.tasks ? opts.tasks.split(',').map((t: string) => t.trim()) : [],
      });

      if (!result.success) {
        console.error(`❌ Handoff failed: ${result.error}`);
        process.exit(1);
      }

      console.log(`\n✅ Handoff initiated`);
      console.log(`   Successor: ${result.successorId}`);
      console.log(`   Healthy: ${result.successorHealthy ? 'Yes' : 'Pending'}`);
    } catch (err) {
      console.error('❌ Handoff failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

handoffCmd
  .command('confirm')
  .description('Confirm health as successor agent')
  .argument('<predecessor-id>', 'Predecessor agent ID')
  .action(async (predecessorId) => {
    try {
      const manager = new HandoffManager();
      const successorId = process.env.CURSOR_AGENT_ID || 'successor-agent';

      console.log(`🤝 Confirming health to predecessor ${predecessorId}...`);
      await manager.confirmHealthAndBegin(successorId, predecessorId);
      console.log('✅ Health confirmation sent');
    } catch (err) {
      console.error('❌ Confirm failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

handoffCmd
  .command('takeover')
  .description('Merge predecessor PR and take over')
  .argument('<predecessor-id>', 'Predecessor agent ID')
  .argument('<pr-number>', 'Predecessor PR number', (v) => parsePositiveInt(v, 'pr-number'))
  .argument('<new-branch>', 'Your new branch name', validateBranchName)
  .option('--admin', 'Use admin privileges')
  .option('--auto', 'Enable auto-merge')
  .addOption(
    new Option('--merge-method <method>', 'Merge method')
      .choices(['merge', 'squash', 'rebase'])
      .default('squash')
  )
  .action(async (predecessorId, prNumber, newBranch, opts) => {
    try {
      const manager = new HandoffManager();

      console.log('🔄 Taking over from predecessor...\n');

      const result = await manager.takeover(predecessorId, prNumber, newBranch, {
        admin: opts.admin,
        auto: opts.auto,
        mergeMethod: opts.mergeMethod,
        deleteBranch: true,
      });

      if (!result.success) {
        console.error(`❌ Takeover failed: ${result.error}`);
        process.exit(1);
      }

      console.log('✅ Takeover complete!');
    } catch (err) {
      console.error('❌ Takeover failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ============================================
// Sandbox Commands
// ============================================

const sandboxCmd = program.command('sandbox').description('Local sandbox execution for AI agents');

sandboxCmd
  .command('run')
  .description('Run an AI agent in a sandbox')
  .argument('<prompt>', 'Task prompt for the agent')
  .option('--runtime <type>', 'Runtime adapter (claude, cursor)', 'claude')
  .option('--workspace <path>', 'Workspace directory to mount', process.cwd())
  .option('--output <path>', 'Output directory', './sandbox-output')
  .option('--timeout <seconds>', 'Timeout in seconds', '300')
  .option('--memory <mb>', 'Memory limit in MB', '1024')
  .option('--env <vars>', 'Environment variables (KEY=value,KEY2=value2)')
  .option('--json', 'Output as JSON')
  .action(async (prompt, opts) => {
    try {
      const { SandboxExecutor } = await import('./sandbox/index.js');
      const executor = new SandboxExecutor();

      // Parse environment variables
      const env: Record<string, string> = {};
      if (opts.env) {
        for (const pair of opts.env.split(',')) {
          const [key, value] = pair.split('=');
          if (key && value) {
            env[key.trim()] = value.trim();
          }
        }
      }

      console.log(`🏃 Running ${opts.runtime} agent in sandbox...`);

      const result = await executor.execute({
        runtime: opts.runtime,
        workspace: opts.workspace,
        outputDir: opts.output,
        prompt,
        timeout: Number.parseInt(opts.timeout, 10) * 1000, // Convert to milliseconds
        memory: Number.parseInt(opts.memory, 10),
        env,
      });

      if (opts.json) {
        output(result, true);
      } else {
        console.log('\n=== Sandbox Result ===\n');
        console.log(`Success: ${result.success ? '✅' : '❌'}`);
        console.log(`Duration: ${result.duration}ms`);
        console.log(`Exit Code: ${result.exitCode}`);

        if (result.output) {
          console.log('\n📄 Output:');
          console.log(result.output);
        }

        if (result.error) {
          console.log('\n❌ Error:');
          console.log(result.error);
        }
      }
    } catch (err) {
      console.error('❌ Sandbox execution failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

sandboxCmd
  .command('fleet')
  .description('Run multiple agents in parallel sandboxes')
  .argument('<prompts...>', 'Task prompts for agents')
  .option('--runtime <type>', 'Runtime adapter (claude, cursor)', 'claude')
  .option('--workspace <path>', 'Workspace directory to mount', process.cwd())
  .option('--output <path>', 'Base output directory', './sandbox-output')
  .option('--timeout <seconds>', 'Timeout in seconds', '300')
  .option('--memory <mb>', 'Memory limit in MB', '1024')
  .option('--json', 'Output as JSON')
  .action(async (prompts, opts) => {
    try {
      const { SandboxExecutor } = await import('./sandbox/index.js');
      const executor = new SandboxExecutor();

      const options = prompts.map((prompt: string, index: number) => ({
        runtime: opts.runtime,
        workspace: opts.workspace,
        outputDir: `${opts.output}/agent-${index + 1}`,
        prompt,
        timeout: Number.parseInt(opts.timeout, 10) * 1000,
        memory: Number.parseInt(opts.memory, 10),
      }));

      console.log(`🏃 Running ${prompts.length} agents in parallel sandboxes...`);

      const results = await executor.executeFleet(options);

      if (opts.json) {
        output(results, true);
      } else {
        console.log('\n=== Fleet Results ===\n');
        results.forEach((result, index) => {
          console.log(`Agent ${index + 1}:`);
          console.log(`  Success: ${result.success ? '✅' : '❌'}`);
          console.log(`  Duration: ${result.duration}ms`);
          console.log(`  Exit Code: ${result.exitCode}`);
          console.log();
        });

        const successful = results.filter((r) => r.success).length;
        console.log(`Summary: ${successful}/${results.length} agents completed successfully`);
      }
    } catch (err) {
      console.error('❌ Fleet execution failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ============================================
// Config Commands
// ============================================

program
  .command('config')
  .description('Show current configuration')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    const cfg = getConfig();
    const configData = {
      defaultModel: getDefaultModel(),
      configuredOrgs: getConfiguredOrgs(),
      tokens: getTokenSummary(),
      defaultRepository: cfg.defaultRepository ?? '(not set)',
      coordinationPr: cfg.coordinationPr ?? '(not set)',
      logLevel: cfg.logLevel,
    };

    if (opts.json) {
      output(configData, true);
    } else {
      console.log('=== Configuration ===\n');
      console.log(`Default Model: ${configData.defaultModel}`);
      console.log(`Default Repository: ${configData.defaultRepository}`);
      console.log(`Coordination PR: ${configData.coordinationPr}`);
      console.log(`Log Level: ${configData.logLevel}`);
      console.log(
        `Configured Orgs: ${configData.configuredOrgs.length > 0 ? configData.configuredOrgs.join(', ') : '(none - configure in agentic.config.json)'}`
      );
      console.log('\nToken Status:');
      for (const [org, info] of Object.entries(configData.tokens)) {
        const status = info.available ? '✅' : '❌';
        console.log(`  ${status} ${org}: ${info.envVar}`);
      }
    }
  });

program
  .command('init')
  .description('Initialize configuration')
  .option('--force', 'Overwrite existing config file')
  .option('--non-interactive', 'Skip prompts, use detected values only')
  .action(async (opts) => {
    const configPath = 'agentic.config.json';

    if (existsSync(configPath) && !opts.force) {
      console.error(`❌ ${configPath} already exists. Use --force to overwrite.`);
      process.exit(1);
    }

    const isInteractive = process.stdout.isTTY && !opts.nonInteractive;

    // Detect org-specific tokens (GITHUB_*_TOKEN pattern)
    // Security: Only allow alphanumeric and underscore in org name extraction
    const organizations: Record<string, { name: string; tokenEnvVar: string }> = {};
    const SAFE_ORG_PATTERN = /^GITHUB_([A-Za-z0-9_]+)_TOKEN$/;
    for (const envVar of Object.keys(process.env)) {
      const match = envVar.match(SAFE_ORG_PATTERN);
      if (match?.[1] && process.env[envVar]) {
        // Normalize to lowercase, replace underscores with hyphens
        const orgName = match[1].toLowerCase().replace(/_/g, '-');
        // Additional validation: org names must be reasonable length
        if (orgName.length > 0 && orgName.length <= 39) {
          organizations[orgName] = { name: orgName, tokenEnvVar: envVar };
        }
      }
    }

    // Detect standard tokens
    const hasGithubToken = !!process.env.GITHUB_TOKEN;
    const hasCursorKey = !!process.env.CURSOR_API_KEY;
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    // Build base config from detected values
    const config: Record<string, unknown> = {
      tokens: {
        organizations: Object.keys(organizations).length > 0 ? organizations : {},
        defaultTokenEnvVar: hasGithubToken ? 'GITHUB_TOKEN' : 'GITHUB_TOKEN',
        prReviewTokenEnvVar: hasGithubToken ? 'GITHUB_TOKEN' : 'GITHUB_TOKEN',
      },
      logLevel: 'info',
      fleet: {
        autoCreatePr: false,
      },
      triage: {
        provider: hasAnthropicKey ? 'anthropic' : hasOpenAIKey ? 'openai' : 'anthropic',
        // model will be set below
      },
    };

    // Interactive prompts for missing values
    if (isInteractive) {
      const { input, confirm, select } = await import('@inquirer/prompts');

      // Ask for default repository if not detected
      const repoAnswer = await input({
        message: 'Default repository (owner/repo, or leave empty):',
        default: '',
      });
      if (repoAnswer) {
        config.defaultRepository = repoAnswer;
      }

      // Ask about fleet defaults
      const autoPr = await confirm({
        message: 'Auto-create PRs when agents complete?',
        default: false,
      });
      (config.fleet as Record<string, unknown>).autoCreatePr = autoPr;

      // === AI PROVIDER & MODEL SELECTION ===
      console.log('\n📊 AI Triage Configuration\n');

      // Select provider
      const provider = await select({
        message: 'AI provider for triage operations:',
        choices: [
          {
            value: 'anthropic',
            name: `Anthropic (Claude)${hasAnthropicKey ? ' ✅ key detected' : ''}`,
          },
          {
            value: 'openai',
            name: `OpenAI (GPT)${hasOpenAIKey ? ' ✅ key detected' : ''}`,
          },
          { value: 'google', name: 'Google AI (Gemini)' },
          { value: 'mistral', name: 'Mistral' },
          { value: 'azure', name: 'Azure OpenAI' },
        ],
        default: hasAnthropicKey ? 'anthropic' : hasOpenAIKey ? 'openai' : 'anthropic',
      });
      (config.triage as Record<string, unknown>).provider = provider;

      // Model selection
      const modelChoice = await select({
        message: 'How would you like to configure the AI model?',
        choices: [
          {
            value: 'list-cursor',
            name:
              'List available Cursor models (requires CURSOR_API_KEY)' +
              (hasCursorKey ? ' ✅' : ' ⚠️'),
          },
          { value: 'common', name: 'Choose from common models' },
          { value: 'manual', name: 'Enter model ID manually' },
          { value: 'auto', name: "Auto (no default - use provider's default)" },
        ],
      });

      let selectedModel: string | undefined;

      let shouldFallbackToCommon = false;

      if (modelChoice === 'list-cursor') {
        if (!hasCursorKey) {
          console.log('⚠️  CURSOR_API_KEY not found. Falling back to common models.');
          shouldFallbackToCommon = true;
        } else {
          try {
            console.log('🔍 Fetching available Cursor models...');
            const fleet = new Fleet();
            const modelsResult = await fleet.listModels();

            if (modelsResult.success && modelsResult.data && modelsResult.data.length > 0) {
              selectedModel = await select({
                message: 'Select a model:',
                choices: modelsResult.data.map((m) => ({ value: m, name: m })),
              });
            } else {
              console.log('⚠️  Could not fetch models. Falling back to common models.');
              shouldFallbackToCommon = true;
            }
          } catch (err) {
            console.log(`⚠️  Error fetching models: ${err instanceof Error ? err.message : err}`);
            shouldFallbackToCommon = true;
          }
        }
      }

      if (!selectedModel && (modelChoice === 'common' || shouldFallbackToCommon)) {
        const commonModels: Record<string, { value: string; name: string }[]> = {
          anthropic: [
            {
              value: 'claude-sonnet-4-20250514',
              name: 'Claude Sonnet 4 (recommended)',
            },
            { value: 'claude-opus-4-20250514', name: 'Claude Opus 4 (most capable)' },
            { value: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
            { value: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (fastest)' },
          ],
          openai: [
            { value: 'gpt-4o', name: 'GPT-4o (recommended)' },
            { value: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { value: 'gpt-4', name: 'GPT-4' },
            { value: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (fastest)' },
          ],
          google: [
            { value: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (recommended)' },
            { value: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (fastest)' },
            { value: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' },
          ],
          mistral: [
            { value: 'mistral-large-latest', name: 'Mistral Large (recommended)' },
            { value: 'mistral-medium-latest', name: 'Mistral Medium' },
            { value: 'mistral-small-latest', name: 'Mistral Small (fastest)' },
          ],
          azure: [
            { value: 'gpt-4o', name: 'GPT-4o (deployment name)' },
            { value: 'gpt-4', name: 'GPT-4 (deployment name)' },
          ],
        };

        const defaultModels = commonModels.anthropic ?? [];
        const providerModels = commonModels[provider as string] ?? defaultModels;
        selectedModel = await select({
          message: `Select ${provider} model:`,
          choices: providerModels,
        });
      }

      if (!selectedModel && modelChoice === 'manual') {
        selectedModel = await input({
          message: 'Enter model ID:',
          default: provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o',
        });
      }

      if (selectedModel) {
        (config.triage as Record<string, unknown>).model = selectedModel;
      }
      // If "auto" was selected, don't set a model - let the provider use its default

      // Ask for additional orgs
      console.log('\n🔐 Organization Tokens\n');
      const addOrg = await confirm({
        message: 'Add organization-specific token mappings?',
        default: false,
      });

      if (addOrg) {
        let adding = true;
        while (adding) {
          const orgName = await input({ message: 'Organization name:' });
          const tokenVar = await input({
            message: `Environment variable for ${orgName}:`,
            default: `GITHUB_${orgName.toUpperCase().replace(/-/g, '_')}_TOKEN`,
          });
          (config.tokens as Record<string, unknown>).organizations = {
            ...((config.tokens as Record<string, unknown>).organizations as object),
            [orgName]: { name: orgName, tokenEnvVar: tokenVar },
          };
          adding = await confirm({
            message: 'Add another organization?',
            default: false,
          });
        }
      }
    } else {
      // Non-interactive: set sensible defaults
      (config.triage as Record<string, unknown>).model = hasAnthropicKey
        ? 'claude-sonnet-4-20250514'
        : hasOpenAIKey
          ? 'gpt-4o'
          : 'claude-sonnet-4-20250514';
    }

    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`\n✅ Created ${configPath}`);

    // Show summary
    const triage = config.triage as Record<string, unknown>;
    console.log('\n📋 Configuration Summary:');
    console.log(`   Provider: ${triage.provider}`);
    console.log(`   Model: ${triage.model ?? '(auto - provider default)'}`);
    if (config.defaultRepository) {
      console.log(`   Default Repo: ${config.defaultRepository}`);
    }
    console.log(`   Auto-create PRs: ${(config.fleet as Record<string, unknown>).autoCreatePr}`);
  });

// ============================================
// Parse and Run
// ============================================

// Initialize config
initConfig();

// Parse CLI
program.parse();
