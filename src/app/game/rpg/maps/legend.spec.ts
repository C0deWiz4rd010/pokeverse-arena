import { describe, expect, it } from 'vitest';
import { LEGEND, parseTiles } from './legend';
import { TILE, isWalkableTile } from '../tiles';

describe('decorative obstacle tiles', () => {
  const decor = ['rock', 'bush', 'stump'] as const;

  it('maps the new legend characters to their kinds', () => {
    expect(LEGEND['o']).toBe('rock');
    expect(LEGEND['b']).toBe('bush');
    expect(LEGEND['u']).toBe('stump');
  });

  it('parses a row of decorations into the right kinds', () => {
    expect(parseTiles(['obu'])).toEqual([['rock', 'bush', 'stump']]);
  });

  it('are solid obstacles you cannot walk through', () => {
    for (const k of decor) {
      expect(TILE[k].walkable, `${k} walkable`).toBe(false);
      expect(isWalkableTile(k), `${k} isWalkableTile`).toBe(false);
      expect(TILE[k].grass, `${k} grass`).toBeFalsy();
    }
  });
});
