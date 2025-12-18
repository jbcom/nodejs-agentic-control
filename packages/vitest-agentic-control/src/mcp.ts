/**
 * MCP (Model Context Protocol) mocking utilities for agentic-control testing.
 *
 * This module provides utilities for mocking MCP servers, tools, and resources
 * during testing. It allows you to simulate MCP server behavior without
 * needing actual MCP server implementations.
 *
 * @module mcp
 */

import { type Mock, vi } from 'vitest';

/**
 * List of MCP-related modules that can be mocked.
 */
export const MCP_MODULES = [
  '@modelcontextprotocol/sdk',
  '@modelcontextprotocol/sdk/client',
  '@modelcontextprotocol/sdk/server',
  '@ai-sdk/mcp',
] as const;

/**
 * Definition for a mock MCP tool.
 */
export interface MockToolDefinition {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** Input schema (JSON Schema) */
  inputSchema?: Record<string, unknown>;
  /** Handler function for the tool */
  handler: (args: unknown) => unknown | Promise<unknown>;
}

/**
 * Definition for a mock MCP resource.
 */
export interface MockResourceDefinition {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name?: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
  /** Resource content */
  content: string | Buffer;
}

/**
 * Options for creating an McpMocker instance.
 */
export interface McpMockerOptions {
  /** Whether to auto-mock all MCP modules */
  autoMock?: boolean;
}

/**
 * Mock MCP tool with call tracking.
 */
export interface MockMcpTool {
  /** Tool definition */
  definition: MockToolDefinition;
  /** Mock handler with call tracking */
  handler: Mock<(args: unknown) => unknown | Promise<unknown>>;
  /** Call history */
  calls: unknown[];
}

/**
 * Mock MCP resource.
 */
export interface MockMcpResource {
  /** Resource definition */
  definition: MockResourceDefinition;
  /** Read count */
  readCount: number;
}

/**
 * Mock MCP server configuration.
 */
export interface MockMcpServerConfig {
  /** Server name */
  name: string;
  /** Server tools */
  tools?: MockToolDefinition[];
  /** Server resources */
  resources?: MockResourceDefinition[];
  /** Server capabilities */
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

/**
 * Mock MCP server instance.
 */
export class MockMcpServer {
  public readonly name: string;
  public readonly tools: Map<string, MockMcpTool> = new Map();
  public readonly resources: Map<string, MockMcpResource> = new Map();
  public readonly capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };

  private connected = false;

  constructor(config: MockMcpServerConfig) {
    this.name = config.name;
    this.capabilities = {
      tools: config.capabilities?.tools ?? true,
      resources: config.capabilities?.resources ?? true,
      prompts: config.capabilities?.prompts ?? false,
    };

    // Register tools
    for (const tool of config.tools ?? []) {
      this.registerTool(tool);
    }

    // Register resources
    for (const resource of config.resources ?? []) {
      this.registerResource(resource);
    }
  }

  /**
   * Register a tool with this mock server.
   */
  registerTool(definition: MockToolDefinition): MockMcpTool {
    const mockTool: MockMcpTool = {
      definition,
      handler: vi.fn(definition.handler),
      calls: [],
    };
    this.tools.set(definition.name, mockTool);
    return mockTool;
  }

  /**
   * Register a resource with this mock server.
   */
  registerResource(definition: MockResourceDefinition): MockMcpResource {
    const mockResource: MockMcpResource = {
      definition,
      readCount: 0,
    };
    this.resources.set(definition.uri, mockResource);
    return mockResource;
  }

  /**
   * Connect to this mock server.
   */
  async connect(): Promise<void> {
    this.connected = true;
  }

  /**
   * Disconnect from this mock server.
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * List available tools.
   */
  async listTools(): Promise<
    Array<{
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }>
  > {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.definition.name,
      description: tool.definition.description,
      inputSchema: tool.definition.inputSchema,
    }));
  }

  /**
   * Call a tool.
   */
  async callTool(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    tool.calls.push(args);
    return tool.handler(args);
  }

  /**
   * List available resources.
   */
  async listResources(): Promise<
    Array<{
      uri: string;
      name?: string;
      description?: string;
      mimeType?: string;
    }>
  > {
    return Array.from(this.resources.values()).map((resource) => ({
      uri: resource.definition.uri,
      name: resource.definition.name,
      description: resource.definition.description,
      mimeType: resource.definition.mimeType,
    }));
  }

  /**
   * Read a resource.
   */
  async readResource(uri: string): Promise<{
    uri: string;
    mimeType?: string;
    content: string | Buffer;
  }> {
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    resource.readCount++;
    return {
      uri: resource.definition.uri,
      mimeType: resource.definition.mimeType,
      content: resource.definition.content,
    };
  }

  /**
   * Reset all call history.
   */
  reset(): void {
    for (const tool of this.tools.values()) {
      tool.handler.mockClear();
      tool.calls = [];
    }
    for (const resource of this.resources.values()) {
      resource.readCount = 0;
    }
  }
}

