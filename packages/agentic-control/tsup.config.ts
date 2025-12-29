import { defineConfig } from 'tsup';

/**
 * tsup configuration for @agentic-dev-library/control
 *
 * This configuration ensures the package works correctly in:
 * - Node.js ESM (with proper .js extensions)
 * - Bundlers (Vite, Webpack, esbuild)
 * - TypeScript projects with any moduleResolution setting
 */
export default defineConfig({
  // Entry points matching package.json exports
  entry: {
    // Main entry
    index: 'src/index.ts',
    // CLI entry
    cli: 'src/cli.ts',
    // Subpath exports
    'orchestrators/index': 'src/orchestrators/index.ts',
    'pipelines/index': 'src/pipelines/index.ts',
    'actions/index': 'src/actions/index.ts',
    'fleet/index': 'src/fleet/index.ts',
    'triage/index': 'src/triage/index.ts',
    'github/index': 'src/github/index.ts',
    'handoff/index': 'src/handoff/index.ts',
    'core/index': 'src/core/index.ts',
    'sandbox/index': 'src/sandbox/index.ts',
  },

  // Output format - ESM only (the package is "type": "module")
  format: ['esm'],

  // Generate TypeScript declaration files
  dts: true,

  // Clean output directory before each build
  clean: true,

  // Generate source maps for debugging
  sourcemap: true,

  // Don't split chunks - each entry point is independent
  splitting: false,

  // Target ES2022 (matches tsconfig)
  target: 'ES2022',

  // External packages (don't bundle dependencies)
  external: [
    '@ai-sdk/mcp',
    '@ai-sdk/anthropic',
    '@ai-sdk/azure',
    '@ai-sdk/google',
    '@ai-sdk/mistral',
    '@ai-sdk/openai',
    '@inquirer/prompts',
    '@modelcontextprotocol/sdk',
    '@octokit/rest',
    '@agentic-dev-library/triage',
    '@agentic-dev-library/vitest-control',
    'ai',
    'ai-sdk-ollama',
    'commander',
    'cosmiconfig',
    'env-var',
    'simple-git',
    'zod',
  ],

  // Ensure proper ESM output
  treeshake: true,

  // Add banner for module compatibility
  banner: {
    js: '/* @agentic-dev-library/control - ESM Build */',
  },

  // Minification disabled for library (consumers can minify)
  minify: false,

  // Keep names for better debugging
  keepNames: true,
});
