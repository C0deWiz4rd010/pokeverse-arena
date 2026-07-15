import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
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
    ),
  ],
};
