// Shared by the i18n tools: loads the German dictionary keys from the TypeScript sources.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = ['../src/app/core/i18n/de.ui.ts', '../src/app/core/i18n/de.data.ts']
  .map((p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'))
  .join('\n');

const unescape = (s) => s.replace(/\\(.)/g, '$1');

/** English text → German text (exact entries only). */
export const DICT = new Map();
for (const m of src.matchAll(/^\s*'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',?$/gm)) {
  const en = unescape(m[1]);
  const de = unescape(m[2]);
  if (en !== de) DICT.set(en.trim(), de);
}

/** True when `line` is English text that has a German entry (i.e. a `| t` is missing). */
export const knownEnglish = (line) => DICT.has(line.replace(/^\[[a-z-]+\]\s*/, '').trim());
