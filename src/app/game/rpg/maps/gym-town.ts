import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Oakhaven — the gym town. Center, Mart and the Gym. North (6,0) ↔ Route 1.
const ROWS = [
  'TTTTTTPTTTTTT',
  'TGGGGGPGGGGGT',
  'TGGGGGGGGGGGT',
  'TGRRRGGGRRRGT',
  'TGHDHGGGHDHGT',
  'TGGGGGGGGGGGT',
  'TGGGRRRRRGGGT',
  'TGGGRRRRRGGGT',
  'TGGGHHDHHGGGT',
  'TGGGGGGGGGGGT',
  'TGGGGGGGGGGGT',
  'TTTTTTPTTTTTT',
];

export const GYM_TOWN: MapDef = {
  id: 'gym-town',
  name: 'Oakhaven',
  width: 13,
  height: 12,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 6, y: 0, to: 'route-1', toX: 5, toY: 12, toFacing: 'up' },
    { x: 3, y: 4, to: 'center', toX: 4, toY: 4, toFacing: 'up' },
    { x: 9, y: 4, to: 'mart', toX: 4, toY: 4, toFacing: 'up' },
    { x: 6, y: 8, to: 'gym', toX: 4, toY: 7, toFacing: 'up' },
    { x: 6, y: 11, to: 'route-2', toX: 5, toY: 1, toFacing: 'down' },
  ],
  signs: [{ x: 7, y: 5, text: 'OAKHAVEN GYM — Leader Chitin, the Swarm Keeper.' }],
  npcs: [],
  items: [],
};
