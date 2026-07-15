import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// The Elite Hall — the adventure's finale. A single rising corridor: the Elite
// duo (Rin, then Kael) challenge on sight with no way around, and Champion
// Aria waits on the dais. No healing mid-gauntlet — Crownspire's gatekeeper
// warned you. Beating Aria sets the 'beat-champion' flag and rolls the
// Hall-of-Fame epilogue.
const ROWS = [
  '#########',
  '#...r...#',
  '#..rrr..#',
  '#...r...#',
  '#.......#',
  '####.####',
  '#.......#',
  '#.......#',
  '####.####',
  '#.......#',
  '#.......#',
  '####.####',
  '#.......#',
  '#.......#',
  '####D####',
  '#########',
];

export const ELITE_HALL: MapDef = {
  id: 'elite-hall',
  name: 'Elite Hall',
  width: 9,
  height: 16,
  outdoor: false,
  tiles: parseTiles(ROWS),
  warps: [{ x: 4, y: 14, to: '@return', toX: 0, toY: 0 }],
  signs: [],
  npcs: [
    {
      id: 'Elite Rin',
      x: 2,
      y: 10,
      facing: 'right',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Elite Rin',
        sight: 4,
        team: [
          { species: 'kadabra', level: 30 },
          { species: 'hypno', level: 31 },
          { species: 'starmie', level: 31 },
        ],
        reward: 4200,
        intro: 'I saw your arrival in a dream. In it, you lost.',
        defeat: 'The future… rewrites itself. Kael awaits above.',
        flag: 'beat-elite-1',
      },
    },
    {
      id: 'Elite Kael',
      x: 6,
      y: 7,
      facing: 'left',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Elite Kael',
        sight: 4,
        team: [
          { species: 'onix', level: 31 },
          { species: 'gyarados', level: 32 },
          { species: 'aerodactyl', level: 32 },
        ],
        reward: 4600,
        intro: 'Rin dreams. I bite. My beasts end journeys here!',
        defeat: 'Unbowed… Aria will enjoy this. Ascend.',
        flag: 'beat-elite-2',
      },
    },
    {
      id: 'Champion Aria',
      x: 4,
      y: 2,
      facing: 'down',
      sprite: 'leader',
      kind: 'trainer',
      script: [],
      trainer: {
        name: 'Champion Aria',
        sight: 3,
        team: [
          { species: 'pidgeot', level: 32 },
          { species: 'rhydon', level: 32 },
          { species: 'arcanine', level: 33 },
          { species: 'alakazam', level: 33 },
          { species: 'dragonite', level: 35 },
        ],
        reward: 10000,
        intro: 'Every badge, every route, every fallen foe — it all led to me. Show me everything!',
        defeat: 'Magnificent… the title is yours, Champion.',
        flag: 'beat-champion',
        ending:
          '👑 CHAMPION! The Hall of Fame records your team forever. Verdant Town’s kid did it — thank you for playing PokéVerse Adventure!',
      },
    },
  ],
  items: [],
};
