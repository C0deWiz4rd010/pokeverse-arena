// Shared by the i18n tools: loads the German dictionary keys from the TypeScript sources.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const i18nDir = fileURLToPath(new URL('../src/app/core/i18n/', import.meta.url));

/** Every dictionary source file: de.ui.ts, de.data*.ts and de.patterns.ts. */
export const DICT_FILES = readdirSync(i18nDir)
  .filter((n) => /^de\.(ui|data(\..+)?|patterns)\.ts$/.test(n))
  .sort();

const src = DICT_FILES.map((n) => readFileSync(i18nDir + n, 'utf8')).join('\n');

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
