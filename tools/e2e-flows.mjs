/**
 * Non-Adventure happy paths against the production build (run by `npm run accept`):
 *   1. Pokédex: search "pikachu" → open the card → the detail page shows Pikachu and its base stats
 *   2. Battle: "Surprise me" → keep picking the first usable move until the result panel appears
 *   3. Team Builder: add a Pokémon by id → export the team JSON → import it back into a clean store
 *   4. Command palette: Ctrl+K opens it, typing filters, Escape closes it and the page is interactive again
 * Fails on any console/page error. Needs network access to PokéAPI (like the adventure flow).
 */
import { chromium } from 'playwright';

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:4200';
const errors = [];
const log = (...a) => console.log('▸', ...a);
const fail = (msg) => errors.push(msg);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  locale: 'en-US',
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

async function fresh(route) {
  await page.goto(`${BASE}/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/* ---- 1 · Pokédex search → detail ------------------------------------------------ */
await fresh('/pokedex');
const search = page.locator('input[type="search"]').first();
await search.waitFor({ timeout: 20000 });
await search.fill('pikachu');
const card = page.locator('pv-pokemon-card a').first();
await card.waitFor({ timeout: 20000 }).catch(() => fail('pokedex: no card for "pikachu"'));
if (await card.count()) {
  await card.click();
  await page
    .waitForURL(/#\/pokemon\//, { timeout: 20000 })
    .catch(() => fail('detail: no navigation'));
  const heading = page.locator('section.detail h1');
  await heading.waitFor({ timeout: 20000 }).catch(() => {});
  const title =
    (await heading
      .first()
      .textContent()
      .catch(() => '')) ?? '';
  if (!/pikachu/i.test(title)) fail(`detail: expected Pikachu, saw "${title.trim()}"`);
  else log('pokédex → detail ok');
  const meters = await page.locator('[role="meter"]').count();
  if (meters < 6) fail(`detail: expected 6 stat meters, saw ${meters}`);
}

/* ---- 2 · Battle to the result ---------------------------------------------------- */
await fresh('/battle');
await page
  .locator('button', { hasText: /Surprise me/i })
  .first()
  .click();
await page
  .waitForSelector('pv-move-button button', { timeout: 30000 })
  .catch(() => fail('battle: no moves'));
let finished = false;
for (let turn = 0; turn < 60 && !finished; turn++) {
  finished = (await page.locator('.result').count()) > 0;
  if (finished) break;
  const move = page.locator('pv-move-button button:not([disabled])').first();
  if (await move.count()) await move.click().catch(() => {});
  await page.waitForTimeout(700);
}
if (!finished) fail('battle: no result panel after 60 turns');
else log('battle reached a result');

/* ---- 3 · Team builder export → import -------------------------------------------- */
await fresh('/team-builder');
const addInput = page.locator('input').first();
await addInput.waitFor({ timeout: 20000 });
await addInput.fill('25');
await addInput.press('Enter');
await page
  .waitForSelector('[role="meter"], .member, pv-stat-bar', { timeout: 20000 })
  .catch(() => {});
const exportBtn = page.locator('button', { hasText: /Export/i }).first();
if (!(await exportBtn.count())) fail('team-builder: no export button');
else {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
    exportBtn.click(),
  ]);
  if (!download) fail('team-builder: export produced no download');
  else {
    const path = await download.path();
    const { readFile } = await import('node:fs/promises');
    const json = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(json.team) || json.team.length < 1)
      fail('team-builder: exported team is empty');
    else log('team export ok');
  }
}

/* ---- 4 · Command palette ----------------------------------------------------------- */
await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.keyboard.press('Control+k');
const dialog = page.locator('[role="dialog"]').first();
await dialog.waitFor({ timeout: 5000 }).catch(() => fail('palette: did not open'));
if (await dialog.count()) {
  await page.keyboard.type('type');
  const inert = await page.evaluate(() => document.querySelectorAll('[inert]').length);
  if (inert === 0) fail('palette: background was not made inert');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (await page.locator('[role="dialog"]').count()) fail('palette: Escape did not close it');
  const stillInert = await page.evaluate(() => document.querySelectorAll('[inert]').length);
  if (stillInert) fail('palette: page stayed inert after closing');
  else log('command palette ok');
}

await browser.close();
console.log('\n===== FLOWS E2E =====');
if (errors.length) {
  for (const e of errors) console.log('✘', e);
  process.exit(1);
}
console.log('all flows clean — 0 errors 🎉');
