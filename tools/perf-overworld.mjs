/**
 * Frame-time probe for the Adventure overworld.
 *
 *   PERF_BASE=http://localhost:4300 PERF_THROTTLE=4 PW_CHANNEL=chrome node tools/perf-overworld.mjs
 *
 * Starts a new game, walks for ~6 s with the CPU throttled (default 4×) and reports the
 * average fps and the slow-frame percentiles measured with requestAnimationFrame.
 */
import { chromium } from 'playwright';

const BASE = process.env.PERF_BASE ?? 'http://localhost:4300';
const THROTTLE = Number(process.env.PERF_THROTTLE ?? 4);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();
await page.goto(`${BASE}/#/adventure`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.evaluate((mute) => { for (const k of Object.keys(localStorage)) if (k.startsWith('pv:rpg')) localStorage.removeItem(k); if (mute) localStorage.setItem('sfx:muted', '1'); }, !!process.env.PERF_MUTE);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.locator('button', { hasText: /New Adventure/i }).first().click();

async function clearDialogue(n = 10) {
  for (let i = 0; i < n; i++) {
    const box = page.locator('.dbox');
    if (!(await box.count())) { await page.waitForTimeout(350); if (!(await box.count())) return; }
    await box.first().click().catch(() => {});
    await page.waitForTimeout(300);
  }
}
await clearDialogue(8);
await page.locator('.starter button, [class*=starter] button').first().click({ timeout: 4000 }).catch(() => {});
await clearDialogue(8);
await page.waitForSelector('.party-hud .ph-mon', { timeout: 10000 }).catch(() => {});

const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
await page.evaluate(() => {
  window.__ft = [];
  let last = performance.now();
  const f = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(f); };
  requestAnimationFrame(f);
});
const dirs = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
const end = Date.now() + 6000;
for (let i = 0; Date.now() < end; i++) {
  await page.keyboard.down(dirs[i % 4]);
  await page.waitForTimeout(200);
  await page.keyboard.up(dirs[i % 4]);
  if (await page.locator('pv-rpg-battle').count()) break; // a wild battle ends the probe early
}
const ft = (await page.evaluate(() => window.__ft)).slice(10);
await browser.close();
ft.sort((a, b) => a - b);
const avg = ft.reduce((s, x) => s + x, 0) / ft.length;
const pct = (p) => ft[Math.min(ft.length - 1, Math.floor(ft.length * p))];
console.log(JSON.stringify({ frames: ft.length, throttle: THROTTLE, avgFps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(1), p50: +pct(0.5).toFixed(1), p95: +pct(0.95).toFixed(1), p99: +pct(0.99).toFixed(1) }));
