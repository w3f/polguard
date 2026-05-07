import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/service/main.ts'],
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: false,
});
