/**
 * Cursor runtime adapter for sandbox execution
 */

import type { AgentOutput, RuntimeAdapter, RuntimeOptions } from '../types.js';

export class CursorRuntime implements RuntimeAdapter {
  readonly name = 'cursor';
  readonly image = 'jbcom/agentic-control:latest';

  prepareCommand(prompt: string, options: RuntimeOptions): string[] {
    const command = ['cursor-agent', 'run', '--task', prompt];

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
    return !!process.env.CURSOR_API_KEY;
  }
}
