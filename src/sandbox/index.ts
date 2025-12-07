/**
 * Agent Execution Contract
 * 
 * This defines the BOUNDARY between different execution modes.
 * All agent executors must implement this interface.
 */

export interface AgentExecutor {
    /**
     * Execute a single agent task
     */
    execute(task: string, workingDir?: string): Promise<void>;
}

/**
 * Sandbox = simplest local single-agent executor
 */
export class SandboxExecutor implements AgentExecutor {
    async execute(task: string, workingDir?: string): Promise<void> {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY required');
        }

        const { query } = await import('@anthropic-ai/claude-agent-sdk');

        const generator = query({
            prompt: task,
            options: { cwd: workingDir || process.cwd() },
        });

        for await (const message of generator) {
            if (message.type === 'assistant') {
                for (const block of message.message.content) {
                    if (block.type === 'text') {
                        process.stdout.write(block.text);
                    }
                }
            }
        }
    }
}

export const sandbox = new SandboxExecutor();
