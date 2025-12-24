/**
 * Agentic Merge Queue - GitHub Action
 * 
 * Cross-organization merge queue using a GitHub Issue as state store.
 * Works with @agentic/triage primitives for queue management.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

// Note: In production, these would be proper imports from @agentic/triage
// For now, we inline the key types and logic

interface QueueItem {
  id: string;
  priority: 1 | 2 | 3;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  addedAt: string;
  retries: number;
  lastError?: string;
  checks?: 'passing' | 'failing' | 'pending';
  mergeable?: boolean;
}

interface QueueState {
  version: number;
  updatedAt: string;
  items: QueueItem[];
  stats: {
    merged24h: number;
    failed24h: number;
  };
}

const QUEUE_ISSUE_TITLE = '🔄 Ecosystem Merge Queue';
const STATE_START = '<!-- QUEUE_STATE_START -->';
const STATE_END = '<!-- QUEUE_STATE_END -->';

async function run(): Promise<void> {
  try {
    const command = core.getInput('command', { required: true });
    const token = core.getInput('github-token', { required: true });
    const queueRepo = core.getInput('queue-repo') || `${github.context.repo.owner}/${github.context.repo.repo}`;
    
    const octokit = github.getOctokit(token);
    const [owner, repo] = queueRepo.split('/');

    // Find or create queue issue
    const issue = await findOrCreateQueueIssue(octokit, owner, repo);
    const state = parseQueueState(issue.body || '');

    switch (command) {
      case 'add': {
        const pr = core.getInput('pr', { required: true });
        const priority = parseInt(core.getInput('priority') || '2') as 1 | 2 | 3;
        await addToQueue(octokit, owner, repo, issue.number, state, pr, priority);
        break;
      }
      case 'remove': {
        const pr = core.getInput('pr', { required: true });
        await removeFromQueue(octokit, owner, repo, issue.number, state, pr);
        break;
      }
      case 'process': {
        const processed = await processQueue(octokit, owner, repo, issue.number, state, token);
        core.setOutput('processed', processed);
        break;
      }
      case 'refresh': {
        await refreshQueue(octokit, owner, repo, issue.number, state, token);
        break;
      }
      case 'status': {
        core.setOutput('result', JSON.stringify(state));
        break;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    core.setOutput('queue-length', state.items.length);

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

async function findOrCreateQueueIssue(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string
): Promise<{ number: number; body: string | null }> {
  // Search for existing issue
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: 'merge-queue',
    per_page: 1,
  });

  if (issues.length > 0) {
    return { number: issues[0].number, body: issues[0].body };
  }

  // Create new issue
  const initialState: QueueState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: [],
    stats: { merged24h: 0, failed24h: 0 },
  };

  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title: QUEUE_ISSUE_TITLE,
    body: formatIssueBody(initialState),
    labels: ['merge-queue', 'automation'],
  });

  return { number: issue.number, body: issue.body };
}

function parseQueueState(body: string): QueueState {
  const startIdx = body.indexOf(STATE_START);
  const endIdx = body.indexOf(STATE_END);

  if (startIdx === -1 || endIdx === -1) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      items: [],
      stats: { merged24h: 0, failed24h: 0 },
    };
  }

  const jsonStart = body.indexOf('```json', startIdx) + 7;
  const jsonEnd = body.indexOf('```', jsonStart);
  const json = body.substring(jsonStart, jsonEnd).trim();

  return JSON.parse(json);
}

function formatIssueBody(state: QueueState): string {
  state.updatedAt = new Date().toISOString();

  const tableRows = state.items.map((item, i) => {
    const priorityIcon = item.priority === 1 ? '🔴' : item.priority === 2 ? '🟡' : '🟢';
    const statusIcon = item.status === 'processing' ? '⚙️' : item.status === 'failed' ? '❌' : '⏳';
    return `| ${i + 1} | [${item.id}](https://github.com/${item.id.replace('#', '/pull/')}) | ${priorityIcon} | ${statusIcon} ${item.status} | ${item.retries} |`;
  }).join('\n');

  return `# 🔄 Ecosystem Merge Queue

Cross-organization merge queue managed by [@agentic/control](https://github.com/agentic-dev-library/control).

**Updated**: ${state.updatedAt}

${STATE_START}
\`\`\`json
${JSON.stringify(state, null, 2)}
\`\`\`
${STATE_END}

## 📊 Stats (24h)
- ✅ Merged: **${state.stats.merged24h}**
- ❌ Failed: **${state.stats.failed24h}**

## 📋 Queue

| # | PR | Priority | Status | Retries |
|---|-----|----------|--------|---------|
${tableRows || '| - | *Queue empty* | - | - | - |'}

---
*Managed by [Agentic Merge Queue](https://github.com/agentic-dev-library/control/actions/merge-queue)*
`;
}

async function addToQueue(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  state: QueueState,
  prId: string,
  priority: 1 | 2 | 3
): Promise<void> {
  if (state.items.some(i => i.id === prId)) {
    core.info(`${prId} already in queue`);
    return;
  }

  state.items.push({
    id: prId,
    priority,
    status: 'pending',
    addedAt: new Date().toISOString(),
    retries: 0,
  });

  // Sort by priority then by added time
  state.items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
  });

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: formatIssueBody(state),
  });

  core.info(`Added ${prId} to queue at position ${state.items.findIndex(i => i.id === prId) + 1}`);
}

async function removeFromQueue(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  state: QueueState,
  prId: string
): Promise<void> {
  state.items = state.items.filter(i => i.id !== prId);

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: formatIssueBody(state),
  });

  core.info(`Removed ${prId} from queue`);
}

async function processQueue(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  state: QueueState,
  token: string
): Promise<number> {
  let processed = 0;

  for (const item of state.items.filter(i => i.status === 'pending')) {
    const [prOwner, prRepoNum] = item.id.split('/');
    const [prRepo, prNum] = prRepoNum.split('#');

    try {
      // Check if PR is mergeable
      const { data: pr } = await octokit.rest.pulls.get({
        owner: prOwner,
        repo: prRepo,
        pull_number: parseInt(prNum),
      });

      if (pr.state !== 'open') {
        // PR is closed, remove from queue
        state.items = state.items.filter(i => i.id !== item.id);
        continue;
      }

      if (!pr.mergeable) {
        item.status = 'failed';
        item.lastError = 'Not mergeable (conflicts)';
        item.retries++;
        continue;
      }

      // Try to merge
      item.status = 'processing';
      await octokit.rest.pulls.merge({
        owner: prOwner,
        repo: prRepo,
        pull_number: parseInt(prNum),
        merge_method: 'squash',
      });

      // Success - remove from queue
      state.items = state.items.filter(i => i.id !== item.id);
      state.stats.merged24h++;
      processed++;
      core.info(`✅ Merged ${item.id}`);

    } catch (error) {
      item.status = 'failed';
      item.lastError = error instanceof Error ? error.message : 'Unknown error';
      item.retries++;
      state.stats.failed24h++;
      core.warning(`❌ Failed to merge ${item.id}: ${item.lastError}`);
    }
  }

  // Update issue
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: formatIssueBody(state),
  });

  return processed;
}

async function refreshQueue(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  state: QueueState,
  token: string
): Promise<void> {
  for (const item of state.items) {
    const [prOwner, prRepoNum] = item.id.split('/');
    const [prRepo, prNum] = prRepoNum.split('#');

    try {
      const { data: pr } = await octokit.rest.pulls.get({
        owner: prOwner,
        repo: prRepo,
        pull_number: parseInt(prNum),
      });

      item.mergeable = pr.mergeable ?? false;

      // Check status
      const { data: checks } = await octokit.rest.checks.listForRef({
        owner: prOwner,
        repo: prRepo,
        ref: pr.head.sha,
      });

      const allPassed = checks.check_runs.every(
        c => c.conclusion === 'success' || c.conclusion === 'skipped'
      );
      const anyFailed = checks.check_runs.some(c => c.conclusion === 'failure');

      item.checks = anyFailed ? 'failing' : allPassed ? 'passing' : 'pending';

      if (pr.state !== 'open') {
        item.status = 'completed';
      }
    } catch (error) {
      core.warning(`Failed to refresh ${item.id}: ${error}`);
    }
  }

  // Remove completed items
  state.items = state.items.filter(i => i.status !== 'completed');

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    body: formatIssueBody(state),
  });

  core.info(`Refreshed ${state.items.length} items in queue`);
}

run();
