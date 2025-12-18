/**
 * Security utilities for safe error reporting and token sanitization
 */

/**
 * Sanitize error messages to remove sensitive tokens
 */
export function sanitizeError(error: string | Error): string {
  const message = error instanceof Error ? error.message : error;

  // Patterns for common token formats
  const tokenPatterns = [
    // GitHub tokens: ghp_, gho_, ghu_, ghs_, ghr_
    /gh[pous]_[A-Za-z0-9_]{36,}/g,
    // GitHub fine-grained tokens: github_pat_
    /github_pat_[A-Za-z0-9_]{82}/g,
    // Anthropic API keys: sk-ant-
    /sk-ant-[A-Za-z0-9_-]{95,}/g,
    // OpenAI API keys: sk-
    /sk-[A-Za-z0-9]{48,}/g,
    // Generic API key patterns
    /[A-Za-z0-9_-]{32,}/g,
  ];

  let sanitized = message;

  for (const pattern of tokenPatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED_TOKEN]');
  }

  return sanitized;
}

/**
 * Sanitize environment variables from error messages
 */
export function sanitizeEnvironment(
  env: Record<string, string | undefined>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      sanitized[key] = 'undefined';
    } else if (
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('secret')
    ) {
      sanitized[key] = value ? '[REDACTED]' : '(not set)';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create a safe error for logging that removes sensitive information
 */
export function createSafeError(message: string, originalError?: Error): Error {
  const sanitizedMessage = sanitizeError(message);
  const error = new Error(sanitizedMessage);

  if (originalError) {
    error.cause = new Error(sanitizeError(originalError.message));
    error.stack = originalError.stack ? sanitizeError(originalError.stack) : undefined;
  }

  return error;
}

/**
 * Safe console logging that sanitizes output
 */
export const safeConsole = {
  log: (message: string, ...args: unknown[]) => {
    console.log(
      sanitizeError(message),
      ...args.map((arg) => (typeof arg === 'string' ? sanitizeError(arg) : arg))
    );
  },

  error: (message: string, ...args: unknown[]) => {
    console.error(
      sanitizeError(message),
      ...args.map((arg) => (typeof arg === 'string' ? sanitizeError(arg) : arg))
    );
  },

  warn: (message: string, ...args: unknown[]) => {
    console.warn(
      sanitizeError(message),
      ...args.map((arg) => (typeof arg === 'string' ? sanitizeError(arg) : arg))
    );
  },
};
