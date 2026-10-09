import { describe, expect, it } from 'vitest';
import type { MoveDto } from '../../core/dto/pokeapi.dto';
import { convertMove, isUsefulStatusMove } from './move-convert';

const named = (name: string) => ({ name, url: '' });

function move(over: Partial<Omit<MoveDto, 'type' | 'meta'>> & { name: string; type?: string; cls?: string; meta?: Partial<NonNullable<MoveDto['meta']>> }): MoveDto {
  const { type = 'normal', cls = 'status', meta, ...rest } = over;
  return {
    id: 1,
    accuracy: 100,
    power: null,
    pp: 20,
    priority: 0,
    type: named(type),
    damage_class: named(cls),
    effect_chance: null,
    effect_entries: [],
    flavor_text_entries: [],
    meta: { ailment: named('none'), ailment_chance: 0, crit_rate: 0, drain: 0, flinch_chance: 0, healing: 0, max_hits: null, min_hits: null, stat_chance: 0, ...meta },
    ...rest,
  } as MoveDto;
}

describe('convertMove — status moves', () => {
  it('keeps the status class instead of turning it into a physical move', () => {
    const m = convertMove(move({ name: 'growl', stat_changes: [{ change: -1, stat: named('attack') }], target: named('all-opponents') }));
    expect(m.damageClass).toBe('status');
    expect(m.power).toBe(0);
  });

  it('maps stat drops on the opponent and boosts on the user', () => {
    const growl = convertMove(move({ name: 'growl', stat_changes: [{ change: -1, stat: named('attack') }], target: named('all-opponents') }));
    expect(growl.boosts).toEqual({ attack: -1 });
    expect(growl.target).toBe('opponent');
    const swords = convertMove(move({ name: 'swords-dance', stat_changes: [{ change: 2, stat: named('attack') }], target: named('user') }));
    expect(swords.boosts).toEqual({ attack: 2 });
    expect(swords.target).toBe('self');
  });

  it('guarantees the ailment of a status move even when ailment_chance is 0', () => {
    const m = convertMove(move({ name: 'thunder-wave', type: 'electric', meta: { ailment: named('paralysis'), ailment_chance: 0 } }));
    expect(m.inflictStatus).toBe('paralysis');
  });

  it('maps recovery, weather, terrain and hazards', () => {
    expect(convertMove(move({ name: 'recover', meta: { healing: 50 } })).healing).toBe(0.5);
    expect(convertMove(move({ name: 'rain-dance', type: 'water' })).setsWeather).toBe('rain');
    expect(convertMove(move({ name: 'grassy-terrain', type: 'grass' })).setsTerrain).toBe('grassy');
    expect(convertMove(move({ name: 'stealth-rock', type: 'rock' })).setsHazard).toBe('stealth-rock');
  });

  it('flags only moves the engine can actually use as useful', () => {
    expect(isUsefulStatusMove(convertMove(move({ name: 'recover', meta: { healing: 50 } })))).toBe(true);
    expect(isUsefulStatusMove(convertMove(move({ name: 'splash' })))).toBe(false);
  });
});

