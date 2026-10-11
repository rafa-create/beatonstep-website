import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Explicit allowlist: never publish Worker sources, SQL, repository metadata,
// private configuration or environment files as website assets.
const directories = ['assets', 'badges', 'store', 'screenshots-archive'];
const rootFile = /^(?:[a-zA-Z0-9_-]+\.(?:html|css|js|json|md))$/;
for (const entry of readdirSync(root)) {
  if (!rootFile.test(entry) || !statSync(join(root, entry)).isFile()) continue;
  cpSync(join(root, entry), join(out, entry));
}
for (const dir of directories) {
  if (existsSync(join(root, dir))) {
    cpSync(join(root, dir), join(out, dir), { recursive: true });
  }
}
if (!existsSync(join(out, 'index.html')) || !existsSync(join(out, 'partages.html'))) {
  throw Error('Required website pages are missing from dist');
}
console.log('Cloudflare static assets prepared in dist/');
