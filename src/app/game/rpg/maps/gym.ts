import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Oakhaven Gym — beat Leader Chitin for the Hive Badge. Enter at (4,7); the
// door (4,8) returns to town.
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

export const GYM: MapDef = {
  id: 'gym',
  name: 'Oakhaven Gym',
  width: 9,
  height: 10,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 8, to: '@return', toX: 0, toY: 0 }],
  signs: [],
  npcs: [
    {
      id: 'Leader Chitin',
      x: 4,
      y: 1,
      facing: 'down',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Leader Chitin',
        team: [
          { species: 'caterpie', level: 8 },
          { species: 'kakuna', level: 8 },
          { species: 'butterfree', level: 11 },
        ],
        reward: 1200,
        intro: 'Underestimate the swarm at your peril!',
        defeat: 'Impossible… my swarm has fallen. The Hive Badge is yours.',
        flag: 'beat-gym1',
        badge: 'Hive Badge',
        ending: '🎉 You earned your first badge! To be continued — thanks for playing the demo!',
      },
    },
  ],
  items: [],
};
