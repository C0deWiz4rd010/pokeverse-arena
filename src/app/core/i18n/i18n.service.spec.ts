import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService, detectLocale, interpolate } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

describe('i18n helpers', () => {
  it('picks German only for de-* browsers', async () => {
    expect(detectLocale(['de-DE', 'en'])).toBe('de');
    expect(detectLocale(['DE'])).toBe('de');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['fr'])).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });

  it('interpolates indexed and named slots and leaves unknown ones alone', async () => {
    expect(interpolate('Lv{0} · {1}', [5, 'x'])).toBe('Lv5 · x');
    expect(interpolate('{a}–{b}', { a: 1, b: 2 })).toBe('1–2');
    expect(interpolate('keep {9}', [1])).toBe('keep {9}');
    expect(interpolate('plain')).toBe('plain');
  });
});

describe('I18nService', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    i18n = TestBed.inject(I18nService);
  });

  it('returns the English source text in English', async () => {
    await i18n.set('en');
    expect(i18n.t('Battle Log')).toBe('Battle Log');
    expect(i18n.t('Lv{0}', [7])).toBe('Lv7');
  });

  it('translates exact keys and fills indexed slots in German', async () => {
    await i18n.set('de');
    expect(i18n.t('Battle Log')).toBe('Kampfprotokoll');
    expect(i18n.t('Lv{0}', [7])).toBe('Lv7');
    expect(i18n.t('Floor {0} of {1}', [2, 9])).toBe('Etage 2 von 9');
  });

  it('falls back to English for unknown text', async () => {
    await i18n.set('de');
    expect(i18n.t('A string nobody translated yet')).toBe('A string nobody translated yet');
  });

  it('matches sentence patterns and translates the captured pieces', async () => {
    await i18n.set('de');
    expect(i18n.t('Pikachu fell asleep!')).toBe('Pikachu ist eingeschlafen!');
    // the captured stat name is itself translated
    expect(i18n.t('Pikachu’s Attack fell!'.replace('’', "'"))).toBe('Pikachus Angriff ist gesunken!');
  });

  it('translates both sides of a "Speaker: line" sentence', async () => {
    await i18n.set('de');
    expect(i18n.t('Prof. Oak: Take one of these three partners — choose well!')).toContain('Prof. Eich');
  });

  it('persists the choice and updates the document language', async () => {
    await i18n.set('de');
    expect(localStorage.getItem('pv:locale')).toBe('de');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('de');
    await i18n.toggle();
    expect(i18n.locale()).toBe('en');
  });
});

describe('TranslatePipe', () => {
  it('translates strings, passes numbers through and blanks null', async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    const i18n = TestBed.inject(I18nService);
    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());
    await i18n.set('de');
    expect(pipe.transform('Close')).toBe('Schließen');
    expect(pipe.transform(42)).toBe('42');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('Lv{0}', [3])).toBe('Lv3');
  });
});