describe('convertMove — damaging moves', () => {
  const dmg = (name: string, extra: Partial<Omit<MoveDto, 'type' | 'meta'>> = {}, meta: Partial<NonNullable<MoveDto['meta']>> = {}) =>
    convertMove(move({ name, cls: 'physical', power: 80, meta, ...extra }));

  it('treats a missing accuracy as never-miss (0)', () => {
    expect(dmg('aerial-ace', { accuracy: null }).accuracy).toBe(0);
  });

  it('only physical moves make contact, minus the known exceptions', () => {
    expect(dmg('tackle').flags?.contact).toBe(true);
    expect(dmg('earthquake').flags?.contact).toBeUndefined();
    expect(convertMove(move({ name: 'psychic', cls: 'special', power: 90 })).flags?.contact).toBeUndefined();
  });

  it('tags punch, bite and sound moves', () => {
    expect(dmg('thunder-punch').flags?.punch).toBe(true);
    expect(dmg('crunch').flags?.bite).toBe(true);
    expect(convertMove(move({ name: 'hyper-voice', cls: 'special', power: 90 })).flags?.sound).toBe(true);
  });

  it('turns an ailment rider into a secondary only when it has a chance', () => {
    expect(dmg('ember', {}, { ailment: named('burn'), ailment_chance: 10 }).secondary).toEqual({ chance: 10, status: 'burn' });
    expect(dmg('plain', {}, { ailment: named('burn'), ailment_chance: 0 }).secondary).toBeUndefined();
  });

  it('puts stat riders on the right side', () => {
    const psychic = dmg('psychic', { stat_changes: [{ change: -1, stat: named('special-defense') }] }, { stat_chance: 10 });
    expect(psychic.secondary).toMatchObject({ chance: 10, boosts: { 'special-defense': -1 }, boostTarget: 'opponent' });
    const cc = dmg('close-combat', { stat_changes: [{ change: -1, stat: named('defense') }] });
    expect(cc.secondary).toMatchObject({ chance: 100, boostTarget: 'self' });
  });

  it('maps drain, recoil, multi-hit, crit and flinch', () => {
    expect(dmg('giga-drain', {}, { drain: 50 }).drain).toBe(0.5);
    expect(dmg('double-edge', {}, { drain: -33 }).recoil).toBeCloseTo(0.33);
    expect(dmg('fury-swipes', {}, { min_hits: 2, max_hits: 5 }).multiHit).toEqual([2, 5]);
    expect(dmg('slash', {}, { crit_rate: 1 }).critStage).toBe(1);
    expect(dmg('bite', {}, { flinch_chance: 30 }).secondary).toEqual({ chance: 30, flinch: true });
  });
});

describe('converted moves inside a battle', () => {
  it('a converted Thunder Wave paralyses the target', async () => {
    const { Battle } = await import('./battle');
    const wave = convertMove(move({ name: 'thunder-wave', type: 'electric', meta: { ailment: named('paralysis'), ailment_chance: 0 } }));
    wave.accuracy = 0;
    const stats = { hp: 300, attack: 100, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 100 };
    const tap = { name: 'tap', type: 'normal' as const, power: 5, accuracy: 100, damageClass: 'physical' as const };
    const a = { id: 1, name: 'A', level: 50, types: ['electric' as const], stats: { ...stats, speed: 300 }, moves: [wave] };
    const b = { id: 2, name: 'B', level: 50, types: ['normal' as const], stats: { ...stats, speed: 1 }, moves: [tap] };
    const battle = new Battle(a, b, 'wave');
    battle.takeTurn(0);
    expect(battle.opponent.status).toBe('paralysis');
  });

  it('Magic Guard holders take no recoil', async () => {
    const { Battle } = await import('./battle');
    const stats = { hp: 300, attack: 300, defense: 100, 'special-attack': 100, 'special-defense': 100, speed: 300 };
    const edge = { name: 'double-edge', type: 'normal' as const, power: 120, accuracy: 0, damageClass: 'physical' as const, recoil: 0.33 };
    const tap = { name: 'splash', type: 'normal' as const, power: 0, accuracy: 0, damageClass: 'status' as const };
    const a = { id: 1, name: 'A', level: 50, types: ['normal' as const], stats, moves: [edge], ability: 'magic-guard' as const };
    const b = { id: 2, name: 'B', level: 50, types: ['normal' as const], stats: { ...stats, speed: 1 }, moves: [tap] };
    const battle = new Battle(a, b, 'guard');
    const before = battle.player.currentHp;
    battle.takeTurn(0);
    expect(battle.opponent.currentHp).toBeLessThan(battle.opponent.maxHp); // the hit landed
    expect(battle.player.currentHp).toBe(before); // …and cost the user nothing
  });
});
