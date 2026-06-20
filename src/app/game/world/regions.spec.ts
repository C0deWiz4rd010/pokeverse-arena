import { describe, expect, it } from 'vitest';
import {
  REGIONS,
  regionById,
  regionDexCount,
  regionForDex,
} from './regions';

describe('regions', () => {
  it('covers the nine core regions in generation order', () => {
    expect(REGIONS).toHaveLength(9);
    REGIONS.forEach((r, i) => {
      expect(r.generation).toBe(i + 1);
    });
  });

  it('has contiguous, non-overlapping dex ranges starting at 1', () => {
    expect(REGIONS[0].dexStart).toBe(1);
    for (let i = 1; i < REGIONS.length; i++) {
      expect(REGIONS[i].dexStart).toBe(REGIONS[i - 1].dexEnd + 1);
    }
  });

  it('maps a dex number to its debut region', () => {
    expect(regionForDex(25)?.id).toBe('kanto'); // Pikachu
    expect(regionForDex(155)?.id).toBe('johto'); // Cyndaquil
    expect(regionForDex(906)?.id).toBe('paldea'); // Sprigatito
    expect(regionForDex(9999)).toBeNull();
  });

  it('looks up regions by slug and counts their species', () => {
    const kanto = regionById('kanto');
    expect(kanto?.name).toBe('Kanto');
    expect(kanto && regionDexCount(kanto)).toBe(151);
    expect(regionById('nowhere')).toBeNull();
  });
});
