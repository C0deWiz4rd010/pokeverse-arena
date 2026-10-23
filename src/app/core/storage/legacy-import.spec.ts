import { beforeEach, describe, expect, it } from 'vitest';
import { loadOdysseyMeta, saveOdysseyMeta } from '../../game/odyssey/odyssey';
import { loadMeta, recordRun } from '../../game/spire/meta';
import { loadHistory, loadRival, pushHistory, saveRival } from '../../game/tournament';

/** The pure game modules persist through the versioned store and still read pre-3.0.5 saves. */
describe('persistence of the game modules', () => {
  beforeEach(() => localStorage.clear());

  it('imports the old raw spire:meta and then writes the new key', () => {
    localStorage.setItem('spire:meta', JSON.stringify({ bestDepth: 9, clears: 2 }));
    const meta = loadMeta();
    expect(meta).toMatchObject({ bestDepth: 9, clears: 2, runs: 0 }); // defaults fill the gaps
    expect(localStorage.getItem('spire:meta')).toBeNull();

    recordRun(meta, 12, 50, false);
    expect(loadMeta().bestDepth).toBe(12);
    expect(JSON.parse(localStorage.getItem('pv:spire:meta')!)).toMatchObject({ v: 1 });
  });

  it('imports the old tournament history and keeps appending', () => {
    const old = {
      date: 'd',
      modeName: 'm',
      formatName: 'f',
      field: 16,
      placement: 1,
      champion: 'You',
      playerWon: true,
      prize: 360,
    };
    localStorage.setItem('tournaments:history', JSON.stringify([old]));
    expect(loadHistory()).toHaveLength(1);
    pushHistory({ ...old, placement: 2, playerWon: false });
    expect(loadHistory()).toHaveLength(2);
    expect(localStorage.getItem('tournaments:history')).toBeNull();
  });

  it('imports the old rival instead of generating a new one', () => {
    const rival = {
      v: 1,
      name: 'Silas',
      title: 'Your Rival',
      seed: 's',
      playerWins: 3,
      rivalWins: 1,
      lastWinner: 'player',
    };
    localStorage.setItem('tournaments:rival', JSON.stringify(rival));
    expect(loadRival()).toEqual(rival);
  });

  it('creates and persists a rival on first use', () => {
    const first = loadRival();
    expect(loadRival()).toEqual(first);
    saveRival({ ...first, playerWins: 5 });
    expect(loadRival().playerWins).toBe(5);
  });

  it('round-trips the odyssey meta and ignores garbage', () => {
    saveOdysseyMeta({ ...loadOdysseyMeta(), bestWave: 7 });
    expect(loadOdysseyMeta().bestWave).toBe(7);
    localStorage.setItem('pv:odyssey:meta', 'garbage');
    expect(loadOdysseyMeta().bestWave).toBe(0);
  });
});