/**
 * MCP mocking utilities class.
 *
 * Provides methods for mocking MCP servers, tools, and resources
 * during testing.
 *
 * @example
 * ```typescript
 * import { McpMocker } from 'vitest-agentic-control';
 *
 * const mocker = new McpMocker();
 *
 * // Create a mock MCP server
 * const server = mocker.mockServer('test-server', {
 *   tools: [
 *     {
 *       name: 'get_weather',
 *       description: 'Get weather for a location',
 *       handler: (args) => ({ temp: 72, condition: 'sunny' }),
 *     },
 *   ],
 *   resources: [
 *     {
 *       uri: 'file:///config.json',
 *       content: '{"key": "value"}',
 *     },
 *   ],
 * });
 *
 * // Use the mock server in tests
 * await server.connect();
 * const result = await server.callTool('get_weather', { location: 'NYC' });
 * ```
 */
export class McpMocker {
  /** Map of mock servers by name */
  public readonly servers: Map<string, MockMcpServer> = new Map();

  /** Track mocked modules */
  private readonly mockedModules: Set<string> = new Set();

  constructor(options: McpMockerOptions = {}) {
    if (options.autoMock) {
      this.mockAllModules();
    }
  }

  /**
   * Create a mock MCP server.
   *
   * @param name - Server name
   * @param config - Server configuration
   * @returns The mock server
   */
  mockServer(name: string, config: Omit<MockMcpServerConfig, 'name'> = {}): MockMcpServer {
    const server = new MockMcpServer({ name, ...config });
    this.servers.set(name, server);
    return server;
  }

  /**
   * Get a mock server by name.
   *
   * @param name - Server name
   * @returns The mock server or undefined
   */
  getServer(name: string): MockMcpServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Mock the MCP client module.
   *
   * @returns Mock client factory
   */
  mockClient(): Mock {
    const mockClientFactory = vi.fn((serverName: string) => {
      const server = this.servers.get(serverName);
      if (!server) {
        throw new Error(`No mock server registered: ${serverName}`);
      }
      return server;
    });

    vi.doMock('@modelcontextprotocol/sdk/client', () => ({
      Client: mockClientFactory,
    }));

    this.mockedModules.add('@modelcontextprotocol/sdk/client');
    return mockClientFactory;
  }

  /**
   * Mock all MCP-related modules.
   *
   * @returns Dictionary of mocked modules
   */
  mockAllModules(): Record<string, unknown> {
    const mocks: Record<string, unknown> = {};

    // Mock SDK client
    mocks['@modelcontextprotocol/sdk/client'] = {
      Client: vi.fn().mockImplementation((serverName: string) => {
        return this.servers.get(serverName) ?? new MockMcpServer({ name: serverName });
      }),
    };

    // Mock SDK server
    mocks['@modelcontextprotocol/sdk/server'] = {
      Server: vi.fn().mockImplementation((config: MockMcpServerConfig) => {
        return new MockMcpServer(config);
      }),
    };

    // Mock AI SDK MCP integration
    mocks['@ai-sdk/mcp'] = {
      experimental_createMCPClient: vi.fn().mockImplementation(async (config: { name: string }) => {
        return this.servers.get(config.name) ?? new MockMcpServer({ name: config.name });
      }),
    };

    for (const [modulePath, mock] of Object.entries(mocks)) {
      vi.doMock(modulePath, () => mock as Record<string, unknown>);
      this.mockedModules.add(modulePath);
    }

    return mocks;
  }

  /**
   * Create a mock tool that can be registered with servers.
   *
   * @param name - Tool name
   * @param handler - Tool handler
   * @param options - Additional options
   * @returns Tool definition
   */
  createMockTool(
    name: string,
    handler: (args: unknown) => unknown | Promise<unknown>,
    options: {
      description?: string;
      inputSchema?: Record<string, unknown>;
    } = {}
  ): MockToolDefinition {
    return {
      name,
      description: options.description,
      inputSchema: options.inputSchema,
      handler,
    };
  }

  /**
   * Create a mock resource that can be registered with servers.
   *
   * @param uri - Resource URI
   * @param content - Resource content
   * @param options - Additional options
   * @returns Resource definition
   */
  createMockResource(
    uri: string,
    content: string | Buffer,
    options: {
      name?: string;
      description?: string;
      mimeType?: string;
    } = {}
  ): MockResourceDefinition {
    return {
      uri,
      content,
      name: options.name,
      description: options.description,
      mimeType: options.mimeType,
    };
  }

  /**
   * Restore all mocked modules.
   */
  restoreAll(): void {
    this.mockedModules.clear();
    this.servers.clear();
  }

  /**
   * Reset all mock servers.
   */
  resetAll(): void {
    for (const server of this.servers.values()) {
      server.reset();
    }
  }
}

/**
 * Factory function to create an McpMocker instance.
 *
 * @param options - Configuration options
 * @returns A new McpMocker instance
 */
export function createMcpMocker(options: McpMockerOptions = {}): McpMocker {
  return new McpMocker(options);
}
