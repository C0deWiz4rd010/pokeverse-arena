import { describe, expect, it } from 'vitest';
import {
  takesWeatherChip,
  weatherChipDamage,
  weatherDamageFactor,
  weatherDefenseFactor,
} from './weather';

describe('weather damage factors', () => {
  it('sun boosts Fire and weakens Water', () => {
    expect(weatherDamageFactor('sun', 'fire')).toBe(1.5);
    expect(weatherDamageFactor('sun', 'water')).toBe(0.5);
  });

  it('rain boosts Water and weakens Fire', () => {
    expect(weatherDamageFactor('rain', 'water')).toBe(1.5);
    expect(weatherDamageFactor('rain', 'fire')).toBe(0.5);
  });

  it('is neutral otherwise', () => {
    expect(weatherDamageFactor('sand', 'fire')).toBe(1);
    expect(weatherDamageFactor('none', 'water')).toBe(1);
  });
});

describe('weather passive defence', () => {
  it('gives Rock-types +50% Sp.Def in sand', () => {
    expect(weatherDefenseFactor('sand', ['rock'], true)).toBe(1.5);
    expect(weatherDefenseFactor('sand', ['rock'], false)).toBe(1);
  });

  it('gives Ice-types +50% Def in snow', () => {
    expect(weatherDefenseFactor('snow', ['ice'], false)).toBe(1.5);
  });
});

describe('weather chip', () => {
  it('chips non-immune types in sand', () => {
    expect(takesWeatherChip('sand', ['normal'])).toBe(true);
    expect(takesWeatherChip('sand', ['rock'])).toBe(false);
    expect(takesWeatherChip('sand', ['steel'])).toBe(false);
  });

  it('chips everyone but Ice in hail', () => {
    expect(takesWeatherChip('hail', ['fire'])).toBe(true);
    expect(takesWeatherChip('hail', ['ice'])).toBe(false);
  });

  it('deals 1/16 max HP', () => {
    expect(weatherChipDamage('sand', 160, ['normal'])).toBe(10);
    expect(weatherChipDamage('sand', 160, ['ground'])).toBe(0);
  });
});
