import { describe, expect, it } from 'vitest';
import { ahead, canEnter, isTallGrass, ledgeLanding, signAt, warpAt } from './movement';
import { PLAYER_HOME } from './maps/player-home';
import { HOME_TOWN } from './maps/home-town';
import { parseTiles } from './maps/legend';
import type { MapDef } from './rpg-types';

describe('movement on authored maps', () => {
  it('blocks walls and allows floor in the bedroom', () => {
    expect(canEnter(PLAYER_HOME, 3, 4)).toBe(true); // start floor
    expect(canEnter(PLAYER_HOME, 0, 0)).toBe(false); // wall
    expect(canEnter(PLAYER_HOME, -1, 4)).toBe(false); // out of bounds
  });

  it('finds the door warp out of the bedroom', () => {
    const w = warpAt(PLAYER_HOME, 3, 6);
    expect(w?.to).toBe('home-town');
    expect(w).toMatchObject({ toX: 3, toY: 4 });
  });

  it('blocks trees/water and detects tall grass in town', () => {
    expect(canEnter(HOME_TOWN, 0, 0)).toBe(false); // border tree
    expect(canEnter(HOME_TOWN, 6, 5)).toBe(false); // pond water
    expect(isTallGrass(HOME_TOWN, 5, 10)).toBe(true);
    expect(isTallGrass(HOME_TOWN, 3, 9)).toBe(false);
  });

  it('warps back inside via the house door and reads the sign', () => {
    expect(warpAt(HOME_TOWN, 3, 3)?.to).toBe('player-home');
    expect(signAt(HOME_TOWN, 6, 4)).toContain('VERDANT TOWN');
  });

  it('ahead() steps one tile in a direction', () => {
    expect(ahead(3, 4, 'down')).toEqual({ x: 3, y: 5 });
    expect(ahead(3, 4, 'up')).toEqual({ x: 3, y: 3 });
  });
});

describe('one-way ledges', () => {
  const map: MapDef = {
    id: 't', name: 'T', width: 3, height: 4, outdoor: true,
    tiles: parseTiles(['GGG', 'LLL', 'GGG', 'TTT']),
    warps: [], signs: [], npcs: [], items: [],
  };

  it('hops down over a ledge onto the tile below', () => {
    expect(ledgeLanding(map, 1, 1, 'down')).toEqual({ x: 1, y: 2 });
  });

  it('blocks every other approach', () => {
    expect(ledgeLanding(map, 1, 1, 'up')).toBeNull();
    expect(ledgeLanding(map, 1, 1, 'left')).toBeNull();
    expect(canEnter(map, 1, 1)).toBe(false); // never stood on
  });

  it('refuses the hop when the landing tile is blocked', () => {
    const cliff: MapDef = { ...map, tiles: parseTiles(['GGG', 'LLL', 'TTT', 'GGG']) };
    expect(ledgeLanding(cliff, 1, 1, 'down')).toBeNull();
  });
});
