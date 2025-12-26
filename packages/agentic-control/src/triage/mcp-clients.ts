/**
 * MCP Client Integration - Config-driven
 *
 * Reads MCP server configuration from agentic.config.json.
 * Falls back to sensible defaults if not configured.
 */

import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { ToolSet } from 'ai';
import { getConfig, type MCPConfig, type MCPServerConfig } from '../core/config.js';

// ─────────────────────────────────────────────────────────────────
// Default MCP Configuration (used if not in config file)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_MCP_CONFIG: MCPConfig = {
  // ───────────────────────────────────────────────────────────────
  // Vendor Connectors (Python) - Jules, Cursor, GitHub, Slack, etc.
  // Provides unified access to all vendor APIs via MCP.
  // Install: pip install vendor-connectors[mcp]
  // ───────────────────────────────────────────────────────────────
  'vendor-connectors': {
    enabled: true,
    tokenEnvVar: 'GOOGLE_JULES_API_KEY',
    tokenEnvVarFallbacks: ['JULES_API_KEY', 'CURSOR_API_KEY'],
    mode: 'stdio',
    command: 'python',
    args: ['-m', 'vendor_connectors.mcp'],
  },
  cursor: {
    enabled: true,
    tokenEnvVar: 'CURSOR_API_KEY',
    tokenEnvVarFallbacks: ['COPILOT_MCP_CURSOR_API_KEY'],
    mode: 'stdio',
    command: 'npx',
    args: ['-y', 'cursor-mcp-server'],
  },
  github: {
    enabled: true,
    tokenEnvVar: 'GITHUB_TOKEN',
    tokenEnvVarFallbacks: ['GITHUB_JBCOM_TOKEN', 'COPILOT_MCP_GITHUB_TOKEN'],
    mode: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
  },
  context7: {
    enabled: true,
    tokenEnvVar: 'CONTEXT7_API_KEY',
    tokenEnvVarFallbacks: ['COPILOT_MCP_CONTEXT7_API_KEY'],
    mode: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/context7-mcp'],
  },
  '21st-magic': {
    enabled: true,
    tokenEnvVar: 'TWENTY_FIRST_API_KEY',
    tokenEnvVarFallbacks: ['COPILOT_MCP_TWENTY_FIRST_API_KEY'],
    mode: 'stdio',
    command: 'npx',
    args: ['-y', '@21st-dev/magic-mcp@latest'],
  },
};

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Resolve token from env vars with fallbacks
 */
function resolveToken(serverConfig: MCPServerConfig): string | undefined {
  // Try primary env var
  if (serverConfig.tokenEnvVar) {
    const token = process.env[serverConfig.tokenEnvVar];
    if (token) return token;
  }

  // Try fallbacks
  if (serverConfig.tokenEnvVarFallbacks) {
    for (const envVar of serverConfig.tokenEnvVarFallbacks) {
      const token = process.env[envVar];
      if (token) return token;
    }
  }

  return undefined;
}

/**
 * Get merged MCP config (user config + defaults)
 */
