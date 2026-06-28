import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Route 1 — a vertical path lined with tall grass, a trainer and a hidden Potion.
// North (5,0) ↔ Verdant Town; South (5,13) ↔ Oakhaven (gym town).
const ROWS = [
  'TTTTTPTTTTT',
  'TGG,,P,,GGT',
  'TGG,,P,,GGT',
  'TGG,,P,,GGT',
  'TGGGGPGGGGT',
  'TGGGGPGGGGT',
  'T,,,,P,,,,T',
  'T,,,,P,,,,T',
  'TGGGGPGGGGT',
  'TGGGGPGGGGT',
  'TGG,,P,,GGT',
  'TGG,,P,,GGT',
  'TGGGGPGGGGT',
  'TTTTTPTTTTT',
];

export const ROUTE_1: MapDef = {
  id: 'route-1',
  name: 'Route 1',
  width: 11,
  height: 14,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 5, y: 0, to: 'home-town', toX: 8, toY: 11, toFacing: 'up' },
    { x: 5, y: 13, to: 'gym-town', toX: 6, toY: 1, toFacing: 'down' },
  ],
  signs: [{ x: 6, y: 4, text: 'ROUTE 1 — Oakhaven ahead. Watch the grass!' }],
  npcs: [
    {
      id: 'Lass Mia',
      x: 3,
      y: 5,
      facing: 'right',
      sprite: 'girl',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Lass Mia',
        team: [
          { species: 'pidgey', level: 6 },
          { species: 'oddish', level: 6 },
        ],
        reward: 360,
        intro: 'Hi! Let’s have a quick battle!',
        defeat: 'You’re strong — good luck at the Gym!',
        flag: 'beat-lass',
      },
    },
  ],
  items: [{ x: 8, y: 9, item: 'potion', qty: 1, flag: 'route1-potion' }],
  encounter: {
    rate: 0.24,
    table: [
      { species: 'pidgey', min: 3, max: 6, weight: 4, catchRate: 255 },
      { species: 'rattata', min: 3, max: 6, weight: 4, catchRate: 255 },
      { species: 'caterpie', min: 3, max: 5, weight: 3, catchRate: 255 },
      { species: 'weedle', min: 3, max: 5, weight: 3, catchRate: 255 },
      { species: 'oddish', min: 4, max: 6, weight: 2, catchRate: 235 },
      { species: 'pikachu', min: 4, max: 6, weight: 1, catchRate: 190 },
    ],
  },
};
