import { describe, expect, it } from 'vitest';
import { dailyFusionPair, fuseBattlers, fuseStats, fuseTypes, fusePokemon, fusionHueShift, spliceName } from './fusion';
import type { Pokemon, PokemonStats } from '../../core/models/pokemon.model';
import type { Battler, BattleMove } from '../engine';

const stats = (
  hp: number, attack: number, defense: number, spa: number, spd: number, speed: number,
): PokemonStats => ({
  hp, attack, defense, 'special-attack': spa, 'special-defense': spd, speed,
});

function mon(partial: Partial<Pokemon>): Pokemon {
  return {
    id: 1,
    name: 'bulbasaur',
    types: ['grass', 'poison'],
    heightM: 0.7,
    weightKg: 6.9,
    baseExperience: 64,
    stats: stats(45, 49, 49, 65, 65, 45),
    baseStatTotal: 318,
    abilities: [{ name: 'overgrow', isHidden: false }],
    moves: [],
    sprites: { default: '', shiny: '', animatedFront: null, animatedBack: null },
    cry: null,
    speciesId: 1,
    ...partial,
  };
}

describe('spliceName', () => {
  it('splices head prefix with body suffix', () => {
    const name = spliceName('bulbasaur', 'charizard');
    expect(name[0]).toBe('B');
    expect(name.toLowerCase()).not.toBe('bulbasaur');
    expect(name.toLowerCase()).not.toBe('charizard');
    expect(name.toLowerCase().startsWith('bul')).toBe(true);
    expect(name.toLowerCase().endsWith('ard')).toBe(true);
  });

  it('is deterministic', () => {
    expect(spliceName('pikachu', 'gengar')).toBe(spliceName('pikachu', 'gengar'));
  });

  it('is order-sensitive (head vs body matters)', () => {
    expect(spliceName('pikachu', 'gengar')).not.toBe(spliceName('gengar', 'pikachu'));
  });

  it('collapses doubled letters at the seam', () => {
    const name = spliceName('abra', 'arbok').toLowerCase();
    expect(name).not.toMatch(/(.)\1\1/);
  });

  it('handles very short names', () => {
    expect(spliceName('mew', 'muk').length).toBeGreaterThanOrEqual(3);
  });
});

describe('fuseStats', () => {
  it('weights mental stats toward the head and physique toward the body', () => {
    const head = stats(90, 30, 30, 90, 90, 30);
    const body = stats(30, 90, 90, 30, 30, 90);
    const fused = fuseStats(head, body);
    expect(fused.hp).toBe(70); // (2*90 + 30) / 3
    expect(fused.attack).toBe(70); // (30 + 2*90) / 3
    expect(fused['special-attack']).toBe(70);
    expect(fused.speed).toBe(70);
  });

  it('is identity-ish when fusing a Pokémon with itself', () => {
    const s = stats(80, 82, 83, 100, 100, 80);
    expect(fuseStats(s, s)).toEqual(s);
  });
});

describe('fuseTypes', () => {
  it('keeps head primary and takes a differing body type', () => {
    expect(fuseTypes(['grass', 'poison'], ['fire', 'flying'])).toEqual(['grass', 'fire']);
  });

  it('falls back to head secondary when body types collide', () => {
    expect(fuseTypes(['grass', 'poison'], ['grass'])).toEqual(['grass', 'poison']);
  });

  it('produces a mono-type when nothing differs', () => {
    expect(fuseTypes(['fire'], ['fire'])).toEqual(['fire']);
  });
});

describe('fusionHueShift', () => {
  it('is zero for identical types', () => {
    expect(fusionHueShift('fire', 'fire')).toBe(0);
  });

  it('stays within the shortest rotation range', () => {
    expect(Math.abs(fusionHueShift('fighting', 'grass'))).toBeLessThanOrEqual(180);
  });
});

