/**
 * Type definitions for sandbox execution
 */

export interface ContainerConfig {
  runtime: 'claude' | 'cursor' | 'custom';
  workspace: string;
  outputDir: string;
  memory?: number;
  timeout?: number;
  env?: Record<string, string>;
}

export interface ContainerResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode: number;
  duration: number;
}

export interface RuntimeOptions {
  timeout?: number;
  memory?: number;
  env?: Record<string, string>;
}

export interface AgentOutput {
  result: string;
  files?: string[];
  error?: string;
}

export interface RuntimeAdapter {
  readonly name: string;
  readonly image: string;

  prepareCommand(prompt: string, options: RuntimeOptions): string[];
  parseOutput(stdout: string, stderr: string): AgentOutput;
  validateEnvironment(): Promise<boolean>;
}

export interface SandboxOptions {
  runtime: 'claude' | 'cursor' | 'custom';
  workspace: string;
  outputDir: string;
  prompt: string;
  timeout?: number;
  memory?: number;
  env?: Record<string, string>;
}
