import { inject } from '@angular/core';
import type { NavigationError } from '@angular/router';
import { ToastService } from '../ui/toast/toast.service';

const RELOAD_KEY = 'pv:chunk-reload';
const RELOAD_COOLDOWN_MS = 60_000;

/** True for the errors a browser throws when a lazy chunk vanished after a deploy. */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(msg);
}

/** Reload at most once per cooldown so a genuinely broken deploy can't loop. */
function reloadAllowed(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY));
    if (last && Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  return true;
}

/**
 * Router navigation-error handler: a new deploy replaces hashed chunks, so an old tab
 * navigating to a lazy route fails to import it. Reload once to pick up the new
 * version; if that already happened recently, tell the user instead of looping.
 */
export function chunkAwareNavigationErrorHandler(e: NavigationError): void {
  // The router runs navigation-error handlers inside an injection context.
  const toast = inject(ToastService);
  if (!isChunkLoadError(e.error)) {
    console.error('Navigation error', e.error);
    return;
  }
  if (reloadAllowed()) {
    location.reload();
    return;
  }
  toast.show({
    title: 'Update available',
    text: 'A newer version was deployed — please reload the page.',
    icon: 'download',
    kind: 'info',
  });
}
