/** Per-tile behaviour: walkability and whether it triggers wild encounters. */
import type { TileKind } from './rpg-types';

export interface TileMeta {
  readonly walkable: boolean;
  /** Tall grass — stepping onto it can roll a wild encounter. */
  readonly grass?: boolean;
}

export const TILE: Record<TileKind, TileMeta> = {
  grass: { walkable: true },
  tallgrass: { walkable: true, grass: true },
  path: { walkable: true },
  sand: { walkable: true },
  floor: { walkable: true },
  rug: { walkable: true },
  door: { walkable: true },
  flower: { walkable: true },
  ledge: { walkable: true },
  water: { walkable: false },
  tree: { walkable: false },
  wall: { walkable: false },
  sign: { walkable: false },
  counter: { walkable: false },
  roof: { walkable: false },
  house: { walkable: false },
  fence: { walkable: false },
};

export function isWalkableTile(t: TileKind): boolean {
  return TILE[t].walkable;
}
export function isGrassTile(t: TileKind): boolean {
  return !!TILE[t].grass;
}
