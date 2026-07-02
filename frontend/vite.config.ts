import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  optimizeDeps: {
    // linked workspace TS source — let Vite transform it directly
    exclude: ['@sim/shared'],
  },
});
