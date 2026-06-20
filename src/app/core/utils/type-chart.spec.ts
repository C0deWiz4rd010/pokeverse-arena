import { describe, expect, it } from 'vitest';
import { effectiveness, effectivenessLabel, singleEffectiveness } from './type-chart';

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
