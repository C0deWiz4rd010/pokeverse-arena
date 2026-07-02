import { describe, expect, it } from 'vitest';
import { defaultSave } from './save';
import { makePartyMon } from './party';
import { QUESTS, questLog, questProgress } from './quests';

describe('quest log', () => {
  it('starts fully open on a fresh save', () => {
    const g = defaultSave();
    expect(questProgress(g)).toEqual({ done: 0, total: QUESTS.length });
    expect(questLog(g).every((e) => !e.done)).toBe(true);
  });

  it('ticks milestones as flags, badges, party and dex progress land', () => {
    const g = defaultSave();
    g.flags['starter'] = true;
    g.flags['first-battle'] = true;
    g.caught = [1, 4];
    g.badges = ['Hive Badge', 'Boulder Badge'];
    g.party = Array.from({ length: 6 }, (_, i) => makePartyMon(`m${i}`, i + 1, 5, 20));
    const done = new Set(questLog(g).filter((e) => e.done).map((e) => e.quest.id));
    expect(done).toContain('starter');
    expect(done).toContain('first-battle');
    expect(done).toContain('catch');
    expect(done).toContain('badge1');
    expect(done).toContain('badge2');
    expect(done).toContain('party6');
    expect(done).not.toContain('badge3');
    expect(done).not.toContain('dex10');
    expect(questProgress(g).done).toBe(6);
  });
});
