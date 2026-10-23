/**
 * Resume support for the roguelike modes (Ascension Spire, Odyssey). A snapshot is written
 * whenever a floor / wave starts and read back — defensively, since it comes from storage — so
 * a reload offers "Continue run". Pure parsing only; the services own the storage calls.
 */
import type { Battler } from '../engine';
import { relicById, type RelicId } from '../spire/relics';
import type { SpireNode } from '../spire/spire-types';

/** State both modes share. */
export interface RunCore {
  readonly seed: string;
  readonly coins: number;
  readonly relics: RelicId[];
  readonly party: Battler[];
  /** Carried HP per party member as a 0..1 fraction. */
  readonly hpFraction: number[];
}

export interface SpireRunSnapshot extends RunCore {
  readonly floor: number;
  readonly choices: SpireNode[];
}

export interface OdysseyRunSnapshot extends RunCore {
  readonly wave: number;
  readonly balls: number;
  readonly isDaily: boolean;
  readonly runUnlocks: number[];
}

const MAX_PARTY = 6;

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;

/** A stored object that has everything the battle engine reads from a {@link Battler}. */
export function isBattlerLike(x: unknown): x is Battler {
  if (!isRecord(x)) return false;
  const stats = x['stats'];
  return (
    typeof x['id'] === 'number' &&
    typeof x['name'] === 'string' &&
    isCount(x['level']) &&
    Array.isArray(x['types']) &&
    Array.isArray(x['moves']) &&
    x['moves'].length > 0 &&
    isRecord(stats) &&
    isCount(stats['hp']) &&
    stats['hp'] > 0
  );
}

export function parseRunCore(raw: unknown): RunCore | null {
  if (!isRecord(raw)) return null;
  const { seed, coins, relics, party, hpFraction } = raw;
  if (typeof seed !== 'string' || !seed || !isCount(coins)) return null;
  if (!Array.isArray(party) || party.length === 0 || party.length > MAX_PARTY) return null;
  if (!party.every(isBattlerLike)) return null;
  const hp: unknown[] = Array.isArray(hpFraction) ? (hpFraction as unknown[]) : [];
  return {
    seed,
    coins,
    relics: Array.isArray(relics)
      ? (relics as unknown[]).filter(
          (r): r is RelicId => typeof r === 'string' && !!relicById(r as RelicId),
        )
      : [],
    party,
    // One entry per member, clamped; a missing entry means full health.
    hpFraction: party.map((_, i) => {
      const f = hp[i];
      return typeof f === 'number' && Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 1;
    }),
  };
}

export function parseSpireRun(raw: unknown): SpireRunSnapshot | null {
  const core = parseRunCore(raw);
  if (!core || !isRecord(raw)) return null;
  const { floor, choices } = raw;
  if (!isCount(floor) || floor < 1) return null;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const valid = choices.every(
    (c) => isRecord(c) && typeof c['id'] === 'string' && typeof c['type'] === 'string',
  );
  if (!valid) return null;
  return { ...core, floor, choices: choices as SpireNode[] };
}

export function parseOdysseyRun(raw: unknown): OdysseyRunSnapshot | null {
  const core = parseRunCore(raw);
  if (!core || !isRecord(raw)) return null;
  const { wave, balls, isDaily, runUnlocks } = raw;
  if (!isCount(wave) || wave < 1 || !isCount(balls)) return null;
  return {
    ...core,
    wave,
    balls,
    isDaily: isDaily === true,
    runUnlocks: Array.isArray(runUnlocks) ? runUnlocks.filter(isCount) : [],
  };
}
