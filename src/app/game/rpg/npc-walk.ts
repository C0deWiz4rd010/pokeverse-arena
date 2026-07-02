/**
 * Wandering NPCs — a pure runtime-position layer over a map's static NPC
 * definitions. NPCs marked with `wander` amble a few tiles around their home;
 * everyone else stays put. The service owns the positions record and re-runs
 * {@link stepWanderers} after each player step; renderers and interaction read
 * positions from it instead of the static defs.
 */
import type { Direction, MapDef, NpcDef } from './rpg-types';
import { DELTA, inBounds, tileAt, warpAt } from './movement';
import { TILE } from './tiles';

export interface NpcRuntime {
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
}

/** npc id → current position/facing. Always holds every NPC on the map. */
export type NpcPositions = Record<string, NpcRuntime>;

const DIRS: readonly Direction[] = ['up', 'down', 'left', 'right'];
/** Chance per player step that a wanderer acts (move or turn). */
const ACT_CHANCE = 0.45;

/** Seed runtime positions from a map's static NPC definitions. */
export function initNpcPositions(map: MapDef): NpcPositions {
  const out: NpcPositions = {};
  for (const npc of map.npcs) out[npc.id] = { x: npc.x, y: npc.y, facing: npc.facing };
  return out;
}

/** The NPC definition currently standing on (x,y), if any. */
export function npcAtRuntime(
  map: MapDef,
  positions: NpcPositions,
  x: number,
  y: number,
): NpcDef | undefined {
  return map.npcs.find((n) => {
    const p = positions[n.id] ?? n;
    return p.x === x && p.y === y;
  });
}

/** Like movement's canEnter, but NPC blocking uses the runtime positions. */
export function canEnterRuntime(map: MapDef, positions: NpcPositions, x: number, y: number): boolean {
  const t = tileAt(map, x, y);
  if (!t || !TILE[t].walkable) return false;
  return !npcAtRuntime(map, positions, x, y);
}

/**
 * Advance every wandering NPC by at most one tile. A wanderer acts with
 * {@link ACT_CHANCE}: it turns to a random direction and steps if the target is
 * walkable, inside its home radius, free of the player, other NPCs, warps and
 * ground items (blocked steps become a turn on the spot). `rand` ∈ [0,1).
 */
export function stepWanderers(
  map: MapDef,
  positions: NpcPositions,
  player: { readonly x: number; readonly y: number },
  rand: () => number,
): NpcPositions {
  const next: Record<string, NpcRuntime> = { ...positions };
  for (const npc of map.npcs) {
    const range = npc.wander ?? 0;
    if (range <= 0) continue;
    const cur = next[npc.id] ?? { x: npc.x, y: npc.y, facing: npc.facing };
    if (rand() >= ACT_CHANCE) continue;
    const dir = DIRS[Math.min(3, Math.floor(rand() * 4))];
    const d = DELTA[dir];
    const tx = cur.x + d.dx;
    const ty = cur.y + d.dy;
    const inRange = Math.abs(tx - npc.x) <= range && Math.abs(ty - npc.y) <= range;
    const free =
      inBounds(map, tx, ty) &&
      inRange &&
      TILE[tileAt(map, tx, ty)!].walkable &&
      !warpAt(map, tx, ty) &&
      !(player.x === tx && player.y === ty) &&
      !Object.entries(next).some(([id, p]) => id !== npc.id && p.x === tx && p.y === ty) &&
      !map.items.some((it) => it.x === tx && it.y === ty);
    next[npc.id] = free ? { x: tx, y: ty, facing: dir } : { ...cur, facing: dir };
  }
  return next;
}
