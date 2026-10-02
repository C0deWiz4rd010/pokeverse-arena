/**
 * RPG save schema, defaults and validation. One blob persisted by SaveService
 * under `rpg:save`.
 */
import { freshNuzlocke } from './nuzlocke';
import type { RpgSave, PartyMon, Direction } from './rpg-types';
import { getMap } from './maps';
import { RESIDUAL_STATUSES } from '../engine/status';

export const RPG_SAVE_VERSION = 1;

/** Where a brand-new game begins (the player's bedroom). */
export const START = { map: 'player-home', x: 3, y: 4, facing: 'down' as const };
/** Default whiteout return point (home-town Pokémon Center area), aligned with the authored map. */
export const DEFAULT_RESPAWN = { map: 'home-town', x: 9, y: 9 };

export function defaultSave(name = 'Red', nuzlocke = false): RpgSave {
  return {
    v: RPG_SAVE_VERSION,
    created: Date.now(),
    name,
    ...(nuzlocke ? { nuzlocke: freshNuzlocke() } : {}),
    map: START.map,
    x: START.x,
    y: START.y,
    facing: START.facing,
    party: [],
    box: [],
    bag: { 'poke-ball': 5, potion: 3 },
    money: 3000,
    flags: {},
    seen: [],
    caught: [],
    badges: [],
    respawn: { ...DEFAULT_RESPAWN },
  };
}

export function isValidSave(s: unknown): s is RpgSave {
  if (!s || typeof s !== 'object') return false;
  const o = s as Partial<RpgSave>;
  return (
    typeof o.map === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    Array.isArray(o.party) &&
    typeof o.money === 'number' &&
    !!o.bag &&
    !!o.flags
  );
}

/* -------------------------------------------------------------- migration */

/**
 * Upgrade an older save to the current shape. `v` 1 is the only version so far;
 * add `if (v < 2) { … }` steps here (never edit past steps) when the schema grows.
 */
export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  // v < 1 (pre-versioned) blobs simply lacked the field.
  if (typeof out['v'] !== 'number') out['v'] = 1;
  return out;
}

/* ---------------------------------------------------------------- sanitise */

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const STATUSES = new Set<string>(['none', 'sleep', 'freeze', 'paralysis', ...RESIDUAL_STATUSES]);

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, fallback: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const clampInt = (x: unknown, lo: number, hi: number, fallback: number): number =>
  Math.min(hi, Math.max(lo, Math.round(num(x, fallback))));

/** Repair one Pokémon, or return null if it can't be salvaged (the caller drops it). */
export function sanitizePartyMon(raw: unknown): PartyMon | null {
  if (!isObj(raw)) return null;
  const species = raw['species'];
  const dexId = num(raw['dexId'], NaN);
  if (typeof species !== 'string' || !species || !Number.isInteger(dexId) || dexId < 1) return null;

  const level = clampInt(raw['level'], 1, 100, 1);
  const maxHp = clampInt(raw['maxHp'], 1, 9999, 1);
  const status = typeof raw['status'] === 'string' && STATUSES.has(raw['status']) ? (raw['status'] as PartyMon['status']) : 'none';
  const mon: PartyMon = {
    uid: typeof raw['uid'] === 'string' && raw['uid'] ? raw['uid'] : `${species}-${dexId}-${level}`,
    species,
    dexId,
    level,
    xp: Math.max(0, Math.round(num(raw['xp'], 0))),
    maxHp,
    currentHp: clampInt(raw['currentHp'], 0, maxHp, maxHp),
    status,
    ...(typeof raw['nickname'] === 'string' && raw['nickname'] ? { nickname: raw['nickname'].slice(0, 20) } : {}),
    ...(typeof raw['heldItem'] === 'string' ? { heldItem: raw['heldItem'] as PartyMon['heldItem'] } : {}),
    ...(raw['shiny'] === true ? { shiny: true } : {}),
  };
  return mon;
}

const monList = (x: unknown): PartyMon[] =>
  (Array.isArray(x) ? x : []).map(sanitizePartyMon).filter((m): m is PartyMon => m !== null);

const intList = (x: unknown): number[] =>
  (Array.isArray(x) ? x : []).filter((n): n is number => Number.isInteger(n));

/**
 * Turn whatever was in storage into a safe, current-version {@link RpgSave}, or
 * null if it's beyond repair. A corrupt Pokémon is dropped rather than crashing
 * the HUD/battle later; unknown maps send the player back to the start.
 */
export function sanitizeSave(raw: unknown): RpgSave | null {
  if (!isObj(raw)) return null;
  const s = migrateSave(raw);
  if (typeof s['map'] !== 'string' || !isObj(s['bag']) || !isObj(s['flags'])) return null;
  if (!Array.isArray(s['party'])) return null;

  const base = defaultSave(typeof s['name'] === 'string' && s['name'] ? s['name'].slice(0, 20) : 'Red');
  const mapKnown = !!getMap(s['map']);
  const bag: RpgSave['bag'] = {};
  for (const [k, v] of Object.entries(s['bag'])) {
    const n = Math.floor(num(v, 0));
    if (n > 0) (bag as Record<string, number>)[k] = Math.min(n, 999);
  }
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(s['flags'])) if (v === true) flags[k] = true;

  const respawn = isObj(s['respawn']) && typeof s['respawn']['map'] === 'string' && getMap(s['respawn']['map'])
    ? { map: s['respawn']['map'], x: clampInt(s['respawn']['x'], 0, 999, DEFAULT_RESPAWN.x), y: clampInt(s['respawn']['y'], 0, 999, DEFAULT_RESPAWN.y) }
    : { ...DEFAULT_RESPAWN };

  const out: RpgSave = {
    ...(s as unknown as Partial<RpgSave>),
    v: RPG_SAVE_VERSION,
    created: num(s['created'], base.created),
    name: base.name,
    map: mapKnown ? s['map'] : START.map,
    x: mapKnown ? clampInt(s['x'], 0, 999, START.x) : START.x,
    y: mapKnown ? clampInt(s['y'], 0, 999, START.y) : START.y,
    facing: DIRECTIONS.includes(s['facing'] as Direction) ? (s['facing'] as Direction) : 'down',
    party: monList(s['party']).slice(0, 6),
    box: monList(s['box']),
    bag,
    money: Math.max(0, Math.round(num(s['money'], base.money))),
    flags,
    seen: intList(s['seen']),
    caught: intList(s['caught']),
    badges: (Array.isArray(s['badges']) ? s['badges'] : []).filter((b): b is string => typeof b === 'string'),
    respawn,
  };
  if (out.nuzlocke && !(isObj(out.nuzlocke) && Array.isArray((out.nuzlocke as { fallen?: unknown }).fallen))) delete out.nuzlocke;
  return out;
}
