import { defineConfig } from 'tsup';

/**
 * tsup configuration for @agentic-dev-library/vitest-control
 */
export default defineConfig({
	entry: {
		index: 'src/index.ts',
		mocking: 'src/mocking.ts',
		fixtures: 'src/fixtures.ts',
		mcp: 'src/mcp.ts',
		providers: 'src/providers.ts',
		sandbox: 'src/sandbox.ts',
	},

	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	splitting: false,
	target: 'ES2022',

	external: ['vitest', '@agentic-dev-library/control', '@agentic-dev-library/triage'],

	treeshake: true,
	minify: false,
	keepNames: true,
});
