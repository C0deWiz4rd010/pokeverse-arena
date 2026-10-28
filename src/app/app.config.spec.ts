import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PreloadingStrategy, Router, ROUTES, TitleStrategy } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { appConfig } from './app.config';
import { routes } from './app.routes';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { IdlePreloadStrategy } from './core/update/idle-preload';

describe('appConfig', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('provides a non-empty provider list', () => {
    expect(appConfig.providers.length).toBeGreaterThan(5);
  });

  it('wires the translating title strategy', () => {
    expect(TestBed.inject(TitleStrategy)).toBeInstanceOf(TranslatedTitleStrategy);
  });

  it('registers the application route table', () => {
    const registered = TestBed.inject(ROUTES).flat();
    expect(registered).toEqual(routes);
    expect(TestBed.inject(Router).config).toEqual(routes);
  });

  it('preloads through the idle strategy', () => {
    expect(TestBed.inject(PreloadingStrategy)).toBeInstanceOf(IdlePreloadStrategy);
  });

  it('resolves the language in an app initializer before first paint', async () => {
    await TestBed.inject(I18nService).ready();
    expect(TestBed.inject(I18nService).locale()).toBe('en');
  });

  it('uses hash-based URLs for static hosting', () => {
    expect(TestBed.inject(LocationStrategy)).toBeInstanceOf(HashLocationStrategy);
  });
});
