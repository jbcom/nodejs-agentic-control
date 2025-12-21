/**
 * Sandbox execution mocking utilities for agentic-control testing.
 *
 * This module provides utilities for mocking Docker container execution
 * and sandbox operations during testing. It allows you to simulate
 * container behavior without needing actual Docker.
 *
 * @module sandbox
 */

import { type Mock, vi } from 'vitest';

/**
 * Mock container configuration.
 */
export interface MockContainerConfig {
  /** Container ID */
  id?: string;
  /** Container name */
  name?: string;
  /** Image name */
  image?: string;
  /** Working directory */
  workdir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Memory limit in MB */
  memory?: number;
  /** Timeout in ms */
  timeout?: number;
}

/**
 * Mock execution result.
 */
export interface MockExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Exit code */
  exitCode?: number;
  /** Standard output */
  stdout?: string;
  /** Standard error */
  stderr?: string;
  /** Output files */
  files?: Array<{
    path: string;
    content: string | Buffer;
  }>;
  /** Execution duration in ms */
  duration?: number;
  /** Error if execution failed */
  error?: Error;
}

/**
 * Options for creating a SandboxMocker instance.
 */
export interface SandboxMockerOptions {
  /** Default container configuration */
  defaultConfig?: MockContainerConfig;
  /** Default execution result */
  defaultResult?: MockExecutionResult;
  /** Whether to auto-mock Docker commands */
  autoMock?: boolean;
}

/**
 * Mock container instance.
 */
export interface MockContainer {
  /** Container configuration */
  config: MockContainerConfig;
  /** Container status */
  status: 'created' | 'running' | 'stopped' | 'removed';
  /** Execution history */
  executions: Array<{
    command: string[];
    result: MockExecutionResult;
    timestamp: Date;
  }>;
  /** Mock methods */
  start: Mock<() => Promise<void>>;
  stop: Mock<() => Promise<void>>;
  exec: Mock<(command: string[]) => Promise<MockExecutionResult>>;
  remove: Mock<() => Promise<void>>;
  copyTo: Mock<(hostPath: string, containerPath: string) => Promise<void>>;
  copyFrom: Mock<(containerPath: string, hostPath: string) => Promise<void>>;
}

/**
 * Sandbox execution mocking utilities class.
 *
 * Provides methods for mocking Docker container execution during testing.
 *
 * @example
 * ```typescript
 * import { SandboxMocker } from 'vitest-agentic-control';
 *
 * const mocker = new SandboxMocker();
 *
 * // Mock successful execution
 * mocker.mockExecution({
 *   success: true,
 *   stdout: 'Hello from container!',
 *   exitCode: 0,
 * });
 *
 * // Create a mock container
 * const container = mocker.createMockContainer({
 *   image: 'node:22',
 *   workdir: '/app',
 * });
 *
 * // Execute command in mock container
 * const result = await container.exec(['npm', 'test']);
 * expect(result.success).toBe(true);
 * ```
 */
export class SandboxMocker {
  /** Default container configuration */
  private defaultConfig: MockContainerConfig;

  /** Default execution result */
  private defaultResult: MockExecutionResult;

  /** Track mock containers */
  public readonly containers: Map<string, MockContainer> = new Map();

  /** Track mocked modules */
  private readonly mockedModules: Set<string> = new Set();

  /** Queue of results to return from executions */
  private resultQueue: MockExecutionResult[] = [];

  /** Counter for generating container IDs */
  private containerIdCounter = 0;

  constructor(options: SandboxMockerOptions = {}) {
    this.defaultConfig = options.defaultConfig ?? {
      image: 'node:22-slim',
      workdir: '/workspace',
    };

    this.defaultResult = options.defaultResult ?? {
      success: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
    };

    if (options.autoMock) {
      this.mockDockerCommands();
    }
  }

  /**
   * Set the default execution result.
   *
   * @param result - The result to return from executions
   */
  mockExecution(result: MockExecutionResult): void {
    this.defaultResult = result;
  }

  /**
   * Queue a result to be returned from the next execution.
   *
   * @param result - The result to queue
   */
  queueResult(result: MockExecutionResult): void {
    this.resultQueue.push(result);
  }

  /**
   * Queue multiple results to be returned from executions.
   *
   * @param results - The results to queue
   */
  queueResults(results: MockExecutionResult[]): void {
    this.resultQueue.push(...results);
  }

  /**
   * Get the next result from the queue or the default.
   */
  private getNextResult(): MockExecutionResult {
    return this.resultQueue.shift() ?? this.defaultResult;
  }

  /**
   * Create a mock container.
   *
   * @param config - Container configuration
   * @returns Mock container instance
   */
  createMockContainer(config: MockContainerConfig = {}): MockContainer {
    const mergedConfig: MockContainerConfig = {
      ...this.defaultConfig,
      ...config,
      id: config.id ?? `mock-container-${++this.containerIdCounter}`,
      name: config.name ?? `mock-container-${this.containerIdCounter}`,
    };

    // At this point, id is guaranteed to be defined
    const containerId = mergedConfig.id as string;

    const container: MockContainer = {
      config: mergedConfig,
      status: 'created',
      executions: [],

      start: vi.fn(async () => {
        container.status = 'running';
      }),

      stop: vi.fn(async () => {
        container.status = 'stopped';
      }),

      exec: vi.fn(async (command: string[]) => {
        const result = this.getNextResult();
        container.executions.push({
          command,
          result,
          timestamp: new Date(),
        });

        if (result.error) {
          throw result.error;
        }

        return result;
      }),

      remove: vi.fn(async () => {
        container.status = 'removed';
        this.containers.delete(containerId);
      }),

      copyTo: vi.fn(async () => {
        // Mock file copy to container
      }),

      copyFrom: vi.fn(async () => {
        // Mock file copy from container
      }),
    };

    this.containers.set(containerId, container);
    return container;
  }

