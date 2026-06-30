import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Rocky Cave — encounters on every step (everywhere). Holds a Great Ball.
const ROWS = [
  '###########',
  '#.........#',
  '#.##...##.#',
  '#.........#',
  '#.##...##.#',
  '#.........#',
  '#.........#',
  '####D######',
  '###########',
];

export const CAVE: MapDef = {
  id: 'cave',
  name: 'Rocky Cave',
  width: 11,
  height: 9,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 7, to: 'route-2', toX: 9, toY: 5, toFacing: 'down' }],
  signs: [],
  npcs: [],
  items: [{ x: 8, y: 1, item: 'great-ball', qty: 1, flag: 'cave-greatball' }],
  encounter: {
    rate: 0.16,
    everywhere: true,
    table: [
      { species: 'geodude', min: 9, max: 13, weight: 4, catchRate: 235 },
      { species: 'zubat', min: 9, max: 13, weight: 4, catchRate: 235 },
      { species: 'machop', min: 10, max: 13, weight: 2, catchRate: 215 },
      { species: 'onix', min: 10, max: 12, weight: 1, catchRate: 120 },
    ],
  },
};
