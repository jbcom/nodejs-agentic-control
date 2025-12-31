/**
 * Agentic Roles Module
 *
 * Provides configurable AI agent personas for repositories.
 *
 * @example
 * ```typescript
 * import { getEffectiveRole, executeRole, SAGE_ROLE } from '@agentic-dev-library/control/roles';
 *
 * // Get a role with config applied
 * const sage = getEffectiveRole('sage', config.roles);
 *
 * // Execute a role
 * const result = await executeRole(context);
 * ```
 */

// Default roles
export {
  CURATOR_ROLE,
  DEFAULT_ROLES,
  DELEGATOR_ROLE,
  FIXER_ROLE,
  getDefaultRole,
  getDefaultRoleIds,
  HARVESTER_ROLE,
  REVIEWER_ROLE,
  SAGE_ROLE,
} from './defaults.js';
// Executor
export {
  applyRoleConfig,
  executeRole,
  executeSageRole,
  findRoleByTrigger,
  getEffectiveRole,
  listRoles,
  roleHasCapability,
} from './executor.js';
// Types
export type {
  AgentCapability,
  BuiltInRoleId,
  RoleConfig,
  RoleDefinition,
  RoleExecutionContext,
  RoleExecutionResult,
  RolesConfig,
  RoleTrigger,
} from './types.js';
