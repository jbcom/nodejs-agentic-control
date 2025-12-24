/**
 * Example: Orchestration Patterns
 *
 * This example demonstrates advanced multi-agent orchestration:
 * - Diamond pattern (fan-out/fan-in)
 * - Coordination via PR comments
 * - Agent monitoring with callbacks
 *
 * @example
 * ```bash
 * export CURSOR_API_KEY="your-cursor-api-key"
 * export GITHUB_TOKEN="your-github-token"
 * pnpm tsx examples/03-orchestration-patterns.ts
 * ```
 */

import type { AgentStatus, DiamondConfig, SpawnOptions } from '@agentic/control';
import { Fleet } from '@agentic/control';

/**
 * Example: Diamond Pattern Orchestration
 *
 * The diamond pattern enables coordinated work across multiple repositories:
 *
 * ```
 *              ┌──────────────┐
 *              │ Control      │
 *              │ Manager      │
 *              └──────┬───────┘
 *                     │
 *          ┌──────────┼──────────┐
 *          │          │          │
 *          ▼          ▼          ▼
 *     ┌────────┐ ┌────────┐ ┌────────┐
 *     │ Target │ │ Target │ │ Target │
 *     │ Repo 1 │ │ Repo 2 │ │ Repo 3 │
 *     └────┬───┘ └────┬───┘ └────┬───┘
 *          │          │          │
 *          └──────────┼──────────┘
 *                     │
 *                     ▼
 *              ┌──────────────┐
 *              │ Counterparty │
 *              │ (Aggregator) │
 *              └──────────────┘
 * ```
 */
async function diamondPatternExample(_fleet: Fleet): Promise<void> {
  console.log('💎 Diamond Pattern Orchestration');
  console.log('─'.repeat(50));

  // Define target repositories for parallel work
  const targetRepos: SpawnOptions[] = [
    {
      repository: 'https://github.com/your-org/frontend-app',
      task: `
        Update the UI components to use the new design tokens.
        Focus on:
        1. Color palette updates
        2. Typography changes
        3. Spacing adjustments

        Report progress via PR comments using format:
        ✅ DONE: [agent-id] [summary]
        ⚠️ BLOCKED: [agent-id] [issue]
      `,
      ref: 'main',
      target: { autoCreatePr: true },
    },
    {
      repository: 'https://github.com/your-org/backend-api',
      task: `
        Update API response formats for v2.
        Focus on:
        1. New pagination format
        2. Error response structure
        3. Rate limiting headers

        Report progress via PR comments.
      `,
      ref: 'main',
      target: { autoCreatePr: true },
    },
    {
      repository: 'https://github.com/your-org/shared-types',
      task: `
        Generate TypeScript types from OpenAPI spec.
        Focus on:
        1. Request/response types
        2. Error types
        3. Utility types

        Report progress via PR comments.
      `,
      ref: 'main',
      target: { autoCreatePr: true },
    },
  ];

  // Define counterparty (aggregator) agent
  const counterparty: SpawnOptions = {
    repository: 'https://github.com/your-org/integration-tests',
    task: `
      You are the integration coordinator.

      Wait for updates from target repository agents, then:
      1. Update integration tests for new APIs
      2. Verify type compatibility
      3. Create summary of all changes

      Monitor the coordination PR for status updates from other agents.
    `,
    ref: 'main',
    target: { autoCreatePr: true },
  };

  // Diamond configuration
  const _diamondConfig: DiamondConfig = {
    targetRepos,
    counterparty,
    controlCenter: 'https://github.com/your-org/control-center',
  };

  console.log('📋 Diamond Configuration:');
  console.log(`   Target Repos: ${targetRepos.length}`);
  console.log(`   Counterparty: ${counterparty.repository}`);
  console.log('');

  // Create the diamond (uncomment to run)
  // const result = await fleet.createDiamond(diamondConfig);
  //
  // if (result.success && result.data) {
  //   console.log('✅ Diamond pattern created!');
  //   console.log(`   Target Agents: ${result.data.targetAgents.length}`);
  //   console.log(`   Counterparty: ${result.data.counterpartyAgent.id}`);
  // }

  console.log('   (Diamond creation commented out - uncomment to run)\n');
}

/**
 * Example: Agent Monitoring with Progress Callbacks
 */
