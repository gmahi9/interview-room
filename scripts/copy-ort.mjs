import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const sample = require.resolve('onnxruntime-web/ort-wasm-simd-threaded.wasm');
const dist = dirname(sample);
const out = join(process.cwd(), 'public', 'ort');
mkdirSync(out, { recursive: true });

const files = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
];

for (const name of files) {
  const from = join(dist, name);
  if (!existsSync(from)) {
    console.error(`Missing speech runtime file: ${from}`);
    process.exit(1);
  }
  copyFileSync(from, join(out, name));
}

console.log(`Copied ${files.length} speech runtime files to public/ort`);
