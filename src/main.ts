import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Register the PWA service worker outside the local dev server so HMR stays
// untouched while production (e.g. GitHub Pages) gains offline support.
if ('serviceWorker' in navigator) {
  const host = location.hostname;
  const isLocalDev = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (!isLocalDev) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => undefined);
    });
  }
}
