/**
 * Fleet - High-level API for Cursor Background Agent management
 * 
 * Provides a clean interface for:
 * - Listing and monitoring agents
 * - Spawning new agents with context and model specification
 * - Sending follow-up messages
 * - Archiving conversations
 * - Diamond pattern orchestration
 * - Token-aware GitHub coordination
 * 
 * All configuration is user-provided - no hardcoded values.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CursorAPI, type CursorAPIOptions } from "./cursor-api.js";
import { GitHubClient } from "../github/client.js";
import { extractOrg } from "../core/tokens.js";
import { getDefaultModel, log } from "../core/config.js";
import type {
  Agent,
  AgentStatus,
  Conversation,
  Repository,
  Result,
  SpawnOptions,
  DiamondConfig,
  PRComment,
} from "../core/types.js";

// ============================================
// Types
// ============================================

export interface FleetConfig extends CursorAPIOptions {
  /** Path to archive conversations */
  archivePath?: string;
}

export interface CoordinationConfig {
  /** PR number for coordination channel */
  coordinationPr: number;
  /** Repository in owner/repo format */
  repo: string;
  /** Outbound poll interval (ms) - check agents */
  outboundInterval?: number;
  /** Inbound poll interval (ms) - check PR comments */
  inboundInterval?: number;
  /** Agent IDs to monitor */
  agentIds?: string[];
}

export interface SpawnContext {
  controlManagerId?: string;
  controlCenter?: string;
  relatedAgents?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================
// Fleet Class
// ============================================

export class Fleet {
  private api: CursorAPI | null;
  private archivePath: string;
  private useDirectApi: boolean;

  constructor(config: FleetConfig = {}) {
    this.archivePath = config.archivePath ?? "./memory-bank/recovery";
    
    // Try to initialize CursorAPI for direct access
    try {
      this.api = new CursorAPI({
        apiKey: config.apiKey,
        timeout: config.timeout,
      });
      this.useDirectApi = true;
    } catch {
      // API key not available
      this.api = null;
      this.useDirectApi = false;
      log.debug("CursorAPI not available, some operations will fail");
    }
  }

  /**
   * Check if direct API is available
   */
  isApiAvailable(): boolean {
    return this.useDirectApi && this.api !== null;
  }

  // ============================================
  // Agent Discovery
  // ============================================

  /**
   * List all agents
   */
  async list(): Promise<Result<Agent[]>> {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.listAgents();
  }

  /**
   * List agents filtered by status
   */
  async listByStatus(status: AgentStatus): Promise<Result<Agent[]>> {
    const result = await this.list();
    if (!result.success) return result;
    return { 
      success: true, 
      data: result.data?.filter(a => a.status === status) ?? [] 
    };
  }

  /**
   * Get running agents only
   */
  async running(): Promise<Result<Agent[]>> {
    return this.listByStatus("RUNNING");
  }

  /**
   * Find agent by ID
   */
  async find(agentId: string): Promise<Result<Agent | undefined>> {
    const result = await this.list();
    if (!result.success) return { success: false, error: result.error };
    return { success: true, data: result.data?.find(a => a.id === agentId) };
  }

  /**
   * Get agent status
   */
  async status(agentId: string): Promise<Result<Agent>> {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.getAgentStatus(agentId);
  }

  // ============================================
  // Agent Spawning
  // ============================================

  /**
   * Spawn a new agent with model specification
   * 
   * @param options - Spawn options including repository, task, ref, context, and model
   */
  async spawn(options: SpawnOptions & { context?: SpawnContext }): Promise<Result<Agent>> {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }

    const task = this.buildTaskWithContext(options.task, options.context);
    const model = options.model ?? getDefaultModel();

    log.info(`Spawning agent in ${options.repository} (model: ${model})`);

    return this.api.launchAgent({
      prompt: { text: task },
      source: {
        repository: options.repository,
        ref: options.ref ?? "main",
      },
      model,
    });
  }

  /**
   * Build task string with coordination context
   */
  private buildTaskWithContext(task: string, context?: SpawnContext): string {
    if (!context) return task;

    const lines = [task, "", "--- COORDINATION CONTEXT ---"];
    
    if (context.controlManagerId) {
      lines.push(`Control Manager Agent: ${context.controlManagerId}`);
    }
    if (context.controlCenter) {
      lines.push(`Control Center: ${context.controlCenter}`);
    }
    if (context.relatedAgents?.length) {
      lines.push(`Related Agents: ${context.relatedAgents.join(", ")}`);
    }
    if (context.metadata) {
      lines.push(`Metadata: ${JSON.stringify(context.metadata)}`);
    }
    lines.push("Report progress via PR comments and addFollowup.");
    lines.push("--- END CONTEXT ---");

    return lines.join("\n");
  }

  // ============================================
  // Agent Communication
  // ============================================

  /**
   * Send a follow-up message to an agent
   */
  async followup(agentId: string, message: string): Promise<Result<void>> {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.addFollowup(agentId, { text: message });
  }

