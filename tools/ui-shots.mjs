/**
 * Visual smoke tool: drives the running dev server with Playwright, screenshots
 * every route (desktop + mobile) and reports any console / page errors.
 *
 * Usage:
 *   npm start                  # in one terminal (ng serve on :4200)
 *   npm run shots              # all routes
 *   npm run shots -- "#/battle,#/profile"   # a subset
 *
 * The app uses hash routing (withHashLocation), so routes are "#/path".
 * Output goes to .ui-shots/ (gitignored).
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:4200';
const OUT = fileURLToPath(new URL('../.ui-shots', import.meta.url));

const ALL = ['#/', '#/pokedex', '#/type-lab', '#/team-builder', '#/battle', '#/arena', '#/tournaments', '#/spire', '#/odyssey', '#/world', '#/fusion', '#/contest', '#/showdown', '#/adventure', '#/profile'];
const routes = process.argv[2] ? process.argv[2].split(',') : ALL;
const slug = (r) => (r === '#/' ? 'home' : r.replace('#/', '').replace(/[^a-z0-9-]+/gi, '_').replace(/^_+|_+$/g, ''));

await mkdir(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()} :: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`${page.url()} :: PAGEERROR ${e.message}`));

for (const r of routes) {
  await page.goto(`${BASE}/${r}`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/${slug(r)}.png`, fullPage: true });
  console.log('shot', slug(r));
}

const m = await ctx.newPage();
m.on('console', (mm) => { if (mm.type() === 'error') errors.push(`${m.url()} :: ${mm.text()}`); });
m.on('pageerror', (e) => errors.push(`${m.url()} :: PAGEERROR ${e.message}`));
const overflow = [];
for (const width of [320, 375]) {
  await m.setViewportSize({ width, height: 780 });
  for (const r of routes) {
    await m.goto(`${BASE}/${r}`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
    await m.waitForTimeout(1100);
    if (width === 375) await m.screenshot({ path: `${OUT}/${slug(r)}_m.png`, fullPage: true });
    const scrollW = await m.evaluate(() => document.scrollingElement.scrollWidth);
    if (scrollW > width + 1) overflow.push(`${slug(r)} @${width}px :: scrollWidth ${scrollW} > ${width}`);
  }
}

await browser.close();
console.log(`\n${errors.length} console/page error(s):`);
console.log(errors.slice(0, 50).join('\n') || '  none 🎉');
console.log(`\n${overflow.length} horizontal-overflow issue(s):`);
console.log(overflow.slice(0, 50).join('\n') || '  none 🎉');
process.exit(errors.length || overflow.length ? 1 : 0);
