import { describe, expect, it } from 'vitest';
import { battleScene } from './battle-scene';
import type { MapDef } from './rpg-types';

const map = (over: Partial<MapDef>): Pick<MapDef, 'outdoor' | 'weather' | 'encounter'> => ({
  outdoor: true,
  ...over,
});

describe('battleScene', () => {
  it('defaults to a meadow by day', () => {
    expect(battleScene(map({}), 'day')).toEqual({ scene: 'meadow', night: false, weather: 'none' });
  });

  it('marks night from the time band', () => {
    expect(battleScene(map({}), 'night')).toEqual({ scene: 'meadow', night: true, weather: 'none' });
  });

  it('uses an indoor scene for interiors (never night)', () => {
    expect(battleScene(map({ outdoor: false }), 'night')).toEqual({ scene: 'indoor', night: false, weather: 'none' });
  });

  it('reads cave from an everywhere-encounter map', () => {
    const everywhere = { chance: 1, table: [], everywhere: true } as MapDef['encounter'];
    expect(battleScene(map({ encounter: everywhere }), 'day').scene).toBe('cave');
  });

  it('reads sand and snow from weather', () => {
    expect(battleScene(map({ weather: 'sandstorm' }), 'day').scene).toBe('sand');
    expect(battleScene(map({ weather: 'snow' }), 'day').scene).toBe('snow');
  });

  it('forces water for fishing bites', () => {
    expect(battleScene(map({ weather: 'snow' }), 'day', true).scene).toBe('water');
  });

  it('carries rain and snow through as battle precipitation', () => {
    expect(battleScene(map({ weather: 'rain' }), 'day').weather).toBe('rain');
    expect(battleScene(map({ weather: 'snow' }), 'day').weather).toBe('snow');
  });

  it('never rains underground or indoors', () => {
    const everywhere = { chance: 1, table: [], everywhere: true } as MapDef['encounter'];
    expect(battleScene(map({ encounter: everywhere, weather: 'rain' }), 'day').weather).toBe('none');
    expect(battleScene(map({ outdoor: false, weather: 'rain' }), 'day').weather).toBe('none');
  });

  it('falls back to a meadow with no map', () => {
    expect(battleScene(null, 'day')).toEqual({ scene: 'meadow', night: false, weather: 'none' });
  });
});
