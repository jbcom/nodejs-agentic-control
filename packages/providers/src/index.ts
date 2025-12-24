/**
 * @agentic/providers
 * 
 * LLM and agent provider implementations for use with @agentic/triage.
 * 
 * These implementations connect the provider-agnostic primitives from
 * @agentic/triage to real LLM services like Ollama, Jules, and Cursor.
 * 
 * @example
 * ```typescript
 * import { AgentRegistry, evaluateComplexity, TaskRouter } from '@agentic/triage';
 * import { createOllamaAgent, createOllamaEvaluator, createJulesAgent } from '@agentic/providers';
 * 
 * // Create evaluator for complexity scoring
 * const evaluate = createOllamaEvaluator({ url: 'http://ollama:11434' });
 * 
 * // Set up agent registry with your preferred providers
 * const registry = new AgentRegistry()
 *   .register(createOllamaAgent('ollama', { url: 'http://ollama:11434' }))
 *   .register(createJulesAgent('jules', { apiKey: process.env.JULES_API_KEY }));
 * 
 * // Create router
 * const router = new TaskRouter({ registry });
 * 
 * // Evaluate and route a task
 * const score = await evaluateComplexity(evaluate, 'Fix the bug', diff);
 * const result = await router.route(task, score);
 * ```
 */

// Ollama provider (free, self-hosted)
export {
  type OllamaConfig,
  createOllamaEvaluator,
  createOllamaAgent,
} from './ollama.js';

// Google Jules provider (free tier, async)
export {
  type JulesConfig,
  type JulesSessionResult,
  createJulesAgent,
  pollJulesSession,
  sendJulesFollowUp,
} from './jules.js';

// Cursor Cloud Agent provider (expensive, last resort)
export {
  type CursorConfig,
  type CursorAgentResult,
  createCursorAgent,
  pollCursorAgent,
} from './cursor.js';
