import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Stonehollow — second town: Pokémon Center, the Rock Gym, and a Rival battle.
const ROWS = [
  'TTTTTTPTTTTTT',
  'TGGGGGGGGGGGT',
  'TGRRRGGGGGGGT',
  'TGHDHGGGGGGGT',
  'TGGGGGGGGGGGT',
  'TGGGRRRRRGGGT',
  'TGGGRRRRRGGGT',
  'TGGGHHDHHGGGT',
  'TGGGGGGGGGGGT',
  'TTTTTTTTTTTTT',
];

export const STONEHOLLOW: MapDef = {
  id: 'stonehollow',
  name: 'Stonehollow',
  width: 13,
  height: 10,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 6, y: 0, to: 'route-2', toX: 5, toY: 12, toFacing: 'up' },
    { x: 3, y: 3, to: 'center', toX: 4, toY: 4, toFacing: 'up' },
    { x: 6, y: 7, to: 'gym2', toX: 4, toY: 7, toFacing: 'up' },
  ],
  signs: [{ x: 7, y: 4, text: 'STONEHOLLOW GYM — Leader Boulder, the Stone Wall.' }],
  npcs: [
    {
      id: 'Rival Blue',
      x: 9,
      y: 4,
      facing: 'left',
      sprite: 'boy',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Rival Blue',
        team: [
          { species: 'pidgeotto', level: 12 },
          { species: 'ivysaur', level: 14 },
        ],
        reward: 800,
        intro: 'Heh, took you long enough. Let’s see your team!',
        defeat: 'Not bad… I’ll be back stronger.',
        flag: 'beat-rival',
      },
    },
  ],
  items: [],
};
