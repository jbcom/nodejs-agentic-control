import { defineConfig } from 'tsup';

/**
 * tsup configuration for @agentic/providers
 */
export default defineConfig({
	entry: {
		index: 'src/index.ts',
		ollama: 'src/ollama.ts',
		jules: 'src/jules.ts',
		cursor: 'src/cursor.ts',
	},

	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
	splitting: false,
	target: 'ES2022',

	external: ['@agentic/triage', '@agentic-dev-library/triage'],

	treeshake: true,
	minify: false,
	keepNames: true,
});