  /**
   * Broadcast message to multiple agents
   */
  async broadcast(agentIds: string[], message: string): Promise<Map<string, Result<void>>> {
    const results = new Map<string, Result<void>>();
    
    await Promise.all(
      agentIds.map(async (id) => {
        results.set(id, await this.followup(id, message));
      })
    );

    return results;
  }

  // ============================================
  // Conversations
  // ============================================

  /**
   * Get agent conversation
   */
  async conversation(agentId: string): Promise<Result<Conversation>> {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.getAgentConversation(agentId);
  }

  /**
   * Archive agent conversation to disk
   */
  async archive(agentId: string, outputPath?: string): Promise<Result<string>> {
    const conv = await this.conversation(agentId);
    if (!conv.success) return { success: false, error: conv.error };

    const path = outputPath ?? join(this.archivePath, `conversation-${agentId}.json`);
    
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(conv.data, null, 2));
      return { success: true, data: path };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================
  // Repositories
  // ============================================

  /**
   * List available repositories
   */
  async repositories(): Promise<Result<Repository[]>> {
    if (!this.api) {
      return { success: false, error: "Cursor API not available" };
    }
    return this.api.listRepositories();
  }

  // ============================================
  // Diamond Pattern Orchestration
  // ============================================

  /**
   * Create a diamond pattern orchestration
   */
  async createDiamond(config: DiamondConfig): Promise<Result<{
    targetAgents: Agent[];
    counterpartyAgent: Agent;
  }>> {
    // Get my agent ID for context
    const runningResult = await this.running();
    const myId = runningResult.data?.[0]?.id ?? "control-manager";

    // Spawn target agents
    const targetAgents: Agent[] = [];
    for (const target of config.targetRepos) {
      const result = await this.spawn({
        ...target,
        context: {
          controlManagerId: myId,
          controlCenter: config.controlCenter,
        },
      });
      if (result.success && result.data) {
        targetAgents.push(result.data);
      }
    }

    // Spawn counterparty with knowledge of target agents
    const counterpartyResult = await this.spawn({
      ...config.counterparty,
      context: {
        controlManagerId: myId,
        controlCenter: config.controlCenter,
        relatedAgents: targetAgents.map(a => a.id),
        metadata: {
          pattern: "diamond",
          targetRepos: config.targetRepos.map(t => t.repository),
        },
      },
    });

    if (!counterpartyResult.success || !counterpartyResult.data) {
      return { 
        success: false, 
        error: counterpartyResult.error ?? "Failed to spawn counterparty" 
      };
    }

    // Notify target agents about counterparty
    for (const agent of targetAgents) {
      await this.followup(agent.id, 
        `Counterparty agent spawned: ${counterpartyResult.data.id}\n` +
        `You may receive direct communication from this agent for coordination.`
      );
    }

    return {
      success: true,
      data: {
        targetAgents,
        counterpartyAgent: counterpartyResult.data,
      },
    };
  }

  // ============================================
  // Fleet Monitoring
  // ============================================

  /**
   * Get fleet summary
   */
  async summary(): Promise<Result<{
    total: number;
    running: number;
    completed: number;
    failed: number;
    agents: Agent[];
  }>> {
    const result = await this.list();
    if (!result.success) return { success: false, error: result.error };

    const agents = result.data ?? [];
    return {
      success: true,
      data: {
        total: agents.length,
        running: agents.filter(a => a.status === "RUNNING").length,
        completed: agents.filter(a => a.status === "COMPLETED" || a.status === "FINISHED").length,
        failed: agents.filter(a => a.status === "FAILED").length,
        agents,
      },
    };
  }

  /**
   * Wait for agent to complete
   */
  async waitFor(agentId: string, options?: {
    timeout?: number;
    pollInterval?: number;
  }): Promise<Result<Agent>> {
    const timeout = options?.timeout ?? 300000;
    const pollInterval = options?.pollInterval ?? 10000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = await this.status(agentId);
      if (!result.success) return result;

      if (result.data?.status !== "RUNNING") {
        return result;
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }

    return { success: false, error: `Timeout waiting for agent ${agentId}` };
  }

  /**
   * Monitor specific agents until all complete
   */
  async monitorAgents(agentIds: string[], options?: {
    pollInterval?: number;
    onProgress?: (status: Map<string, AgentStatus>) => void;
  }): Promise<Map<string, Agent>> {
    const pollInterval = options?.pollInterval ?? 15000;
    const results = new Map<string, Agent>();
    const pending = new Set(agentIds);
    const nonTerminalStates = new Set<AgentStatus>(["RUNNING", "PENDING"]);

    while (pending.size > 0) {
      const statusMap = new Map<string, AgentStatus>();
      
      for (const id of pending) {
        const result = await this.status(id);
        if (result.success && result.data) {
          statusMap.set(id, result.data.status);
          
          if (!nonTerminalStates.has(result.data.status)) {
            results.set(id, result.data);
            pending.delete(id);
          }
        }
      }

      options?.onProgress?.(statusMap);
      
      if (pending.size > 0) {
        await new Promise(r => setTimeout(r, pollInterval));
      }
    }

    return results;
  }

