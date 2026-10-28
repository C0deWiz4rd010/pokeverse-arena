import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RecentPokemonService } from './recent-pokemon.service';

describe('RecentPokemonService', () => {
  const create = (): RecentPokemonService => {
    TestBed.resetTestingModule();
    return TestBed.inject(RecentPokemonService);
  };

  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(create().list()).toEqual([]);
  });

  it('records most-recent-first without duplicates', () => {
    const s = create();
    s.record(1, 'bulbasaur');
    s.record(4, 'charmander');
    s.record(1, 'bulbasaur');
    expect(s.list().map((r) => r.id)).toEqual([1, 4]);
  });

  it('caps the history at eight entries', () => {
    const s = create();
    for (let i = 1; i <= 12; i++) s.record(i, `mon-${i}`);
    expect(s.list()).toHaveLength(8);
    expect(s.list()[0]).toEqual({ id: 12, name: 'mon-12' });
  });

  it('persists across instances', () => {
    create().record(25, 'pikachu');
    expect(create().list()).toEqual([{ id: 25, name: 'pikachu' }]);
  });

  it('clear empties the list and the stored copy', () => {
    const s = create();
    s.record(25, 'pikachu');
    s.clear();
    expect(s.list()).toEqual([]);
    expect(localStorage.getItem('pv:recent:pokemon')).toBeNull();
    expect(create().list()).toEqual([]);
  });
});
