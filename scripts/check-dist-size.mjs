import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'dist');
const limit = 25 * 1024 * 1024;

function filesIn(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesIn(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

let files;
try {
  files = filesIn(root);
} catch {
  console.error('dist/ is missing. Run the site build before the size check.');
  process.exit(1);
}

const overs = files
  .map((file) => ({ file, size: statSync(file).size }))
  .filter((item) => item.size > limit);

if (overs.length > 0) {
  for (const item of overs) {
    const mib = (item.size / (1024 * 1024)).toFixed(2);
    console.error(`${relative(process.cwd(), item.file)} is ${mib} MiB, over the 25 MiB limit.`);
  }
  process.exit(1);
}

console.log(`Checked ${files.length} files in dist/. None is over 25 MiB.`);
