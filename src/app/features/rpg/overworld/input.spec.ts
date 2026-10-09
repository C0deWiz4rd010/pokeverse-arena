import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OverworldInput, type OverworldInputHost } from './input';

function setup(phase = 'overworld') {
  const calls = { interact: 0, menu: 0, fired: [] as string[] };
  const host: OverworldInputHost = {
    phase: () => phase,
    interact: () => { calls.interact++; },
    openMenu: () => { calls.menu++; },
    fire: (p) => { calls.fired.push(p); },
  };
  const surface = document.createElement('div');
  document.body.appendChild(surface);
  const input = new OverworldInput(host);
  input.attach(surface);
  return { input, calls, surface };
}

const key = (type: 'keydown' | 'keyup', k: string, shift = false) =>
  window.dispatchEvent(new KeyboardEvent(type, { key: k, shiftKey: shift, cancelable: true }));

function pointer(el: HTMLElement, type: string, x: number, y: number, id = 1) {
  const e = new Event(type, { bubbles: true }) as Event & Record<string, unknown>;
  Object.assign(e, { pointerId: id, clientX: x, clientY: y });
  el.dispatchEvent(e);
}

describe('OverworldInput', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.input.detach(); ctx.surface.remove(); });

  it('walks while an arrow is held and stops on release', () => {
    key('keydown', 'ArrowLeft');
    expect(ctx.input.next()).toBe('left');
    key('keyup', 'ArrowLeft');
    expect(ctx.input.next()).toBeNull();
  });

  it('the most recently pressed direction wins', () => {
    key('keydown', 'ArrowUp');
    key('keydown', 'ArrowRight');
    expect(ctx.input.next()).toBe('right');
    key('keyup', 'ArrowRight');
    expect(ctx.input.next()).toBe('up');
  });

  it('forgets held keys when the window loses focus or the tab is hidden', () => {
    key('keydown', 'd');
    window.dispatchEvent(new Event('blur'));
    expect(ctx.input.next()).toBeNull();
    key('keydown', 's');
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    expect(ctx.input.next()).toBeNull();
  });

  it('Shift runs, and the touch toggle is sticky', () => {
    key('keydown', 'ArrowUp', true);
    expect(ctx.input.isRunning()).toBe(true);
    key('keyup', 'ArrowUp', false);
    expect(ctx.input.isRunning()).toBe(false);
    ctx.input.toggleRun();
    expect(ctx.input.isRunning()).toBe(true);
  });

  it('Z interacts and Escape opens the menu — but not while typing in a field', () => {
    key('keydown', 'z');
    key('keydown', 'Escape');
    expect([ctx.calls.interact, ctx.calls.menu]).toEqual([1, 1]);
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(ctx.calls.interact).toBe(1);
    field.remove();
  });

  it('ignores steering while an overlay owns the screen', () => {
    ctx.input.detach();
    ctx = setup('dialogue');
    key('keydown', 'ArrowUp');
    ctx.input.press('left');
    expect(ctx.input.next()).toBeNull();
  });

  it('a swipe steers and a quick still tap interacts', () => {
    pointer(ctx.surface, 'pointerdown', 100, 100);
    pointer(ctx.surface, 'pointermove', 100, 160);
    expect(ctx.input.next()).toBe('down');
    pointer(ctx.surface, 'pointerup', 100, 160);
    expect(ctx.input.next()).toBeNull();
    expect(ctx.calls.interact).toBe(0);
    pointer(ctx.surface, 'pointerdown', 50, 50, 2);
    pointer(ctx.surface, 'pointerup', 50, 50, 2);
    expect(ctx.calls.interact).toBe(1);
  });

  it('a cancelled touch stops the walk and never counts as a tap', () => {
    pointer(ctx.surface, 'pointerdown', 100, 100);
    pointer(ctx.surface, 'pointermove', 160, 100);
    expect(ctx.input.next()).toBe('right');
    pointer(ctx.surface, 'pointercancel', 160, 100);
    expect(ctx.input.next()).toBeNull();
    expect(ctx.calls.interact).toBe(0);
  });

  it('stops listening after detach', () => {
    ctx.input.detach();
    key('keydown', 'ArrowUp');
    expect(ctx.input.next()).toBeNull();
  });
});
