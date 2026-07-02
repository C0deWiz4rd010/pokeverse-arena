import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Stonehollow — second town: Pokémon Center, the Rock Gym, and a Rival battle.
// The south road (badge-gated) leads on to Route 3 and Sunreach.
const ROWS = [
  'TTTTTTPTTTTTT',
  'TGGGGGGGGGGGT',
  'TGRRRGGGGGGGT',
  'TGHDHGGGGGGGT',
  'TGGGGGGGGGGGT',
  'TGGGRRRRRGGGT',
  'TGGGRRRRRGGGT',
  'TGGGHHDHHGGGT',
  'TGGGGGPGGGGGT',
  'TTTTTTPTTTTTT',
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
    // South road — a ranger turns you back until you hold the Boulder Badge.
    { x: 6, y: 9, to: 'route-3', toX: 6, toY: 1, toFacing: 'down', requiresBadge: 'Boulder Badge' },
  ],
  signs: [
    { x: 7, y: 4, text: 'STONEHOLLOW GYM — Leader Boulder, the Stone Wall.' },
    { x: 5, y: 8, text: 'ROUTE 3 south — badge holders only beyond this point.' },
  ],
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
    {
      id: 'Elder Rowan',
      x: 10,
      y: 2,
      facing: 'down',
      sprite: 'oldman',
      kind: 'talk',
      wander: 2,
      script: [
        { say: 'Brrr… the snow never lets up here.' },
        { say: 'Past the south gate, the desert wind bites even harder.' },
      ],
    },
  ],
  items: [],
  weather: 'snow',
};
