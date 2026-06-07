import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const appVersion = process.env.npm_package_version ?? '0.3.0';

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    {
      name: 'emit-app-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: `${JSON.stringify({ version: appVersion })}\n`,
        });
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    watch: {
      usePolling: true,
      interval: 500,
      ignored: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/test-results/**', '**/playwright-report/**', '**/.wrangler/**'],
    },
    proxy: {
      '/api': {
        target: 'https://dc.hhhl.cc',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
