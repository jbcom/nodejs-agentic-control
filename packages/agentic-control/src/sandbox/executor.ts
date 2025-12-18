/**
 * Main sandbox executor for running AI agents in containers
 */

import { ContainerManager } from './container.js';
import { ClaudeRuntime, CursorRuntime } from './runtime/index.js';
import type { ContainerResult, RuntimeAdapter, SandboxOptions } from './types.js';

export class SandboxExecutor {
  private containerManager: ContainerManager;
  private runtimes: Map<string, RuntimeAdapter>;

  constructor() {
    this.containerManager = new ContainerManager();
    this.runtimes = new Map<string, RuntimeAdapter>([
      ['claude', new ClaudeRuntime()],
      ['cursor', new CursorRuntime()],
    ]);
  }

  async execute(options: SandboxOptions): Promise<ContainerResult> {
    const runtime = this.runtimes.get(options.runtime);
    if (!runtime) {
      throw new Error(`Unknown runtime: ${options.runtime}`);
    }

    // Validate environment
    const isValid = await runtime.validateEnvironment();
    if (!isValid) {
      throw new Error(`Environment validation failed for runtime: ${options.runtime}`);
    }

    const containerId = await this.containerManager.create({
      runtime: options.runtime,
      workspace: options.workspace,
      outputDir: options.outputDir,
      memory: options.memory,
      timeout: options.timeout,
      env: options.env,
    });

    try {
      await this.containerManager.start(containerId);
      const command = runtime.prepareCommand(options.prompt, {
        timeout: options.timeout,
        memory: options.memory,
        env: options.env,
      });

      const result = await this.containerManager.exec(containerId, command);

      // Parse the output using the runtime adapter
      if (result.success && result.output) {
        const parsed = runtime.parseOutput(result.output, result.error || '');
        return {
          ...result,
          output: JSON.stringify(parsed),
        };
      }

      return result;
    } finally {
      await this.containerManager.stop(containerId);
      await this.containerManager.remove(containerId);
    }
  }

  async executeFleet(options: SandboxOptions[]): Promise<ContainerResult[]> {
    // Execute all sandboxes in parallel
    const promises = options.map((option) => this.execute(option));
    return Promise.all(promises);
  }
}
