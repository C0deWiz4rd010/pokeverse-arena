import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// 8×8 bedroom. '@' start is (3,4); the door (3,6) leads out to Verdant Town.
const ROWS = [
  '########',
  '#..rr..#',
  '#C.rr.C#',
  '#......#',
  '#......#',
  '#......#',
  '###D####',
  '########',
];

export const PLAYER_HOME: MapDef = {
  id: 'player-home',
  name: 'Home',
  width: 8,
  height: 8,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 3, y: 6, to: 'home-town', toX: 3, toY: 4, toFacing: 'down' }],
  signs: [{ x: 5, y: 2, text: 'A cosy room. The adventure begins!' }],
  npcs: [],
  items: [],
};
