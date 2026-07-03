import { SeededRng } from '../../core/utils/rng';

/**
 * Daily Challenge — pure logic.
 *
 * Every calendar day (UTC) derives one deterministic matchup from the date, so
 * every trainer in the world fights the same battle with the same seed. The
 * streak record tracks consecutive daily wins; only the first attempt of a day
 * counts (retries are for fun).
 */

export interface DailyMatchup {
  readonly key: string;
  readonly playerId: number;
  readonly opponentId: number;
  readonly level: number;
  /** Seed for the battle engine — same for everyone on the same day. */
  readonly seed: string;
}

export interface DailyRecord {
  /** Day key of the last *counted* attempt (first attempt of that day). */
  readonly lastKey: string | null;
  /** Day key of the last counted win. */
  readonly lastWonKey: string | null;
  /** Consecutive-day win streak as of `lastKey`. */
  readonly streak: number;
  readonly best: number;
  readonly wins: number;
  readonly plays: number;
}

export const EMPTY_DAILY: DailyRecord = {
  lastKey: null,
  lastWonKey: null,
  streak: 0,
  best: 0,
  wins: 0,
  plays: 0,
};

const HIGHEST_DEX_ID = 1025;

/** Today's day key, UTC — 'YYYY-MM-DD'. */
export function dailyKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The day key immediately before `key`. */
export function previousKey(key: string): string {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return dailyKey(d);
}

/** The unique, deterministic matchup for a day key. */
export function dailyMatchup(key: string, highestId = HIGHEST_DEX_ID): DailyMatchup {
  const rng = new SeededRng('daily-' + key);
  const playerId = rng.int(1, highestId);
  let opponentId = rng.int(1, highestId);
  if (opponentId === playerId) opponentId = (opponentId % highestId) + 1;
  return { key, playerId, opponentId, level: 50, seed: 'daily-' + key };
}

/** Has the day already been won / attempted? */
export function wonOn(rec: DailyRecord, key: string): boolean {
  return rec.lastWonKey === key;
}
export function playedOn(rec: DailyRecord, key: string): boolean {
  return rec.lastKey === key;
}

/**
 * The streak to *display* for day `key`: the stored streak is only alive if
 * the last counted win was today or yesterday — otherwise it has lapsed.
 */
export function currentStreak(rec: DailyRecord, key: string): number {
  if (rec.lastWonKey === key || rec.lastWonKey === previousKey(key)) return rec.streak;
  return 0;
}

/**
 * Fold a finished battle into the record. Only the first attempt per day
 * counts; later attempts return the record unchanged. A win extends the
 * streak when yesterday was also won, otherwise starts a new one; a loss
 * breaks it.
 */
export function recordDailyResult(rec: DailyRecord, key: string, won: boolean): DailyRecord {
  if (playedOn(rec, key)) return rec;
  const plays = rec.plays + 1;
  if (!won) {
    return { ...rec, lastKey: key, streak: 0, plays };
  }
  const streak = rec.lastWonKey === previousKey(key) ? rec.streak + 1 : 1;
  return {
    lastKey: key,
    lastWonKey: key,
    streak,
    best: Math.max(rec.best, streak),
    wins: rec.wins + 1,
    plays,
  };
}
