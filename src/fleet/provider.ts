/**
 * Fleet provider interface - abstraction for different agent fleet backends
 * 
 * Implementations:
 * - CursorFleetProvider: Cursor cloud background agents
 * - CrewAIFleetProvider: Python CrewAI agents
 * - LocalFleetProvider: Local agent execution
 */

import type { Agent, Conversation, Repository, Result, SpawnOptions } from '../core/types.js';

/**
 * Fleet provider interface that all fleet implementations must satisfy
 */
export interface IFleetProvider {
    /**
     * List all agents in the fleet
     */
    listAgents(): Promise<Result<Agent[]>>;

    /**
     * Get status of a specific agent
     */
    getAgentStatus(agentId: string): Promise<Result<Agent>>;

    /**
     * Spawn a new agent
     */
    spawnAgent(options: SpawnOptions): Promise<Result<Agent>>;

    /**
     * Send follow-up message to an agent
     */
    sendFollowup(agentId: string, message: string): Promise<Result<void>>;

    /**
     * Get conversation history for an agent
     */
    getConversation(agentId: string): Promise<Result<Conversation>>;

    /**
     * List available repositories (if applicable)
     */
    listRepositories?(): Promise<Result<Repository[]>>;

    /**
     * List available models (if applicable)
     */
    listModels?(): Promise<Result<string[]>>;

    /**
     * Check if this provider is available/configured
     */
    isAvailable(): boolean;

    /**
     * Get the provider name
     */
    getProviderName(): string;
}

/**
 * Fleet provider registry for managing multiple providers
 */
export class FleetProviderRegistry {
    private providers = new Map<string, IFleetProvider>();
    private defaultProvider?: string;

    /**
     * Register a fleet provider
     */
    register(name: string, provider: IFleetProvider): void {
        this.providers.set(name, provider);
        
        // First registered available provider becomes default
        if (!this.defaultProvider && provider.isAvailable()) {
            this.defaultProvider = name;
        }
    }

    /**
     * Get a specific provider by name
     */
    get(name: string): IFleetProvider | undefined {
        return this.providers.get(name);
    }

    /**
     * Get the default provider
     */
    getDefault(): IFleetProvider | undefined {
        return this.defaultProvider ? this.providers.get(this.defaultProvider) : undefined;
    }

    /**
     * List all registered providers
     */
    list(): Array<{ name: string; available: boolean }> {
        return Array.from(this.providers.entries()).map(([name, provider]) => ({
            name,
            available: provider.isAvailable(),
        }));
    }

    /**
     * Set the default provider
     */
    setDefault(name: string): void {
        if (!this.providers.has(name)) {
            throw new Error(`Provider "${name}" not registered`);
        }
        this.defaultProvider = name;
    }
}
