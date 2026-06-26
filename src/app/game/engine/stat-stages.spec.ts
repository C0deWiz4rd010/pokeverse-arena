import { describe, expect, it } from 'vitest';
import {
  applyBoost,
  applyBoosts,
  clampStage,
  freshStages,
  stageLabel,
  stageMultiplier,
} from './stat-stages';

describe('stat stages', () => {
  it('clamps stages to [-6, 6]', () => {
    expect(clampStage(9)).toBe(6);
    expect(clampStage(-9)).toBe(-6);
    expect(clampStage(2)).toBe(2);
  });

  it('uses the 2/(2+n) table for offensive/defensive stats', () => {
    expect(stageMultiplier('attack', 0)).toBe(1);
    expect(stageMultiplier('attack', 1)).toBeCloseTo(1.5);
    expect(stageMultiplier('attack', 2)).toBe(2);
    expect(stageMultiplier('attack', -1)).toBeCloseTo(2 / 3);
    expect(stageMultiplier('attack', 6)).toBe(4);
  });

  it('uses the gentler 3/(3+n) table for accuracy/evasion', () => {
    expect(stageMultiplier('accuracy', 1)).toBeCloseTo(4 / 3);
    expect(stageMultiplier('evasion', -1)).toBeCloseTo(3 / 4);
  });

  it('applies a boost and reports how far it moved', () => {
    const { stages, applied } = applyBoost(freshStages(), 'attack', 2);
    expect(stages.attack).toBe(2);
    expect(applied).toBe(2);
  });

  it('reports 0 applied at the ceiling', () => {
    const maxed = { ...freshStages(), attack: 6 };
    const { applied } = applyBoost(maxed, 'attack', 2);
    expect(applied).toBe(0);
  });

  it('applies several boosts at once', () => {
    const out = applyBoosts(freshStages(), { attack: 1, speed: 2, defense: -1 });
    expect(out.attack).toBe(1);
    expect(out.speed).toBe(2);
    expect(out.defense).toBe(-1);
  });

  it('labels stages with arrows', () => {
    expect(stageLabel(0)).toBe('');
    expect(stageLabel(2)).toBe('▲▲');
    expect(stageLabel(-1)).toBe('▼');
  });
});
