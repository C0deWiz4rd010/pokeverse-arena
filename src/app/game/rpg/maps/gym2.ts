import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Stonehollow Gym — beat Leader Boulder for the Boulder Badge.
const ROWS = [
  '#########',
  '#...L...#',
  '#.......#',
  '#..rrr..#',
  '#..rrr..#',
  '#.......#',
  '#.......#',
  '#.......#',
  '####D####',
  '#########',
];

export const GYM2: MapDef = {
  id: 'gym2',
  name: 'Stonehollow Gym',
  width: 9,
  height: 10,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 8, to: '@return', toX: 0, toY: 0 }],
  signs: [],
  npcs: [
    {
      id: 'Leader Boulder',
      x: 4,
      y: 1,
      facing: 'down',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Leader Boulder',
        team: [
          { species: 'geodude', level: 12 },
          { species: 'graveler', level: 13 },
          { species: 'onix', level: 15 },
        ],
        reward: 1800,
        intro: 'Break through my stone wall — if you can!',
        defeat: 'Cracked at last. The Boulder Badge is yours.',
        flag: 'beat-gym2',
        badge: 'Boulder Badge',
        ending: '🏆 Two badges! The ranger south of town will let you pass now — Route 3 awaits.',
      },
    },
  ],
  items: [],
};
