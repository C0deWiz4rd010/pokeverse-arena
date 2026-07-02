import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Sunreach Gym — beat Leader Vala for the Knuckle Badge (third and final demo badge).
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

export const GYM3: MapDef = {
  id: 'gym3',
  name: 'Sunreach Gym',
  width: 9,
  height: 10,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 8, to: '@return', toX: 0, toY: 0 }],
  signs: [],
  npcs: [
    {
      id: 'Leader Vala',
      x: 4,
      y: 1,
      facing: 'down',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Leader Vala',
        team: [
          { species: 'machop', level: 17 },
          { species: 'primeape', level: 18 },
          { species: 'machoke', level: 20 },
        ],
        reward: 2600,
        intro: 'Every dawn I train. Show me your discipline!',
        defeat: 'A worthy fist. Take the Knuckle Badge with pride.',
        flag: 'beat-gym3',
        badge: 'Knuckle Badge',
        ending: '🏆 Three badges — you have conquered the expanded demo. More lands await someday!',
      },
    },
  ],
  items: [],
};
