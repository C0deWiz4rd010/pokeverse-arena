/**
 * One-command acceptance run against the PRODUCTION build (what CI executes):
 *   1. serves dist/pokeverse-arena/browser
 *   2. every route x 7 viewports: no console/page errors, no horizontal overflow  (ui-shots)
 *   3. new game -> starter -> wild battle -> menu save                              (e2e-adventure)
 *   4. offline start through the service worker                                    (e2e-offline)
 *
 *   npm run build && npm run accept        # set PW_CHANNEL=chrome to use installed Chrome
 */
import { spawn } from 'node:child_process';

const PORT = process.env.ACCEPT_PORT ?? '4300';
const server = spawn(process.execPath, ['tools/serve-dist.mjs', PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const run = (name, file, env) =>
  new Promise((resolve) => {
    console.log(`\n▶ ${name}`);
    const p = spawn(process.execPath, [file], { stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('exit', (code) => resolve(code ?? 1));
  });

const base = `http://localhost:${PORT}`;
const results = [
  ['routes x viewports', await run('routes x viewports', 'tools/ui-shots.mjs', { SHOTS_BASE: base, SHOTS_LOCALE: 'en' })],
  ['adventure flow', await run('adventure flow', 'tools/e2e-adventure.mjs', { SHOTS_BASE: base })],
  ['offline start', await run('offline start', 'tools/e2e-offline.mjs', { OFFLINE_BASE: `http://pv.localhost:${PORT}` })],
];
server.kill();
console.log('\n===== ACCEPTANCE =====');
for (const [n, c] of results) console.log(`${c === 0 ? '✔' : '✘'} ${n}`);
process.exit(results.some(([, c]) => c !== 0) ? 1 : 0);
