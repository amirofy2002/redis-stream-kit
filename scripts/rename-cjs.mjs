import { readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (p.endsWith('.js')) await rename(p, p.replace(/\.js$/, '.cjs'));
    else if (p.endsWith('.d.ts')) await rename(p, p.replace(/\.d\.ts$/, '.d.cts'));
    else if (p.endsWith('.js.map')) await rename(p, p.replace(/\.js\.map$/, '.cjs.map'));
  }
}
await walk('dist/cjs');
