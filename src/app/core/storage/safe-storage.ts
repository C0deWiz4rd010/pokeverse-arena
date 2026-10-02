/**
 * Throw-proof wrappers over `localStorage`. Access itself can throw (blocked site
 * data, Safari private mode, sandboxed frames) — field initialisers and DI
 * constructors must never take the whole app down because of that.
 */
export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns false when the write failed (quota, blocked storage). */
export function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
