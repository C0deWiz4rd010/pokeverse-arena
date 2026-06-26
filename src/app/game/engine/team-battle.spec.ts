import { describe, expect, it } from 'vitest';
import { TeamBattle } from './team-battle';
import type { Battler, BattleMove } from './battle-types';

const tackle: BattleMove = { name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' };
const weak: BattleMove = { name: 'Tap', type: 'normal', power: 5, accuracy: 100, damageClass: 'physical' };
const sd: BattleMove = { name: 'Swords Dance', type: 'normal', power: 0, accuracy: 0, damageClass: 'status', boosts: { attack: 2 } };

function mk(o: Partial<Battler>): Battler {
  return {
    id: 1,
    name: 'Mon',
    level: 50,
    types: ['normal'],
    stats: { hp: 250, attack: 120, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 100 },
    moves: [tackle],
    ...o,
  };
}

const move = (i: number) => ({ type: 'move' as const, index: i });
const swap = (to: number) => ({ type: 'switch' as const, to });

describe('TeamBattle', () => {
  it('ends when a whole party faints and reports the winner', () => {
    const teamA = [mk({ name: 'A1', stats: { ...mk({}).stats, attack: 250, speed: 200 } })];
    const teamB = [mk({ name: 'B1', stats: { ...mk({}).stats, hp: 30, defense: 1, speed: 1 } })];
    const tb = new TeamBattle(teamA, teamB, 'win');
    let guard = 0;
    while (!tb.state.finished && guard++ < 50) tb.takeTurn(move(0), move(0));
    expect(tb.state.finished).toBe(true);
    expect(tb.state.winner).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const run = () => {
      const tb = new TeamBattle(
        [mk({ name: 'A1', stats: { ...mk({}).stats, speed: 130 } }), mk({ name: 'A2' })],
        [mk({ name: 'B1' }), mk({ name: 'B2', stats: { ...mk({}).stats, speed: 80 } })],
        'repro',
      );
      let guard = 0;
      while (!tb.state.finished && guard++ < 80) {
        if (tb.mustSwitch(0)) tb.autoForceSwitch(0);
        if (tb.mustSwitch(1)) tb.autoForceSwitch(1);
        if (tb.state.finished) break;
        tb.takeTurn(tb.chooseAction(0), tb.chooseAction(1));
      }
      return [tb.hp(0), tb.hp(1), tb.state.winner];
    };
    expect(run()).toEqual(run());
  });

  it('switches the active Pokémon and resets its stat stages on the way out', () => {
    const teamA = [mk({ name: 'Lead', moves: [sd, tackle], stats: { ...mk({}).stats, speed: 200 } }), mk({ name: 'Bench' })];
    const teamB = [mk({ name: 'Foe', moves: [weak], stats: { ...mk({}).stats, speed: 1 } })];
    const tb = new TeamBattle(teamA, teamB, 'switch');
    tb.takeTurn(move(0), move(0)); // Lead uses Swords Dance → +2 Attack
    expect(tb.active(0).stages.attack).toBe(2);
    tb.takeTurn(swap(1), move(0)); // switch Lead → Bench
    expect(tb.active(0).battler.name).toBe('Bench');
    expect(teamA[0].stats.hp).toBeGreaterThan(0);
    // The switched-out Lead's stages were cleared.
    expect(tb.state.parties[0][0].stages.attack).toBe(0);
  });

  it('bites a switch-in with Stealth Rock', () => {
    const teamA = [mk({ name: 'Lead', stats: { ...mk({}).stats, speed: 200 } }), mk({ name: 'Fire', types: ['fire'] })];
    const teamB = [mk({ name: 'Foe', moves: [weak], stats: { ...mk({}).stats, speed: 1 } })];
    const tb = new TeamBattle(teamA, teamB, 'rocks');
    tb.state.field.hazards[0] = { 'stealth-rock': 1, spikes: 0, 'toxic-spikes': 0 };
    tb.takeTurn(swap(1), move(0)); // Fire (weak to Rock) switches in
    // Fire takes 1/4 from Stealth Rock plus the foe's weak tackle.
    expect(tb.active(0).currentHp).toBeLessThan(tb.active(0).maxHp);
  });

  it('fires Intimidate when a Pokémon switches in', () => {
    const teamA = [mk({ name: 'Lead', stats: { ...mk({}).stats, speed: 200 } }), mk({ name: 'Scary', ability: 'intimidate' })];
    const teamB = [mk({ name: 'Foe', moves: [weak], stats: { ...mk({}).stats, speed: 1 } })];
    const tb = new TeamBattle(teamA, teamB, 'intim');
    tb.takeTurn(swap(1), move(0));
    expect(tb.active(1).stages.attack).toBe(-1);
  });

  it('keeps weather on the field across a switch', () => {
    const teamA = [mk({ name: 'Sun', ability: 'drought', stats: { ...mk({}).stats, speed: 200 } }), mk({ name: 'Bench' })];
    const teamB = [mk({ name: 'Foe', moves: [weak], stats: { ...mk({}).stats, speed: 1 } })];
    const tb = new TeamBattle(teamA, teamB, 'wx');
    tb.takeTurn(move(0), move(0));
    expect(tb.state.field.weather).toBe('sun');
    tb.takeTurn(swap(1), move(0));
    expect(tb.state.field.weather).toBe('sun'); // persists across the switch
  });
});
