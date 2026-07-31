import { describe, expect, it } from 'vitest';
import { battleScene } from './battle-scene';
import type { MapDef } from './rpg-types';

const map = (over: Partial<MapDef>): Pick<MapDef, 'outdoor' | 'weather' | 'encounter'> => ({
  outdoor: true,
  ...over,
});

describe('battleScene', () => {
  it('defaults to a meadow by day', () => {
    expect(battleScene(map({}), 'day')).toEqual({ scene: 'meadow', night: false });
  });

  it('marks night from the time band', () => {
    expect(battleScene(map({}), 'night')).toEqual({ scene: 'meadow', night: true });
  });

  it('uses an indoor scene for interiors (never night)', () => {
    expect(battleScene(map({ outdoor: false }), 'night')).toEqual({ scene: 'indoor', night: false });
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

  it('falls back to a meadow with no map', () => {
    expect(battleScene(null, 'day')).toEqual({ scene: 'meadow', night: false });
  });
});
