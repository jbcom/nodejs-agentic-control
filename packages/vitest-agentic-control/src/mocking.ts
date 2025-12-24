/**
 * Core mocking utilities for @agentic/control testing.
 *
 * This module provides the main `AgenticMocker` class that wraps Vitest's
 * mocking capabilities and provides convenience methods for mocking
 * @agentic/control components.
 *
 * @module mocking
 */

import { type Mock, vi } from 'vitest';
import { createMcpMocker, type McpMocker, type McpMockerOptions } from './mcp.js';
import {
  createProviderMocker,
  type ProviderMocker,
  type ProviderMockerOptions,
} from './providers.js';
import { createSandboxMocker, type SandboxMocker, type SandboxMockerOptions } from './sandbox.js';

/**
 * Options for creating an AgenticMocker instance.
 */
export interface AgenticMockerOptions {
  /** Options for MCP mocking */
  mcp?: McpMockerOptions;
  /** Options for provider mocking */
  providers?: ProviderMockerOptions;
  /** Options for sandbox mocking */
  sandbox?: SandboxMockerOptions;
}

/**
 * Main mocker class for comprehensive @agentic/control testing.
 *
 * This class provides a unified interface for mocking all @agentic/control
 * components: MCP servers, AI providers, sandbox execution, and more.
 *
 * @example Basic usage
 * ```typescript
 * import { AgenticMocker } from 'vitest-@agentic/control';
 *
 * const mocker = new AgenticMocker();
 *
 * // Mock MCP server
 * mocker.mcp.mockServer('my-server', {
 *   tools: [{ name: 'tool1', handler: () => 'result' }],
 * });
 *
 * // Mock AI provider
 * mocker.providers.mockAnthropic({ response: 'Hello!' });
 *
 * // Mock sandbox execution
 * mocker.sandbox.mockExecution({ success: true, output: 'Done!' });
 *
 * // Clean up after test
 * mocker.restoreAll();
 * ```
 */
export class AgenticMocker {
  /** MCP mocking utilities */
  public readonly mcp: McpMocker;
  /** AI provider mocking utilities */
  public readonly providers: ProviderMocker;
  /** Sandbox execution mocking utilities */
  public readonly sandbox: SandboxMocker;

  /** Track all mocked modules for cleanup */
  private readonly mockedModules: Map<string, unknown> = new Map();
  /** Track original module values */
  private readonly originalModules: Map<string, unknown> = new Map();

  /**
   * Creates a new AgenticMocker instance.
   *
   * @param options - Configuration options for the mocker
   */
  constructor(options: AgenticMockerOptions = {}) {
    this.mcp = createMcpMocker(options.mcp);
    this.providers = createProviderMocker(options.providers);
    this.sandbox = createSandboxMocker(options.sandbox);
  }

  /**
   * Mock a module by path.
   *
   * @param modulePath - The module path to mock
   * @param mockValue - The mock value to use
   * @returns The mock value for chaining
   */
  mockModule<T extends Record<string, unknown>>(modulePath: string, mockValue: T): T {
    vi.doMock(modulePath, () => mockValue as Partial<T>);
    this.mockedModules.set(modulePath, mockValue);
    return mockValue;
  }

  /**
   * Create a spy on a function.
   *
   * @param implementation - Optional implementation for the spy
   * @returns The mock function
   */
  createSpy<T extends (...args: unknown[]) => unknown>(implementation?: T): Mock<T> {
    return vi.fn(implementation);
  }

  /**
   * Mock all @agentic/control framework modules.
   *
   * This mocks the common modules used in @agentic/control:
   * - MCP SDK modules
   * - AI SDK modules
   * - GitHub client modules
   *
   * @returns Dictionary of all mocked modules
   */
  mockAllFrameworks(): Record<string, unknown> {
    const mocks: Record<string, unknown> = {};

    // Mock MCP modules
    const mcpMocks = this.mcp.mockAllModules();
    Object.assign(mocks, mcpMocks);

    // Mock provider modules
    const providerMocks = this.providers.mockAllModules();
    Object.assign(mocks, providerMocks);

    return mocks;
  }

  /**
   * Mock the GitHub client.
   *
   * @param options - Options for the mock
   * @returns The mock GitHub client
   */
  mockGitHubClient(
    options: { issues?: unknown[]; pullRequests?: unknown[]; repositories?: unknown[] } = {}
  ): unknown {
    const mockClient = {
      issues: {
        list: vi.fn().mockResolvedValue({ data: options.issues ?? [] }),
        get: vi.fn().mockResolvedValue({ data: options.issues?.[0] ?? {} }),
        create: vi.fn().mockResolvedValue({ data: { id: 1, number: 1 } }),
        update: vi.fn().mockResolvedValue({ data: {} }),
      },
      pulls: {
        list: vi.fn().mockResolvedValue({ data: options.pullRequests ?? [] }),
        get: vi.fn().mockResolvedValue({ data: options.pullRequests?.[0] ?? {} }),
        create: vi.fn().mockResolvedValue({ data: { id: 1, number: 1 } }),
      },
      repos: {
        get: vi.fn().mockResolvedValue({ data: options.repositories?.[0] ?? {} }),
        listForOrg: vi.fn().mockResolvedValue({ data: options.repositories ?? [] }),
      },
    };

    this.mockModule('@octokit/rest', { Octokit: vi.fn().mockReturnValue(mockClient) });
    return mockClient;
  }

  /**
   * Mock environment variables temporarily.
   *
   * @param env - Environment variables to set
   * @returns Cleanup function to restore original values
   */
  mockEnv(env: Record<string, string>): () => void {
    const original: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(env)) {
      original[key] = process.env[key];
      process.env[key] = value;
    }

    return () => {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    };
  }

  /**
   * Restore all mocked modules to their original values.
   */
  restoreAll(): void {
    // Clear our module tracking
    this.mockedModules.clear();
    this.originalModules.clear();

    // Restore sub-mockers
    this.mcp.restoreAll();
    this.providers.restoreAll();
    this.sandbox.restoreAll();

    // Clear all mocks and reset module cache
    vi.clearAllMocks();
    vi.resetModules();
  }

  /**
   * Reset all mocks without restoring.
   */
  resetAll(): void {
    vi.resetAllMocks();
    this.mcp.resetAll();
    this.providers.resetAll();
    this.sandbox.resetAll();
  }
}

/**
 * Factory function to create an AgenticMocker instance.
 *
 * @param options - Configuration options
 * @returns A new AgenticMocker instance
 *
 * @example
 * ```typescript
 * import { createAgenticMocker } from 'vitest-@agentic/control';
 *
 * const mocker = createAgenticMocker();
 * mocker.mcp.mockServer('test', { tools: [] });
 * ```
 */
export function createAgenticMocker(options: AgenticMockerOptions = {}): AgenticMocker {
  return new AgenticMocker(options);
}
