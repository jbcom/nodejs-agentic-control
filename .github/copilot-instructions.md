# TypeScript/Node.js Copilot Instructions

## Environment Setup

### Package Manager: pnpm (preferred)
```bash
# Install pnpm if not present
npm install -g pnpm

# Install dependencies
pnpm install
```

### Node Version
Check `.nvmrc` or `package.json` engines field for required version.
```bash
nvm use  # If .nvmrc exists
```

## Development Commands

### Testing (ALWAYS run tests)
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test -- src/__tests__/specific.test.ts

# Run tests matching pattern
pnpm test -- -t "pattern"
```

### Linting & Formatting
```bash
# Lint (ESLint or Biome)
pnpm lint

# Fix lint issues
pnpm lint:fix

# Format (Prettier or Biome)
pnpm format

# Check formatting
pnpm format:check

# Type checking
pnpm typecheck
```

### Building
```bash
# Build for production
pnpm build

# Build in watch mode
pnpm build:watch

# Clean build artifacts
pnpm clean
```

## Code Patterns

### Imports
```typescript
// Node built-ins first
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// External packages
import { z } from 'zod';

// Internal absolute imports
import { config } from '@/config';
import { logger } from '@/utils/logger';

// Relative imports last
import { helper } from './helper';
```

### Type Definitions
```typescript
// Prefer interfaces for object shapes
interface UserConfig {
  readonly id: string;
  name: string;
  settings?: Settings;
}

// Use type for unions/intersections
type Result<T> = Success<T> | Failure;

// Export types explicitly
export type { UserConfig, Result };
```

### Error Handling
```typescript
// Custom error classes
class ProcessingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

// Result pattern (alternative to exceptions)
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

### Async Patterns
```typescript
// Prefer async/await over .then()
async function fetchData(url: string): Promise<Data> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new FetchError(`HTTP ${response.status}`);
  }
  return response.json();
}

// Use Promise.all for parallel operations
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts(),
]);
```

### Testing Patterns
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Processor', () => {
  let processor: Processor;

  beforeEach(() => {
    processor = new Processor({ debug: false });
  });

  it('should process valid input', async () => {
    const result = await processor.process('valid');
    expect(result.success).toBe(true);
  });

  it('should throw on invalid input', async () => {
    await expect(processor.process('')).rejects.toThrow('Invalid');
  });

  it('should call external service', async () => {
    const mockService = vi.fn().mockResolvedValue({ data: 'test' });
    // ...
  });
});
```

### React Patterns (if applicable)
```typescript
// Functional components with proper typing
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// Hooks
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  // ...
  return debouncedValue;
}
```

## Common Issues

### "Cannot find module"
```bash
# Rebuild TypeScript
pnpm build

# Check tsconfig.json paths
```

### Type errors after package update
```bash
# Regenerate types
pnpm install
pnpm typecheck
```

### ESM vs CommonJS issues
```typescript
// In ESM (type: "module" in package.json)
import { something } from './module.js';  // .js extension required

// For JSON imports
import config from './config.json' with { type: 'json' };
```

## File Structure
```
src/
├── index.ts           # Main entry point
├── core/              # Core logic (no framework deps)
├── components/        # React components (if applicable)
├── hooks/             # React hooks
├── utils/             # Utility functions
├── types/             # Type definitions
└── __tests__/         # Unit tests
tests/
├── integration/       # Integration tests
└── e2e/              # End-to-end tests
```
