import { Injectable, computed, effect, signal } from '@angular/core';
import { safeGet, safeSet } from '../storage/safe-storage';

export type Locale = 'en' | 'de';
export const LOCALES: readonly { readonly code: Locale; readonly label: string; readonly short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'de', label: 'Deutsch', short: 'DE' },
];

const STORAGE_KEY = 'pv:locale';

interface GermanBundle {
  readonly DE: Readonly<Record<string, string>>;
  readonly DE_PATTERNS: readonly (readonly [string, string])[];
}

/** The browser's preferred language, narrowed to what the app ships. */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  const first = (languages?.[0] ?? '').toLowerCase();
  return first.startsWith('de') ? 'de' : 'en';
}

/** Replace `{0}`, `{1}` / `{name}` placeholders with the given values. */
export function interpolate(template: string, params?: readonly unknown[] | Readonly<Record<string, unknown>>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = Array.isArray(params) ? params[Number(key)] : (params as Record<string, unknown>)[key];
    return v === undefined || v === null ? whole : String(v);
  });
}

interface CompiledPattern {
  readonly re: RegExp;
  readonly de: string;
  /** Slot names in English order ('' for anonymous `{}`), used to resolve `{name}` in the German text. */
  readonly names: readonly string[];
  /** Number of literal characters — more specific sentences are tried first. */
  readonly weight: number;
}

const SLOT = /\{(\w*)\}/g;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
/** A capture that is only digits / punctuation needs no translation. */
const NO_LETTERS = /^[\d\s.,%×+\-–/:]*$/;

function compilePattern(en: string, de: string): CompiledPattern {
  const names: string[] = [];
  let weight = 0;
  let source = '';
  let last = 0;
  for (const m of en.matchAll(SLOT)) {
    const literal = en.slice(last, m.index);
    weight += literal.length;
    source += literal.replace(REGEX_SPECIALS, '\\$&') + '(.+?)';
    names.push(m[1] ?? '');
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = en.slice(last);
  weight += tail.length;
  source += tail.replace(REGEX_SPECIALS, '\\$&');
  return { re: new RegExp('^' + source + '$', 's'), de, names, weight };
}

/**
 * Light-weight, gettext-style translation. The English source text *is* the key;
 * German lives in `de.ts`. Anything not translated falls back to the English text,
 * so partially translated screens degrade gracefully. Sentences with dynamic parts
 * (`{} fell asleep!`) are matched through patterns, and their captured pieces
 * (names, stats) are translated recursively.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(this.initial());
  readonly isGerman = computed(() => this.locale() === 'de');
  private patterns: CompiledPattern[] | null = null;
  private readonly memo = new Map<string, string>();
  /** Loaded lazily; a signal so views re-render the moment German arrives. */
  private readonly bundle = signal<GermanBundle | null>(null);
  private loading: Promise<void> | null = null;

  constructor() {
    effect(() => {
      const loc = this.locale();
      if (typeof document !== 'undefined') document.documentElement.lang = loc;
    });
    if (this.locale() === 'de') void this.load();
  }

  /** Resolves once the active language is ready to use (instant for English). */
  ready(): Promise<void> {
    return this.locale() === 'de' ? this.load() : Promise.resolve();
  }

  set(locale: Locale): Promise<void> {
    this.locale.set(locale);
    safeSet(STORAGE_KEY, locale);
    return this.ready();
  }

  toggle(): Promise<void> {
    return this.set(this.locale() === 'de' ? 'en' : 'de');
  }

  private load(): Promise<void> {
    return (this.loading ??= import('./de.bundle')
      .then((b) => {
        this.bundle.set(b);
      })
      .catch(() => {
        this.loading = null; // offline / chunk missing: stay English, retry on the next switch
      }));
  }

  /** Translate `text` (reads the locale signal, so templates/computeds re-run on a switch). */
  t(text: string, params?: readonly unknown[] | Readonly<Record<string, unknown>>): string {
    const dict = this.locale() === 'de' ? this.bundle() : null;
    const base = dict ? this.translate(text, 0, dict) : text;
    return interpolate(base, params);
  }

  /** Exact dictionary hit, else a sentence pattern (`{}` slots), else the English text. */
  private translate(text: string, depth: number, dict: GermanBundle): string {
    const exact = dict.DE[text];
    if (exact !== undefined) return exact;
    const cached = this.memo.get(text);
    if (cached !== undefined) return cached;

    let result = text;
    if (depth < 2 && /[A-Za-z]{2}/.test(text)) {
      const trimmed = text.trim();
      const known = trimmed !== text ? dict.DE[trimmed] : undefined;
      if (known !== undefined) {
        result = text.replace(trimmed, known);
      } else {
        for (const p of this.compiled(dict)) {
          const m = p.re.exec(text);
          if (!m) continue;
          let next = 0;
          result = p.de.replace(SLOT, (_whole, name: string) => {
            const idx = name === '' ? next++ : /^\d+$/.test(name) ? Number(name) - 1 : p.names.indexOf(name);
            const cap = m[idx + 1];
            if (cap === undefined) return '';
            return NO_LETTERS.test(cap) ? cap : this.translate(cap, depth + 1, dict);
          });
          break;
        }
        // "Speaker: line" — translate each side on its own.
        if (result === text) {
          const sep = text.indexOf(': ');
          if (sep > 0 && sep < 40) {
            const head = this.translate(text.slice(0, sep), depth + 1, dict);
            const tail = this.translate(text.slice(sep + 2), depth + 1, dict);
            if (head !== text.slice(0, sep) || tail !== text.slice(sep + 2)) result = head + ': ' + tail;
          }
        }
      }
    }
    if (this.memo.size > 4000) this.memo.clear();
    this.memo.set(text, result);
    return result;
  }

  private compiled(dict: GermanBundle): CompiledPattern[] {
    return (this.patterns ??= dict.DE_PATTERNS.map(([en, de]) => compilePattern(en, de)).sort((a, b) => b.weight - a.weight));
  }

  private initial(): Locale {
    const stored = safeGet(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
    return detectLocale(typeof navigator === 'undefined' ? undefined : (navigator.languages ?? [navigator.language]));
  }
}
