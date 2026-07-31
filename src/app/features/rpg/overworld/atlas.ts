/**
 * Maps the game's {@link TileKind}s and character keys onto the CC0
 * **Ninja Adventure** asset pack by pixel-boy & AAA (see public/rpg/LICENSE.md):
 * a 28-column outdoor master sheet, patterned interior floors and room-frame
 * walls, plus 16 px characters with real 4-direction walk frames. Water and
 * tall-grass sway stay procedural (animated) on top of the tile art. Paths and
 * interior walls pick their tile from rounded 3×3 blob blocks via a pure
 * neighbor-mask helper, so roads and rooms read hand-drawn. Pure data + math —
 * the Pixi renderer turns these into textures.
 */
import type { TileKind } from '../../../game/rpg/rpg-types';

export type Sheet = 'world' | 'interior' | 'wall';
export const SHEET_URL: Record<Sheet, string> = {
  world: 'rpg/tilesets/nj-world.png',
  interior: 'rpg/tilesets/nj-interior.png',
  wall: 'rpg/tilesets/nj-wall.png',
};
/** Tile columns per packed sheet (indices are `col + row * cols`). */
export const SHEET_COLS: Record<Sheet, number> = { world: 28, interior: 22, wall: 10 };
export const TILE_PX = 16;

/** Index helpers — (col, row) → atlas index on a given sheet. */
const W = (c: number, r: number): number => c + r * SHEET_COLS.world;
const I = (c: number, r: number): number => c + r * SHEET_COLS.interior;
const L = (c: number, r: number): number => c + r * SHEET_COLS.wall;

/** A tile is drawn from an atlas, procedurally, or with a tint over a base. */
export type TileArt =
  | { readonly sheet: Sheet; readonly i: number; readonly tint?: number; readonly over?: TileArt }
  | { readonly proc: 'water' | 'tallgrass' };

const T = (sheet: Sheet, i: number, tint?: number): TileArt => ({ sheet, i, tint });

/** Grass underlays most outdoor decorations so trees/flowers/signs sit on green. */
export const GRASS: TileArt = T('world', W(22, 11));
/**
 * Occasional grass texture variants for a living, hand-planted meadow: the two
 * pack grass tiles plus subtle colour-graded tints (pale sun-bleached patches,
 * deeper shade, warm early-autumn) so no two clumps read exactly alike.
 */
export const GRASS_VARIANTS: readonly TileArt[] = [
  T('world', W(24, 11)),
  T('world', W(22, 11), 0xd6f0c6),
  T('world', W(24, 11), 0xc2e6a8),
  T('world', W(22, 11), 0xbfe0c4),
  T('world', W(24, 11), 0xe6f0b8),
];
export const INDOOR_FLOOR: TileArt = T('interior', I(1, 1));

/**
 * Colour-graded wildflowers scattered sparsely across open grass. All reuse the
 * pack's blossom tile, re-tinted into a cottage-garden spread — scarlet, gold,
 * blush pink and lavender — so meadows bloom with variety, not one repeated dot.
 */
export const FLOWER_VARIANTS: readonly TileArt[] = [
  T('world', W(14, 9)),
  T('world', W(14, 9), 0xff8f8f),
  T('world', W(14, 9), 0xffe27a),
  T('world', W(14, 9), 0xff9ec8),
  T('world', W(14, 9), 0xc7a8ff),
];

export const TILE_ART: Record<TileKind, TileArt> = {
  grass: GRASS,
  tallgrass: { proc: 'tallgrass' },
  path: T('world', W(21, 16)), // blob center; edges resolved via pathAutoIndex
  sand: T('world', W(21, 11)),
  water: { proc: 'water' },
  tree: T('world', W(3, 8)), // solo fallback; rows fuse pine halves in the renderer
  flower: T('world', W(14, 9)),
  fence: T('world', W(21, 1)),
  sign: T('world', W(16, 8)),
  house: T('world', W(0, 2)),
  roof: T('world', W(1, 1)),
  door: T('world', W(0, 2)), // wall base; DOOR_OVERLAY is drawn on top
  wall: T('wall', L(7, 0)), // band; corners/sides resolved via wallAutoIndex
  floor: INDOOR_FLOOR,
  rug: T('interior', I(5, 1)),
  counter: T('world', W(25, 8)),
  ledge: T('world', W(12, 17)), // grass lip over a cliff face — the drop reads
  // decorative obstacles — drawn procedurally in the renderers; the grass base
  // pass sits underneath, so these entries are only a harmless fallback tile.
  rock: GRASS,
  bush: GRASS,
  stump: GRASS,
};

/** Self-contained round tree for isolated trunks and odd row ends. */
export const TREE_SOLO = W(3, 8);
/**
 * Two-tile-tall pine, split into left/right halves: tree *rows* alternate the
 * halves so every pair fuses into one full conifer — a dense forest hedge.
 * Tops land on the canopy layer one tile above, overlapping walkers.
 */
export const PINE = {
  topL: W(4, 10), topR: W(5, 10),
  botL: W(4, 11), botR: W(5, 11),
} as const;
/** Stand-alone door leaf, drawn over the wall/floor base tile. */
export const DOOR_OVERLAY = W(26, 9);
/** Tall-grass tuft (transparent bg), drawn over grass and swayed procedurally. */
export const TALLGRASS_TUFT = W(9, 15);
/** Lily pad decor sprinkled onto still water (opaque — matches WATER_BASE). */
export const LILY_PAD = W(23, 8);

