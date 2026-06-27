import { describe, expect, it } from 'vitest';
import { animatedSprite, cryUrl, idFromUrl, officialArtwork } from './pokeapi-endpoints';

describe('pokeapi endpoint helpers', () => {
  it('extracts the trailing id from a resource url', () => {
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon/25/')).toBe(25);
    expect(idFromUrl('.../pokemon/151')).toBe(151);
  });

  it('builds official artwork urls (incl. shiny)', () => {
    expect(officialArtwork(25)).toMatch(/official-artwork\/25\.png$/);
    expect(officialArtwork(25, true)).toMatch(/official-artwork\/shiny\/25\.png$/);
  });

  it('builds animated showdown sprite urls (incl. shiny)', () => {
    expect(animatedSprite(6)).toMatch(/showdown\/6\.gif$/);
    expect(animatedSprite(6, true)).toMatch(/showdown\/shiny\/6\.gif$/);
  });

  it('builds a cry url by id', () => {
    expect(cryUrl(1)).toMatch(/cries\/pokemon\/latest\/1\.ogg$/);
  });
});
