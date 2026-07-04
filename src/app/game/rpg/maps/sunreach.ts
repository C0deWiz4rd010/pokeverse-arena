import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Sunreach — third town, baked in desert sun: Center, Mart and the Fighting
// Gym. The journey's current end — flowers and a fountain square.
const ROWS = [
  'TTTTTTPTTTTTT',
  'TSSSSSPSSSSST',
  'TSRRRSSSRRRST',
  'TSHDHSSSHDHST',
  'TSSSSSfSSSSST',
  'TSSf~~~~~fSST',
  'TSSSSSSSSSSST',
  'TSSSRRRRRSSST',
  'TSSSRRRRRSSST',
  'TSSSHHDHHSSST',
  'TSSSSSSSSSSST',
  'TTTTTTPTTTTTT',
];

export const SUNREACH: MapDef = {
  id: 'sunreach',
  name: 'Sunreach',
  width: 13,
  height: 12,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 6, y: 0, to: 'route-3', toX: 6, toY: 11, toFacing: 'up' },
    // Pokémon Center (top-left) and Poké Mart (top-right) reuse the shared interiors.
    { x: 3, y: 3, to: 'center', toX: 4, toY: 4, toFacing: 'up' },
    { x: 10, y: 3, to: 'mart', toX: 4, toY: 4, toFacing: 'up' },
    // Sunreach Gym (bottom building).
    { x: 6, y: 9, to: 'gym3', toX: 4, toY: 7, toFacing: 'up' },
    // South gate → Route 4, sealed until you hold the Knuckle Badge.
    { x: 6, y: 11, to: 'route-4', toX: 5, toY: 1, toFacing: 'down', requiresBadge: 'Knuckle Badge' },
  ],
  signs: [
    { x: 6, y: 4, text: 'SUNREACH GYM — Leader Vala, the Blazing Fist.' },
    { x: 5, y: 10, text: 'SOUTH — Route 4 to Mistfall. Knuckle Badge required.' },
  ],
  npcs: [
    {
      id: 'Fisher Manu',
      x: 9,
      y: 6,
      facing: 'left',
      sprite: 'oldman',
      kind: 'talk',
      wander: 2,
      script: [
        { say: 'The fountain is the only water for miles — and it BITES, I tell you!' },
        { say: 'Got a rod? Face the water and cast. Dragons sleep down there…' },
      ],
    },
    {
      id: 'Ace Trainer Noor',
      x: 3,
      y: 6,
      facing: 'right',
      sprite: 'girl',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Ace Trainer Noor',
        team: [
          { species: 'kadabra', level: 17 },
          { species: 'haunter', level: 17 },
        ],
        reward: 980,
        intro: 'Before the gym, you face me!',
        defeat: 'Your bond with your team shines.',
        flag: 'beat-ace-noor',
      },
    },
  ],
  items: [{ x: 11, y: 10, item: 'full-heal', qty: 1, flag: 'sunreach-fullheal' }],
  // Desert anglers swear the fountain is bottomless.
  fishing: {
    rate: 0.75,
    table: [
      { species: 'magikarp', min: 8, max: 14, weight: 4, catchRate: 255 },
      { species: 'goldeen', min: 10, max: 15, weight: 3, catchRate: 225 },
      { species: 'staryu', min: 12, max: 16, weight: 2, catchRate: 225 },
      { species: 'dratini', min: 12, max: 15, weight: 1, catchRate: 45 },
    ],
  },
  weather: 'sun',
};
