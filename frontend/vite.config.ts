import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  optimizeDeps: {
    // linked workspace TS source — let Vite transform it directly.
    // @babylonjs/havok: esbuild pre-bundling breaks its .wasm URL resolution.
    exclude: ['@sim/shared', '@babylonjs/havok'],
  },
});
