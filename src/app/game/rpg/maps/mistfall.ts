import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Mistfall Town — a fog-wreathed seaside town built around a tidal bay. Center,
// Mart and the Water Gym. The current end of the road: fourth badge, then a
// "to be continued". North (6,0) ↔ Route 4.
const ROWS = [
  'TTTTTTPTTTTTT',
  'TSSSSSPSSSSST',
  'TSRRRSSSRRRST',
  'TSHDHSSSHDHST',
  'TSSSSSSSSSSST',
  'TSS~~~~~~~SST',
  'TSS~~~~~~~SST',
  'TSSSSSSSSSSSP',
  'TSSSRRRRRSSST',
  'TSSSHHDHHSSST',
  'TSSSSSSSSSSST',
  'TTTTTTTTTTTTT',
];

export const MISTFALL: MapDef = {
  id: 'mistfall',
  name: 'Mistfall Town',
  width: 13,
  height: 12,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 6, y: 0, to: 'route-4', toX: 5, toY: 12, toFacing: 'up' },
    { x: 3, y: 3, to: 'center', toX: 4, toY: 4, toFacing: 'up' },
    { x: 9, y: 3, to: 'mart', toX: 4, toY: 4, toFacing: 'up' },
    { x: 6, y: 9, to: 'gym4', toX: 4, toY: 8, toFacing: 'up' },
    // East gate → Victory Pass, sealed until all four badges shine (v2.0).
    { x: 12, y: 7, to: 'route-5', toX: 1, toY: 6, toFacing: 'right', requiresBadge: 'Tide Badge' },
  ],
  signs: [
    { x: 6, y: 4, text: 'MISTFALL GYM — Leader Nerida, Warden of the Tides.' },
    { x: 2, y: 7, text: 'The bay never empties. Cast a line and see what stirs below.' },
  ],
  npcs: [
    {
      id: 'Sailor Bruno',
      x: 10,
      y: 7,
      facing: 'left',
      sprite: 'oldman',
      kind: 'talk',
      wander: 2,
      script: [
        { say: 'Fog this thick, you hear the Pokémon before you see them.' },
        { say: 'Leader Nerida hasn’t lost at home in years. Mind the tide.' },
      ],
    },
    {
      id: 'Swimmer Delta',
      x: 3,
      y: 10,
      facing: 'right',
      sprite: 'girl',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Swimmer Delta',
        team: [
          { species: 'poliwhirl', level: 22 },
          { species: 'seadra', level: 23 },
        ],
        reward: 1300,
        intro: 'Warm up against me before you challenge the gym!',
        defeat: 'You swim against the current well. Go on!',
        flag: 'beat-swimmer-delta',
      },
    },
  ],
  items: [{ x: 11, y: 10, item: 'hyper-potion', qty: 1, flag: 'mistfall-hyperpotion' }],
  weather: 'rain',
  // The tidal bay — anglers pull rarer catches after dark.
  fishing: {
    rate: 0.75,
    table: [
      { species: 'magikarp', min: 15, max: 22, weight: 4, catchRate: 255 },
      { species: 'tentacool', min: 18, max: 23, weight: 3, catchRate: 190 },
      { species: 'horsea', min: 18, max: 24, weight: 2, catchRate: 225, time: 'day' },
      { species: 'shellder', min: 18, max: 24, weight: 2, catchRate: 190, time: 'day' },
      { species: 'chinchou', min: 18, max: 24, weight: 2, catchRate: 190, time: 'night' },
      { species: 'lapras', min: 22, max: 26, weight: 1, catchRate: 45, time: 'night' },
    ],
  },
};
