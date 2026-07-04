import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Route 4 — a rain-swept coastal path south of Sunreach, where the desert gives
// way to the sea. Tall grass hides day-and-night wilds; one Ranger patrols.
// North (5,0) ↔ Sunreach; South (5,13) ↔ Mistfall Town.
const ROWS = [
  'TTTTTPTTTTT',
  'TGG,,P,,GGT',
  'TGG,,P,,GGT',
  'T,,,,P,,,,T',
  'T,,,,P,,,,T',
  'TGGGGPGGGGT',
  'TLLLLPLLLLT',
  'TGGGGPGGGGT',
  'T,,,,P,,,,T',
  'T,,,,P,,,,T',
  'TGG,,P,,GGT',
  'TGGGGPGGGGT',
  'TGGGGPGGGGT',
  'TTTTTPTTTTT',
];

export const ROUTE_4: MapDef = {
  id: 'route-4',
  name: 'Route 4',
  width: 11,
  height: 14,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 5, y: 0, to: 'sunreach', toX: 6, toY: 10, toFacing: 'up' },
    { x: 5, y: 13, to: 'mistfall', toX: 6, toY: 1, toFacing: 'down' },
  ],
  signs: [{ x: 6, y: 5, text: 'ROUTE 4 — the sea air stirs different Pokémon by day and night.' }],
  npcs: [
    {
      id: 'Ranger Coralie',
      x: 3,
      y: 8,
      facing: 'right',
      sprite: 'girl',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Ranger Coralie',
        team: [
          { species: 'wingull', level: 20 },
          { species: 'lombre', level: 21 },
        ],
        reward: 1100,
        intro: 'The coast is my beat — prove you belong here!',
        defeat: 'The tide favours you. Mistfall lies just south.',
        flag: 'beat-ranger-coralie',
        sight: 4,
      },
    },
  ],
  items: [{ x: 8, y: 3, item: 'super-potion', qty: 1, flag: 'route4-superpotion' }],
  weather: 'rain',
  encounter: {
    rate: 0.26,
    table: [
      // Any time
      { species: 'rattata', min: 16, max: 20, weight: 3, catchRate: 255 },
      { species: 'wingull', min: 17, max: 21, weight: 3, catchRate: 190 },
      // Daytime only — sun-loving shore dwellers
      { species: 'psyduck', min: 17, max: 21, weight: 3, catchRate: 190, time: 'day' },
      { species: 'meowth', min: 16, max: 20, weight: 2, catchRate: 255, time: 'day' },
      { species: 'staryu', min: 18, max: 22, weight: 1, catchRate: 225, time: 'day' },
      // Nighttime only — things that stir after dark
      { species: 'zubat', min: 16, max: 20, weight: 3, catchRate: 255, time: 'night' },
      { species: 'hoothoot', min: 16, max: 20, weight: 2, catchRate: 255, time: 'night' },
      { species: 'murkrow', min: 18, max: 22, weight: 1, catchRate: 30, time: 'night' },
    ],
  },
};
