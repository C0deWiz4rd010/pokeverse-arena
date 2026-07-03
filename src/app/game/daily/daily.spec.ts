import { describe, expect, it } from 'vitest';
import {
  EMPTY_DAILY,
  buildShareText,
  currentStreak,
  dailyKey,
  dailyMatchup,
  dailyNumber,
  playedOn,
  previousKey,
  recordDailyResult,
  turnEmoji,
  wonOn,
} from './daily';
import type { BattleEvent } from '../engine';

describe('daily matchup', () => {
  it('is deterministic for a given day', () => {
    expect(dailyMatchup('2026-07-03')).toEqual(dailyMatchup('2026-07-03'));
  });

  it('differs between days (spot check across a month)', () => {
    const a = dailyMatchup('2026-07-03');
    const days = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    expect(days.some((d) => dailyMatchup(d).playerId !== a.playerId)).toBe(true);
  });

  it('never pits a Pokémon against itself and stays in dex range', () => {
    for (let i = 1; i <= 60; i++) {
      const m = dailyMatchup(`2026-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`);
      expect(m.playerId).not.toBe(m.opponentId);
      expect(m.playerId).toBeGreaterThanOrEqual(1);
      expect(m.opponentId).toBeLessThanOrEqual(1025);
    }
  });

  it('derives keys in UTC and steps back across month borders', () => {
    expect(dailyKey(new Date('2026-07-03T12:00:00Z'))).toBe('2026-07-03');
    expect(previousKey('2026-07-01')).toBe('2026-06-30');
    expect(previousKey('2026-01-01')).toBe('2025-12-31');
  });
});

describe('daily streak record', () => {
  it('a first win starts a streak of 1', () => {
    const r = recordDailyResult(EMPTY_DAILY, '2026-07-03', true);
    expect(r.streak).toBe(1);
    expect(r.wins).toBe(1);
    expect(wonOn(r, '2026-07-03')).toBe(true);
  });

  it('winning on consecutive days extends the streak', () => {
    let r = recordDailyResult(EMPTY_DAILY, '2026-07-03', true);
    r = recordDailyResult(r, '2026-07-04', true);
    expect(r.streak).toBe(2);
    expect(r.best).toBe(2);
  });

  it('a skipped day starts a fresh streak but keeps the best', () => {
    let r = recordDailyResult(EMPTY_DAILY, '2026-07-03', true);
    r = recordDailyResult(r, '2026-07-04', true);
    r = recordDailyResult(r, '2026-07-10', true);
    expect(r.streak).toBe(1);
    expect(r.best).toBe(2);
  });

  it('a loss breaks the streak and counts the play', () => {
    let r = recordDailyResult(EMPTY_DAILY, '2026-07-03', true);
    r = recordDailyResult(r, '2026-07-04', false);
    expect(r.streak).toBe(0);
    expect(r.plays).toBe(2);
    expect(r.wins).toBe(1);
  });

  it('only the first attempt of a day counts', () => {
    const first = recordDailyResult(EMPTY_DAILY, '2026-07-03', false);
    const retry = recordDailyResult(first, '2026-07-03', true);
    expect(retry).toEqual(first);
    expect(playedOn(retry, '2026-07-03')).toBe(true);
  });

  it('displayed streak lapses after a missed day', () => {
    const r = recordDailyResult(EMPTY_DAILY, '2026-07-03', true);
    expect(currentStreak(r, '2026-07-03')).toBe(1);
    expect(currentStreak(r, '2026-07-04')).toBe(1); // still winnable today
    expect(currentStreak(r, '2026-07-06')).toBe(0); // lapsed
  });
});

describe('daily sharing', () => {
  const dmg = (effectiveness: number, crit = false): BattleEvent => ({
    kind: 'damage',
    side: 1,
    amount: 10,
    effectiveness,
    crit,
    remainingHp: 50,
    maxHp: 100,
  });
  const move: BattleEvent = { kind: 'move', side: 0, attacker: 'a', move: 'tackle' };

  it('numbers days from the epoch', () => {
    expect(dailyNumber('2026-07-01')).toBe(1);
    expect(dailyNumber('2026-07-03')).toBe(3);
  });

  it('maps turn outcomes onto emoji', () => {
    expect(turnEmoji([move, dmg(2)])).toBe('🟩');
    expect(turnEmoji([move, dmg(1)])).toBe('🟨');
    expect(turnEmoji([move, dmg(0.5)])).toBe('🟥');
    expect(turnEmoji([move, dmg(0)])).toBe('🟪');
    expect(turnEmoji([move, dmg(2, true)])).toBe('💥');
    expect(turnEmoji([{ kind: 'miss', side: 0, attacker: 'a', move: 'tackle' }])).toBe('⬜');
  });

  it("ignores the foe's damage against the player", () => {
    const foeHit: BattleEvent = { kind: 'damage', side: 0, amount: 9, effectiveness: 2, crit: false, remainingHp: 1, maxHp: 10 };
    expect(turnEmoji([foeHit, move, dmg(1)])).toBe('🟨');
  });

  it('builds a share text with wrapped rows and streak line', () => {
    const text = buildShareText({
      key: '2026-07-03',
      won: true,
      turns: 12,
      streak: 2,
      marks: Array.from({ length: 12 }, () => '🟩'),
    });
    const lines = text.split('\n');
    expect(lines[0]).toBe('PokéVerse Daily #3 · 2026-07-03');
    expect(lines[1]).toContain('Won in 12 turns');
    expect(lines[1]).toContain('🔥 2-day streak');
    expect(lines[2]).toHaveLength(20); // 10 emoji (2 code units each)
    expect(lines[3]).toHaveLength(4);
  });

  it('omits the streak on a defeat', () => {
    const text = buildShareText({ key: '2026-07-01', won: false, turns: 1, streak: 0, marks: ['🟥'] });
    expect(text).toContain('💀 Defeated after 1 turn');
    expect(text).not.toContain('🔥');
  });
});
