# @agentic/providers

LLM and agent provider implementations for [@agentic/triage](https://github.com/agentic-dev-library/triage).

## Installation

```bash
npm install @agentic/providers @agentic/triage
```

## Providers

| Provider | Cost | Use Case |
|----------|------|----------|
| **Ollama** | Free | Trivial/simple tasks, local inference |
| **Jules** | Free tier | Complex tasks, PR creation, multi-file |
| **Cursor** | $$$ | Expert-level, last resort |

## Usage

```typescript
import { AgentRegistry, evaluateComplexity, TaskRouter } from '@agentic/triage';
import { 
  createOllamaAgent, 
  createOllamaEvaluator, 
  createJulesAgent,
  createCursorAgent 
} from '@agentic/providers';

// Create evaluator for complexity scoring
const evaluate = createOllamaEvaluator({ 
  url: 'http://localhost:11434',
  model: 'qwen2.5-coder:32b'
});

// Set up agent registry
const registry = new AgentRegistry()
  .register(createOllamaAgent('ollama', { 
    url: 'http://localhost:11434' 
  }))
  .register(createJulesAgent('jules', { 
    apiKey: process.env.JULES_API_KEY! 
  }))
  .register(createCursorAgent('cursor', { 
    apiKey: process.env.CURSOR_API_KEY! 
  }, {
    requiresApproval: true  // Explicit approval needed
  }));

// Create router with cost tracking
const router = new TaskRouter({ 
  registry,
  dailyBudget: 50,  // $0.50 in cost units
  onCostIncurred: (agent, cost, task) => {
    console.log(`${agent.id} cost ${cost} for ${task.id}`);
  }
});

// Evaluate and route a task
const score = await evaluateComplexity(evaluate, 'Fix the login bug', diff);
console.log(`Complexity: ${score.weighted} (${score.tier})`);

const result = await router.route({ 
  id: 'task-123',
  description: 'Fix the login bug',
  context: diff,
  repo: 'my-org/my-repo'
}, score);

if (result.success) {
  console.log(`Completed by ${result.agent}`);
} else {
  console.log(`Failed: ${result.result.error}`);
}
```

## License

MIT
