/**
 * Adventure happy-path E2E: drives the running dev server with Playwright
 * through new game → starter → first wild battle → run → menu save, and fails
 * on any console/page error along the way.
 *
 * Usage:
 *   npm start                 # in one terminal (ng serve on :4200)
 *   npm run e2e               # or SHOTS_BASE=http://localhost:4233 npm run e2e
 *
 * Screenshots land in .ui-shots/ (gitignored) for visual inspection.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:4200';
const OUT = fileURLToPath(new URL('../.ui-shots', import.meta.url));
await mkdir(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const log = (...a) => console.log('▸', ...a);
const fail = (msg) => { errors.push(msg); };

await page.goto(`${BASE}/#/adventure`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

// Fresh run every time: wipe the save and reload the route.
await page.evaluate(() => localStorage.removeItem('pv:rpg:save'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);

// 1 — Title → New Adventure.
const newGame = page.locator('button', { hasText: /New Adventure/i }).first();
if (!(await newGame.count())) fail('title: no New Adventure button');
else {
  await newGame.click();
  log('new game started');
}

// Clicking the dialogue box first completes the typewriter, then advances —
// loop until no box remains (handles any number of lines, incl. network waits).
async function clearDialogue(maxClicks = 24) {
  for (let i = 0; i < maxClicks; i++) {
    const box = page.locator('.dbox');
    if (!(await box.count())) {
      await page.waitForTimeout(400); // a follow-up line may still be loading
      if (!(await box.count())) return;
    }
    await box.first().click().catch(() => {});
    await page.waitForTimeout(320);
  }
}

// 2 — Advance intro dialogue until the starter picker appears.
await clearDialogue(8);
await page.waitForSelector('.starter button, pv-starter button', { timeout: 20000 }).catch(() => {});
const starterBtn = page.locator('.starter button, pv-starter button').first();
if (!(await starterBtn.count())) fail('starter: picker never appeared');
else {
  await starterBtn.click();
  // grantPokemon fetches the species — allow for a cold cache, then clear the
  // confirmation dialogue.
  await page.waitForSelector('.dbox', { timeout: 20000 }).catch(() => {});
  await clearDialogue();
  log('starter chosen');
}

// 3 — Party HUD proves the save took.
await page.waitForSelector('.party-hud .ph-mon', { timeout: 10000 }).catch(() => {});
if (!(await page.locator('.party-hud .ph-mon').count())) fail('overworld: party HUD missing');
else log('party HUD visible');
await page.screenshot({ path: `${OUT}/e2e-adv-overworld.png` });

// 4 — Walk a fixed path: bedroom (3,4) → door (3,6) → Verdant Town (3,4) →
//     right to x5 → down to the tall-grass row (y10), then sweep it until a
//     wild battle rolls (32%/grass step).
const path = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight',
  'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown'];
let inBattle = false;
// The overworld tracks *held* keys per animation frame, so hold each arrow for
// one full 150ms step instead of a fleeting press.
async function stepKey(key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(180);
  await page.keyboard.up(key);
  await page.waitForTimeout(60);
}
for (let i = 0; i < 70 && !inBattle; i++) {
  const dir = i < path.length ? path[i] : (Math.floor(i / 3) % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
  await stepKey(dir);
  inBattle = (await page.locator('.rb, pv-rpg-battle').count()) > 0;
}
if (!inBattle) fail('encounter: no wild battle after 90 steps');
else {
  log('wild battle triggered');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/e2e-adv-battle.png` });
  // 5 — Run away (wild battles allow it).
  const runBtn = page.locator('button', { hasText: /^Run$/ }).first();
  if (await runBtn.count()) {
    await runBtn.click();
    await page.waitForTimeout(900);
    const cont = page.locator('button', { hasText: /Continue/i }).first();
    if (await cont.count()) await cont.click();
    log('ran from battle');
  } else fail('battle: Run button missing');
}

// 6 — Open the menu and save.
await page.waitForTimeout(700);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const saveBtn = page.locator('button', { hasText: /^Save$/ }).first();
if (await saveBtn.count()) {
  await saveBtn.click();
  log('saved from the field menu');
} else fail('menu: Save button missing');
await page.screenshot({ path: `${OUT}/e2e-adv-menu.png` });

await browser.close();
console.log('\n===== ADVENTURE E2E =====');
if (errors.length) {
  console.log(`${errors.length} error(s):`);
  for (const e of errors) console.log(' -', e);
  process.exitCode = 1;
} else {
  console.log('happy path clean — 0 errors 🎉');
}
