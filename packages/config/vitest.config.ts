import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@w3f/polguard-common': fileURLToPath(new URL('../common/src', import.meta.url)),
    },
  },
});
