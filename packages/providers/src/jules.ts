/**
 * Google Jules Provider Implementation
 * 
 * Creates agents that use Google Jules for complex async tasks.
 * Jules can create PRs, run commands, and handle multi-file changes.
 */

import type {
  AgentDefinition,
  AgentTask,
  AgentResult,
  AgentCapabilities,
} from '@agentic/triage';

export interface JulesConfig {
  /** Jules API key */
  apiKey: string;
  /** API base URL (default: https://jules.googleapis.com/v1alpha) */
  baseUrl?: string;
  /** Automation mode (default: AUTO_CREATE_PR) */
  automationMode?: 'AUTOMATION_MODE_UNSPECIFIED' | 'AUTO_CREATE_PR' | 'MANUAL';
}

export interface JulesSessionResult {
  /** Session ID for polling */
  sessionId: string;
  /** Session name/resource path */
  name: string;
  /** Current state */
  state: string;
}

const DEFAULT_BASE_URL = 'https://jules.googleapis.com/v1alpha';

/**
 * Create a Jules-based agent for the registry
 */
export function createJulesAgent(
  id: string,
  config: JulesConfig,
  options: {
    name?: string;
    cost?: number;
    priority?: number;
    capabilities?: Partial<AgentCapabilities>;
  } = {}
): AgentDefinition<JulesSessionResult> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const automationMode = config.automationMode ?? 'AUTO_CREATE_PR';

  return {
    id,
    name: options.name ?? 'Google Jules',
    cost: options.cost ?? 0, // Free tier
    priority: options.priority ?? 10, // Lower priority than Ollama
    enabled: true,
    requiresApproval: false,
    capabilities: {
      tiers: ['moderate', 'complex', 'expert'],
      maxContext: 100000,
      canCreatePR: true,
      canExecute: true,
      async: true, // Jules is async - returns job ID
      ...options.capabilities,
    },
    execute: async (task: AgentTask): Promise<AgentResult<JulesSessionResult>> => {
      try {
        const response = await fetch(`${baseUrl}/sessions`, {
          method: 'POST',
          headers: {
            'X-Goog-Api-Key': config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: formatJulesPrompt(task),
            sourceContext: task.repo ? {
              source: `sources/github/${task.repo}`,
              githubRepoContext: {
                startingBranch: 'main',
              },
            } : undefined,
            automationMode,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          return {
            success: false,
            error: `Jules API error: ${response.status} - ${error}`,
            escalate: true,
            cost: 0,
          };
        }

        const result = await response.json();
        
        return {
          success: true,
          data: {
            sessionId: result.name?.split('/').pop() ?? result.name,
            name: result.name,
            state: result.state ?? 'PENDING',
          },
          jobId: result.name, // Caller should poll this
          cost: 0,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          escalate: true,
          cost: 0,
        };
      }
    },
  };
}

/**
 * Poll a Jules session for completion
 */
export async function pollJulesSession(
  config: JulesConfig,
  sessionName: string
): Promise<{ state: string; prUrl?: string; error?: string }> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  const response = await fetch(`${baseUrl}/${sessionName}`, {
    headers: {
      'X-Goog-Api-Key': config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to poll session: ${response.status}`);
  }

  const result = await response.json();
  
  return {
    state: result.state,
    prUrl: result.pullRequestUrl,
    error: result.error?.message,
  };
}

/**
 * Send a follow-up message to a Jules session
 */
export async function sendJulesFollowUp(
  config: JulesConfig,
  sessionName: string,
  message: string
): Promise<void> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  const response = await fetch(`${baseUrl}/${sessionName}:addUserResponse`, {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userResponse: message }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send follow-up: ${response.status}`);
  }
}

function formatJulesPrompt(task: AgentTask): string {
  return `${task.description}

Context:
${task.context}

Requirements:
- Create a PR with your changes
- Ensure all tests pass
- Follow existing code style
- Add appropriate documentation`;
}
