import { describe, expect, it } from 'vitest';
import {
  freshField,
  freshStages,
  freshVolatiles,
  type Battler,
  type BattleSide,
} from '../../game/engine';
import { fieldChips, stageChips, volatileChips } from './battle-view';

const battler: Battler = {
  id: 1,
  name: 'm',
  level: 50,
  types: ['normal'],
  stats: {
    hp: 100,
    attack: 100,
    defense: 100,
    'special-attack': 100,
    'special-defense': 100,
    speed: 100,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
};

const side = (): BattleSide => ({
  battler,
  currentHp: 100,
  maxHp: 100,
  pp: [],
  status: 'none',
  sleepTurns: 0,
  toxicCounter: 0,
  stages: freshStages(),
  volatiles: freshVolatiles(),
  itemUsed: false,
});

describe('battle view helpers', () => {
  it('lists only the stat stages that moved', () => {
    expect(stageChips(freshStages())).toEqual([]);
    expect(stageChips({ ...freshStages(), attack: 2, speed: -1 })).toEqual([
      { label: 'Atk', value: 2 },
      { label: 'Spe', value: -1 },
    ]);
  });

  it('shows no volatile chips for a clean Pokémon or no Pokémon', () => {
    expect(volatileChips(undefined)).toEqual([]);
    expect(volatileChips(side())).toEqual([]);
  });

  it('turns volatiles and Tera into labelled chips', () => {
    const s = side();
    s.terastallized = 'ghost';
    s.volatiles.substitute = 40;
    s.volatiles.confusionTurns = 2;
    s.volatiles.leechSeed = true;
    s.volatiles.taunt = 1;
    s.volatiles.encore = { index: 0, turns: 2 };
    s.volatiles.charging = 1;
    s.volatiles.lockedMove = 0;
    const chips = volatileChips(s);
    expect(chips.map((c) => c.label)).toEqual([
      'Tera Ghost',
      'Substitute',
      'Confused',
      'Seeded',
      'Taunted',
      'Encore',
      'Charging',
      'Move locked',
    ]);
    expect(chips.find((c) => c.id === 'substitute')?.tone).toBe('good');
    expect(chips.find((c) => c.id === 'confusion')?.tone).toBe('bad');
  });

  it('lists screens, Tailwind and Trick Room with their owner and turns', () => {
    const field = freshField();
    expect(fieldChips(field)).toEqual([]);
    field.screens[0].reflect = 4;
    field.screens[1]['light-screen'] = 2;
    field.tailwind[1] = 3;
    field.trickRoom = 5;
    expect(fieldChips(field)).toEqual([
      { id: 'reflect-0', label: 'Reflect', owner: 'you', turns: 4 },
      { id: 'light-screen-1', label: 'Light Screen', owner: 'foe', turns: 2 },
      { id: 'tailwind-1', label: 'Tailwind', owner: 'foe', turns: 3 },
      { id: 'trick-room', label: 'Trick Room', owner: 'field', turns: 5 },
    ]);
  });
});
