import { describe, expect, it } from 'vitest';
import {
  burnAttackFactor,
  canApplyStatus,
  paralysisSpeedFactor,
  residualDamage,
  resolveMoveGate,
} from './status';

describe('status — application rules', () => {
  it('blocks a second non-volatile status', () => {
    expect(canApplyStatus('burn', ['water'], 'paralysis')).toBe(false);
  });

  it('respects type immunities', () => {
    expect(canApplyStatus('burn', ['fire'], 'none')).toBe(false);
    expect(canApplyStatus('paralysis', ['electric'], 'none')).toBe(false);
    expect(canApplyStatus('poison', ['steel'], 'none')).toBe(false);
    expect(canApplyStatus('toxic', ['poison'], 'none')).toBe(false);
    expect(canApplyStatus('freeze', ['ice'], 'none')).toBe(false);
  });

  it('allows a legal status', () => {
    expect(canApplyStatus('burn', ['grass'], 'none')).toBe(true);
  });
});

describe('status — residual damage', () => {
  it('burns 1/16 and poisons 1/8', () => {
    expect(residualDamage('burn', 160, 0)).toBe(10);
    expect(residualDamage('poison', 160, 0)).toBe(20);
  });

  it('ramps toxic by the counter', () => {
    expect(residualDamage('toxic', 160, 1)).toBe(10);
    expect(residualDamage('toxic', 160, 3)).toBe(30);
    expect(residualDamage('toxic', 160, 99)).toBe(150); // capped at 15/16
  });

  it('deals nothing for non-residual statuses', () => {
    expect(residualDamage('paralysis', 160, 0)).toBe(0);
    expect(residualDamage('none', 160, 0)).toBe(0);
  });
});

describe('status — move gates', () => {
  it('wakes after the sleep counter elapses', () => {
    expect(resolveMoveGate('A', 'sleep', 1, 0.9)).toMatchObject({ canMove: true, status: 'none' });
    expect(resolveMoveGate('A', 'sleep', 3, 0.9)).toMatchObject({ canMove: false, sleepTurns: 2 });
  });

  it('thaws freeze 20% of the time', () => {
    expect(resolveMoveGate('A', 'freeze', 0, 0.1).canMove).toBe(true);
    expect(resolveMoveGate('A', 'freeze', 0, 0.5).canMove).toBe(false);
  });

  it('fully paralyses 25% of the time', () => {
    expect(resolveMoveGate('A', 'paralysis', 0, 0.1).canMove).toBe(false);
    expect(resolveMoveGate('A', 'paralysis', 0, 0.5).canMove).toBe(true);
  });
});

describe('status — stat factors', () => {
  it('burn halves physical attack', () => {
    expect(burnAttackFactor('burn')).toBe(0.5);
    expect(burnAttackFactor('none')).toBe(1);
  });

  it('paralysis halves speed', () => {
    expect(paralysisSpeedFactor('paralysis')).toBe(0.5);
    expect(paralysisSpeedFactor('none')).toBe(1);
  });
});
