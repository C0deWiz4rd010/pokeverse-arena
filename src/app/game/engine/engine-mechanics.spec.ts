import { describe, expect, it } from 'vitest';
import { Battle } from './battle';
import type { Battler, BattleMove } from './battle-types';

const tackle: BattleMove = { name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' };
const weakTackle: BattleMove = { name: 'Tap', type: 'normal', power: 5, accuracy: 100, damageClass: 'physical' };

function mk(overrides: Partial<Battler>): Battler {
  return {
    id: 1,
    name: 'Mon',
    level: 50,
    types: ['normal'],
    stats: { hp: 300, attack: 100, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 100 },
    moves: [tackle],
    ...overrides,
  };
}

const fast = (o: Partial<Battler>) => mk({ stats: { ...mk({}).stats, speed: 300 }, ...o });
const slow = (o: Partial<Battler>) => mk({ stats: { ...mk({}).stats, speed: 1 }, ...o });

describe('entry abilities', () => {
  it('Intimidate lowers the foe’s Attack on entry', () => {
    const b = new Battle(fast({ name: 'Boss', ability: 'intimidate' }), slow({ name: 'Foe' }), 'intim');
    b.takeTurn(0);
    expect(b.opponent.stages.attack).toBe(-1);
  });

  it('Drought sets harsh sunlight on entry', () => {
    const b = new Battle(fast({ name: 'Sun', ability: 'drought' }), slow({ name: 'Foe' }), 'sun');
    b.takeTurn(0);
    expect(b.state.field.weather).toBe('sun');
  });
});

describe('status moves', () => {
  it('Will-O-Wisp burns the target and chips it at end of turn', () => {
    const wow: BattleMove = { name: 'Will-O-Wisp', type: 'fire', power: 0, accuracy: 0, damageClass: 'status', inflictStatus: 'burn', target: 'opponent' };
    const b = new Battle(fast({ name: 'Mage', moves: [wow] }), slow({ name: 'Foe', moves: [weakTackle] }), 'burn');
    b.takeTurn(0);
    expect(b.opponent.status).toBe('burn');
    expect(b.opponent.currentHp).toBeLessThan(b.opponent.maxHp);
  });

  it('Swords Dance raises the user’s Attack by two stages', () => {
    const sd: BattleMove = { name: 'Swords Dance', type: 'normal', power: 0, accuracy: 0, damageClass: 'status', boosts: { attack: 2 }, target: 'self' };
    const b = new Battle(fast({ name: 'Hero', moves: [sd] }), slow({ name: 'Foe', moves: [weakTackle] }), 'sd');
    b.takeTurn(0);
    expect(b.player.stages.attack).toBe(2);
  });
});

describe('defensive abilities & items', () => {
  it('Levitate makes Ground moves miss entirely', () => {
    const quake: BattleMove = { name: 'Earthquake', type: 'ground', power: 100, accuracy: 0, damageClass: 'physical' };
    const b = new Battle(fast({ name: 'Digger', moves: [quake] }), slow({ name: 'Floaty', ability: 'levitate', moves: [weakTackle] }), 'lev');
    b.takeTurn(0);
    expect(b.opponent.currentHp).toBe(b.opponent.maxHp);
  });

  it('Focus Sash lets a full-HP Pokémon survive a KO at 1 HP', () => {
    const nuke: BattleMove = { name: 'Nuke', type: 'normal', power: 250, accuracy: 0, damageClass: 'physical' };
    const hitter = fast({ name: 'Hitter', moves: [nuke], stats: { ...mk({}).stats, speed: 300, attack: 255 } });
    const frail = slow({ name: 'Frail', item: 'focus-sash', moves: [weakTackle], stats: { ...mk({}).stats, hp: 60, defense: 1, speed: 1 } });
    const b = new Battle(hitter, frail, 'sash');
    b.takeTurn(0);
    expect(b.opponent.currentHp).toBe(1);
    expect(b.state.finished).toBe(false);
  });

  it('Sturdy endures a one-hit KO from full HP', () => {
    const nuke: BattleMove = { name: 'Nuke', type: 'normal', power: 250, accuracy: 0, damageClass: 'physical' };
    const hitter = fast({ name: 'Hitter', moves: [nuke], stats: { ...mk({}).stats, speed: 300, attack: 255 } });
    const wall = slow({ name: 'Wall', ability: 'sturdy', moves: [weakTackle], stats: { ...mk({}).stats, hp: 60, defense: 1, speed: 1 } });
    const b = new Battle(hitter, wall, 'sturdy');
    b.takeTurn(0);
    expect(b.opponent.currentHp).toBe(1);
  });
});

describe('move mechanics', () => {
  it('multi-hit moves strike several times', () => {
    const fury: BattleMove = { name: 'Fury Swipes', type: 'normal', power: 18, accuracy: 0, damageClass: 'physical', multiHit: [2, 2] };
    const b = new Battle(fast({ name: 'Cat', moves: [fury] }), slow({ name: 'Foe', moves: [weakTackle], stats: { ...mk({}).stats, hp: 500 } }), 'multi');
    const events = b.takeTurn(0);
    const hitsOnFoe = events.filter((e) => e.kind === 'damage' && e.side === 1);
    expect(hitsOnFoe.length).toBe(2);
  });

  it('100%-chance secondary effects always trigger', () => {
    const scald: BattleMove = { name: 'Scald', type: 'water', power: 40, accuracy: 0, damageClass: 'special', secondary: { chance: 100, status: 'burn' } };
    const b = new Battle(fast({ name: 'Squirt', moves: [scald] }), slow({ name: 'Foe', moves: [weakTackle], stats: { ...mk({}).stats, hp: 500 } }), 'scald');
    b.takeTurn(0);
    expect(b.opponent.status).toBe('burn');
  });

  it('recoil moves hurt the user', () => {
    const flare: BattleMove = { name: 'Flare Blitz', type: 'fire', power: 120, accuracy: 0, damageClass: 'physical', recoil: 0.33, flags: { contact: true } };
    const b = new Battle(fast({ name: 'Charby', moves: [flare], stats: { ...mk({}).stats, speed: 300, hp: 400 } }), slow({ name: 'Foe', moves: [weakTackle], stats: { ...mk({}).stats, hp: 500 } }), 'recoil');
    b.takeTurn(0);
    expect(b.player.currentHp).toBeLessThan(b.player.maxHp);
  });
});

describe('weather as a damage mechanic', () => {
  it('sun boosts a Fire move over clear skies (same seed)', () => {
    const ember: BattleMove = { name: 'Ember', type: 'fire', power: 90, accuracy: 0, damageClass: 'special' };
    const atkSun = fast({ name: 'A', ability: 'drought', types: ['fire'], moves: [ember], stats: { ...mk({}).stats, speed: 300, 'special-attack': 150 } });
    const atkClear = fast({ name: 'A', types: ['fire'], moves: [ember], stats: { ...mk({}).stats, speed: 300, 'special-attack': 150 } });
    const foe = () => slow({ name: 'Foe', moves: [weakTackle], stats: { ...mk({}).stats, hp: 600, 'special-defense': 80 } });

    const sun = new Battle(atkSun, foe(), 'wx');
    const clear = new Battle(atkClear, foe(), 'wx');
    const sunDmg = sun.takeTurn(0).find((e) => e.kind === 'damage' && e.side === 1);
    const clearDmg = clear.takeTurn(0).find((e) => e.kind === 'damage' && e.side === 1);
    expect(sunDmg && clearDmg && sunDmg.amount > clearDmg.amount).toBe(true);
  });
});
