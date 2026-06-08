import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./test/cloudflare-workers-shim.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
