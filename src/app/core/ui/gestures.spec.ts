import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onSwipe, type SwipeEvent } from './gestures';

describe('onSwipe', () => {
  let el: HTMLElement;
  let clock: number;
  let events: SwipeEvent[];
  let off: () => void;

  const fire = (type: string, x: number, y: number, pointerId = 1): void => {
    const e = new Event(type);
    Object.assign(e, { clientX: x, clientY: y, pointerId });
    el.dispatchEvent(e);
  };
  const gesture = (dx: number, dy: number, ms = 100, id = 1): void => {
    fire('pointerdown', 100, 100, id);
    clock += ms;
    fire('pointerup', 100 + dx, 100 + dy, id);
  };

  beforeEach(() => {
    el = document.createElement('div');
    events = [];
    clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    off = onSwipe(el, (e) => events.push(e));
  });
  afterEach(() => vi.restoreAllMocks());

  it('resolves the four directions', () => {
    gesture(-60, 0);
    gesture(60, 0);
    gesture(0, -60);
    gesture(0, 60);
    expect(events.map((e) => e.dir)).toEqual(['left', 'right', 'up', 'down']);
    expect(events.every((e) => !e.tap)).toBe(true);
    expect(events[0]).toMatchObject({ dx: -60, dy: 0 });
  });

  it('locks to the dominant axis', () => {
    gesture(70, 40);
    gesture(30, -80);
    expect(events.map((e) => e.dir)).toEqual(['right', 'up']);
  });

  it('reports a tap for a tiny movement', () => {
    gesture(3, -4);
    expect(events).toEqual([{ dir: null, tap: true, dx: 3, dy: -4 }]);
  });

  it('ignores a drag that is neither a tap nor long enough', () => {
    gesture(20, 0);
    expect(events).toEqual([]);
  });

  it('ignores a swipe that took too long, but a slow tap still counts', () => {
    gesture(100, 0, 900);
    expect(events).toEqual([]);
    gesture(2, 2, 900);
    expect(events).toHaveLength(1);
    expect(events[0]!.tap).toBe(true);
  });

  it('ignores pointerup from another pointer and without a press', () => {
    fire('pointerup', 200, 100);
    fire('pointerdown', 100, 100, 1);
    fire('pointerup', 200, 100, 2);
    expect(events).toEqual([]);
  });

  it('drops a cancelled gesture', () => {
    fire('pointerdown', 100, 100);
    fire('pointercancel', 100, 100);
    fire('pointerup', 200, 100);
    expect(events).toEqual([]);
  });

  it('honours custom thresholds', () => {
    off();
    off = onSwipe(el, (e) => events.push(e), { threshold: 10, tapSlop: 2, maxDuration: 50 });
    gesture(12, 0, 10);
    gesture(12, 0, 80);
    expect(events.map((e) => e.dir)).toEqual(['right']);
  });

  it('detaches every listener', () => {
    off();
    gesture(80, 0);
    gesture(1, 1);
    expect(events).toEqual([]);
  });
});