async function monitoringExample(fleet: Fleet): Promise<void> {
  console.log('📊 Agent Monitoring Example');
  console.log('─'.repeat(50));

  // Get running agents to monitor
  const runningResult = await fleet.running();

  if (!runningResult.success || !runningResult.data || runningResult.data.length === 0) {
    console.log('   No running agents to monitor.\n');
    return;
  }

  const agentIds = runningResult.data.map((a) => a.id);
  console.log(`   Monitoring ${agentIds.length} agents...\n`);

  // Monitor with progress callback
  const results = await fleet.monitorAgents(agentIds, {
    pollInterval: 30000, // 30 seconds
    onProgress: (statusMap: Map<string, AgentStatus>) => {
      console.log(`   [${new Date().toISOString()}] Status Update:`);
      for (const [id, status] of statusMap) {
        const emoji = status === 'RUNNING' ? '🏃' : status === 'COMPLETED' ? '✅' : '❓';
        console.log(`     ${emoji} ${id.slice(0, 12)}: ${status}`);
      }
    },
  });

  console.log('\n   Final Results:');
  for (const [id, agent] of results) {
    console.log(`     ${id.slice(0, 12)}: ${agent.status}`);
    if (agent.target?.prUrl) {
      console.log(`       PR: ${agent.target.prUrl}`);
    }
  }
  console.log('');
}

/**
 * Example: AI-Powered Conversation Analysis
 */
async function analysisExample(fleet: Fleet): Promise<void> {
  console.log('🧠 AI-Powered Analysis Example');
  console.log('─'.repeat(50));

  // Get a completed agent's conversation
  const listResult = await fleet.list();

  if (!listResult.success || !listResult.data) {
    console.log('   No agents available for analysis.\n');
    return;
  }

  const completedAgent = listResult.data.find(
    (a) => a.status === 'COMPLETED' || a.status === 'FINISHED'
  );

  if (!completedAgent) {
    console.log('   No completed agents to analyze.\n');
    return;
  }

  console.log(`   Analyzing agent: ${completedAgent.id.slice(0, 12)}`);

  // Get conversation
  const convResult = await fleet.conversation(completedAgent.id);

  if (!convResult.success || !convResult.data) {
    console.log(`   ⚠️ Could not fetch conversation: ${convResult.error}\n`);
    return;
  }

  console.log(`   Messages: ${convResult.data.totalMessages}`);

  // Analyze with AI (requires AI provider configured)
  // const analyzer = new AIAnalyzer();
  // const analysis = await analyzer.analyzeConversation(convResult.data);
  //
  // console.log('\n   Analysis Results:');
  // console.log(`   Summary: ${analysis.data?.summary}`);
  // console.log(`   Completed Tasks: ${analysis.data?.completedTasks.length}`);
  // console.log(`   Outstanding: ${analysis.data?.outstandingTasks.length}`);
  // console.log(`   Blockers: ${analysis.data?.blockers.length}`);

  console.log('   (AI analysis commented out - configure provider to run)\n');
}

/**
 * Example: Coordination Loop
 *
 * Sets up bidirectional communication between control center and agents
 * via GitHub PR comments.
 */
async function coordinationLoopExample(_fleet: Fleet): Promise<void> {
  console.log('🔄 Coordination Loop Example');
  console.log('─'.repeat(50));

  const coordinationConfig = {
    coordinationPr: 123, // PR number for coordination
    repo: 'your-org/control-center',
    outboundInterval: 60000, // Check agents every 60s
    inboundInterval: 15000, // Check PR comments every 15s
    agentIds: ['bc-agent-1', 'bc-agent-2'], // Agents to monitor
  };

  console.log('   Coordination Configuration:');
  console.log(`   PR: ${coordinationConfig.repo}#${coordinationConfig.coordinationPr}`);
  console.log(`   Agents: ${coordinationConfig.agentIds.length}`);
  console.log(`   Outbound Interval: ${coordinationConfig.outboundInterval / 1000}s`);
  console.log(`   Inbound Interval: ${coordinationConfig.inboundInterval / 1000}s`);
  console.log('');

  // Start coordination loop (uncomment to run - runs indefinitely)
  // await fleet.coordinate(coordinationConfig);

  console.log('   (Coordination loop commented out - runs indefinitely)\n');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🎭 Orchestration Patterns Example\n');

  const fleet = new Fleet();

  if (!fleet.isApiAvailable()) {
    console.error('❌ Cursor API not available. Set CURSOR_API_KEY environment variable.');
    console.log('   Continuing with documentation examples...\n');
  }

  // Run examples
  await diamondPatternExample(fleet);
  await monitoringExample(fleet);
  await analysisExample(fleet);
  await coordinationLoopExample(fleet);

  console.log('✨ Done!');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
