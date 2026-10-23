import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ArenaProgressStore } from './arena-progress.store';

describe('ArenaProgressStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  const create = () => TestBed.inject(ArenaProgressStore);

  it('awards a badge once and persists it', () => {
    const store = create();
    store.awardBadge('fire');
    store.awardBadge('fire');
    expect(store.hasBadge('fire')).toBe(true);
    expect(store.badges().size).toBe(1);

    TestBed.resetTestingModule();
    expect(create().hasBadge('fire')).toBe(true);
  });

  it('accumulates coins and ignores non-positive amounts', () => {
    const store = create();
    store.addCoins(50);
    store.addCoins(0);
    store.addCoins(-10);
    expect(store.coins()).toBe(50);
    TestBed.resetTestingModule();
    expect(create().coins()).toBe(50);
  });

  it('keeps only the best star rating per gym', () => {
    const store = create();
    store.recordStars('water', 2);
    store.recordStars('water', 1);
    expect(store.starsFor('water')).toBe(2);
    store.recordStars('water', 3);
    expect(store.starsFor('water')).toBe(3);
  });

  it('crowns the champion and resets badges, stars and the crown (coins stay)', () => {
    const store = create();
    store.awardBadge('grass');
    store.recordStars('grass', 3);
    store.crown();
    store.addCoins(20);
    expect(store.isChampion()).toBe(true);

    store.reset();
    expect(store.badges().size).toBe(0);
    expect(store.isChampion()).toBe(false);
    expect(store.stars()).toEqual({});
    expect(store.coins()).toBe(20);
  });

  it('survives corrupt stored data', () => {
    localStorage.setItem('arena:badges', '{not json');
    localStorage.setItem('arena:stars', '[[');
    localStorage.setItem('arena:coins', 'abc');
    const store = create();
    expect(store.badges().size).toBe(0);
    expect(store.stars()).toEqual({});
    expect(store.coins()).toBe(0);
  });
});
