/**
 * AI Provider mocking utilities for agentic-control testing.
 *
 * This module provides utilities for mocking AI providers (Anthropic, OpenAI,
 * Google, Mistral, Azure, Ollama) during testing. It allows you to simulate
 * AI model responses without making actual API calls.
 *
 * @module providers
 */

import { type Mock, vi } from 'vitest';

/**
 * List of supported AI providers.
 */
export const SUPPORTED_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'mistral',
  'azure',
  'ollama',
] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Provider module paths for mocking.
 */
export const PROVIDER_MODULES: Record<SupportedProvider, string> = {
  anthropic: '@ai-sdk/anthropic',
  openai: '@ai-sdk/openai',
  google: '@ai-sdk/google',
  mistral: '@ai-sdk/mistral',
  azure: '@ai-sdk/azure',
  ollama: 'ai-sdk-ollama',
};

/**
 * Common AI SDK modules.
 */
export const AI_SDK_MODULES = ['ai', 'ai/rsc'] as const;

/**
 * Mock provider response configuration.
 */
export interface MockProviderResponse {
  /** The text response to return */
  response?: string;
  /** Tool calls to include in response */
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  /** Whether the response should stream */
  stream?: boolean;
  /** Simulated latency in ms */
  latency?: number;
  /** Error to throw instead of returning response */
  error?: Error;
  /** Usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Mock stream chunk for streaming responses.
 */
export interface MockStreamChunk {
  /** Text delta */
  textDelta?: string;
  /** Tool call start */
  toolCallStart?: {
    name: string;
    id: string;
  };
  /** Tool call delta (args) */
  toolCallDelta?: {
    id: string;
    args: string;
  };
  /** Whether this is the final chunk */
  isFinished?: boolean;
}

/**
 * Options for creating a ProviderMocker instance.
 */
export interface ProviderMockerOptions {
  /** Default response for all providers */
  defaultResponse?: MockProviderResponse;
  /** Whether to auto-mock all provider modules */
  autoMock?: boolean;
}

/**
 * Mock model instance for a provider.
 */
interface MockModel {
  /** Generate a response */
  generate: Mock<(prompt: string, options?: unknown) => Promise<unknown>>;
  /** Generate a streaming response */
  generateStream: Mock<(prompt: string, options?: unknown) => AsyncGenerator<MockStreamChunk>>;
  /** The provider this model belongs to */
  provider: SupportedProvider;
  /** Model ID */
  modelId: string;
}

/**
 * AI Provider mocking utilities class.
 *
 * Provides methods for mocking AI provider responses during testing.
 *
 * @example
 * ```typescript
 * import { ProviderMocker } from 'vitest-agentic-control';
 *
 * const mocker = new ProviderMocker();
 *
 * // Mock Anthropic provider
 * mocker.mockAnthropic({
 *   response: 'Hello! I am Claude.',
 *   usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
 * });
 *
 * // Mock OpenAI provider with streaming
 * mocker.mockOpenAI({
 *   response: 'Hello! I am GPT.',
 *   stream: true,
 * });
 *
 * // Mock a specific model
 * const model = mocker.createMockModel('anthropic', 'claude-sonnet-4-20250514');
 * ```
 */
export class ProviderMocker {
  /** Default response configuration */
  private defaultResponse: MockProviderResponse;

  /** Track mocked modules */
  private readonly mockedModules: Set<string> = new Set();

  /** Track provider-specific configurations */
  private readonly providerConfigs: Map<SupportedProvider, MockProviderResponse> = new Map();

  /** Track mock models */
  public readonly models: Map<string, MockModel> = new Map();

  constructor(options: ProviderMockerOptions = {}) {
    this.defaultResponse = options.defaultResponse ?? {
      response: 'This is a mock AI response.',
    };

    if (options.autoMock) {
      this.mockAllModules();
    }
  }

