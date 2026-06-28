import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Poké Mart — talk to the clerk (4,2) to shop; door (4,5) returns to town.
const ROWS = [
  '#########',
  '#.CCCCC.#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#...D...#',
  '#########',
];

export const MART: MapDef = {
  id: 'mart',
  name: 'Poké Mart',
  width: 9,
  height: 7,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 5, to: 'home-town', toX: 12, toY: 9, toFacing: 'down' }],
  signs: [],
  npcs: [
    {
      id: 'Clerk',
      x: 4,
      y: 2,
      facing: 'down',
      sprite: 'clerk',
      kind: 'shop',
      script: [],
    },
  ],
  items: [],
};
