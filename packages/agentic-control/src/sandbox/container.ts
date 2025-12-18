/**
 * Docker container lifecycle management
 */

import { randomUUID } from 'node:crypto';
import { safeDockerCommand, safeSpawn } from '../core/subprocess.js';
import type { ContainerConfig, ContainerResult } from './types.js';

export class ContainerManager {
  async create(config: ContainerConfig): Promise<string> {
    const containerId = `agentic-sandbox-${randomUUID().slice(0, 8)}`;

    const dockerArgs = [
      'create',
      '--name',
      containerId,
      '--rm',
      '--workdir',
      '/workspace',
      '-v',
      `${config.workspace}:/workspace:ro`,
      '-v',
      `${config.outputDir}:/output`,
    ];

    // Add memory limit if specified
    if (config.memory) {
      dockerArgs.push('-m', `${config.memory}m`);
    }

    // Add environment variables
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }

    // Use the appropriate image based on runtime
    const image = this.getImageForRuntime(config.runtime);
    dockerArgs.push(image);

    const result = safeDockerCommand(dockerArgs);
    if (!result.success) {
      throw new Error(`Failed to create container: ${result.stderr}`);
    }

    return containerId;
  }

  async start(containerId: string): Promise<void> {
    const result = safeDockerCommand(['start', containerId]);
    if (!result.success) {
      throw new Error(`Failed to start container ${containerId}: ${result.stderr}`);
    }
  }

  async stop(containerId: string): Promise<void> {
    const result = safeDockerCommand(['stop', containerId]);
    if (!result.success) {
      // Container might already be stopped, which is fine
      console.warn(`Warning: Could not stop container ${containerId}: ${result.stderr}`);
    }
  }

  async remove(containerId: string): Promise<void> {
    const result = safeDockerCommand(['rm', '-f', containerId]);
    if (!result.success) {
      // Container might already be removed, which is fine
      console.warn(`Warning: Could not remove container ${containerId}: ${result.stderr}`);
    }
  }

  async exec(containerId: string, command: string[]): Promise<ContainerResult> {
    const startTime = Date.now();

    const dockerArgs = ['exec', containerId, ...command];

    try {
      const result = await safeSpawn('docker', dockerArgs);
      const duration = Date.now() - startTime;

      return {
        success: result.success,
        output: result.stdout,
        error: result.stderr,
        exitCode: result.code || 0,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration,
      };
    }
  }

  async logs(containerId: string): Promise<string> {
    const result = safeDockerCommand(['logs', containerId]);
    if (!result.success) {
      throw new Error(`Failed to get logs for container ${containerId}: ${result.stderr}`);
    }
    return result.stdout;
  }

  private getImageForRuntime(runtime: string): string {
    switch (runtime) {
      case 'claude':
      case 'cursor':
        return 'jbcom/agentic-control:latest';
      case 'custom':
        return 'jbcom/agentic-control:latest';
      default:
        return 'jbcom/agentic-control:latest';
    }
  }
}
