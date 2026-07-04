import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Mistfall Gym — beat Leader Nerida for the Tide Badge (fourth demo badge).
// A hall split by channels of water the challenger walks around.
const ROWS = [
  '#########',
  '#.......#',
  '#.~~.~~.#',
  '#.~~.~~.#',
  '#.......#',
  '#.~~.~~.#',
  '#.~~.~~.#',
  '#.......#',
  '####D####',
  '#########',
];

export const GYM4: MapDef = {
  id: 'gym4',
  name: 'Mistfall Gym',
  width: 9,
  height: 10,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 8, to: '@return', toX: 0, toY: 0 }],
  signs: [],
  npcs: [
    {
      id: 'Leader Nerida',
      x: 4,
      y: 1,
      facing: 'down',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Leader Nerida',
        team: [
          { species: 'wartortle', level: 24 },
          { species: 'starmie', level: 25 },
          { species: 'gyarados', level: 27 },
        ],
        reward: 3400,
        intro: 'The tide takes everything in time. Show me you can hold your ground!',
        defeat: 'You stood firm against the current. The Tide Badge is yours.',
        flag: 'beat-gym4',
        badge: 'Tide Badge',
        ending: '🌊 Four badges! Mistfall bows to you. The horizon holds more — to be continued…',
      },
    },
  ],
  items: [],
};
