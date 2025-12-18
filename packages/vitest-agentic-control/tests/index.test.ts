/**
 * Tests for vitest-agentic-control plugin.
 *
 * These tests verify the core functionality of the testing utilities.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  createAgenticMocker,
  createFleetConfig,
  createMcpMocker,
  createMockAgentConfig,
  createMockCrewConfig,
  createMockGitHubIssue,
  createMockGitHubPR,
  createMockTaskConfig,
  createProviderMocker,
  createSandboxConfig,
  createSandboxMocker,
  createTestConfig,
  createTokenConfig,
  createTriageConfig,
  withTestEnv,
} from '../src/index.js';

describe('vitest-agentic-control', () => {
  describe('AgenticMocker', () => {
    it('should create an AgenticMocker instance', () => {
      const mocker = createAgenticMocker();
      expect(mocker).toBeDefined();
      expect(mocker.mcp).toBeDefined();
      expect(mocker.providers).toBeDefined();
      expect(mocker.sandbox).toBeDefined();
    });

    it('should provide MCP mocking utilities', () => {
      const mocker = createAgenticMocker();
      const server = mocker.mcp.mockServer('test-server', {
        tools: [
          {
            name: 'test-tool',
            handler: () => ({ result: 'ok' }),
          },
        ],
      });

      expect(server).toBeDefined();
      expect(server.name).toBe('test-server');
      expect(server.tools.size).toBe(1);
    });

    it('should provide sandbox mocking utilities', () => {
      const mocker = createAgenticMocker();
      mocker.sandbox.mockExecution({
        success: true,
        stdout: 'test output',
        exitCode: 0,
      });

      const container = mocker.sandbox.createMockContainer({
        image: 'node:22',
      });

      expect(container).toBeDefined();
      expect(container.config.image).toBe('node:22');
    });
  });

  describe('McpMocker', () => {
    it('should create mock MCP servers', () => {
      const mocker = createMcpMocker();
      const server = mocker.mockServer('my-server', {
        tools: [
          {
            name: 'search',
            handler: (args) => ({ results: [args] }),
          },
        ],
        resources: [
          {
            uri: 'file:///test.txt',
            content: 'test content',
          },
        ],
      });

      expect(server.name).toBe('my-server');
      expect(server.tools.size).toBe(1);
      expect(server.resources.size).toBe(1);
    });

    it('should allow calling mock tools', async () => {
      const mocker = createMcpMocker();
      const server = mocker.mockServer('test', {
        tools: [
          {
            name: 'greet',
            handler: (args: unknown) => {
              const { name } = args as { name: string };
              return { message: `Hello, ${name}!` };
            },
          },
        ],
      });

      const result = await server.callTool('greet', { name: 'World' });
      expect(result).toEqual({ message: 'Hello, World!' });
    });

    it('should allow reading mock resources', async () => {
      const mocker = createMcpMocker();
      const server = mocker.mockServer('test', {
        resources: [
          {
            uri: 'file:///config.json',
            content: '{"key": "value"}',
            mimeType: 'application/json',
          },
        ],
      });

      const resource = await server.readResource('file:///config.json');
      expect(resource.content).toBe('{"key": "value"}');
      expect(resource.mimeType).toBe('application/json');
    });
  });

  describe('ProviderMocker', () => {
    it('should create mock models', () => {
      const mocker = createProviderMocker();
      const model = mocker.createMockModel('anthropic', 'claude-3-opus', {
        response: 'Hello from Claude!',
      });

      expect(model).toBeDefined();
      expect(model.provider).toBe('anthropic');
      expect(model.modelId).toBe('claude-3-opus');
    });

    it('should generate mock responses', async () => {
      const mocker = createProviderMocker();
      const model = mocker.createMockModel('openai', 'gpt-4', {
        response: 'Mock GPT response',
      });

      const result = await model.generate('Hello');
      expect(result).toHaveProperty('text', 'Mock GPT response');
    });
  });

  describe('SandboxMocker', () => {
    it('should create mock containers', () => {
      const mocker = createSandboxMocker();
      const container = mocker.createMockContainer({
        image: 'python:3.11',
        workdir: '/app',
      });

      expect(container.config.image).toBe('python:3.11');
      expect(container.config.workdir).toBe('/app');
      expect(container.status).toBe('created');
    });

    it('should simulate container lifecycle', async () => {
      const mocker = createSandboxMocker();
      const container = mocker.createMockContainer();

      expect(container.status).toBe('created');

      await container.start();
      expect(container.status).toBe('running');

      await container.stop();
      expect(container.status).toBe('stopped');
    });

    it('should execute commands and return queued results', async () => {
      const mocker = createSandboxMocker();
      mocker.queueResults([
        { success: true, stdout: 'Step 1 done', exitCode: 0 },
        { success: true, stdout: 'Step 2 done', exitCode: 0 },
      ]);

      const container = mocker.createMockContainer();
      await container.start();

      const result1 = await container.exec(['echo', 'step1']);
      expect(result1.stdout).toBe('Step 1 done');

      const result2 = await container.exec(['echo', 'step2']);
      expect(result2.stdout).toBe('Step 2 done');
    });
  });

  describe('Test Fixtures', () => {
    it('should create test configurations', () => {
      const config = createTestConfig({
        logLevel: 'debug',
        tokens: true,
        fleet: true,
        triage: true,
        sandbox: true,
      });

      expect(config.logLevel).toBe('debug');
      expect(config.tokens).toBeDefined();
      expect(config.fleet).toBeDefined();
      expect(config.triage).toBeDefined();
      expect(config.sandbox).toBeDefined();
    });

    it('should create token configurations', () => {
      const tokens = createTokenConfig({
        defaultTokenEnvVar: 'CUSTOM_TOKEN',
      });

      expect(tokens.defaultTokenEnvVar).toBe('CUSTOM_TOKEN');
      expect(tokens.organizations).toBeDefined();
    });

    it('should create fleet configurations', () => {
      const fleet = createFleetConfig({
        concurrency: 10,
      });

      expect(fleet.concurrency).toBe(10);
    });

    it('should create triage configurations', () => {
      const triage = createTriageConfig({
        provider: 'openai',
        model: 'gpt-4-turbo',
      });

      expect(triage.provider).toBe('openai');
      expect(triage.model).toBe('gpt-4-turbo');
    });

    it('should create sandbox configurations', () => {
      const sandbox = createSandboxConfig({
        runtime: 'cursor',
        memory: 1024,
      });

      expect(sandbox.runtime).toBe('cursor');
      expect(sandbox.memory).toBe(1024);
    });
  });

  describe('GitHub Fixtures', () => {
    it('should create mock GitHub issues', () => {
      const issue = createMockGitHubIssue({
        number: 42,
        title: 'Bug report',
        labels: ['bug', 'priority:high'],
      });

      expect(issue.number).toBe(42);
      expect(issue.title).toBe('Bug report');
      expect(issue.labels).toHaveLength(2);
      expect(issue.labels[0].name).toBe('bug');
    });

    it('should create mock GitHub pull requests', () => {
      const pr = createMockGitHubPR({
        number: 123,
        title: 'Feature PR',
        state: 'merged',
      });

      expect(pr.number).toBe(123);
      expect(pr.title).toBe('Feature PR');
      expect(pr.merged).toBe(true);
    });
  });

  describe('Crew Fixtures', () => {
    it('should create mock agent configs', () => {
      const agent = createMockAgentConfig();

      expect(agent.name).toBe('test-agent');
      expect(agent.role).toBeDefined();
      expect(agent.goal).toBeDefined();
    });

    it('should create mock task configs', () => {
      const task = createMockTaskConfig();

      expect(task.name).toBe('test-task');
      expect(task.description).toBeDefined();
      expect(task.agent).toBe('test-agent');
    });

    it('should create mock crew configs', () => {
      const crew = createMockCrewConfig();

      expect(crew.name).toBe('test-crew');
      expect(crew.agents).toBeDefined();
      expect(crew.tasks).toBeDefined();
    });
  });

  describe('Environment Helpers', () => {
    let cleanup: (() => void) | null = null;

    afterEach(() => {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    });

    it('should set up and clean up test environment', () => {
      const originalToken = process.env.TEST_TOKEN;

      cleanup = withTestEnv({
        TEST_TOKEN: 'test-value-123',
      });

      expect(process.env.TEST_TOKEN).toBe('test-value-123');

      cleanup();
      cleanup = null;

      expect(process.env.TEST_TOKEN).toBe(originalToken);
    });

    it('should handle undefined original values', () => {
      delete process.env.UNIQUE_TEST_VAR;

      cleanup = withTestEnv({
        UNIQUE_TEST_VAR: 'temporary-value',
      });

      expect(process.env.UNIQUE_TEST_VAR).toBe('temporary-value');

      cleanup();
      cleanup = null;

      expect(process.env.UNIQUE_TEST_VAR).toBeUndefined();
    });
  });
});
