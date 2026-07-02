import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Route 2 — Oakhaven (north) ↔ Stonehollow (south), with a cave branch (9,4)
// and a line-of-sight Hiker. Tougher grass than Route 1.
const ROWS = [
  'TTTTTPTTTTT',
  'TGG,,P,,GGT',
  'TGG,,P,,GGT',
  'TGGGGPGGGGT',
  'TGGGGPPPPDT',
  'T,,,,P,,,,T',
  'T,,,,P,,,,T',
  'TGGGGPGGGGT',
  'TGGGGPGGGGT',
  'TGG,,P,,GGT',
  'TGG,,P,,GGT',
  'TGGGGPGGGGT',
  'TGGGGPGGGGT',
  'TTTTTPTTTTT',
];

export const ROUTE_2: MapDef = {
  id: 'route-2',
  name: 'Route 2',
  width: 11,
  height: 14,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 5, y: 0, to: 'gym-town', toX: 6, toY: 10, toFacing: 'up' },
    { x: 5, y: 13, to: 'stonehollow', toX: 6, toY: 1, toFacing: 'down' },
    { x: 9, y: 4, to: 'cave', toX: 4, toY: 6, toFacing: 'up' },
  ],
  signs: [{ x: 6, y: 3, text: 'ROUTE 2 — a cave cuts east. Stonehollow lies south.' }],
  npcs: [
    {
      id: 'Hiker Bryce',
      x: 3,
      y: 7,
      facing: 'right',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Hiker Bryce',
        team: [
          { species: 'geodude', level: 10 },
          { species: 'machop', level: 11 },
        ],
        reward: 520,
        intro: 'Hah! My rock-hard team will crush you!',
        defeat: 'Crumbled like gravel… well battled.',
        flag: 'beat-hiker',
        sight: 4,
      },
    },
  ],
  items: [{ x: 8, y: 11, item: 'super-potion', qty: 1, flag: 'route2-superpotion' }],
  encounter: {
    rate: 0.26,
    table: [
      { species: 'pidgey', min: 7, max: 10, weight: 3, catchRate: 255 },
      { species: 'spearow', min: 7, max: 10, weight: 3, catchRate: 255 },
      { species: 'ekans', min: 8, max: 11, weight: 2, catchRate: 235 },
      { species: 'sandshrew', min: 8, max: 11, weight: 2, catchRate: 255 },
      { species: 'mankey', min: 8, max: 11, weight: 2, catchRate: 235 },
    ],
  },
  weather: 'rain',
};
