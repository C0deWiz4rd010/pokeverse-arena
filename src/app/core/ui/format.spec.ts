import { describe, expect, it } from 'vitest';
import { kgToLbs, metersToFeet, padId, titleCase, typeColorVar } from './format';

describe('format helpers', () => {
  it('title-cases slugs', () => {
    expect(titleCase('bulbasaur')).toBe('Bulbasaur');
    expect(titleCase('mr-mime')).toBe('Mr Mime');
    expect(titleCase('special-attack')).toBe('Special Attack');
    expect(titleCase('')).toBe('');
  });

  it('pads dex ids to three digits', () => {
    expect(padId(1)).toBe('#001');
    expect(padId(25)).toBe('#025');
    expect(padId(1025)).toBe('#1025');
  });

  it('maps a type onto its CSS variable', () => {
    expect(typeColorVar('fire')).toBe('var(--type-fire)');
  });

  it('converts metres to feet and inches', () => {
    expect(metersToFeet(0.4)).toBe(`1'04"`);
    expect(metersToFeet(1.8)).toBe(`5'11"`);
    expect(metersToFeet(0)).toBe(`0'00"`);
  });

  it('converts kilograms to pounds with one decimal', () => {
    expect(kgToLbs(6.9)).toBe('15.2 lbs');
    expect(kgToLbs(0)).toBe('0.0 lbs');
  });
});