describe('dailyFusionPair', () => {
  it('is deterministic for a given seed', () => {
    expect(dailyFusionPair('fusion-2026-07-12')).toEqual(dailyFusionPair('fusion-2026-07-12'));
  });

  it('differs across seeds (different days)', () => {
    expect(dailyFusionPair('fusion-2026-07-12')).not.toEqual(dailyFusionPair('fusion-2026-07-13'));
  });

  it('stays in range and never fuses a Pokémon with itself', () => {
    for (let day = 1; day <= 60; day++) {
      const { head, body } = dailyFusionPair(`fusion-2026-08-${day}`);
      expect(head).toBeGreaterThanOrEqual(1);
      expect(head).toBeLessThanOrEqual(1025);
      expect(body).toBeGreaterThanOrEqual(1);
      expect(body).toBeLessThanOrEqual(1025);
      expect(body).not.toBe(head);
    }
  });
});

describe('fuseBattlers', () => {
  const move = (name: string): BattleMove => ({ name, type: 'normal', power: 60, accuracy: 100, damageClass: 'physical' });
  const battler = (partial: Partial<Battler>): Battler => ({
    id: 6,
    name: 'charizard',
    level: 60,
    types: ['fire', 'flying'],
    stats: stats(180, 160, 150, 200, 170, 190),
    moves: [move('flamethrower'), move('air-slash'), move('dragon-claw'), move('roost')],
    sprite: 'charizard.png',
    ...partial,
  });

  const head = battler({});
  const body = battler({
    id: 9,
    name: 'blastoise',
    level: 62,
    types: ['water'],
    stats: stats(180, 160, 190, 170, 200, 150),
    moves: [move('surf'), move('flamethrower'), move('ice-beam'), move('shell-smash')],
    sprite: 'blastoise.png',
  });

  it('splices name, fuses types/stats and wears the body sprite hue-shifted to the head', () => {
    const chimera = fuseBattlers(head, body);
    expect(chimera.name).toBe(spliceName('charizard', 'blastoise'));
    expect(chimera.types).toEqual(fuseTypes(head.types, body.types));
    expect(chimera.stats).toEqual(fuseStats(head.stats, body.stats));
    expect(chimera.sprite).toBe('blastoise.png');
    expect(chimera.hue).toBe(fusionHueShift('fire', 'water'));
    expect(chimera.level).toBe(62);
  });

  it('interleaves both movesets head-first, deduped to four', () => {
    const moves = fuseBattlers(head, body).moves.map((m) => m.name);
    expect(moves).toHaveLength(4);
    expect(new Set(moves).size).toBe(4);
    expect(moves[0]).toBe('flamethrower');
    expect(moves[1]).toBe('surf');
    expect(moves).toContain('air-slash');
  });

  it('mints a synthetic id outside the real dex range', () => {
    const chimera = fuseBattlers(head, body);
    expect(chimera.id).toBe(60_009);
    expect(chimera.id).toBeGreaterThan(1025);
  });
});

describe('fusePokemon', () => {
  const head = mon({ id: 6, name: 'charizard', types: ['fire', 'flying'], stats: stats(78, 84, 78, 109, 85, 100) });
  const body = mon({ id: 9, name: 'blastoise', types: ['water'], stats: stats(79, 83, 100, 85, 105, 78) });

  it('is fully deterministic for the same pair', () => {
    expect(fusePokemon(head, body)).toEqual(fusePokemon(head, body));
  });

  it('builds the dex code from head.body ids', () => {
    expect(fusePokemon(head, body).code).toBe('6.9');
  });

  it('sums the fused stats into the BST', () => {
    const f = fusePokemon(head, body);
    expect(f.bst).toBe(Object.values(f.stats).reduce((a, b) => a + b, 0));
  });

  it('averages height and weight', () => {
    const f = fusePokemon(head, body);
    expect(f.heightM).toBeCloseTo((head.heightM + body.heightM) / 2, 1);
    expect(f.weightKg).toBeCloseTo((head.weightKg + body.weightKg) / 2, 1);
  });

  it('picks an ability from either parent', () => {
    const names = [...head.abilities, ...body.abilities].map((a) => a.name);
    expect(names).toContain(fusePokemon(head, body).ability);
  });
});
