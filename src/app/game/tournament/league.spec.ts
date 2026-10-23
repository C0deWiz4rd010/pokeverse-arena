import { describe, expect, it } from 'vitest';
import type { Battler, BattleMove } from '../engine';
import { League } from './league';
import {
  anyPlayerRemaining,
  bracketMatchSetup,
  rulesForMode,
  runAiMatches,
  teamForRound,
} from './match-runner';
import { buildBracket } from './bracket';
import { modeById } from './modes';
import { makeTrainer, scaleStats, teamStrength } from './trainers';
import type { Trainer } from './types';

const tackle: BattleMove = {
  name: 'Tackle',
  type: 'normal',
  power: 60,
  accuracy: 100,
  damageClass: 'physical',
};

function mon(name: string, power: number): Battler {
  return {
    id: 1,
    name,
    level: 50,
    types: ['normal'],
    stats: {
      hp: 100 + power,
      attack: 60 + power,
      defense: 80,
      'special-attack': 80,
      'special-defense': 80,
      speed: 60 + power,
    },
    moves: [tackle],
  };
}

/** `count` trainers, index 0 is the player; higher index = stronger team. */
function field(count: number): Trainer[] {
  return Array.from({ length: count }, (_, i) => makeTrainer(i, i === 0, [mon(`m${i}`, i * 10)]));
}

describe('trainers', () => {
  it('gives the player and CPUs stable identities', () => {
    const player = makeTrainer(0, true, []);
    expect(player).toMatchObject({ id: 'player', name: 'You', isPlayer: true });
    const cpu = makeTrainer(3, false, []);
    expect(cpu.id).toBe('cpu-3');
    expect(makeTrainer(3, false, []).avatar).toBe(cpu.avatar);
  });

  it('scales stats and ranks team strength', () => {
    const s = scaleStats(mon('a', 0).stats, 2);
    expect(s.hp).toBe(200);
    expect(teamStrength(makeTrainer(1, false, [mon('a', 50)]))).toBeGreaterThan(
      teamStrength(makeTrainer(1, false, [mon('a', 0)])),
    );
  });
});

describe('League', () => {
  it('round-robin: exposes the player match, then finishes with one champion', () => {
    const trainers = field(4);
    const lg = new League('round-robin', trainers, 1, null);
    let finish = lg.advance();
    let played = 0;
    while (!finish && played < 20) {
      expect(lg.match?.player.isPlayer).toBe(true);
      const out = lg.recordPlayerOutcome(true, [10]);
      expect(out).not.toBeNull();
      finish = out!.finish;
      played++;
    }
    expect(finish).not.toBeNull();
    expect(played).toBe(3); // the player meets each of the 3 others once
    expect(finish!.field).toBe(4);
    expect(finish!.champion?.isPlayer).toBe(true);
    expect(finish!.placement).toBe(1);
    expect(lg.match).toBeNull();
  });

  it('ignores a player outcome when no match is pending', () => {
    const lg = new League('round-robin', field(4), 1, null);
    lg.advance();
    lg.recordPlayerOutcome(false, []);
    // advance until finished then a stray outcome is a no-op
    let guard = 0;
    while (lg.match && guard++ < 10) lg.recordPlayerOutcome(false, []);
    expect(lg.recordPlayerOutcome(true, [])).toBeNull();
  });

  it('is deterministic for the same field', () => {
    const run = () => {
      const lg = new League('round-robin', field(6), 1, null);
      let finish = lg.advance();
      while (!finish) finish = lg.recordPlayerOutcome(false, [])!.finish;
      return finish.ranked.map((s) => s.trainerId).join(',');
    };
    expect(run()).toBe(run());
  });
});

describe('bracket match runner', () => {
  const mode = modeById('classic');

  it('resolves CPU matches until the player is up', () => {
    const b = runAiMatches(buildBracket(field(16)), mode, new Map());
    expect(anyPlayerRemaining(b)).toBe(true);
    const setup = bracketMatchSetup(b, mode, new Map());
    expect(setup?.player.isPlayer).toBe(true);
    expect(setup?.round).toBe('r16');
    expect(bracketMatchSetup(null, mode, new Map())).toBeNull();
  });

  it('only scales foes in ascending modes and leaves the player alone', () => {
    const t = makeTrainer(1, false, [mon('x', 0)]);
    expect(teamForRound(mode, t, 'final')).toBe(t.team);
    expect(teamForRound(null, t, 'final')).toBe(t.team);
  });

  it('returns no rules for a plain mode', () => {
    expect(rulesForMode(mode, 'm1')).toBeUndefined();
    expect(rulesForMode(null, 'm1')).toBeUndefined();
  });
});
