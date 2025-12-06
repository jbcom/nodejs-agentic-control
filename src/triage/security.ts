/**
 * Security utilities for the Agent
 *
 * Centralized security functions to prevent:
 * - Path traversal attacks
 * - Command injection
 * - Sandbox escapes
 */

import { existsSync, realpathSync } from 'fs';
import { dirname, resolve, relative, isAbsolute } from 'path';

/**
 * Result of path validation
 */
export interface PathValidationResult {
    /** Whether the path is valid and within the sandbox */
    valid: boolean;
    /** The fully resolved path */
    resolvedPath: string;
    /** Error message if validation failed */
    error?: string;
}

/**
 * Validate that a path is within the allowed working directory.
 * Prevents path traversal attacks (e.g., ../../../etc/passwd)
 *
 * @param inputPath - The path to validate (relative or absolute)
 * @param workingDirectory - The sandbox directory that paths must stay within
 * @returns Validation result with resolved path or error
 */
export function validatePath(inputPath: string, workingDirectory: string): PathValidationResult {
    try {
        // Resolve the input path relative to working directory (this normalizes .. components)
        const fullPath = isAbsolute(inputPath)
            ? resolve(inputPath)
            : resolve(workingDirectory, inputPath);

        // Get the real path of workingDirectory (resolves symlinks)
        const realWorkDir = realpathSync(workingDirectory);

        // For existing paths, use realpathSync to resolve symlinks
        if (existsSync(fullPath)) {
            const realPath = realpathSync(fullPath);
            const relativePath = relative(realWorkDir, realPath);
            if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
                return {
                    valid: false,
                    resolvedPath: fullPath,
                    error: `Path traversal detected: ${inputPath} resolves outside working directory`,
                };
            }
            return { valid: true, resolvedPath: fullPath };
        }

        // For non-existing paths, find the nearest existing ancestor
        let pathToCheck = dirname(fullPath);
        while (!existsSync(pathToCheck)) {
            const parent = dirname(pathToCheck);
            if (parent === pathToCheck) {
                // Reached filesystem root without finding existing directory
                break;
            }
            pathToCheck = parent;
        }

        // Validate that the existing ancestor is within workingDirectory
        if (existsSync(pathToCheck)) {
            const realPath = realpathSync(pathToCheck);
            const relativePath = relative(realWorkDir, realPath);
            if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
                return {
                    valid: false,
                    resolvedPath: fullPath,
                    error: `Path traversal detected: ${inputPath} resolves outside working directory`,
                };
            }
        } else {
            // No existing ancestor found - path is at root level and outside workingDirectory
            return {
                valid: false,
                resolvedPath: fullPath,
                error: `Path traversal detected: ${inputPath} resolves outside working directory`,
            };
        }

        // Also verify the full resolved path is within workingDirectory
        const normalizedRelative = relative(realWorkDir, fullPath);
        if (normalizedRelative.startsWith('..') || isAbsolute(normalizedRelative)) {
            return {
                valid: false,
                resolvedPath: fullPath,
                error: `Path traversal detected: ${inputPath} resolves outside working directory`,
            };
        }

        return { valid: true, resolvedPath: fullPath };
    } catch (error) {
        return {
            valid: false,
            resolvedPath: inputPath,
            error: `Path validation error: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

/**
 * Sanitize a filename for use in shell commands.
 * Prevents command injection via filenames.
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename with dangerous characters replaced
 */
export function sanitizeFilename(filename: string): string {
    // Remove or escape dangerous characters
    // Allow only alphanumeric, dots, dashes, underscores, and forward slashes
    return filename.replace(/[^a-zA-Z0-9._\-\/]/g, '_');
}

/**
 * Check if a shell command contains potentially dangerous patterns.
 * This is a heuristic check - not a replacement for proper sandboxing.
 *
 * @param command - The command to check
 * @returns Object with safety assessment
 */
export function assessCommandSafety(command: string): {
    safe: boolean;
    risks: string[];
} {
    const risks: string[] = [];

    // Check for destructive commands
    if (/\brm\s+(-rf?|--recursive)\b/i.test(command)) {
        risks.push('Recursive deletion detected');
    }

    // Check for privilege escalation
    if (/\bsudo\b/i.test(command)) {
        risks.push('Sudo usage detected');
    }

    // Check for dangerous permission changes
    if (/\bchmod\s+(777|a\+rwx)\b/i.test(command)) {
        risks.push('Dangerous permission change detected');
    }

    // Check for shell escapes and redirects to sensitive locations
    if (/>\s*\/etc\//i.test(command)) {
        risks.push('Write to /etc detected');
    }

    // Check for curl/wget piped to shell
    if (/\b(curl|wget)\b.*\|\s*(bash|sh|zsh)\b/i.test(command)) {
        risks.push('Remote code execution pattern detected');
    }

    return {
        safe: risks.length === 0,
        risks,
    };
}
