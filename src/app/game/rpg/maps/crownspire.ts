import type { MapDef } from '../rpg-types';
import { parseTiles } from './legend';

// Crownspire City — the summit seat of the league. A stone plaza flanked by a
// Center and Mart, crowned by the Elite Hall where the Champion waits.
// South (6,11) ↔ Victory Pass.
const ROWS = [
  'TTTTTTTTTTTTT',
  'TPPPRRRRRPPPT',
  'TPPPHHDHHPPPT',
  'TPPPPPPPPPPPT',
  'TPRRRPPPRRRPT',
  'TPHDHPPPHDHPT',
  'TPPPPP!PPPPPT',
  'TPffPPPPPffPT',
  'TPPPPPPPPPPPT',
  'TPPPPPPPPPPPT',
  'TPPPPPPPPPPPT',
  'TTTTTTPTTTTTT',
];

export const CROWNSPIRE: MapDef = {
  id: 'crownspire',
  name: 'Crownspire City',
  width: 13,
  height: 12,
  outdoor: true,
  tiles: parseTiles(ROWS),
  warps: [
    { x: 6, y: 11, to: 'route-5', toX: 6, toY: 1, toFacing: 'down' },
    { x: 3, y: 5, to: 'center', toX: 4, toY: 4, toFacing: 'up' },
    { x: 9, y: 5, to: 'mart', toX: 4, toY: 4, toFacing: 'up' },
    // The Elite Hall — the finale.
    { x: 6, y: 2, to: 'elite-hall', toX: 4, toY: 14, toFacing: 'up' },
  ],
  signs: [{ x: 6, y: 6, text: 'ELITE HALL — where champions are made. Trainers enter; legends leave.' }],
  npcs: [
    {
      id: 'Gatekeeper Sol',
      x: 8,
      y: 3,
      facing: 'down',
      sprite: 'oldman',
      kind: 'talk',
      script: [
        { say: 'Sol: Beyond that door wait the Elite duo — and above them, Champion Aria.', speaker: 'Gatekeeper Sol' },
        { say: 'Sol: No Center visits mid-gauntlet. Stock up, brace yourself, and go make history.', speaker: 'Gatekeeper Sol' },
      ],
    },
    {
      id: 'Groupie Lin',
      x: 4,
      y: 8,
      facing: 'right',
      sprite: 'girl',
      kind: 'talk',
      wander: 2,
      script: [
        { say: 'Aria has never lost a title defense. Her Dragonite ends every argument.' },
      ],
    },
  ],
  items: [{ x: 11, y: 9, item: 'revive', qty: 1, flag: 'crownspire-revive' }],
  forage: [{ x: 2, y: 7 }, { x: 10, y: 7 }],
};