  /**
   * Mock the Anthropic provider.
   *
   * @param config - Response configuration
   */
  mockAnthropic(config: MockProviderResponse = {}): void {
    this.providerConfigs.set('anthropic', { ...this.defaultResponse, ...config });
    this.mockProviderModule('anthropic');
  }

  /**
   * Mock the OpenAI provider.
   *
   * @param config - Response configuration
   */
  mockOpenAI(config: MockProviderResponse = {}): void {
    this.providerConfigs.set('openai', { ...this.defaultResponse, ...config });
    this.mockProviderModule('openai');
  }

  /**
   * Mock the Google provider.
   *
   * @param config - Response configuration
   */
  mockGoogle(config: MockProviderResponse = {}): void {
    this.providerConfigs.set('google', { ...this.defaultResponse, ...config });
    this.mockProviderModule('google');
  }

  /**
   * Mock the Mistral provider.
   *
   * @param config - Response configuration
   */
  mockMistral(config: MockProviderResponse = {}): void {
    this.providerConfigs.set('mistral', { ...this.defaultResponse, ...config });
    this.mockProviderModule('mistral');
  }

  /**
   * Mock the Azure provider.
   *
   * @param config - Response configuration
   */
  mockAzure(config: MockProviderResponse = {}): void {
    this.providerConfigs.set('azure', { ...this.defaultResponse, ...config });
    this.mockProviderModule('azure');
  }

  /**
   * Mock the Ollama provider.
   *
   * @param config - Response configuration
   */
  mockOllama(config: MockProviderResponse = {}): void {
    this.providerConfigs.set('ollama', { ...this.defaultResponse, ...config });
    this.mockProviderModule('ollama');
  }

  /**
   * Mock a specific provider module.
   *
   * @param provider - The provider to mock
   */
  private mockProviderModule(provider: SupportedProvider): void {
    const modulePath = PROVIDER_MODULES[provider];
    const config = this.providerConfigs.get(provider) ?? this.defaultResponse;

    const mockProvider = this.createMockProviderFactory(provider, config);

    vi.doMock(modulePath, () => mockProvider);
    this.mockedModules.add(modulePath);
  }

  /**
   * Create a mock provider factory function.
   *
   * @param provider - The provider type
   * @param config - Response configuration
   * @returns Mock provider factory
   */
  private createMockProviderFactory(
    provider: SupportedProvider,
    config: MockProviderResponse
  ): Record<string, unknown> {
    const createModel = (modelId: string) => {
      const model = this.createMockModel(provider, modelId, config);
      return model;
    };

    // Return appropriate factory based on provider
    switch (provider) {
      case 'anthropic':
        return {
          anthropic: vi.fn().mockReturnValue({
            chat: createModel,
            messages: createModel,
          }),
          createAnthropic: vi.fn().mockReturnValue({
            chat: createModel,
            messages: createModel,
          }),
        };

      case 'openai':
        return {
          openai: vi.fn().mockReturnValue({
            chat: createModel,
            completion: createModel,
          }),
          createOpenAI: vi.fn().mockReturnValue({
            chat: createModel,
            completion: createModel,
          }),
        };

      case 'google':
        return {
          google: vi.fn().mockReturnValue({
            generativeAI: createModel,
          }),
          createGoogle: vi.fn().mockReturnValue({
            generativeAI: createModel,
          }),
        };

      case 'mistral':
        return {
          mistral: vi.fn().mockReturnValue({
            chat: createModel,
          }),
          createMistral: vi.fn().mockReturnValue({
            chat: createModel,
          }),
        };

      case 'azure':
        return {
          azure: vi.fn().mockReturnValue({
            chat: createModel,
          }),
          createAzure: vi.fn().mockReturnValue({
            chat: createModel,
          }),
        };

      case 'ollama':
        return {
          ollama: vi.fn().mockReturnValue({
            chat: createModel,
          }),
          createOllama: vi.fn().mockReturnValue({
            chat: createModel,
          }),
        };
    }
  }

