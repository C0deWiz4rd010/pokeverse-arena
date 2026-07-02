import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// 16×13 starter town. Top-left house = the player's home; a pond, a tall-grass
// patch, plus Lab / Center / Mart buildings (interiors wired in later phases).
const ROWS = [
  'TTTTTTTTTTTTTTTT',
  'TGGGGGGGGGGGGGGT',
  'TGRRRGGGGGGRRRGT',
  'TGHDHGGGGGGHDHGT',
  'TGGGGG!GGGGGGGGT',
  'TGGGGG~~~~GGGGGT',
  'TGGGGG~~~~GGGGGT',
  'TGRRRGGGGGGRRRGT',
  'TGHDHGGGGGGHDHGT',
  'TGGGGGGGGGGGGGGT',
  'TGGGG,,,,,GGGGGT',
  'TGGGGGGGPGGGGGGT',
  'TTTTTTTTPTTTTTTT',
];

export const HOME_TOWN: MapDef = {
  id: 'home-town',
  name: 'Verdant Town',
  width: 16,
  height: 13,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    // Player's house door → back into the bedroom.
    { x: 3, y: 3, to: 'player-home', toX: 3, toY: 5, toFacing: 'up' },
    // Pokémon Center (bottom-left building) and Poké Mart (bottom-right building).
    { x: 3, y: 8, to: 'center', toX: 4, toY: 4, toFacing: 'up' },
    { x: 12, y: 8, to: 'mart', toX: 4, toY: 4, toFacing: 'up' },
    // Prof. Oak's Lab (top-right building).
    { x: 12, y: 3, to: 'lab', toX: 4, toY: 4, toFacing: 'up' },
    // South gate → Route 1.
    { x: 8, y: 12, to: 'route-1', toX: 5, toY: 1, toFacing: 'down' },
  ],
  signs: [{ x: 6, y: 4, text: 'VERDANT TOWN — where every journey begins.' }],
  npcs: [
    {
      id: 'Youngster',
      x: 10,
      y: 4,
      facing: 'down',
      sprite: 'boy',
      kind: 'talk',
      wander: 2,
      script: [
        { say: 'The tall grass south of town is full of wild Pokémon!' },
        { say: 'Weaken them first, then throw a Poké Ball to catch them.' },
      ],
    },
    {
      id: 'Gardener Ivy',
      x: 8,
      y: 9,
      facing: 'left',
      sprite: 'girl',
      kind: 'talk',
      wander: 2,
      script: [
        { say: 'I love watching the flowers sway… oh! A trainer!' },
        { say: 'They say a ranger guards the road south of Stonehollow.' },
      ],
    },
    {
      id: 'Bug Catcher Sam',
      x: 6,
      y: 11,
      facing: 'up',
      sprite: 'boy',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Bug Catcher Sam',
        team: [
          { species: 'caterpie', level: 4 },
          { species: 'weedle', level: 4 },
        ],
        reward: 240,
        intro: 'My bugs are hungry for a battle!',
        defeat: 'Whoa, you and your team are tough!',
        flag: 'beat-bugcatcher',
      },
    },
  ],
  items: [],
  encounter: {
    rate: 0.32,
    table: [
      { species: 'pidgey', min: 2, max: 4, weight: 4, catchRate: 255 },
      { species: 'rattata', min: 2, max: 4, weight: 4, catchRate: 255 },
      { species: 'caterpie', min: 2, max: 3, weight: 3, catchRate: 255 },
      { species: 'weedle', min: 2, max: 3, weight: 3, catchRate: 255 },
      { species: 'oddish', min: 3, max: 5, weight: 2, catchRate: 235 },
    ],
  },
};
