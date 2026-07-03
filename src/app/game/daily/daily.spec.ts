import { describe, expect, it } from 'vitest';
import {
  EMPTY_DAILY,
  currentStreak,
  dailyKey,
  dailyMatchup,
  playedOn,
  previousKey,
  recordDailyResult,
  wonOn,
} from './daily';

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
