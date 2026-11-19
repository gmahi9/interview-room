import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    // The default onnxruntime-web entry embeds WebAssembly. This condition
    // selects the build that loads those files from wasmPaths instead.
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