  // ============================================
  // GitHub Coordination (Token-Aware, Using GitHubClient)
  // ============================================

  /**
   * Run bidirectional coordination loop with intelligent token switching
   */
  async coordinate(config: CoordinationConfig): Promise<void> {
    const outboundInterval = config.outboundInterval ?? 60000;
    const inboundInterval = config.inboundInterval ?? 15000;
    const agentIds = new Set(config.agentIds ?? []);
    const processedCommentIds = new Set<number>();

    // Parse repo into owner/name
    const [owner, repo] = config.repo.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid repo format. Expected 'owner/repo'");
    }

    log.info("=== Fleet Coordinator Started ===");
    log.info(`Coordination PR: #${config.coordinationPr}`);
    log.info(`Monitoring ${agentIds.size} agents`);
    log.info(`Using token for org: ${extractOrg(config.repo)}`);

    // Run both loops concurrently
    await Promise.all([
      this.outboundLoop(config, agentIds, outboundInterval),
      this.inboundLoop(config, owner, repo, agentIds, processedCommentIds, inboundInterval),
    ]);
  }

  private async outboundLoop(
    config: CoordinationConfig,
    agentIds: Set<string>,
    interval: number
  ): Promise<void> {
    while (true) {
      try {
        log.debug(`[OUTBOUND] Checking ${agentIds.size} agents...`);

        for (const agentId of [...agentIds]) {
          const result = await this.status(agentId);

          if (!result.success || !result.data) {
            log.warn(`${agentId.slice(0, 12)}: Unable to fetch status`);
            continue;
          }

          const agent = result.data;
          
          if (agent.status === "RUNNING") {
            const message = [
              "📊 STATUS CHECK from Fleet Coordinator",
              "",
              "Report progress by commenting on the coordination PR:",
              `https://github.com/${config.repo}/pull/${config.coordinationPr}`,
            ].join("\n");

            await this.followup(agentId, message);
          } else {
            agentIds.delete(agentId);
          }
        }
      } catch (err) {
        log.error("[OUTBOUND ERROR]", err);
      }

      await new Promise(r => setTimeout(r, interval));
    }
  }

  private async inboundLoop(
    config: CoordinationConfig,
    owner: string,
    repo: string,
    agentIds: Set<string>,
    processedIds: Set<number>,
    interval: number
  ): Promise<void> {
    while (true) {
      try {
        // Use GitHubClient for safe API calls (no shell injection)
        const commentsResult = await GitHubClient.listPRComments(owner, repo, config.coordinationPr);
        
        if (!commentsResult.success || !commentsResult.data) {
          log.warn("[INBOUND] Failed to fetch comments:", commentsResult.error);
          await new Promise(r => setTimeout(r, interval));
          continue;
        }

        for (const comment of commentsResult.data) {
          if (processedIds.has(comment.id)) continue;

          if (comment.body.includes("@cursor")) {
            log.info(`[INBOUND] New @cursor mention from ${comment.author}`);
            await this.processCoordinationComment(owner, repo, config, agentIds, comment);
          }

          processedIds.add(comment.id);
        }
      } catch (err) {
        log.error("[INBOUND ERROR]", err);
      }

      await new Promise(r => setTimeout(r, interval));
    }
  }

  private async processCoordinationComment(
    owner: string,
    repo: string,
    config: CoordinationConfig,
    agentIds: Set<string>,
    comment: PRComment
  ): Promise<void> {
    const body = comment.body;

    if (body.includes("✅ DONE:")) {
      const match = body.match(/✅ DONE:\s*(bc-[\w-]+)\s*(.*)/);
      if (match) {
        const [, agentId, summary] = match;
        log.info(`Agent ${agentId} completed: ${summary}`);
        agentIds.delete(agentId);
        
        // Use GitHubClient for posting (uses PR review token)
        await GitHubClient.postPRComment(
          owner, 
          repo, 
          config.coordinationPr, 
          `✅ Acknowledged completion from ${agentId.slice(0, 12)}. Summary: ${summary}`
        );
      }
    } else if (body.includes("⚠️ BLOCKED:")) {
      const match = body.match(/⚠️ BLOCKED:\s*(bc-[\w-]+)\s*(.*)/);
      if (match) {
        const [, agentId, issue] = match;
        log.warn(`Agent ${agentId} blocked: ${issue}`);
        
        await GitHubClient.postPRComment(
          owner,
          repo,
          config.coordinationPr,
          `⚠️ Agent ${agentId.slice(0, 12)} blocked: ${issue}\n\nManual intervention may be required.`
        );
      }
    }
  }
}
