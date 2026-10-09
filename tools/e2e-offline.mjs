/**
 * Offline acceptance: the installed app must start with no network.
 *
 *   node tools/serve-dist.mjs 4300 &
 *   OFFLINE_BASE=http://pv.localhost:4300 PW_CHANNEL=chrome node tools/e2e-offline.mjs
 *
 * Loads the shell online, waits for the service worker to take control and finish precaching, goes
 * offline, then reloads and navigates: the shell must render (never Chrome's dino page) and routes
 * must show app UI, not a blank screen.
 */
import { chromium } from 'playwright';

const BASE = process.env.OFFLINE_BASE ?? 'http://pv.localhost:4300';
const problems = [];
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const controlled = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  await navigator.serviceWorker.ready;
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise((r) => setTimeout(r, 250));
  return !!navigator.serviceWorker.controller;
});
if (!controlled) {
  // first load is not controlled until a reload — that is normal; reload once online
  await page.reload({ waitUntil: 'domcontentloaded' });
}
await page.waitForTimeout(3500); // let the precache install finish

await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch((e) => problems.push(`offline reload failed: ${e.message}`));
await page.waitForTimeout(1500);
const shell = await page.evaluate(() => ({
  nav: !!document.querySelector('nav'),
  chars: (document.body.innerText || '').trim().length,
  title: document.title,
}));
if (!shell.nav || shell.chars < 40) problems.push(`offline shell did not render: ${JSON.stringify(shell)}`);

for (const route of ['#/pokedex', '#/profile', '#/adventure']) {
  await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => (document.body.innerText || '').trim().length);
  if (text < 40) problems.push(`offline ${route}: blank page`);
}

await browser.close();
console.log('\n===== OFFLINE E2E =====');
if (problems.length) { console.log(problems.map((p) => ' - ' + p).join('\n')); process.exitCode = 1; }
else console.log('offline start works — shell and routes render without a network 🎉');
