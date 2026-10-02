import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { TitleStrategy } from '@angular/router';
import { I18nService } from './core/i18n/i18n.service';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { chunkAwareNavigationErrorHandler } from './core/update/chunk-error';
import { IdlePreloadStrategy } from './core/update/idle-preload';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
    // German visitors get the dictionary before the first paint (no English flash)
    provideAppInitializer(() => inject(I18nService).ready()),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Hash routing keeps deep links working on GitHub Pages (no server rewrites).
      withHashLocation(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      // Native cross-page fade (View Transitions API); browsers without support
      // simply skip it, and the CSS respects prefers-reduced-motion. The initial
      // navigation is skipped — starting a transition there races the first
      // paint and logs an InvalidStateError abort.
      withViewTransitions({ skipInitialTransition: true }),
      withNavigationErrorHandler(chunkAwareNavigationErrorHandler),
      withPreloading(IdlePreloadStrategy),
    ),
  ],
};
