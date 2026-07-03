import { SeededRng } from '../../core/utils/rng';
import type { BattleEvent } from '../engine';

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

/* --------------------------------------------------------------- sharing */

/** The first ever Daily Challenge day — share texts count up from here. */
export const DAILY_EPOCH = '2026-07-01';

/** 1-based challenge number for a day key (#1 on the epoch day). */
export function dailyNumber(key: string): number {
  const ms = Date.parse(key + 'T00:00:00Z') - Date.parse(DAILY_EPOCH + 'T00:00:00Z');
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * One emoji per player turn, Wordle-style:
 * 🟩 super effective · 🟨 neutral · 🟥 resisted · 🟪 immune · ⬜ miss,
 * with 💥 replacing the square on a critical hit.
 */
export function turnEmoji(events: readonly BattleEvent[]): string {
  let mark = '⬜';
  let sawMove = false;
  for (const e of events) {
    if (e.kind === 'move' && e.side === 0) sawMove = true;
    if (e.kind === 'miss' && e.side === 0) return '⬜';
    if (sawMove && e.kind === 'damage' && e.side === 1) {
      if (e.crit) return '💥';
      if (e.effectiveness === 0) return '🟪';
      if (e.effectiveness > 1) return '🟩';
      if (e.effectiveness < 1) return '🟥';
      return '🟨';
    }
  }
  return mark;
}

export interface ShareInput {
  readonly key: string;
  readonly won: boolean;
  readonly turns: number;
  readonly streak: number;
  readonly marks: readonly string[];
}

/** The Wordle-style share text for a finished daily battle. */
export function buildShareText(input: ShareInput): string {
  const head = `PokéVerse Daily #${dailyNumber(input.key)} · ${input.key}`;
  const outcome = input.won
    ? `🏆 Won in ${input.turns} turn${input.turns === 1 ? '' : 's'}${input.streak > 0 ? ` · 🔥 ${input.streak}-day streak` : ''}`
    : `💀 Defeated after ${input.turns} turn${input.turns === 1 ? '' : 's'}`;
  const rows: string[] = [];
  for (let i = 0; i < input.marks.length; i += 10) {
    rows.push(input.marks.slice(i, i + 10).join(''));
  }
  return [head, outcome, ...rows, 'Same seed for every trainer — PokéVerse Arena'].join('\n');
}
