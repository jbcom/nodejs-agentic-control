/**
 * Example: Agent Spawning
 *
 * This example demonstrates how to spawn a single Cursor Background Agent
 * and monitor its progress until completion.
 *
 * @example
 * ```bash
 * # Set required environment variables
 * export CURSOR_API_KEY="your-cursor-api-key"
 *
 * # Run the example
 * pnpm tsx examples/01-agent-spawn.ts
 * ```
 */

import { Fleet } from 'agentic-control';

/**
 * Main function demonstrating agent spawning workflow
 */
async function main(): Promise<void> {
  console.log('🚀 Agent Spawning Example\n');

  // Initialize Fleet manager
  const fleet = new Fleet();

  // Check if API is available
  if (!fleet.isApiAvailable()) {
    console.error('❌ Cursor API not available. Set CURSOR_API_KEY environment variable.');
    process.exit(1);
  }

  // Define spawn options
  const spawnOptions = {
    repository: 'https://github.com/your-org/your-repo',
    task: `
      Review the codebase and create a summary document.

      Steps:
      1. Read the README.md and package.json
      2. Identify the main entry points
      3. List the key dependencies
      4. Create a SUMMARY.md with your findings
    `,
    ref: 'main',
    target: {
      autoCreatePr: true,
      branchName: 'agent/codebase-review',
    },
  };

  console.log('📋 Spawn Configuration:');
  console.log(`   Repository: ${spawnOptions.repository}`);
  console.log(`   Branch: ${spawnOptions.ref}`);
  console.log(`   Auto-create PR: ${spawnOptions.target.autoCreatePr}`);
  console.log('');

  // Spawn the agent
  console.log('⏳ Spawning agent...');
  const result = await fleet.spawn(spawnOptions);

  if (!result.success || !result.data) {
    console.error(`❌ Failed to spawn agent: ${result.error}`);
    process.exit(1);
  }

  const agent = result.data;
  console.log(`✅ Agent spawned successfully!`);
  console.log(`   Agent ID: ${agent.id}`);
  console.log(`   Status: ${agent.status}`);
  console.log('');

  // Monitor agent progress
  console.log('📊 Monitoring agent progress...');
  console.log('   (Press Ctrl+C to stop monitoring)\n');

  const finalResult = await fleet.waitFor(agent.id, {
    timeout: 600000, // 10 minutes
    pollInterval: 15000, // 15 seconds
  });

  if (!finalResult.success || !finalResult.data) {
    console.error(`❌ Error waiting for agent: ${finalResult.error}`);
    process.exit(1);
  }

  const finalAgent = finalResult.data;
  console.log('\n🏁 Agent completed!');
  console.log(`   Final Status: ${finalAgent.status}`);

  if (finalAgent.target?.prUrl) {
    console.log(`   PR URL: ${finalAgent.target.prUrl}`);
  }

  if (finalAgent.summary) {
    console.log(`   Summary: ${finalAgent.summary}`);
  }

  // Archive the conversation
  console.log('\n📁 Archiving conversation...');
  const archiveResult = await fleet.archive(agent.id);

  if (archiveResult.success) {
    console.log(`   Saved to: ${archiveResult.data}`);
  }

  console.log('\n✨ Done!');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
