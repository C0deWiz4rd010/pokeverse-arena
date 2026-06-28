/** Grid movement, collision, warp & NPC lookups over a {@link MapDef}. Pure. */
import type { Direction, MapDef, NpcDef, TileKind, WarpDef } from './rpg-types';
import { TILE } from './tiles';

export const DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function inBounds(map: MapDef, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function tileAt(map: MapDef, x: number, y: number): TileKind | null {
  return inBounds(map, x, y) ? map.tiles[y][x] : null;
}

export function npcAt(map: MapDef, x: number, y: number): NpcDef | undefined {
  return map.npcs.find((n) => n.x === x && n.y === y);
}

export function warpAt(map: MapDef, x: number, y: number): WarpDef | undefined {
  return map.warps.find((w) => w.x === x && w.y === y);
}

export function signAt(map: MapDef, x: number, y: number): string | undefined {
  return map.signs.find((s) => s.x === x && s.y === y)?.text;
}

/** Can the player stand on (x,y)? In-bounds, a walkable tile, and no NPC there. */
export function canEnter(map: MapDef, x: number, y: number): boolean {
  const t = tileAt(map, x, y);
  if (!t || !TILE[t].walkable) return false;
  return !npcAt(map, x, y);
}

/** The tile coordinate one step in a direction from (x,y). */
export function ahead(x: number, y: number, dir: Direction): { x: number; y: number } {
  const d = DELTA[dir];
  return { x: x + d.dx, y: y + d.dy };
}

export function isTallGrass(map: MapDef, x: number, y: number): boolean {
  const t = tileAt(map, x, y);
  return !!t && !!TILE[t].grass;
}
