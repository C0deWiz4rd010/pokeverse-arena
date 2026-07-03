/**
 * Maps the game's {@link TileKind}s and character keys onto Kenney CC0 atlas
 * indices (Tiny Town = outdoors, Tiny Dungeon = interiors + characters). Water
 * and tall grass are rendered procedurally (animated) instead of from an atlas.
 * Pure data — the Pixi renderer turns these into textures.
 */
import type { TileKind } from '../../../game/rpg/rpg-types';

export type Sheet = 'town' | 'dungeon';
export const SHEET_URL: Record<Sheet, string> = {
  town: 'rpg/tilesets/tiny-town.png',
  dungeon: 'rpg/tilesets/tiny-dungeon.png',
};
export const ATLAS_COLS = 12;
export const TILE_PX = 16;

/** A tile is drawn from an atlas, procedurally, or with a tint over a base. */
export type TileArt =
  | { readonly sheet: Sheet; readonly i: number; readonly tint?: number; readonly over?: TileArt }
  | { readonly proc: 'water' | 'tallgrass' };

const T = (sheet: Sheet, i: number, tint?: number): TileArt => ({ sheet, i, tint });

/** Grass underlays most outdoor decorations so trees/flowers/signs sit on green. */
export const GRASS: TileArt = T('town', 0);
export const INDOOR_FLOOR: TileArt = T('dungeon', 48);

export const TILE_ART: Record<TileKind, TileArt> = {
  grass: T('town', 0),
  tallgrass: { proc: 'tallgrass' },
  path: T('town', 40),
  sand: T('town', 39),
  water: { proc: 'water' },
  tree: { sheet: 'town', i: 5, over: undefined }, // round bush, drawn over grass
  flower: { sheet: 'town', i: 2 },
  fence: { sheet: 'town', i: 44 },
  sign: { sheet: 'town', i: 83 },
  house: T('town', 72),
  roof: T('town', 52),
  door: T('town', 85),
  wall: T('dungeon', 40),
  floor: T('dungeon', 48),
  rug: T('dungeon', 63),
  counter: T('dungeon', 72),
  // Tinted earthy so the one-way drop reads differently from a plain path.
  ledge: T('town', 40, 0xc98f5a),
};

/** Outdoor decorations that should be drawn on top of a grass tile. */
export const GROUNDED: ReadonlySet<TileKind> = new Set(['tree', 'flower', 'sign', 'fence']);

/** Character/NPC sprite key → Tiny Dungeon atlas index. */
export const CHAR_ART: Record<string, number> = {
  boy: 98,
  girl: 99,
  prof: 84,
  nurse: 99,
  clerk: 85,
  leader: 87,
  oldman: 100,
  default: 98,
};

export function charIndex(key: string): number {
  return CHAR_ART[key] ?? CHAR_ART['default'];
}

/** Pixel rect (x,y,w,h) of an atlas index within its packed sheet. */
export function frameRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: (i % ATLAS_COLS) * TILE_PX, y: Math.floor(i / ATLAS_COLS) * TILE_PX, w: TILE_PX, h: TILE_PX };
}