  /**
   * Create a mock model for a provider.
   *
   * @param provider - The provider type
   * @param modelId - The model ID
   * @param config - Response configuration
   * @returns Mock model instance
   */
  createMockModel(
    provider: SupportedProvider,
    modelId: string,
    config: MockProviderResponse = {}
  ): MockModel {
    const mergedConfig = { ...this.defaultResponse, ...config };

    const generate = vi.fn(async () => {
      if (mergedConfig.latency) {
        await new Promise((resolve) => setTimeout(resolve, mergedConfig.latency));
      }

      if (mergedConfig.error) {
        throw mergedConfig.error;
      }

      return {
        text: mergedConfig.response ?? 'Mock response',
        toolCalls: mergedConfig.toolCalls ?? [],
        usage: mergedConfig.usage ?? {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    });

    const generateStream = vi.fn(async function* () {
      if (mergedConfig.latency) {
        await new Promise((resolve) => setTimeout(resolve, mergedConfig.latency));
      }

      if (mergedConfig.error) {
        throw mergedConfig.error;
      }

      const text = mergedConfig.response ?? 'Mock response';
      const chunks = text.split(' ');

      for (const chunk of chunks) {
        yield { textDelta: `${chunk} ` };
      }

      yield { isFinished: true };
    });

    const model: MockModel = {
      generate: generate as Mock<(prompt: string, options?: unknown) => Promise<unknown>>,
      generateStream: generateStream as Mock<
        (prompt: string, options?: unknown) => AsyncGenerator<MockStreamChunk>
      >,
      provider,
      modelId,
    };

    this.models.set(`${provider}:${modelId}`, model);
    return model;
  }

  /**
   * Mock the core AI SDK module.
   */
  mockAiSdk(): void {
    vi.doMock('ai', () => ({
      generateText: vi.fn(async (options: { model: MockModel; prompt: string }) => {
        return options.model.generate(options.prompt, options);
      }),
      streamText: vi.fn(async function* (options: { model: MockModel; prompt: string }) {
        yield* options.model.generateStream(options.prompt, options);
      }),
      generateObject: vi.fn(async () => ({ object: {} })),
      streamObject: vi.fn(async function* () {
        yield { object: {} };
      }),
    }));

    this.mockedModules.add('ai');
  }

  /**
   * Mock all provider modules.
   *
   * @returns Dictionary of mocked modules
   */
  mockAllModules(): Record<string, unknown> {
    const mocks: Record<string, unknown> = {};

    // Mock AI SDK
    this.mockAiSdk();
    mocks.ai = true;

    // Mock all providers
    for (const provider of SUPPORTED_PROVIDERS) {
      this.mockProviderModule(provider);
      mocks[PROVIDER_MODULES[provider]] = true;
    }

    return mocks;
  }

  /**
   * Set a response for a specific provider.
   *
   * @param provider - The provider
   * @param config - Response configuration
   */
  setProviderResponse(provider: SupportedProvider, config: MockProviderResponse): void {
    this.providerConfigs.set(provider, { ...this.defaultResponse, ...config });
  }

  /**
   * Get the configuration for a provider.
   *
   * @param provider - The provider
   * @returns The configuration or undefined
   */
  getProviderConfig(provider: SupportedProvider): MockProviderResponse | undefined {
    return this.providerConfigs.get(provider);
  }

  /**
   * Restore all mocked modules.
   */
  restoreAll(): void {
    this.mockedModules.clear();
    this.providerConfigs.clear();
    this.models.clear();
  }

  /**
   * Reset all mocks.
   */
  resetAll(): void {
    for (const model of this.models.values()) {
      model.generate.mockClear();
      model.generateStream.mockClear();
    }
  }
}

/**
 * Factory function to create a ProviderMocker instance.
 *
 * @param options - Configuration options
 * @returns A new ProviderMocker instance
 */
export function createProviderMocker(options: ProviderMockerOptions = {}): ProviderMocker {
  return new ProviderMocker(options);
}