/** Procedural water palette, sampled from the pack so decor tiles blend in. */
export const WATER_BASE = 0x72c4e6;
export const WATER_DEEP = 0x43b1de;
export const WATER_RIPPLE = 0xa9e2f5;
export const WATER_GLINT = 0xf2fbff;

/** Outdoor decorations that should be drawn on top of a grass tile. */
export const GROUNDED: ReadonlySet<TileKind> = new Set(['tree', 'flower', 'sign', 'fence']);

/* ------------------------------------------------------------- autotiling */

/**
 * Resolve a 3×3 rounded-blob block from same-kind neighbor presence: a missing
 * neighbor on a side puts the rounded edge there; no neighbors at all yields
 * the stand-alone blob. 1-wide corridors fall back to the block's mid row/col.
 */
function blob(
  b: { tl: number; t: number; tr: number; l: number; c: number; r: number; bl: number; b: number; br: number; solo: number },
  n: boolean, e: boolean, s: boolean, w: boolean,
): number {
  if (!n && !e && !s && !w) return b.solo;
  const row = n ? (s ? 1 : 2) : s ? 0 : 1;
  const col = w ? (e ? 1 : 2) : e ? 0 : 1;
  return [
    [b.tl, b.t, b.tr],
    [b.l, b.c, b.r],
    [b.bl, b.b, b.br],
  ][row][col];
}

const PATH_BLOB = {
  tl: W(20, 15), t: W(21, 15), tr: W(22, 15),
  l: W(20, 16), c: W(21, 16), r: W(22, 16),
  bl: W(20, 17), b: W(21, 17), br: W(22, 17),
  solo: W(19, 15),
};

const WALL_BLOB = {
  tl: L(5, 0), t: L(7, 0), tr: L(9, 0),
  l: L(5, 1), c: L(7, 0), r: L(9, 1),
  bl: L(5, 4), b: L(7, 4), br: L(9, 4),
  solo: L(7, 0),
};

/** Path tile index for the given same-kind (path/door) neighbor mask. */
export function pathAutoIndex(n: boolean, e: boolean, s: boolean, w: boolean): number {
  return blob(PATH_BLOB, n, e, s, w);
}

/**
 * Interior wall tile index. Corners/junctions come from the room frame's 3×3;
 * 1-thick runs can't be expressed by a blob, so they take a floor-side hint:
 * vertical runs face their side piece toward the floor, horizontal runs use
 * the frame's bottom band when the room lies north of the wall.
 */
export function wallAutoIndex(
  n: boolean, e: boolean, s: boolean, w: boolean,
  floorEast = true, floorNorth = false,
): number {
  if (n && s && !e && !w) return floorEast ? WALL_BLOB.l : WALL_BLOB.r;
  if (!n && !s) return floorNorth ? WALL_BLOB.b : WALL_BLOB.t;
  return blob(WALL_BLOB, n, e, s, w);
}

/** Deterministic per-tile hash for sprinkling grass variants / lily pads. */
export function tileHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

/* ------------------------------------------------------------- characters */

/** Character/NPC sprite key → its 4×N walk sheet (cols: down, up, left, right). */
export const CHAR_SHEETS: Record<string, string> = {
  boy: 'rpg/tilesets/nj-char-boy.png',
  girl: 'rpg/tilesets/nj-char-girl.png',
  prof: 'rpg/tilesets/nj-char-prof.png',
  nurse: 'rpg/tilesets/nj-char-nurse.png',
  clerk: 'rpg/tilesets/nj-char-clerk.png',
  leader: 'rpg/tilesets/nj-char-leader.png',
  oldman: 'rpg/tilesets/nj-char-oldman.png',
};
export const CHAR_DEFAULT = 'boy';
/** Walk cycle length on the 4×7 sheets (rows 0–3; rows 4+ are poses we skip). */
export const CHAR_WALK_FRAMES = 4;
export const CHAR_DIR_COL: Record<'down' | 'up' | 'left' | 'right', number> = {
  down: 0, up: 1, left: 2, right: 3,
};

export function charSheetUrl(key: string): string {
  return CHAR_SHEETS[key] ?? CHAR_SHEETS[CHAR_DEFAULT];
}

/** Pixel rect (x,y,w,h) of an atlas index within its packed sheet. */
export function frameRect(sheet: Sheet, i: number): { x: number; y: number; w: number; h: number } {
  const cols = SHEET_COLS[sheet];
  return { x: (i % cols) * TILE_PX, y: Math.floor(i / cols) * TILE_PX, w: TILE_PX, h: TILE_PX };
}

/** Pixel rect of a walk frame on a 4-column character sheet. */
export function charFrameRect(dir: keyof typeof CHAR_DIR_COL, frame: number): { x: number; y: number; w: number; h: number } {
  return { x: CHAR_DIR_COL[dir] * TILE_PX, y: (frame % CHAR_WALK_FRAMES) * TILE_PX, w: TILE_PX, h: TILE_PX };
}
