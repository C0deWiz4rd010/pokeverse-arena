import { describe, expect, it } from 'vitest';
import { NATURES, natureByName, natureSummary } from './natures';
import { calcStat } from './stat-calculator';

describe('natures', () => {
  it('defines exactly 25 natures', () => {
    expect(NATURES).toHaveLength(25);
  });

  it('has 5 neutral natures', () => {
    const neutral = NATURES.filter((n) => !n.increased && !n.decreased);
    expect(neutral).toHaveLength(5);
  });

  it('never raises and lowers the same stat', () => {
    for (const n of NATURES) {
      if (n.increased && n.decreased) {
        expect(n.increased).not.toBe(n.decreased);
      }
    }
  });

  it('looks up by name and falls back to Hardy', () => {
    expect(natureByName('Adamant').increased).toBe('attack');
    expect(natureByName('nope').name).toBe('Hardy');
  });

  it('summarises modifiers for the UI', () => {
    expect(natureSummary(natureByName('Adamant'))).toBe('+Atk / -SpA');
    expect(natureSummary(natureByName('Hardy'))).toBe('Neutral');
  });

  it('applies the +/-10% multiplier in stat calc', () => {
    const adamant = natureByName('Adamant');
    const neutral = natureByName('Hardy');
    const atkAdamant = calcStat('attack', 100, 31, 0, 50, adamant);
    const atkNeutral = calcStat('attack', 100, 31, 0, 50, neutral);
    expect(atkAdamant).toBeGreaterThan(atkNeutral);
  });
});
