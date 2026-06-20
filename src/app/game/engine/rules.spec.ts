import { describe, expect, it } from 'vitest';
import { singleEffectivenessRuled, effectivenessRuled, weatherBoost } from './rules';

describe('rule-aware effectiveness', () => {
  it('returns the normal chart when no rules are given', () => {
    expect(singleEffectivenessRuled('water', 'fire')).toBe(2);
    expect(singleEffectivenessRuled('fire', 'water')).toBe(0.5);
    expect(singleEffectivenessRuled('electric', 'ground')).toBe(0);
  });

  it('flips matchups under the inverse rule', () => {
    const inverse = { inverse: true };
    // Super-effective becomes resisted.
    expect(singleEffectivenessRuled('water', 'fire', inverse)).toBe(0.5);
    // Resisted becomes super-effective.
    expect(singleEffectivenessRuled('fire', 'water', inverse)).toBe(2);
    // Immunity becomes a weakness — the whole point of inverse battles.
    expect(singleEffectivenessRuled('electric', 'ground', inverse)).toBe(2);
    expect(singleEffectivenessRuled('normal', 'ghost', inverse)).toBe(2);
    // Neutral stays neutral.
    expect(singleEffectivenessRuled('normal', 'normal', inverse)).toBe(1);
  });

  it('multiplies across a dual typing', () => {
    // Rock is weak to water (2) and not affected further by being rock again.
    expect(effectivenessRuled('water', ['rock', 'ground'])).toBe(4);
    // Inverse turns that double-weakness into a double-resist.
    expect(effectivenessRuled('water', ['rock', 'ground'], { inverse: true })).toBe(0.25);
  });

  it('applies a weather boost only to the matching move type', () => {
    expect(weatherBoost('fire', { weatherBoostType: 'fire' })).toBe(1.5);
    expect(weatherBoost('water', { weatherBoostType: 'fire' })).toBe(1);
    expect(weatherBoost('fire')).toBe(1);
  });
});
