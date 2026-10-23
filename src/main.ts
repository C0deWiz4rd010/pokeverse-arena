import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  console.error(err);
  const root = document.querySelector('app-root') ?? document.body;
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText = 'padding:2rem 1rem;max-width:32rem;margin:10vh auto;font:16px system-ui,sans-serif;text-align:center;color:#e8ecf4';
  box.textContent = 'PokéVerse Arena could not start. Please reload the page — if this keeps happening, clear the site data and try again.';
  root.replaceChildren(box);
});

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
