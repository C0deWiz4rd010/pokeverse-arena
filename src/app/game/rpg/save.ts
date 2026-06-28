/**
 * RPG save schema, defaults and validation. One blob persisted by SaveService
 * under `rpg:save`.
 */
import type { RpgSave } from './rpg-types';

export const RPG_SAVE_VERSION = 1;

/** Where a brand-new game begins (the player's bedroom). */
export const START = { map: 'player-home', x: 3, y: 4, facing: 'down' as const };
/** Default whiteout return point (home-town Pokémon Center area), aligned with the authored map. */
export const DEFAULT_RESPAWN = { map: 'home-town', x: 9, y: 9 };

export function defaultSave(name = 'Red'): RpgSave {
  return {
    v: RPG_SAVE_VERSION,
    created: Date.now(),
    name,
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
