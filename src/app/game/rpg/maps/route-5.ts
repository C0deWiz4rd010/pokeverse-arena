import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Route 5 — "Victory Pass": a snow-swept mountain climb from Mistfall's east
// gate up to Crownspire City. High-level wilds, two ace trainers barring the
// switchbacks, and a ledge shortcut on the way back down. West (0,6) ↔
// Mistfall; north (6,0) ↔ Crownspire.
const ROWS = [
  'TTTTTTPTTTTTT',
  'TGGGGGPGGGGGT',
  'TGG,,,P,,,GGT',
  'TGG,TTPTT,GGT',
  'TGGG,,P,,GGGT',
  'TGLLLGPGLLLGT',
  'PGGGGGPGGGGGT',
  'TGG,,,P,,,GGT',
  'TGG,TTPTT,GGT',
  'TGGG,,P,,GGGT',
  'TGGGGGPGGGGGT',
  'TGG,,GPG,,GGT',
  'TTTTTTPTTTTTT',
];

export const ROUTE_5: MapDef = {
  id: 'route-5',
  name: 'Victory Pass',
  width: 13,
  height: 13,
  outdoor: true,
  tiles: parseTiles(ROWS),
  weather: 'snow',
  warps: [
    { x: 0, y: 6, to: 'mistfall', toX: 11, toY: 7, toFacing: 'left' },
    { x: 6, y: 0, to: 'crownspire', toX: 6, toY: 10, toFacing: 'up' },
  ],
  signs: [{ x: 7, y: 10, text: 'VICTORY PASS — beyond lies Crownspire, seat of the Champion.' }],
  npcs: [
    {
      id: 'Ace Trainer Silas',
      x: 7,
      y: 8,
      facing: 'down',
      sprite: 'boy',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Ace Trainer Silas',
        sight: 3,
        team: [
          { species: 'machoke', level: 27 },
          { species: 'magneton', level: 28 },
        ],
        reward: 1800,
        intro: 'Only the best climb this pass. Prove you belong!',
        defeat: 'Strong… you might actually make it up there.',
        flag: 'beat-ace-silas',
      },
    },
    {
      id: 'Ace Trainer Mira',
      x: 5,
      y: 3,
      facing: 'down',
      sprite: 'girl',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Ace Trainer Mira',
        sight: 3,
        team: [
          { species: 'haunter', level: 28 },
          { species: 'ninetales', level: 29 },
        ],
        reward: 1900,
        intro: 'The snow hides many things. Me, for example!',
        defeat: 'Brr… go on then. Crownspire awaits.',
        flag: 'beat-ace-mira',
      },
    },
  ],
  items: [{ x: 11, y: 11, item: 'hyper-potion', qty: 2, flag: 'route5-hyperpotion' }],
  forage: [{ x: 2, y: 1 }, { x: 10, y: 10 }],
  encounter: {
    rate: 0.3,
    table: [
      { species: 'sneasel', min: 26, max: 30, weight: 3, catchRate: 60 },
      { species: 'graveler', min: 26, max: 29, weight: 3, catchRate: 120 },
      { species: 'machoke', min: 26, max: 30, weight: 2, catchRate: 90 },
      { species: 'jynx', min: 27, max: 30, weight: 1, catchRate: 45, time: 'night' },
      { species: 'lapras', min: 27, max: 30, weight: 1, catchRate: 45, time: 'day' },
      { species: 'snorlax', min: 28, max: 30, weight: 1, catchRate: 25 },
    ],
  },
};
