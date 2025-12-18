/**
 * Claude runtime adapter for sandbox execution
 */

import type { AgentOutput, RuntimeAdapter, RuntimeOptions } from '../types.js';

export class ClaudeRuntime implements RuntimeAdapter {
  readonly name = 'claude';
  readonly image = 'jbcom/agentic-control:latest';

  prepareCommand(prompt: string, options: RuntimeOptions): string[] {
    const command = ['npx', '@anthropic-ai/claude-agent-sdk', 'query', '--prompt', prompt];

    if (options.timeout) {
      command.push('--timeout', options.timeout.toString());
    }

    return command;
  }

  parseOutput(stdout: string, stderr: string): AgentOutput {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(stdout);
      return {
        result: parsed.result || stdout,
        files: parsed.files || [],
        error: stderr || parsed.error,
      };
    } catch {
      // Fallback to plain text
      return {
        result: stdout,
        files: [],
        error: stderr,
      };
    }
  }

  async validateEnvironment(): Promise<boolean> {
    return !!process.env.ANTHROPIC_API_KEY;
  }
}
