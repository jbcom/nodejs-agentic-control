/**
 * Ollama Provider Implementation
 * 
 * Creates agents that use Ollama for LLM inference.
 * Ollama is free/self-hosted, ideal for trivial/simple tasks.
 */

import type {
  AgentDefinition,
  AgentTask,
  AgentResult,
  AgentCapabilities,
  LLMEvaluator,
} from '@agentic/triage';

export interface OllamaConfig {
  /** Ollama API URL (default: http://localhost:11434) */
  url?: string;
  /** Model to use (default: qwen2.5-coder:32b) */
  model?: string;
  /** Request timeout in ms (default: 60000) */
  timeout?: number;
}

const DEFAULT_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5-coder:32b';
const DEFAULT_TIMEOUT = 60000;

/**
 * Create an LLM evaluator function for Ollama
 * Use this with @agentic/triage's evaluateComplexity()
 */
export function createOllamaEvaluator(config: OllamaConfig = {}): LLMEvaluator {
  const url = config.url ?? DEFAULT_URL;
  const model = config.model ?? DEFAULT_MODEL;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return async (prompt: string): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const result = await response.json();
      return result.response;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Create an Ollama-based agent for the registry
 */
export function createOllamaAgent(
  id: string,
  config: OllamaConfig = {},
  options: {
    name?: string;
    cost?: number;
    priority?: number;
    capabilities?: Partial<AgentCapabilities>;
  } = {}
): AgentDefinition<string> {
  const url = config.url ?? DEFAULT_URL;
  const model = config.model ?? DEFAULT_MODEL;
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;

  return {
    id,
    name: options.name ?? `Ollama (${model})`,
    cost: options.cost ?? 0, // Free
    priority: options.priority ?? 1, // High priority (try first)
    enabled: true,
    requiresApproval: false,
    capabilities: {
      tiers: ['trivial', 'simple'],
      maxContext: 8000,
      canCreatePR: false,
      canExecute: false,
      async: false,
      ...options.capabilities,
    },
    execute: async (task: AgentTask): Promise<AgentResult<string>> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${url}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: formatTaskPrompt(task),
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return {
            success: false,
            error: `Ollama error: ${response.status}`,
            escalate: true,
            cost: 0,
          };
        }

        const result = await response.json();
        const output = result.response?.trim();

        // Check if Ollama is asking to escalate
        if (output?.toUpperCase().startsWith('ESCALATE:')) {
          return {
            success: false,
            error: output,
            escalate: true,
            cost: 0,
          };
        }

        return {
          success: true,
          data: output,
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

function formatTaskPrompt(task: AgentTask): string {
  return `You are a code assistant. Complete this task:

TASK: ${task.description}

CONTEXT:
${task.context.slice(0, 8000)}

If you can complete this task, provide the solution.
If this task is too complex, respond with: ESCALATE: <reason>

Provide your response:`;
}
