import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';
import { TranslatedTitleStrategy } from './translated-title.strategy';

describe('TranslatedTitleStrategy', () => {
  let strategy: TranslatedTitleStrategy;
  let i18n: I18nService;
  let title: Title;
  const snapshot = {} as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: TitleStrategy, useClass: TranslatedTitleStrategy }],
    });
    title = TestBed.inject(Title);
    title.setTitle('initial');
    i18n = TestBed.inject(I18nService);
    strategy = TestBed.inject(TitleStrategy) as TranslatedTitleStrategy;
    TestBed.tick();
  });

  it('sets the document title from the route title', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue('Battle');
    strategy.updateTitle(snapshot);
    expect(title.getTitle()).toBe('Battle');
  });

  it('leaves the title alone when the route has none', () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue(undefined);
    strategy.updateTitle(snapshot);
    expect(title.getTitle()).toBe('initial');
  });

  it('re-translates the current title on a language switch', async () => {
    vi.spyOn(strategy, 'buildTitle').mockReturnValue('Battle');
    strategy.updateTitle(snapshot);
    await i18n.set('de');
    TestBed.tick();
    expect(title.getTitle()).toBe('Kampf');
    await i18n.set('en');
    TestBed.tick();
    expect(title.getTitle()).toBe('Battle');
  });
});
