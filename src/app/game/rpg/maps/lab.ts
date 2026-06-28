import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Professor's Lab — talk to the Professor (4,2) to choose a starter.
const ROWS = [
  '#########',
  '#.CC.CC.#',
  '#.......#',
  '#.......#',
  '#.......#',
  '#...D...#',
  '#########',
];

export const LAB: MapDef = {
  id: 'lab',
  name: "Prof. Oak's Lab",
  width: 9,
  height: 7,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 5, to: '@return', toX: 0, toY: 0 }],
  signs: [],
  npcs: [
    {
      id: 'Prof. Oak',
      x: 4,
      y: 2,
      facing: 'down',
      sprite: 'prof',
      kind: 'professor',
      script: [{ say: 'How is your partner doing? The world is wide — go and explore!', speaker: 'Prof. Oak' }],
    },
  ],
  items: [],
};
