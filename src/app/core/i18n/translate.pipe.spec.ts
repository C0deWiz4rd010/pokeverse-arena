import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    i18n = TestBed.inject(I18nService);
    pipe = TestBed.runInInjectionContext(() => new TranslatePipe());
  });

  it('is impure so it follows the locale signal', () => {
    const meta = (TranslatePipe as unknown as { ɵpipe: { pure: boolean } }).ɵpipe;
    expect(meta.pure).toBe(false);
  });

  it('returns an empty string for nullish and empty input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('stringifies numbers without translating', () => {
    expect(pipe.transform(42)).toBe('42');
    expect(pipe.transform(0)).toBe('0');
  });

  it('passes English text through and interpolates params', () => {
    expect(pipe.transform('Battle Log')).toBe('Battle Log');
    expect(pipe.transform('Lv{0}', [12])).toBe('Lv12');
    expect(pipe.transform('{name} wins', { name: 'Pikachu' })).toBe('Pikachu wins');
  });

  it('translates after the locale switches to German', async () => {
    await i18n.set('de');
    expect(pipe.transform('Battle')).toBe('Kampf');
    await i18n.set('en');
    expect(pipe.transform('Battle')).toBe('Battle');
  });
});
