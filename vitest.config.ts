import { defineConfig } from 'vitest/config';

/**
 * Two test environments in one run:
 * - gateway/shared logic is pure Node (TagBus, links, schema helpers)
 * - frontend logic that touches the DOM / localStorage (panelRegistry,
 *   command palette) needs jsdom
 *
 * We select the environment per-file with a `// @vitest-environment jsdom`
 * docblock at the top of the frontend test files; the default here is node.
 * `@sim/shared` resolves to its TS source (the app has no build step).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['{shared,gateway,frontend}/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@sim/shared': new URL('./shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
