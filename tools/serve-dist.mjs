/**
 * Tiny static server for the production build (CI + local acceptance runs).
 *
 *   node tools/serve-dist.mjs [port]      # default 4300, serves dist/pokeverse-arena/browser
 *
 * Reachable as http://localhost:PORT and, so the service worker registers (it skips plain
 * localhost), as http://pv.localhost:PORT in Chromium.
 */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(process.env.DIST_DIR ?? fileURLToPath(new URL('../dist/pokeverse-arena/browser', import.meta.url)));
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4300);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://x');
    let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403).end(); return; }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = join(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info) { file = join(ROOT, 'index.html'); }
    let body = await readFile(file);
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    // compress text like GitHub Pages does, so size/timing numbers match production
    const gz = /text|json|javascript|svg|manifest/.test(type) && /gzip/.test(String(req.headers['accept-encoding']));
    if (gz) body = gzipSync(body);
    res.writeHead(200, {
      ...(gz ? { 'content-encoding': 'gzip' } : {}),
      'content-type': type,
      // the service worker and shell must never be served stale
      'cache-control': /sw\.js$|index\.html$/.test(file) ? 'no-cache' : 'public, max-age=300',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
}).listen(PORT, () => console.log(`serving ${ROOT} on :${PORT}`));
