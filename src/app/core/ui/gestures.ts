/**
 * Lightweight pointer-based swipe detection — no dependencies, framework-free.
 * Attach to any element; the callback fires once per gesture with the resolved
 * direction (axis-locked to the dominant movement) plus a `tap` flag for taps.
 *
 *   const off = onSwipe(el, ({ dir, tap }) => { ... });
 *   // later: off();  // detaches all listeners
 */
export type SwipeDir = 'up' | 'down' | 'left' | 'right';

export interface SwipeEvent {
  dir: SwipeDir | null;
  tap: boolean;
  dx: number;
  dy: number;
}

export interface SwipeOptions {
  /** Minimum travel (px) along the dominant axis to count as a swipe. */
  threshold?: number;
  /** Max travel (px) that still counts as a tap. */
  tapSlop?: number;
  /** Max duration (ms) for a gesture to be considered (longer = ignored). */
  maxDuration?: number;
}

export function onSwipe(
  el: HTMLElement,
  cb: (e: SwipeEvent) => void,
  opts: SwipeOptions = {},
): () => void {
  const threshold = opts.threshold ?? 36;
  const tapSlop = opts.tapSlop ?? 10;
  const maxDuration = opts.maxDuration ?? 800;

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let active = false;
  let id = -1;

  const down = (ev: PointerEvent): void => {
    active = true;
    id = ev.pointerId;
    startX = ev.clientX;
    startY = ev.clientY;
    startT = performance.now();
  };

  const up = (ev: PointerEvent): void => {
    if (!active || ev.pointerId !== id) return;
    active = false;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const dt = performance.now() - startT;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (adx <= tapSlop && ady <= tapSlop) {
      cb({ dir: null, tap: true, dx, dy });
      return;
    }
    if (dt > maxDuration) return;

    let dir: SwipeDir | null = null;
    if (adx >= ady && adx >= threshold) dir = dx < 0 ? 'left' : 'right';
    else if (ady > adx && ady >= threshold) dir = dy < 0 ? 'up' : 'down';
    if (dir) cb({ dir, tap: false, dx, dy });
  };

  const cancel = (): void => {
    active = false;
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);

  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
