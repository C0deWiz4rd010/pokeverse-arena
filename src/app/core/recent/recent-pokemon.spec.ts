import { describe, expect, it } from 'vitest';
import { pushRecent, type RecentPokemon } from './recent-pokemon.service';

const mon = (id: number): RecentPokemon => ({ id, name: `mon-${id}` });

describe('pushRecent', () => {
  it('prepends the newest entry', () => {
    expect(pushRecent([mon(1)], mon(2)).map((r) => r.id)).toEqual([2, 1]);
  });

  it('moves a revisited entry to the front instead of duplicating it', () => {
    const list = [mon(1), mon(2), mon(3)];
    expect(pushRecent(list, mon(3)).map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it('caps the list at the given maximum', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8].map(mon);
    const next = pushRecent(list, mon(9));
    expect(next).toHaveLength(8);
    expect(next[0].id).toBe(9);
    expect(next.some((r) => r.id === 8)).toBe(false);
  });

  it('does not mutate the input list', () => {
    const list = [mon(1)];
    pushRecent(list, mon(2));
    expect(list).toHaveLength(1);
  });
});
