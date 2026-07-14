import { describe, expect, it } from 'vitest';
import {
  CHAR_WALK_FRAMES,
  SHEET_COLS,
  TILE_ART,
  TILE_PX,
  charFrameRect,
  charSheetUrl,
  frameRect,
  pathAutoIndex,
  tileHash,
  wallAutoIndex,
} from './atlas';

const W = (c: number, r: number): number => c + r * SHEET_COLS.world;
const L = (c: number, r: number): number => c + r * SHEET_COLS.wall;

describe('path autotiling (rounded blob)', () => {
  it('is the stand-alone blob with no neighbors', () => {
    expect(pathAutoIndex(false, false, false, false)).toBe(W(19, 15));
  });

  it('picks corners when two adjacent sides are open', () => {
    // path continues east+south → rounded top-left corner
    expect(pathAutoIndex(false, true, true, false)).toBe(W(20, 15));
    // continues west+south → top-right corner
    expect(pathAutoIndex(false, false, true, true)).toBe(W(22, 15));
    // continues north+east → bottom-left corner
    expect(pathAutoIndex(true, true, false, false)).toBe(W(20, 17));
    // continues north+west → bottom-right corner
    expect(pathAutoIndex(true, false, false, true)).toBe(W(22, 17));
  });

  it('picks edges and the center for surrounded tiles', () => {
    expect(pathAutoIndex(true, true, true, true)).toBe(W(21, 16)); // center
    expect(pathAutoIndex(false, true, true, true)).toBe(W(21, 15)); // top edge
    expect(pathAutoIndex(true, true, false, true)).toBe(W(21, 17)); // bottom edge
  });

  it('runs 1-wide corridors through the blob center (worn road)', () => {
    expect(pathAutoIndex(true, false, true, false)).toBe(W(21, 16)); // vertical
    expect(pathAutoIndex(false, true, false, true)).toBe(W(21, 16)); // horizontal
  });
});

describe('wall autotiling', () => {
  it('resolves corners, bands and sides from the room frame', () => {
    expect(wallAutoIndex(false, true, true, false)).toBe(L(5, 0)); // top-left corner
    expect(wallAutoIndex(false, true, false, true)).toBe(L(7, 0)); // horizontal band
    expect(wallAutoIndex(true, false, true, false)).toBe(L(5, 1)); // vertical run (left side)
    expect(wallAutoIndex(true, false, false, true)).toBe(L(9, 4)); // bottom-right corner
    expect(wallAutoIndex(false, false, false, false)).toBe(L(7, 0)); // isolated → band
  });

  it('faces 1-thick runs toward the floor via the hints', () => {
    expect(wallAutoIndex(true, false, true, false, false)).toBe(L(9, 1)); // floor west
    expect(wallAutoIndex(false, true, false, true, true, true)).toBe(L(7, 4)); // room north
  });
});

describe('atlas geometry', () => {
  it('computes frame rects with per-sheet column counts', () => {
    expect(frameRect('world', 0)).toEqual({ x: 0, y: 0, w: TILE_PX, h: TILE_PX });
    expect(frameRect('world', SHEET_COLS.world)).toEqual({ x: 0, y: TILE_PX, w: TILE_PX, h: TILE_PX });
    expect(frameRect('interior', SHEET_COLS.interior + 1)).toEqual({ x: TILE_PX, y: TILE_PX, w: TILE_PX, h: TILE_PX });
    expect(frameRect('wall', 9)).toEqual({ x: 9 * TILE_PX, y: 0, w: TILE_PX, h: TILE_PX });
  });

  it('maps every tile kind to art', () => {
    for (const art of Object.values(TILE_ART)) {
      if ('proc' in art) continue;
      expect(art.i).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('character sheets', () => {
  it('lays out walk frames as direction columns × frame rows', () => {
    expect(charFrameRect('down', 0)).toEqual({ x: 0, y: 0, w: TILE_PX, h: TILE_PX });
    expect(charFrameRect('right', 3)).toEqual({ x: 3 * TILE_PX, y: 3 * TILE_PX, w: TILE_PX, h: TILE_PX });
    // frames wrap so a running cycle can just increment
    expect(charFrameRect('up', CHAR_WALK_FRAMES)).toEqual(charFrameRect('up', 0));
  });

  it('falls back to the hero sheet for unknown keys', () => {
    expect(charSheetUrl('mystery-npc')).toBe(charSheetUrl('boy'));
  });
});

describe('tileHash', () => {
  it('is deterministic and varies across tiles', () => {
    expect(tileHash(3, 9)).toBe(tileHash(3, 9));
    expect(tileHash(3, 9)).not.toBe(tileHash(9, 3));
  });
});
