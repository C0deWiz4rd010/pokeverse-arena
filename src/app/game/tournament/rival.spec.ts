import { describe, expect, it } from 'vitest';
import { createRival, recordRivalMeeting, rivalLevelBoost, rivalMeetings, rivalTaunt } from './rival';

/** A rand() that replays a fixed sequence (repeats the last value). */
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
};

describe('tournament rival', () => {
  it('creates a deterministic identity from the rand source', () => {
    const a = createRival(seq(0, 0, 0));
    const b = createRival(seq(0, 0, 0));
    expect(a.name).toBe(b.name);
    expect(a.title).toBe(b.title);
    expect(a.playerWins).toBe(0);
    expect(a.rivalWins).toBe(0);
    expect(a.lastWinner).toBeNull();
  });

  it('records head-to-head outcomes immutably', () => {
    const s0 = createRival(seq(0));
    const s1 = recordRivalMeeting(s0, true);
    const s2 = recordRivalMeeting(s1, false);
    expect(s0.playerWins).toBe(0); // original untouched
    expect(s1.playerWins).toBe(1);
    expect(s1.lastWinner).toBe('player');
    expect(s2.rivalWins).toBe(1);
    expect(s2.lastWinner).toBe('rival');
    expect(rivalMeetings(s2)).toBe(2);
  });

  it('grows +1 level per meeting, capped at +6', () => {
    let s = createRival(seq(0));
    expect(rivalLevelBoost(s)).toBe(0);
    for (let i = 0; i < 10; i++) s = recordRivalMeeting(s, i % 2 === 0);
    expect(rivalMeetings(s)).toBe(10);
    expect(rivalLevelBoost(s)).toBe(6);
  });

  it('picks a taunt bucket from the record and fills in the score', () => {
    let s = createRival(seq(0));
    expect(rivalTaunt(s).length).toBeGreaterThan(0); // first-meeting line

    s = recordRivalMeeting(s, false); // rival leads 1–0
    expect(rivalTaunt(s)).toContain('1–0');

    s = recordRivalMeeting(s, true); // tied 1–1
    expect(rivalTaunt(s)).toContain('1–1');

    s = recordRivalMeeting(s, true); // player leads 2–1
    expect(rivalTaunt(s)).toContain('2–1');
  });
});
