/**
 * Finds UI text that is still English after switching to German: loads every route with the
 * locale forced to "de" and reports visible lines that contain common English function words.
 *
 *   npm start                       # dev server on :4200
 *   PW_CHANNEL=chrome node tools/i18n-scan.mjs [#/route,#/other]
 */
import { chromium } from 'playwright';
import { knownEnglish } from './i18n-dict.mjs';


const BASE = process.env.SHOTS_BASE ?? 'http://localhost:4200';
const ALL = ['#/', '#/pokedex', '#/pokemon/25', '#/type-lab', '#/team-builder', '#/battle', '#/arena', '#/tournaments', '#/spire', '#/odyssey', '#/world', '#/fusion', '#/contest', '#/showdown', '#/adventure', '#/profile'];
const routes = process.argv[2] ? process.argv[2].split(',') : ALL;

const ENGLISH = /\b(the|and|your|you|you're|with|from|this|that|for|of|to|is|are|will|have|has|into|once|every|each|more|than|not|only|first|then|their|when|before|after|can|per|any|all|its|it's|one|new|best|win|lose)\b/i;
// proper names / product words that legitimately stay as they are
const IGNORE = /PokéVerse|PokéAPI|Pokédex|Pokémon|Angular|PixiJS|Three\.js|GitHub|Nuzlocke|Showdown|Arena|Dex|JSON|Seed/;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('pv:locale', 'de'));
const page = await ctx.newPage();
let total = 0;
for (const r of routes) {
  await page.goto(`${BASE}/${r}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const lines = await page.evaluate(() => {
    const out = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const el = n.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (t.length > 3) out.add(t);
    }
    for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')) {
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) {
        const v = el.getAttribute(a);
        if (v && v.length > 3) out.add(`[${a}] ${v}`);
      }
    }
    return [...out];
  });
  const hits = lines.filter((l) => (ENGLISH.test(l) || knownEnglish(l)) && !IGNORE.test(l));
  total += hits.length;
  console.log(`\n== ${r}  (${hits.length})`);
  for (const h of hits.slice(0, 40)) console.log('  ' + h.slice(0, 140));
}
await browser.close();
console.log(`\n${total} suspicious line(s)`);
