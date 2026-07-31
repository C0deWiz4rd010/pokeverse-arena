/** ASCII legend → TileKind, so maps can be authored as readable string rows. */
import type { TileKind } from '../rpg-types';

export const LEGEND: Record<string, TileKind> = {
  '.': 'floor',
  G: 'grass',
  ',': 'tallgrass',
  P: 'path',
  S: 'sand',
  '~': 'water',
  T: 'tree',
  '#': 'wall',
  r: 'rug',
  D: 'door',
  '!': 'sign',
  C: 'counter',
  R: 'roof',
  H: 'house',
  '=': 'fence',
  f: 'flower',
  L: 'ledge',
  o: 'rock',
  b: 'bush',
  u: 'stump',
};

/** Parse equal-length string rows into a row-major TileKind grid. */
export function parseTiles(rows: readonly string[]): TileKind[][] {
  return rows.map((row) => [...row].map((ch) => LEGEND[ch] ?? 'grass'));
}
