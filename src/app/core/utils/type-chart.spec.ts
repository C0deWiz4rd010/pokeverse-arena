import { describe, expect, it } from 'vitest';
import {
  analyzeTeamTypes,
  defensiveProfile,
  effectiveness,
  effectivenessLabel,
  offensiveProfile,
  singleEffectiveness,
} from './type-chart';

describe('type-chart', () => {
  it('handles classic super-effective matchups', () => {
    expect(singleEffectiveness('water', 'fire')).toBe(2);
    expect(singleEffectiveness('fire', 'grass')).toBe(2);
    expect(singleEffectiveness('electric', 'water')).toBe(2);
  });

  it('handles immunities (0x)', () => {
    expect(singleEffectiveness('normal', 'ghost')).toBe(0);
    expect(singleEffectiveness('ground', 'flying')).toBe(0);
    expect(singleEffectiveness('electric', 'ground')).toBe(0);
    expect(singleEffectiveness('dragon', 'fairy')).toBe(0);
  });

  it('defaults to neutral for unlisted matchups', () => {
    expect(singleEffectiveness('normal', 'water')).toBe(1);
  });

  it('multiplies across dual types (4x)', () => {
    // Rock is 2x weak to water and 2x weak to grass
    expect(effectiveness('grass', ['rock', 'ground'])).toBe(4);
  });

  it('multiplies across dual types (0.25x)', () => {
    expect(effectiveness('fire', ['fire', 'water'])).toBe(0.25);
  });

  it('collapses to 0 when any type is immune', () => {
    expect(effectiveness('ground', ['flying', 'water'])).toBe(0);
  });

  it('labels multipliers correctly', () => {
    expect(effectivenessLabel(0)).toBe('No effect');
    expect(effectivenessLabel(4)).toBe('Hyper effective');
    expect(effectivenessLabel(2)).toBe('Super effective');
    expect(effectivenessLabel(0.5)).toBe('Not very effective');
    expect(effectivenessLabel(1)).toBe('Neutral');
  });
});

describe('defensiveProfile', () => {
  it('reflects a dual type from the defender perspective', () => {
    const profile = defensiveProfile(['fire', 'flying']);
    expect(profile['rock']).toBe(4); // 2x (fire) * 2x (flying)
    expect(profile['ground']).toBe(0); // flying immunity
    expect(profile['grass']).toBe(0.25); // 0.5 * 0.5
    expect(profile['normal']).toBe(1);
  });
});

describe('offensiveProfile', () => {
  it('mirrors the single-type chart row', () => {
    const profile = offensiveProfile('water');
    expect(profile['fire']).toBe(2);
    expect(profile['water']).toBe(0.5);
    expect(profile['normal']).toBe(1);
  });
});

describe('analyzeTeamTypes', () => {
  it('counts shared weaknesses and uncovered threats', () => {
    const team = [
      { name: 'charizard', types: ['fire', 'flying'] as const },
      { name: 'pidgeot', types: ['normal', 'flying'] as const },
    ];
    const analysis = analyzeTeamTypes(team);
    // Both are weak to electric (flying) and rock.
    expect(analysis.weaknesses['electric']).toBe(2);
    expect(analysis.weaknesses['rock']).toBe(2);
    // Neither resists electric -> uncovered blind spot.
    expect(analysis.uncovered).toContain('electric');
    // Both resist grass/bug via flying, so those are covered.
    expect(analysis.resistances['bug']).toBe(2);
  });
});


import { groupDefenses } from './type-chart';

describe('groupDefenses', () => {
  it('groups weaknesses, resistances and immunities for a dual type', () => {
    // Charizard (fire/flying): ×4 rock, ×2 water/electric, ×0 ground, resists several.
    const g = groupDefenses(['fire', 'flying']);
    expect(g.x4).toContain('rock');
    expect(g.x2).toEqual(expect.arrayContaining(['water', 'electric']));
    expect(g.immune).toContain('ground');
    expect(g.half.length + g.quarter.length).toBeGreaterThan(0);
  });

  it('omits neutral matchups', () => {
    const g = groupDefenses(['normal']);
    expect(g.immune).toContain('ghost');
    expect(g.x2).toContain('fighting');
    // Normal has no double weakness or resistance.
    expect(g.x4).toHaveLength(0);
    expect(g.half).toHaveLength(0);
  });
});
