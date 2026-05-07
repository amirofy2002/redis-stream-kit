import { readdir, rename, readFile, writeFile } from 'node:fs/promises';
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

async function rewrite(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      await rewrite(p);
      continue;
    }
    if (p.endsWith('.cjs')) {
      const src = await readFile(p, 'utf8');
      const next = src
        .replace(/(require\(\s*["'])(\.[^"']*?)\.js(["']\s*\))/g, '$1$2.cjs$3')
        .replace(/(\/\/# sourceMappingURL=.*?)\.js\.map\s*$/m, '$1.cjs.map');
      if (next !== src) await writeFile(p, next);
    } else if (p.endsWith('.d.cts')) {
      const src = await readFile(p, 'utf8');
      const next = src.replace(
        /(from\s+["']|require\(\s*["'])(\.[^"']*?)\.js(["'])/g,
        '$1$2.cjs$3',
      );
      if (next !== src) await writeFile(p, next);
    }
  }
}

await walk('dist/cjs');
await rewrite('dist/cjs');
