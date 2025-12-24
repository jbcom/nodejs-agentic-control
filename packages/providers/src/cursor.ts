/**
 * Cursor Cloud Agent Provider Implementation
 * 
 * Creates agents that use Cursor Cloud Agents for expert-level tasks.
 * WARNING: Cursor Cloud Agents are expensive - use sparingly!
 */

import type {
  AgentDefinition,
  AgentTask,
  AgentResult,
  AgentCapabilities,
} from '@agentic/triage';

export interface CursorConfig {
  /** Cursor API key */
  apiKey: string;
  /** API base URL (default: https://api.cursor.com/v0) */
  baseUrl?: string;
  /** Workspace path in the cloud environment */
  workspacePath?: string;
}

export interface CursorAgentResult {
  /** Agent ID */
  agentId: string;
  /** Current status */
  status: string;
  /** Output messages */
  messages?: Array<{ role: string; content: string }>;
}

const DEFAULT_BASE_URL = 'https://api.cursor.com/v0';

/**
 * Create a Cursor Cloud Agent for the registry
 * 
 * ⚠️ EXPENSIVE - Requires explicit approval by default
 */
export function createCursorAgent(
  id: string,
  config: CursorConfig,
  options: {
    name?: string;
    cost?: number;
    priority?: number;
    requiresApproval?: boolean;
    capabilities?: Partial<AgentCapabilities>;
  } = {}
): AgentDefinition<CursorAgentResult> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  return {
    id,
    name: options.name ?? 'Cursor Cloud Agent',
    cost: options.cost ?? 100, // Expensive!
    priority: options.priority ?? 100, // Very low priority (last resort)
    enabled: true,
    requiresApproval: options.requiresApproval ?? true, // Require approval by default
    capabilities: {
      tiers: ['expert'], // Only for expert-level tasks
      maxContext: 200000,
      canCreatePR: true,
      canExecute: true,
      async: true,
      ...options.capabilities,
    },
    execute: async (task: AgentTask): Promise<AgentResult<CursorAgentResult>> => {
      try {
        const response = await fetch(`${baseUrl}/agents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: formatCursorPrompt(task),
              },
            ],
            workspacePath: config.workspacePath,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          return {
            success: false,
            error: `Cursor API error: ${response.status} - ${error}`,
            escalate: false, // No more tiers to escalate to
            cost: 0, // Don't charge for failed requests
          };
        }

        const result = await response.json();
        
        return {
          success: true,
          data: {
            agentId: result.id ?? result.agentId,
            status: result.status ?? 'running',
            messages: result.messages,
          },
          jobId: result.id, // Caller should poll
          cost: 100, // Charge for successful spawn
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          escalate: false,
          cost: 0,
        };
      }
    },
  };
}

/**
 * Poll a Cursor agent for status
 */
export async function pollCursorAgent(
  config: CursorConfig,
  agentId: string
): Promise<CursorAgentResult> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  const response = await fetch(`${baseUrl}/agents/${agentId}`, {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to poll agent: ${response.status}`);
  }

  const result = await response.json();
  
  return {
    agentId: result.id,
    status: result.status,
    messages: result.messages,
  };
}

function formatCursorPrompt(task: AgentTask): string {
  return `You are an expert developer. Complete this complex task:

TASK: ${task.description}

REPOSITORY: ${task.repo ?? 'Unknown'}

CONTEXT:
${task.context}

This task was escalated to you because simpler approaches failed.
Take your time, analyze carefully, and provide a complete solution.`;
}
