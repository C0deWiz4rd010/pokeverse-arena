import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Pokémon Center — talk to the nurse (4,2) to heal; door (4,5) returns to town.
const ROWS = [
  '#########',
  '#.CCCCC.#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#...D...#',
  '#########',
];

export const CENTER: MapDef = {
  id: 'center',
  name: 'Pokémon Center',
  width: 9,
  height: 7,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 5, to: '@return', toX: 0, toY: 0 }],
  signs: [],
  npcs: [
    {
      id: 'Nurse',
      x: 4,
      y: 2,
      facing: 'down',
      sprite: 'nurse',
      kind: 'heal',
      script: [],
    },
  ],
  items: [],
};
