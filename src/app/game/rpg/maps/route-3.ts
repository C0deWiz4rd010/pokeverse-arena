import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Route 3 — a wind-scoured desert pass between Stonehollow (north) and
// Sunreach (south). Sandstorm weather, ledges along the road, ground/fighting
// wilds, and two trainers (one watching the road).
const ROWS = [
  'TTTTTTPTTTTT',
  'TSS,,,P,,SST',
  'TSS,,,P,,SST',
  'TSSSSLPSSSST',
  'TS,,,,P,,,ST',
  'TS,,,,P,,,ST',
  'TSSSSSPLSSST',
  'TSS,,,P,,SST',
  'TSS,,,P,,SST',
  'TSSSSSPSSSST',
  'TS,,,,P,,,ST',
  'TSSSSSPSSSST',
  'TTTTTTPTTTTT',
];

export const ROUTE_3: MapDef = {
  id: 'route-3',
  name: 'Route 3',
  width: 12,
  height: 13,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 6, y: 0, to: 'stonehollow', toX: 6, toY: 8, toFacing: 'up' },
    { x: 6, y: 12, to: 'sunreach', toX: 6, toY: 1, toFacing: 'down' },
  ],
  signs: [{ x: 5, y: 4, text: 'ROUTE 3 — sandstorm country. Sunreach lies south.' }],
  npcs: [
    {
      id: 'Ranger Dune',
      x: 8,
      y: 5,
      facing: 'left',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Ranger Dune',
        team: [
          { species: 'sandslash', level: 15 },
          { species: 'cubone', level: 16 },
        ],
        reward: 760,
        intro: 'Only the toughest cross my dunes!',
        defeat: 'You walk the sand like a native…',
        flag: 'beat-ranger-dune',
        sight: 4,
      },
    },
    {
      id: 'Picnicker Roxie',
      x: 3,
      y: 10,
      facing: 'right',
      sprite: 'girl',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Picnicker Roxie',
        team: [
          { species: 'nidorina', level: 15 },
          { species: 'gloom', level: 15 },
        ],
        reward: 700,
        intro: 'A picnic in a sandstorm builds character!',
        defeat: 'Sand in my sandwiches AND a loss…',
        flag: 'beat-picnicker-roxie',
      },
    },
  ],
  items: [
    { x: 9, y: 2, item: 'hyper-potion', qty: 1, flag: 'route3-hyperpotion' },
    { x: 2, y: 8, item: 'ultra-ball', qty: 2, flag: 'route3-ultraballs' },
  ],
  encounter: {
    rate: 0.26,
    table: [
      { species: 'sandshrew', min: 13, max: 16, weight: 3, catchRate: 255 },
      { species: 'diglett', min: 13, max: 15, weight: 3, catchRate: 255 },
      { species: 'cubone', min: 14, max: 16, weight: 2, catchRate: 190 },
      { species: 'machop', min: 14, max: 16, weight: 2, catchRate: 180 },
      { species: 'rhyhorn', min: 15, max: 17, weight: 1, catchRate: 120 },
    ],
  },
  weather: 'sandstorm',
};