function getMCPConfig(): MCPConfig {
  const userConfig = getConfig().mcp ?? {};

  // Merge user config with defaults
  const merged: MCPConfig = {};

  for (const [name, defaultServer] of Object.entries(DEFAULT_MCP_CONFIG)) {
    const userServer = userConfig[name];
    if (userServer === undefined) {
      merged[name] = defaultServer;
    } else {
      merged[name] = { ...defaultServer, ...userServer };
    }
  }

  // Add any custom servers from user config
  for (const [name, server] of Object.entries(userConfig)) {
    if (!(name in merged) && server) {
      merged[name] = server;
    }
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────
// Exports for backward compatibility
// ─────────────────────────────────────────────────────────────────

/** @deprecated Use getMCPConfig() instead */
export const MCP_ENV_VARS = {
  cursor: { name: 'CURSOR_API_KEY', sources: ['COPILOT_MCP_CURSOR_API_KEY', 'CURSOR_API_KEY'] },
  github: {
    name: 'GITHUB_TOKEN',
    sources: ['COPILOT_MCP_GITHUB_TOKEN', 'GITHUB_JBCOM_TOKEN', 'GITHUB_TOKEN'],
  },
  context7: {
    name: 'CONTEXT7_API_KEY',
    sources: ['COPILOT_MCP_CONTEXT7_API_KEY', 'CONTEXT7_API_KEY'],
    optional: true,
  },
} as const;

/** @deprecated Use getMCPConfig() and resolveToken() instead */
export const mcpCredentials = {
  get cursorApiKey() {
    return resolveToken(getMCPConfig().cursor ?? {});
  },
  get githubToken() {
    return resolveToken(getMCPConfig().github ?? {});
  },
  get context7ApiKey() {
    return resolveToken(getMCPConfig().context7 ?? {});
  },
};

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface MCPClientConfig {
  /** Override specific server configs */
  cursor?: Partial<MCPServerConfig> & { apiKey?: string };
  github?: Partial<MCPServerConfig> & { token?: string };
  context7?: Partial<MCPServerConfig> & { apiKey?: string };
  '21st-magic'?: Partial<MCPServerConfig> & { apiKey?: string };
  /**
   * Vendor Connectors MCP Server (Python)
   * Provides unified access to Jules, Cursor, GitHub, Slack, Vault, Zoom, etc.
   * Install: pip install vendor-connectors[mcp]
   */
  'vendor-connectors'?: Partial<MCPServerConfig> & {
    julesApiKey?: string;
    cursorApiKey?: string;
    ollamaApiKey?: string;
  };
}

export interface MCPClients {
  [name: string]: Awaited<ReturnType<typeof createMCPClient>> | undefined;
}

// ─────────────────────────────────────────────────────────────────
// Main Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Initialize MCP clients based on config
 */
export async function initializeMCPClients(overrides: MCPClientConfig = {}): Promise<MCPClients> {
  const clients: MCPClients = {};
  const mcpConfig = getMCPConfig();

  for (const [name, serverConfig] of Object.entries(mcpConfig)) {
    if (!serverConfig || serverConfig.enabled === false) continue;

    // Apply overrides
    const override = overrides[name as keyof MCPClientConfig];
    const config = override ? { ...serverConfig, ...override } : serverConfig;

    // Resolve token
    let token = resolveToken(config);

    // Check for legacy override format
    if (override) {
      if ('apiKey' in override && override.apiKey) token = override.apiKey;
      if ('token' in override && override.token) token = override.token;
    }

    // Optional servers that can run without tokens
    const optionalServers = ['context7', '21st-magic', 'vendor-connectors'];
    if (!token && !optionalServers.includes(name)) {
      // Skip non-optional servers without tokens
      continue;
    }

    try {
      if (config.mode === 'stdio' && config.command) {
        const env: Record<string, string> = { ...(process.env as Record<string, string>) };

        // Set token in environment for the command
        if (token) {
          if (name === 'cursor') env.CURSOR_API_KEY = token;
          if (name === 'github') env.GITHUB_TOKEN = token;
          if (name === 'context7') env.CONTEXT7_API_KEY = token;
          if (name === '21st-magic') env.TWENTY_FIRST_API_KEY = token;
        }

        // vendor-connectors uses multiple tokens from env vars (outside token check per AI review)
        if (name === 'vendor-connectors') {
          const vcOverride = overrides['vendor-connectors'];
          // Pass through all relevant API keys for vendor-connectors, respecting overrides
          env.GOOGLE_JULES_API_KEY =
            vcOverride?.julesApiKey ?? process.env.GOOGLE_JULES_API_KEY ?? '';
          env.JULES_API_KEY =
            vcOverride?.julesApiKey ??
            process.env.JULES_API_KEY ??
            process.env.GOOGLE_JULES_API_KEY ??
            '';
          env.CURSOR_API_KEY = vcOverride?.cursorApiKey ?? process.env.CURSOR_API_KEY ?? '';
          env.OLLAMA_API_KEY = vcOverride?.ollamaApiKey ?? process.env.OLLAMA_API_KEY ?? '';
        }

        clients[name] = await createMCPClient({
          transport: new StdioMCPTransport({
            command: config.command,
            args: config.args ?? [],
            env,
          }),
        });
      }
      // TODO: Add proxy mode support when needed
    } catch (err) {
      console.warn(`Failed to initialize ${name} MCP client:`, err);
    }
  }

  return clients;
}

/**
 * Get all tools from initialized MCP clients
 */
export async function getMCPTools(clients: MCPClients): Promise<ToolSet> {
  const allTools: ToolSet = {};

  for (const [name, client] of Object.entries(clients)) {
    if (!client) continue;

    try {
      const { tools } = await client.tools();
      if (tools) {
        for (const [toolName, mcpTool] of Object.entries(tools)) {
          // MCP tools need to be cast to AI SDK ToolSet format
          allTools[`${name}_${toolName}`] = mcpTool as unknown as ToolSet[string];
        }
      }
    } catch (err) {
      console.warn(`Failed to get tools from ${name}:`, err);
    }
  }

  return allTools;
}

/**
 * Close all MCP clients
 */
export async function closeMCPClients(clients: MCPClients): Promise<void> {
  for (const [name, client] of Object.entries(clients)) {
    if (!client) continue;

    try {
      await client.close();
    } catch (err) {
      console.warn(`Failed to close ${name} MCP client:`, err);
    }
  }
}

// NOTE: The listMCPPrompts and listMCPResources methods have been removed.
// The current @ai-sdk/mcp MCPClient type does not expose these methods.
// If you need to list prompts or resources, use the MCP server's native API directly
// or wait for future @ai-sdk/mcp updates that may add this functionality.
