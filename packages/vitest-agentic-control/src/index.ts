/**
 * Vitest plugin with fixtures and utilities for @agentic/control E2E testing.
 *
 * This package provides test utilities and mocking fixtures for building
 * E2E tests with @agentic/control components (MCP, providers, sandbox, fleet).
 *
 * @packageDocumentation
 *
 * @example Installation
 * ```bash
 * pnpm add -D vitest-@agentic/control
 * ```
 *
 * @example Basic Usage
 * ```typescript
 * import { describe, it, expect } from 'vitest';
 * import { createMcpMocker, createProviderMocker } from 'vitest-@agentic/control';
 *
 * describe('My MCP Tests', () => {
 *   it('should mock MCP server', async () => {
 *     const mocker = createMcpMocker();
 *     mocker.mockServer('test-server', {
 *       tools: [{ name: 'test-tool', handler: () => ({ result: 'ok' }) }],
 *     });
 *
 *     // Your test code here
 *   });
 * });
 * ```
 *
 * @example Provider Mocking
 * ```typescript
 * import { createProviderMocker } from 'vitest-@agentic/control';
 *
 * const mocker = createProviderMocker();
 * mocker.mockAnthropic({ response: 'Mocked Claude response' });
 * mocker.mockOpenAI({ response: 'Mocked GPT response' });
 * ```
 *
 * Available exports:
 *   - `AgenticMocker` - Main mocker class for comprehensive mocking
 *   - `createMcpMocker` - Factory for MCP server mocking
 *   - `createProviderMocker` - Factory for AI provider mocking
 *   - `createSandboxMocker` - Factory for sandbox execution mocking
 *   - Test fixtures for configs and environment setup
 */

// Test fixtures
export {
  createFleetConfig,
  createMockAgentConfig,
  createMockCrewConfig,
  createMockGitHubIssue,
  createMockGitHubPR,
  createMockTaskConfig,
  createSandboxConfig,
  createTestConfig,
  createTokenConfig,
  createTriageConfig,
  DEFAULT_TEST_ENV,
  type TestConfig,
  type TestConfigOptions,
  type TestEnvSetup,
  type TestFleetConfig,
  type TestSandboxConfig,
  type TestTokenConfig,
  type TestTriageConfig,
  withTestEnv,
} from './fixtures.js';

// MCP mocking utilities
export {
  createMcpMocker,
  McpMocker,
  type McpMockerOptions,
  MockMcpResource,
  MockMcpServer,
  MockMcpTool,
  type MockResourceDefinition,
  type MockToolDefinition,
} from './mcp.js';
// Main mocker class
export { AgenticMocker, createAgenticMocker } from './mocking.js';
// Provider mocking utilities
export {
  createProviderMocker,
  type MockProviderResponse,
  type MockStreamChunk,
  ProviderMocker,
  type ProviderMockerOptions,
  SUPPORTED_PROVIDERS,
} from './providers.js';
// Sandbox mocking utilities
export {
  createSandboxMocker,
  type MockContainerConfig,
  type MockExecutionResult,
  SandboxMocker,
  type SandboxMockerOptions,
} from './sandbox.js';

// Version
export const VERSION = '1.0.0';
