import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/service/main.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  clean: true,
  sourcemap: true,
  target: 'node22',
  splitting: false,
});
