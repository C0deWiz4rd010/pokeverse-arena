/**
 * Keeps the German dictionary honest: every literal passed through the `t` pipe in a
 * template (`{{ 'Text' | t }}`, `[title]="'Text' | t"`) must have a German entry.
 *
 *   node tools/i18n-check.mjs         # exit 1 when a literal has no translation
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { DICT_FILES } from './i18n-dict.mjs';
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
const unq = (s) => s.replace(/\\(.)/g, '$1');
const keys = new Set();
/** key → file of its first definition, to report entries defined in more than one dictionary file. */
const definedIn = new Map();
const duplicates = [];
for (const file of DICT_FILES) {
  const text = readFileSync(join(root, 'core/i18n', file), 'utf8');
  const found = [
    ...[...text.matchAll(/^\s*'((?:[^'\\]|\\.)*)':\s*'/gm)].map((m) => ['exact', unq(m[1])]),
    ...[...text.matchAll(/^\s*\[\s*'((?:[^'\\]|\\.)*)',\s*'/gm)].map((m) => ['pattern', unq(m[1])]),
  ];
  for (const [kind, key] of found) {
    const id = `${kind}:${key}`;
    if (definedIn.has(id))
      duplicates.push(`${kind} "${key}" is in ${definedIn.get(id)} and ${file}`);
    else definedIn.set(id, file);
    keys.add(key);
  }
}

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

if (duplicates.length) {
  console.log(
    `${duplicates.length} duplicated dictionary entr${duplicates.length === 1 ? 'y' : 'ies'} (a later file would silently override the earlier one):`,
  );
  for (const d of duplicates) console.log(`  ${d}`);
  process.exit(1);
}

if (missing.size) {
  console.log(`${missing.size} template string(s) without a German translation:`);
  for (const [k, f] of missing) console.log(`  ${f}: ${k}`);
  process.exit(1);
}
console.log(`i18n ok — ${keys.size} entries, every template literal is translated.`);
