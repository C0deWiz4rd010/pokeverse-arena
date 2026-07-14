/**
 * Persisted Ascension Spire meta-progression: best depth, lifetime coins, clears
 * and the highest ascension tier unlocked. Stored in localStorage for now; the
 * progression backbone folds it into the profile later.
 */
import type { SpireMeta } from './spire-types';

const KEY = 'spire:meta';

export function defaultMeta(): SpireMeta {
  return { bestDepth: 0, runs: 0, clears: 0, bankedCoins: 0, ascension: 0, chimeraWins: 0 };
}

export function loadMeta(): SpireMeta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMeta();
    return { ...defaultMeta(), ...(JSON.parse(raw) as Partial<SpireMeta>) };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: SpireMeta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
}

/** Fold a finished run into the meta record (returns a fresh object). */
export function recordRun(meta: SpireMeta, depth: number, coins: number, cleared: boolean): SpireMeta {
  const next: SpireMeta = {
    ...meta,
    bestDepth: Math.max(meta.bestDepth, depth),
    runs: meta.runs + 1,
    clears: meta.clears + (cleared ? 1 : 0),
    bankedCoins: meta.bankedCoins + Math.max(0, coins),
    // Each clear unlocks the next ascension tier (capped).
    ascension: cleared ? Math.min(10, Math.max(meta.ascension, meta.ascension + 1)) : meta.ascension,
  };
  saveMeta(next);
  return next;
}

/** Mark the start of a run. */
export function startRun(meta: SpireMeta): SpireMeta {
  const next = { ...meta, runs: meta.runs + 1 };
  saveMeta(next);
  return next;
}

/** Chalk up a defeated secret chimera boss. */
export function recordChimeraWin(meta: SpireMeta): SpireMeta {
  const next = { ...meta, chimeraWins: meta.chimeraWins + 1 };
  saveMeta(next);
  return next;
}
