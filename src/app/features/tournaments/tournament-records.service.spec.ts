import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Battler } from '../../game/engine';
import { TOURNAMENT_MODES, makeTrainer, type Trainer } from '../../game/tournament';
import { TournamentRecords } from './tournament-records.service';

const mon = (id: number, hp = 100, level = 50): Battler => ({
  id,
  name: `mon-${id}`,
  level,
  types: ['normal'],
  stats: {
    hp,
    attack: 60,
    defense: 60,
    'special-attack': 60,
    'special-defense': 60,
    speed: 60,
  },
  moves: [{ name: 'Tackle', type: 'normal', power: 40, accuracy: 100, damageClass: 'physical' }],
});

const cpu = (index: number, hp: number): Trainer => makeTrainer(index, false, [mon(index, hp)]);

describe('TournamentRecords', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  const create = () => TestBed.inject(TournamentRecords);

  it('starts with an empty history, no last run and a generated rival', () => {
    const rec = create();
    expect(rec.history()).toEqual([]);
    expect(rec.lastRun()).toBeNull();
    expect(rec.rival().name).toBeTruthy();
  });

  it('logs a won run once with the champion prize and persists it', () => {
    const rec = create();
    const player = makeTrainer(0, true, [mon(1)]);
    const run = {
      placement: 1,
      field: 16,
      champion: player,
      mode: TOURNAMENT_MODES[0]!,
      format: 'single-elim' as const,
      pick: null,
    };
    rec.log(run);
    rec.log(run); // second call is a no-op until resetRun
    expect(rec.history()).toHaveLength(1);
    const last = rec.lastRun()!;
    expect(last.playerWon).toBe(true);
    expect(last.placement).toBe(1);
    expect(last.prize).toBe(360);
    expect(last.pickBonus).toBeUndefined();
    expect(last.modeName).toBe(TOURNAMENT_MODES[0]!.name);

    TestBed.resetTestingModule();
    expect(create().history()).toHaveLength(1);
  });

  it('adds the crystal-ball bonus on a correct call and falls back to mid-table placement', () => {
    const rec = create();
    const winner = cpu(3, 100);
    rec.log({
      placement: 0,
      field: 16,
      champion: winner,
      mode: null,
      format: 'swiss',
      pick: { trainerId: winner.id, payout: 77 },
    });
    const last = rec.lastRun()!;
    expect(last.playerWon).toBe(false);
    expect(last.placement).toBe(9); // ceil(16/2) + 1
    expect(last.pickBonus).toBe(77);
    expect(last.prize).toBe(15 + 77);
    expect(last.modeName).toBe('Tournament');
    expect(last.champion).toBe(winner.name);
  });

  it('allows a new log after resetRun and does not award a bonus for a wrong call', () => {
    const rec = create();
    const champ = cpu(1, 100);
    const base = { field: 8, champion: champ, mode: null, format: 'round-robin' as const };
    rec.log({ ...base, placement: 3, pick: { trainerId: 'someone-else', payout: 50 } });
    expect(rec.lastRun()!.placement).toBe(3);
    expect(rec.lastRun()!.pickBonus).toBeUndefined();

    rec.resetRun();
    expect(rec.lastRun()).toBeNull();
    rec.log({ ...base, placement: 2, champion: null, pick: null });
    expect(rec.history()).toHaveLength(2);
    expect(rec.lastRun()!.champion).toBe('—');
  });

  it('records rival meetings and persists them', () => {
    const rec = create();
    rec.recordRival(true);
    rec.recordRival(false);
    rec.recordRival(true);
    expect(rec.rival().playerWins).toBe(2);
    expect(rec.rival().rivalWins).toBe(1);
    const name = rec.rival().name;

    TestBed.resetTestingModule();
    const again = create();
    expect(again.rival().name).toBe(name);
    expect(again.rival().playerWins).toBe(2);
  });

  it('injects the rival over the strongest CPU entry and never over the player', () => {
    const rec = create();
    const player = makeTrainer(0, true, [mon(1, 9999)]);
    const weak = cpu(1, 50);
    const strong = cpu(2, 500);
    const out = rec.injectRival([player, weak, strong]);
    expect(out[0]).toBe(player);
    expect(out[1]).toBe(weak);
    expect(out[2]!.id).toBe('rival');
    expect(out[2]!.isRival).toBe(true);
    expect(out[2]!.name).toBe(rec.rival().name);
    expect(out[2]!.team).toHaveLength(1);
  });

  it('gives the rival a level edge that grows with the head-to-head history', () => {
    const rec = create();
    for (let i = 0; i < 6; i++) rec.recordRival(false);
    const strong = cpu(2, 500);
    const out = rec.injectRival([strong]);
    expect(out[0]!.team[0]!.level).toBeGreaterThan(50);
    expect(out[0]!.team[0]!.stats.hp).toBeGreaterThan(500);
  });

  it('leaves the field alone when there is no CPU entry', () => {
    const rec = create();
    const player = makeTrainer(0, true, [mon(1)]);
    const out = rec.injectRival([player]);
    expect(out).toEqual([player]);
  });
});
