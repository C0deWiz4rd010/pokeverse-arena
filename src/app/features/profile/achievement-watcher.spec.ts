import { describe, expect, it } from 'vitest';
import { diffUnlocked } from './achievement-diff';

describe('diffUnlocked', () => {
  it('baselines silently on the very first run', () => {
    const d = diffUnlocked(['first-badge', 'tour-win'], null);
    expect(d.newly).toEqual([]);
    expect(d.nextSeen).toEqual(['first-badge', 'tour-win']);
  });

  it('reports only ids not yet seen', () => {
    const d = diffUnlocked(['first-badge', 'tour-win', 'champion'], ['first-badge']);
    expect(d.newly).toEqual(['tour-win', 'champion']);
  });

  it('reports nothing when the sets match', () => {
    expect(diffUnlocked(['a', 'b'], ['a', 'b']).newly).toEqual([]);
  });

  it('mirrors the current set so a progress reset re-arms toasts', () => {
    const afterReset = diffUnlocked([], ['first-badge', 'tour-win']);
    expect(afterReset.newly).toEqual([]);
    expect(afterReset.nextSeen).toEqual([]);
    // …and earning the badge again toasts again.
    expect(diffUnlocked(['first-badge'], [...afterReset.nextSeen]).newly).toEqual(['first-badge']);
  });
});
