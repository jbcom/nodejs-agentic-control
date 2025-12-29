/**
 * Role Executor
 *
 * Executes roles with the appropriate handlers based on capabilities.
 */

import { generateText, type LanguageModel } from 'ai';
import { Analyzer } from '../triage/analyzer.js';
import { DEFAULT_ROLES, getDefaultRole } from './defaults.js';
import type {
  AgentCapability,
  RoleConfig,
  RoleDefinition,
  RoleExecutionContext,
  RoleExecutionResult,
  RolesConfig,
} from './types.js';

/**
 * Merge role config overrides with default role
 */
export function applyRoleConfig(role: RoleDefinition, config?: RoleConfig): RoleDefinition {
  if (!config) return role;

  const merged = { ...role };

  if (config.systemPrompt) {
    merged.systemPrompt = config.systemPrompt;
  }

  if (config.triggers) {
    merged.triggers = config.triggers;
  }

  if (config.model) {
    merged.defaultModel = config.model;
  }

  // Handle capability modifications
  let capabilities = [...role.capabilities];

  if (config.additionalCapabilities) {
    capabilities = [...new Set([...capabilities, ...config.additionalCapabilities])];
  }

  if (config.revokedCapabilities) {
    capabilities = capabilities.filter((c) => !config.revokedCapabilities?.includes(c));
  }

  merged.capabilities = capabilities;

  return merged;
}

/**
 * Get effective role with config applied
 */
export function getEffectiveRole(
  roleId: string,
  rolesConfig?: RolesConfig
): RoleDefinition | undefined {
  const defaultRole = getDefaultRole(roleId);

  if (!defaultRole) {
    // Check custom roles
    return rolesConfig?.custom?.[roleId];
  }

  // Apply config overrides if present
  const roleConfig = rolesConfig?.[roleId as keyof RolesConfig] as RoleConfig | undefined;

  if (roleConfig?.enabled === false) {
    return undefined; // Role is disabled
  }

  return applyRoleConfig(defaultRole, roleConfig);
}

/**
 * Check if a role has a specific capability
 */
export function roleHasCapability(role: RoleDefinition, capability: AgentCapability): boolean {
  return role.capabilities.includes(capability);
}

/**
 * Execute a role with the given context
 */
export async function executeRole(context: RoleExecutionContext): Promise<RoleExecutionResult> {
  const { role, model, trigger } = context;
  const actions: RoleExecutionResult['actions'] = [];

  try {
    // Build the full prompt with context
    let userPrompt = `Trigger: ${trigger.type}\nSource: ${trigger.source}\n`;

    if (context.repo) {
      userPrompt += `\nRepository: ${context.repo.fullName}`;
    }

    if (context.issueContext) {
      userPrompt += `\n\nIssue #${context.issueContext.number}: ${context.issueContext.title}`;
      userPrompt += `\nAuthor: ${context.issueContext.author}`;
      userPrompt += `\nLabels: ${context.issueContext.labels.join(', ') || 'none'}`;
      userPrompt += `\n\n${context.issueContext.body}`;
    }

    if (context.fileContext?.diff) {
      userPrompt += `\n\nDiff:\n\`\`\`\n${context.fileContext.diff.slice(0, 10000)}\n\`\`\``;
    }

    // Generate response using the role's system prompt
    const { text } = await generateText({
      model,
      system: role.systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: role.maxTokens ?? 4096,
      temperature: role.temperature ?? 0.3,
    });

    actions.push({
      type: 'generate_response',
      description: 'Generated AI response',
      result: 'success',
    });

    return {
      success: true,
      response: text,
      actions,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      actions,
    };
  }
}

/**
 * Execute Sage role specifically
 *
 * Uses the triage package's Sage handlers for structured output
 */
export async function executeSageRole(
  query: string,
  model: LanguageModel,
  context?: Partial<RoleExecutionContext>
): Promise<RoleExecutionResult> {
  const role = getDefaultRole('sage');
  if (!role) {
    return { success: false, error: 'Sage role not found' };
  }

  try {
    // Use Analyzer for quickTriage as a bridge until Sage is in triage package
    const analyzer = new Analyzer();

    // Build context string
    let contextStr = query;
    if (context?.issueContext) {
      contextStr = `Issue #${context.issueContext.number}: ${context.issueContext.title}\n\n${context.issueContext.body}\n\nQuery: ${query}`;
    }

    const triage = await analyzer.quickTriage(contextStr);

    const response = `**Priority**: ${triage.priority} | **Category**: ${triage.category}

${triage.summary}

**Suggested Action**: ${triage.suggestedAction}

*(Confidence: ${Math.round(triage.confidence * 100)}%)*`;

    return {
      success: true,
      response,
      data: triage as unknown as Record<string, unknown>,
      actions: [
        { type: 'quick_triage', description: 'Performed quick triage analysis', result: 'success' },
      ],
    };
  } catch (_error) {
    // Fallback to simple text generation
    const { text } = await generateText({
      model,
      system: role.systemPrompt,
      prompt: query,
      temperature: role.temperature ?? 0.3,
    });

    return {
      success: true,
      response: text,
      actions: [
        {
          type: 'fallback_generation',
          description: 'Used fallback text generation',
          result: 'success',
        },
      ],
    };
  }
}

/**
 * List all available roles (default + custom)
 */
export function listRoles(rolesConfig?: RolesConfig): RoleDefinition[] {
  const roles: RoleDefinition[] = [];

  // Add enabled default roles
  for (const [id, role] of Object.entries(DEFAULT_ROLES)) {
    const config = rolesConfig?.[id as keyof RolesConfig] as RoleConfig | undefined;
    if (config?.enabled !== false) {
      roles.push(applyRoleConfig(role, config));
    }
  }

  // Add custom roles
  if (rolesConfig?.custom) {
    for (const role of Object.values(rolesConfig.custom)) {
      roles.push(role);
    }
  }

  return roles;
}

/**
 * Find a role by trigger pattern
 */
export function findRoleByTrigger(
  pattern: string,
  rolesConfig?: RolesConfig
): RoleDefinition | undefined {
  const normalizedPattern = pattern.toLowerCase().trim();

  for (const role of listRoles(rolesConfig)) {
    for (const trigger of role.triggers) {
      if (trigger.type === 'comment') {
        if (normalizedPattern.startsWith(trigger.pattern.toLowerCase())) {
          return role;
        }
      }
    }
  }

  return undefined;
}
