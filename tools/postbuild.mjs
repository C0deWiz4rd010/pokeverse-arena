/**
 * Post-build step (runs automatically after `npm run build`): stamps the service worker
 * with a build id and the list of files that make up the app shell, so the first visit
 * is precached and every deploy gets a fresh, self-cleaning cache.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../dist/pokeverse-arena/browser/', import.meta.url));
const html = await readFile(join(dir, 'index.html'), 'utf8');

// Relative script / stylesheet / modulepreload references in the built shell.
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css))"/g)) refs.add(m[1]);
const list = [...refs, 'manifest.webmanifest', 'icon.svg', 'icon-192.png'];

const hash = createHash('sha1');
for (const f of [...refs].sort()) hash.update(await readFile(join(dir, f)));
hash.update(html);
const buildId = hash.digest('hex').slice(0, 10);

let sw = await readFile(join(dir, 'sw.js'), 'utf8');
const before = sw;
sw = sw.replace(/const BUILD_ID = '[^']*';/, `const BUILD_ID = '${buildId}';`);
sw = sw.replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(list)};`);
if (sw === before) throw new Error('postbuild: placeholders not found in sw.js');
await writeFile(join(dir, 'sw.js'), sw);
console.log(`sw.js stamped: build ${buildId}, ${list.length} precached files`);
