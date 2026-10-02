/**
 * Keeps the German dictionary honest: every literal passed through the `t` pipe in a
 * template (`{{ 'Text' | t }}`, `[title]="'Text' | t"`) must have a German entry.
 *
 *   node tools/i18n-check.mjs         # exit 1 when a literal has no translation
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/app/', import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

// Dictionary keys: 'English': 'German' pairs in de.ui.ts / de.data.ts (exact) and [en, de] tuples (patterns).
const dictSrc = ['core/i18n/de.ui.ts', 'core/i18n/de.data.ts'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
const unq = (s) => s.replace(/\\(.)/g, '$1');
const keys = new Set();
for (const m of dictSrc.matchAll(/^\s*'((?:[^'\\]|\\.)*)':\s*'/gm)) keys.add(unq(m[1]));
for (const m of dictSrc.matchAll(/^\s*\[\s*'((?:[^'\\]|\\.)*)',\s*'/gm)) keys.add(unq(m[1]));

const missing = new Map();
const literal = /'((?:[^'\\]|\\.)*)'\s*\|\s*t\b/g;
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(literal)) {
    // inline TS templates escape quotes twice; undo both layers
    const key = unq(unq(m[1]));
    if (!/[A-Za-zÄÖÜäöüß]{2}/.test(key)) continue;
    if (!keys.has(key)) missing.set(key, file.replace(root, ''));
  }
}

if (missing.size) {
  console.log(`${missing.size} template string(s) without a German translation:`);
  for (const [k, f] of missing) console.log(`  ${f}: ${k}`);
  process.exit(1);
}
console.log(`i18n ok — ${keys.size} entries, every template literal is translated.`);