  /**
   * Mock Docker CLI commands.
   */
  mockDockerCommands(): void {
    // Mock child_process for Docker commands
    vi.doMock('child_process', () => ({
      spawn: vi.fn((command: string, args: string[]) => {
        const isDocker = command === 'docker' || command.includes('docker');

        if (isDocker) {
          return this.createMockDockerProcess(args);
        }

        // Return a basic mock process for non-Docker commands
        return {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: vi.fn((event: string, cb: (code: number) => void) => {
            if (event === 'close') {
              cb(0);
            }
          }),
          kill: vi.fn(),
        };
      }),

      spawnSync: vi.fn((command: string, _args: string[]) => {
        const isDocker = command === 'docker' || command.includes('docker');

        if (isDocker) {
          const result = this.getNextResult();
          return {
            status: result.exitCode ?? 0,
            stdout: Buffer.from(result.stdout ?? ''),
            stderr: Buffer.from(result.stderr ?? ''),
            error: result.error,
          };
        }

        return {
          status: 0,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
        };
      }),

      execSync: vi.fn((command: string) => {
        if (command.includes('docker')) {
          return this.defaultResult.stdout ?? '';
        }
        return '';
      }),
    }));

    this.mockedModules.add('child_process');
  }

  /**
   * Create a mock Docker process.
   */
  private createMockDockerProcess(args: string[]): unknown {
    const result = this.getNextResult();

    // Parse Docker command
    const subcommand = args[0];

    const process = {
      stdout: {
        on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data' && result.stdout) {
            cb(Buffer.from(result.stdout));
          }
        }),
      },
      stderr: {
        on: vi.fn((event: string, cb: (data: Buffer) => void) => {
          if (event === 'data' && result.stderr) {
            cb(Buffer.from(result.stderr));
          }
        }),
      },
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === 'close') {
          setTimeout(() => cb(result.exitCode ?? 0), 10);
        }
      }),
      kill: vi.fn(),
    };

    // Handle specific Docker commands
    if (subcommand === 'run') {
      // Create a mock container when docker run is called
      const container = this.createMockContainer({
        image: args.find((_a, i) => args[i - 1] === '--image') ?? 'unknown',
      });
      container.status = 'running';
    }

    return process;
  }

  /**
   * Mock the ContainerManager class from agentic-control.
   */
  mockContainerManager(): Mock {
    const mockManager = vi.fn().mockImplementation(() => ({
      createContainer: vi.fn(async (config: MockContainerConfig) => {
        return this.createMockContainer(config);
      }),
      startContainer: vi.fn(async (id: string) => {
        const container = this.containers.get(id);
        if (container) {
          await container.start();
        }
      }),
      stopContainer: vi.fn(async (id: string) => {
        const container = this.containers.get(id);
        if (container) {
          await container.stop();
        }
      }),
      removeContainer: vi.fn(async (id: string) => {
        const container = this.containers.get(id);
        if (container) {
          await container.remove();
        }
      }),
      execInContainer: vi.fn(async (id: string, command: string[]) => {
        const container = this.containers.get(id);
        if (container) {
          return container.exec(command);
        }
        throw new Error(`Container not found: ${id}`);
      }),
    }));

    vi.doMock('agentic-control/sandbox', () => ({
      ContainerManager: mockManager,
    }));

    this.mockedModules.add('agentic-control/sandbox');
    return mockManager;
  }

  /**
   * Mock the SandboxExecutor class from agentic-control.
   */
  mockSandboxExecutor(): Mock {
    const mockExecutor = vi.fn().mockImplementation(() => ({
      execute: vi.fn(async () => {
        return this.getNextResult();
      }),
      executeWithTimeout: vi.fn(async () => {
        return this.getNextResult();
      }),
    }));

    vi.doMock('agentic-control/sandbox', () => ({
      SandboxExecutor: mockExecutor,
    }));

    this.mockedModules.add('agentic-control/sandbox');
    return mockExecutor;
  }

  /**
   * Create a mock runtime adapter.
   *
   * @param name - Runtime name
   * @param command - Command to return from prepareCommand
   */
  createMockRuntime(
    name: string,
    command: string[] = ['echo', 'mock']
  ): {
    name: string;
    prepareCommand: Mock<(prompt: string, options?: unknown) => string[]>;
    parseOutput: Mock<(output: string) => unknown>;
  } {
    return {
      name,
      prepareCommand: vi.fn(() => command),
      parseOutput: vi.fn((output: string) => ({ output })),
    };
  }

  /**
   * Get all container IDs.
   */
  getContainerIds(): string[] {
    return Array.from(this.containers.keys());
  }

  /**
   * Get a container by ID.
   */
  getContainer(id: string): MockContainer | undefined {
    return this.containers.get(id);
  }

  /**
   * Restore all mocked modules.
   */
  restoreAll(): void {
    this.mockedModules.clear();
    this.containers.clear();
    this.resultQueue = [];
  }

  /**
   * Reset all mocks.
   */
  resetAll(): void {
    for (const container of this.containers.values()) {
      container.start.mockClear();
      container.stop.mockClear();
      container.exec.mockClear();
      container.remove.mockClear();
      container.copyTo.mockClear();
      container.copyFrom.mockClear();
      container.executions = [];
    }
    this.resultQueue = [];
  }
}

/**
 * Factory function to create a SandboxMocker instance.
 *
 * @param options - Configuration options
 * @returns A new SandboxMocker instance
 */
export function createSandboxMocker(options: SandboxMockerOptions = {}): SandboxMocker {
  return new SandboxMocker(options);
}
