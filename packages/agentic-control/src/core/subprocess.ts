/**
 * Safe subprocess execution utilities
 */

import { type SpawnOptions, type SpawnSyncOptions, spawn, spawnSync } from 'node:child_process';
import { sanitizeError } from './security.js';

// ============================================
// Safe Execution Functions
// ============================================

/**
 * Safely execute a command with array-based arguments (no shell interpolation)
 */
export function safeSpawnSync(
  command: string,
  args: string[] = [],
  options: SpawnSyncOptions = {}
): { success: boolean; stdout: string; stderr: string; code: number | null } {
  // Validate inputs
  if (typeof command !== 'string' || command.trim() === '') {
    throw new Error('Command must be a non-empty string');
  }

  if (!Array.isArray(args)) {
    throw new Error('Arguments must be an array');
  }

  // Ensure we don't use shell
  const safeOptions: SpawnSyncOptions = {
    ...options,
    shell: false, // Explicitly disable shell to prevent injection
    encoding: 'utf-8',
  };

  try {
    const result = spawnSync(command, args, safeOptions);

    return {
      success: result.status === 0,
      stdout: result.stdout?.toString() ?? '',
      stderr: result.stderr?.toString() ?? '',
      code: result.status,
    };
  } catch (error) {
    const sanitizedError = sanitizeError(error instanceof Error ? error.message : String(error));
    throw new Error(`Command execution failed: ${sanitizedError}`);
  }
}

/**
 * Safely execute a command asynchronously with array-based arguments
 */
export function safeSpawn(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<{ success: boolean; stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    // Validate inputs
    if (typeof command !== 'string' || command.trim() === '') {
      reject(new Error('Command must be a non-empty string'));
      return;
    }

    if (!Array.isArray(args)) {
      reject(new Error('Arguments must be an array'));
      return;
    }

    // Ensure we don't use shell
    const safeOptions: SpawnOptions = {
      ...options,
      shell: false, // Explicitly disable shell to prevent injection
    };

    const child = spawn(command, args, safeOptions);

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        stdout,
        stderr,
        code,
      });
    });

    child.on('error', (error) => {
      const sanitizedError = sanitizeError(error.message);
      reject(new Error(`Command execution failed: ${sanitizedError}`));
    });
  });
}

/**
 * Validate command arguments to prevent injection
 */
export function validateCommandArgs(args: string[]): void {
  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw new Error('All command arguments must be strings');
    }

    // Check for potentially dangerous characters that could be used for injection
    if (arg.includes('\n') || arg.includes('\r')) {
      throw new Error('Command arguments cannot contain newline characters');
    }

    // Check for null bytes (common injection technique)
    if (arg.includes('\0')) {
      throw new Error('Command arguments cannot contain null bytes');
    }
  }
}

/**
 * Safely execute git commands with validation
 */
export function safeGitCommand(args: string[], options: SpawnSyncOptions = {}) {
  // Validate git arguments
  validateCommandArgs(args);

  // Additional git-specific validation
  const allowedGitCommands = [
    'diff',
    'log',
    'show',
    'status',
    'branch',
    'remote',
    'config',
    'rev-parse',
    'ls-remote',
    'fetch',
    'pull',
    'push',
    'clone',
    'checkout',
    'merge',
    'rebase',
    'commit',
    'add',
    'reset',
  ];

  const firstArg = args[0];
  if (!firstArg || !allowedGitCommands.includes(firstArg)) {
    throw new Error(`Git command not allowed: ${firstArg ?? '(empty)'}`);
  }

  return safeSpawnSync('git', args, options);
}

/**
 * Safely execute docker commands with validation
 */
export function safeDockerCommand(args: string[], options: SpawnSyncOptions = {}) {
  // Validate docker arguments
  validateCommandArgs(args);

  // Additional docker-specific validation
  const allowedDockerCommands = [
    'build',
    'run',
    'exec',
    'ps',
    'images',
    'pull',
    'push',
    'start',
    'stop',
    'restart',
    'rm',
    'rmi',
    'logs',
    'inspect',
    'create',
    'cp',
    'stats',
    'top',
    'version',
    'info',
  ];

  const firstArg = args[0];
  if (!firstArg || !allowedDockerCommands.includes(firstArg)) {
    throw new Error(`Docker command not allowed: ${firstArg ?? '(empty)'}`);
  }

  return safeSpawnSync('docker', args, options);
}
