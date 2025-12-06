/**
 * AI Provider Loading - Shared provider utilities
 *
 * Supports multiple AI providers via Vercel AI SDK:
 * - anthropic (@ai-sdk/anthropic)
 * - openai (@ai-sdk/openai)
 * - google (@ai-sdk/google)
 * - mistral (@ai-sdk/mistral)
 * - azure (@ai-sdk/azure)
 *
 * Install the provider you need:
 *   pnpm add @ai-sdk/anthropic
 */

import { getTriageConfig, getDefaultApiKeyEnvVar } from './config.js';

// ============================================
// Types
// ============================================

export type ProviderFactory = (config: { apiKey: string }) => unknown;
export type ModelFactory = (model: string) => unknown;

export type SupportedProvider = 'anthropic' | 'openai' | 'google' | 'mistral' | 'azure';

export interface ProviderConfig {
    package: string;
    factory: string;
}

// ============================================
// Provider Configuration
// ============================================

/**
 * Security: Explicit allowlist of supported providers and their packages.
 * Dynamic imports are only allowed for these pre-defined packages.
 */
export const PROVIDER_CONFIG: Record<SupportedProvider, ProviderConfig> = {
    anthropic: { package: '@ai-sdk/anthropic', factory: 'createAnthropic' },
    openai: { package: '@ai-sdk/openai', factory: 'createOpenAI' },
    google: { package: '@ai-sdk/google', factory: 'createGoogleGenerativeAI' },
    mistral: { package: '@ai-sdk/mistral', factory: 'createMistral' },
    azure: { package: '@ai-sdk/azure', factory: 'createAzure' },
} as const;

/**
 * Check if a provider name is valid
 */
export function isValidProvider(name: string): name is SupportedProvider {
    return name in PROVIDER_CONFIG;
}

/**
 * Get list of supported provider names
 */
export function getSupportedProviders(): SupportedProvider[] {
    return Object.keys(PROVIDER_CONFIG) as SupportedProvider[];
}

// ============================================
// Provider Loading
// ============================================

/**
 * Load an AI provider dynamically.
 *
 * @param providerName - Name of the provider (anthropic, openai, etc.)
 * @param apiKey - API key for the provider
 * @returns A function that creates a model instance
 * @throws Error if provider is unknown or package not installed
 */
export async function loadProvider(providerName: string, apiKey: string): Promise<ModelFactory> {
    // Security: Validate provider name against explicit allowlist
    if (!isValidProvider(providerName)) {
        throw new Error(
            `Unknown provider: ${providerName}\n` +
                `Supported providers: ${getSupportedProviders().join(', ')}`
        );
    }

    const config = PROVIDER_CONFIG[providerName];

    try {
        // Security: Only import from pre-defined allowlist - no user input in import path
        let module: Record<string, unknown>;
        switch (providerName) {
            case 'anthropic':
                module = await import('@ai-sdk/anthropic');
                break;
            case 'openai':
                module = await import('@ai-sdk/openai');
                break;
            case 'google':
                module = await import('@ai-sdk/google');
                break;
            case 'mistral':
                module = await import('@ai-sdk/mistral');
                break;
            case 'azure':
                module = await import('@ai-sdk/azure');
                break;
            default:
                // This should never happen due to isValidProvider check above
                throw new Error(`Provider ${providerName} not implemented`);
        }

        const factory = module[config.factory] as ProviderFactory;

        if (typeof factory !== 'function') {
            throw new Error(`Factory ${config.factory} not found in ${config.package}`);
        }

        const provider = factory({ apiKey });
        return (model: string) => (provider as ModelFactory)(model);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
            throw new Error(
                `Provider package not installed: ${config.package}\n` +
                    `Install it with: pnpm add ${config.package}`
            );
        }
        throw err;
    }
}

// ============================================
// Provider Instance Management
// ============================================

/**
 * Cached provider instances to avoid re-loading
 */
const providerCache = new Map<string, ModelFactory>();

/**
 * Get or create a cached provider instance.
 *
 * @param providerName - Name of the provider
 * @param apiKey - API key for the provider
 * @returns A function that creates a model instance
 */
export async function getOrLoadProvider(
    providerName: string,
    apiKey: string
): Promise<ModelFactory> {
    const cacheKey = `${providerName}:${apiKey.slice(0, 8)}`;

    let provider = providerCache.get(cacheKey);
    if (!provider) {
        provider = await loadProvider(providerName, apiKey);
        providerCache.set(cacheKey, provider);
    }

    return provider;
}

/**
 * Clear the provider cache (useful for testing)
 */
export function clearProviderCache(): void {
    providerCache.clear();
}

// ============================================
// Configuration Helpers
// ============================================

export interface ProviderOptions {
    /** AI provider: anthropic, openai, google, mistral, azure */
    provider?: string;
    /** Model to use */
    model?: string;
    /** API key (defaults to provider-specific env var) */
    apiKey?: string;
}

/**
 * Resolve provider options with defaults from config.
 *
 * @param options - User-provided options
 * @returns Resolved provider name, model, and API key
 * @throws Error if API key is not available
 */
export function resolveProviderOptions(options: ProviderOptions = {}): {
    providerName: string;
    model: string;
    apiKey: string;
} {
    const triageConfig = getTriageConfig();

    const providerName = options.provider ?? triageConfig.provider ?? 'anthropic';
    const model = options.model ?? triageConfig.model ?? 'claude-sonnet-4-20250514';

    // Determine the correct API key
    const effectiveProvider = options.provider ?? triageConfig.provider ?? 'anthropic';
    const envVarName =
        options.provider && options.provider !== triageConfig.provider
            ? getDefaultApiKeyEnvVar(effectiveProvider)
            : (triageConfig.apiKeyEnvVar ?? getDefaultApiKeyEnvVar(effectiveProvider));

    const apiKey = options.apiKey ?? process.env[envVarName] ?? '';

    if (!apiKey) {
        const hint = getDefaultApiKeyEnvVar(effectiveProvider);
        throw new Error(
            `API key required for ${providerName} provider.\n` +
                `Set ${hint} environment variable or pass apiKey option.`
        );
    }

    return { providerName, model, apiKey };
}
