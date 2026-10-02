import { Injectable } from '@angular/core';
import type { PreloadingStrategy, Route } from '@angular/router';
import { EMPTY, Observable, from, switchMap, timer } from 'rxjs';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** Respect Data Saver and slow connections — never spend someone's data on guesses. */
export function shouldPreload(conn: NetworkInformationLike | undefined): boolean {
  if (!conn) return true;
  if (conn.saveData) return false;
  return !/(^|-)2g$/.test(conn.effectiveType ?? '');
}

/**
 * Preloads only routes flagged with `data: { preload: true }`, a moment after the
 * app has settled, and only on a healthy connection. Everything else stays lazy.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data?.['preload']) return EMPTY;
    const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
    if (!shouldPreload(conn)) return EMPTY;
    return timer(2500).pipe(switchMap(() => from(load())));
  }
}
