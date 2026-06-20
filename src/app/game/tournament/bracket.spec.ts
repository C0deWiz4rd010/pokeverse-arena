import { describe, expect, it } from 'vitest';
import {
  buildBracket,
  nextReadyMatch,
  playerMatch,
  reportResult,
  findMatch,
} from './bracket';
import type { Trainer } from './types';

function trainers(count = 16): Trainer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    name: `Trainer ${i}`,
    title: 'Ace',
    avatar: '🧢',
    team: [],
    isPlayer: i === 0,
  }));
}

describe('bracket', () => {
  it('seeds 16 trainers into 8 opening matches', () => {
    const b = buildBracket(trainers());
    expect(b.rounds.r16).toHaveLength(8);
    expect(b.rounds.qf).toHaveLength(4);
    expect(b.rounds.sf).toHaveLength(2);
    expect(b.rounds.final).toHaveLength(1);
    expect(b.rounds.r16[0].a?.id).toBe('t0');
    expect(b.rounds.r16[0].b?.id).toBe('t1');
    expect(b.rounds.qf[0].a).toBeNull();
    expect(b.champion).toBeNull();
  });

  it('rejects brackets that are not 16 trainers', () => {
    expect(() => buildBracket(trainers(8))).toThrow();
  });

  it('advances winners into the correct next-round slot', () => {
    let b = buildBracket(trainers());
    // r16 slot 0 → winner a (t0) goes to qf slot 0, side a.
    b = reportResult(b, 'r16-0', 0);
    expect(b.rounds.qf[0].a?.id).toBe('t0');
    // r16 slot 1 → winner b (t3) goes to qf slot 0, side b.
    b = reportResult(b, 'r16-1', 1);
    expect(b.rounds.qf[0].b?.id).toBe('t3');
  });

  it('does not mutate the previous bracket (immutable updates)', () => {
    const original = buildBracket(trainers());
    const updated = reportResult(original, 'r16-0', 0);
    expect(findMatch(original, 'r16-0')?.played).toBe(false);
    expect(findMatch(updated, 'r16-0')?.played).toBe(true);
  });

  it('walks the next ready match round by round', () => {
    let b = buildBracket(trainers());
    expect(nextReadyMatch(b)?.id).toBe('r16-0');
    for (let i = 0; i < 8; i++) b = reportResult(b, `r16-${i}`, 0);
    // All R16 played → the first quarterfinal is now ready.
    expect(nextReadyMatch(b)?.id).toBe('qf-0');
  });

  it('finds the player match while they are still in', () => {
    const b = buildBracket(trainers());
    expect(playerMatch(b)?.id).toBe('r16-0');
  });

  it('crowns a champion after the final', () => {
    let b = buildBracket(trainers());
    for (let i = 0; i < 8; i++) b = reportResult(b, `r16-${i}`, 0);
    for (let i = 0; i < 4; i++) b = reportResult(b, `qf-${i}`, 0);
    for (let i = 0; i < 2; i++) b = reportResult(b, `sf-${i}`, 0);
    b = reportResult(b, 'final-0', 0);
    expect(b.champion?.id).toBe('t0');
  });
});
