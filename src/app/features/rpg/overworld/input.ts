import { signal } from '@angular/core';
import type { Direction } from '../../../game/rpg/rpg-types';
import type { HapticPattern } from '../../../core/haptics/haptics.service';

/** What the input layer needs from whichever renderer hosts it (canvas or Pixi). */
export interface OverworldInputHost {
  phase(): string;
  interact(): void;
  openMenu(): void;
  fire(pattern: HapticPattern): void;
}

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};
const DRAG_DEAD = 22;
const TAP_MS = 260;

/**
 * Every way of steering the overworld — keyboard, on-screen pad, swipe-drag, tap-to-interact and
 * gamepad — in one place, shared by the canvas and the Pixi renderer so they behave identically.
 * Held directions are cleared whenever the browser could swallow the "up" event (blur, tab hidden,
 * pointer cancel), so the walker never keeps going on its own. The most recently pressed direction wins.
 */
export class OverworldInput {
  private readonly held = new Set<Direction>();
  private readonly pad = new Set<Direction>();
  private shift = false;
  private padRun = false;
  private padPrev = [false, false];
  /** Sticky run toggle for touch players (keyboard holds Shift, gamepad holds X). */
  readonly touchRun = signal(false);

  private target: HTMLElement | null = null;
  private dragId = -1;
  private dragActive = false;
  private dragX = 0;
  private dragY = 0;
  private dragT = 0;
  private dragDir: Direction | null = null;
  private dragMoved = false;

  constructor(private readonly host: OverworldInputHost) {}

  /** Start listening; `surface` is the element a swipe/tap on the map is read from. */
  attach(surface: HTMLElement): void {
    this.target = surface;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.onVisibility);
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointermove', this.onPointerMove);
    surface.addEventListener('pointerup', this.onPointerUp);
    surface.addEventListener('pointercancel', this.onPointerCancel);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.onVisibility);
    const s = this.target;
    if (s) {
      s.removeEventListener('pointerdown', this.onPointerDown);
      s.removeEventListener('pointermove', this.onPointerMove);
      s.removeEventListener('pointerup', this.onPointerUp);
      s.removeEventListener('pointercancel', this.onPointerCancel);
    }
    this.target = null;
    this.clear();
  }

  /** Forget every held input. */
  readonly clear = (): void => {
    this.held.clear();
    this.pad.clear();
    this.shift = false;
    this.padRun = false;
    this.dragActive = false;
    this.dragDir = null;
  };

  /** True while any run input is active. */
  isRunning(): boolean {
    return this.shift || this.padRun || this.touchRun();
  }

  /** The direction to walk this frame (latest key wins; the gamepad only when nothing else is held). */
  next(): Direction | null {
    let last: Direction | null = null;
    for (const d of this.held) last = d;
    if (last) return last;
    for (const d of this.pad) last = d;
    return last;
  }

  /* ------------------------------------------------------- on-screen buttons */

  press(dir: Direction, ev?: Event): void {
    ev?.preventDefault();
    if (this.host.phase() !== 'overworld') return;
    this.host.fire('tap');
    this.held.delete(dir); // re-insert so it becomes the newest
    this.held.add(dir);
  }
  release(dir: Direction): void {
    this.held.delete(dir);
  }
  toggleRun(ev?: Event): void {
    ev?.preventDefault();
    this.host.fire('select');
    this.touchRun.update((v) => !v);
  }
  interact(ev?: Event): void {
    ev?.preventDefault();
    if (this.host.phase() !== 'overworld') return;
    this.host.fire('tap');
    this.host.interact();
  }
  menu(ev?: Event): void {
    ev?.preventDefault();
    this.host.fire('tap');
    this.host.openMenu();
  }

  /* ------------------------------------------------------------- gamepad */

  /** Poll the first connected gamepad: stick/d-pad walk, A interacts, B opens the menu, X runs. */
  pollGamepad(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    let gp: Gamepad | null = null;
    if (pads) for (let i = 0; i < pads.length; i++) if (pads[i]?.connected) { gp = pads[i]; break; }
    this.pad.clear();
    if (!gp) { this.padRun = false; return; }
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    if (ay < -0.5 || gp.buttons[12]?.pressed) this.pad.add('up');
    if (ay > 0.5 || gp.buttons[13]?.pressed) this.pad.add('down');
    if (ax < -0.5 || gp.buttons[14]?.pressed) this.pad.add('left');
    if (ax > 0.5 || gp.buttons[15]?.pressed) this.pad.add('right');
    this.padRun = gp.buttons[2]?.pressed ?? false;
    const a = gp.buttons[0]?.pressed ?? false;
    const b = gp.buttons[1]?.pressed ?? false;
    const live = this.host.phase() === 'overworld';
    if (a && !this.padPrev[0] && live) this.host.interact();
    if (b && !this.padPrev[1] && live) this.host.openMenu();
    this.padPrev = [a, b];
  }

  /* ------------------------------------------------------------- keyboard */

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.shift = e.shiftKey;
    if (this.host.phase() !== 'overworld') return; // a dialogue/starter overlay is active
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') {
      if (isTyping(e.target)) return;
      e.preventDefault();
      this.host.interact();
      return;
    }
    if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      this.host.openMenu();
      return;
    }
    const dir = KEY_DIR[e.key];
    if (dir && !isTyping(e.target)) {
      e.preventDefault();
      this.held.delete(dir);
      this.held.add(dir);
    }
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.shift = e.shiftKey;
    const dir = KEY_DIR[e.key];
    if (dir) this.held.delete(dir);
  };
  private readonly onVisibility = (): void => {
    if (document.hidden) this.clear();
  };

  /* ------------------------- swipe to steer, quick tap to interact (touch) */

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.dragActive) return;
    // the on-screen buttons, the menu and the party HUD handle their own taps
    if ((e.target as HTMLElement | null)?.closest('.pad, .ab, .ow-menu, .party-hud, button')) return;
    this.dragActive = true;
    this.dragId = e.pointerId;
    this.dragX = e.clientX;
    this.dragY = e.clientY;
    this.dragT = performance.now();
    this.dragDir = null;
    this.dragMoved = false;
  };
  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragActive || e.pointerId !== this.dragId) return;
    const dx = e.clientX - this.dragX;
    const dy = e.clientY - this.dragY;
    if (Math.abs(dx) < DRAG_DEAD && Math.abs(dy) < DRAG_DEAD) return;
    this.dragMoved = true;
    const dir: Direction = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    if (dir !== this.dragDir) {
      if (this.dragDir) this.held.delete(this.dragDir);
      this.dragDir = dir;
      this.held.add(dir);
      this.host.fire('tap');
    }
  };
  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.dragId || !this.dragActive) return;
    this.endDrag();
    // a tap (barely moved, brief) interacts with what is in front of the player
    const quick = performance.now() - this.dragT < TAP_MS;
    if (!this.dragMoved && quick && this.host.phase() === 'overworld') {
      this.host.fire('tap');
      this.host.interact();
    }
  };
  /** The system took the touch away (scroll, palm, notification): stop, but never count it as a tap. */
  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.dragId) this.endDrag();
  };
  private endDrag(): void {
    this.dragActive = false;
    if (this.dragDir) this.held.delete(this.dragDir);
    this.dragDir = null;
  }
}

/** True when the key press belongs to a text field (never steer or interact from there). */
function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}
