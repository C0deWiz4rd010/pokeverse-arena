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
  'TGGGGGGGGGGGGGGT',
  'TTTTTTTTTTTTTTTT',
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
  ],
  signs: [{ x: 6, y: 4, text: 'VERDANT TOWN — where every journey begins.' }],
  npcs: [],
  items: [],
};
