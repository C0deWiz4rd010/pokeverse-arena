import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { RpgService } from '../rpg.service';
import type { Direction } from '../../../game/rpg/rpg-types';
import { VOID, drawCharacter, drawTile } from './tile-renderer';

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  W: 'up', S: 'down', A: 'left', D: 'right',
};

/**
 * Tile-based overworld: a `<canvas>` camera that follows the player with smooth
 * grid-step movement, plus keyboard (arrows/WASD, Z/Enter interact, Esc menu) and
 * on-screen controls for touch. The render loop only runs while mounted (the shell
 * mounts this component solely during the `overworld` phase).
 */
@Component({
  selector: 'pv-overworld',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ow" #wrap>
      <canvas #cv class="ow-canvas"></canvas>

      @if (svc.map(); as m) {
        <div class="ow-loc">{{ m.name }}</div>
      }
      @if (svc.toast(); as t) {
        <div class="ow-toast" role="status">{{ t }}</div>
      }
      <button class="ow-menu" type="button" (click)="svc.openMenu()" aria-label="Menu">☰</button>

      <!-- touch controls -->
      <div class="pad" aria-hidden="true">
        <button class="pad-btn up" (pointerdown)="press('up', $event)" (pointerup)="release('up')" (pointerleave)="release('up')">▲</button>
        <button class="pad-btn left" (pointerdown)="press('left', $event)" (pointerup)="release('left')" (pointerleave)="release('left')">◀</button>
        <button class="pad-btn right" (pointerdown)="press('right', $event)" (pointerup)="release('right')" (pointerleave)="release('right')">▶</button>
        <button class="pad-btn down" (pointerdown)="press('down', $event)" (pointerup)="release('down')" (pointerleave)="release('down')">▼</button>
      </div>
      <div class="ab" aria-hidden="true">
        <button class="ab-btn a" (pointerdown)="interact($event)">A</button>
        <button class="ab-btn b" (pointerdown)="svc.openMenu()">B</button>
      </div>
    </div>
  `,
  styleUrl: './overworld.scss',
})
export class OverworldComponent implements OnDestroy {
  protected readonly svc = inject(RpgService);
  private readonly wrap = viewChild.required<ElementRef<HTMLDivElement>>('wrap');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');

  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private ts = 32;
  private cssW = 0;
  private cssH = 0;
  private frame = 0;

  // visual (tweened) position; logical position lives in the service.
  private visX = 0;
  private visY = 0;
  private stepping = false;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private t0 = 0;
  private readonly held = new Set<Direction>();
  private readonly stepMs = REDUCED ? 0 : 140;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') {
      e.preventDefault();
      this.svc.interact();
      return;
    }
    if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      this.svc.openMenu();
      return;
    }
    const dir = KEY_DIR[e.key];
    if (dir) {
      e.preventDefault();
      this.held.add(dir);
    }
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const dir = KEY_DIR[e.key];
    if (dir) this.held.delete(dir);
  };
  private readonly onResize = (): void => this.resize();

  constructor() {
    afterNextRender(() => {
      const p = this.svc.player();
      if (p) {
        this.visX = p.x;
        this.visY = p.y;
      }
      this.ctx = this.canvas().nativeElement.getContext('2d');
      this.resize();
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('resize', this.onResize);
      this.loop();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
  }

  protected press(dir: Direction, ev?: Event): void {
    ev?.preventDefault();
    this.held.add(dir);
  }
  protected release(dir: Direction): void {
    this.held.delete(dir);
  }
  protected interact(ev?: Event): void {
    ev?.preventDefault();
    this.svc.interact();
  }

  /* ------------------------------------------------------------- internals */

  private resize(): void {
    const el = this.wrap().nativeElement;
    const cv = this.canvas().nativeElement;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = el.clientWidth;
    this.cssH = Math.max(360, Math.min(560, Math.round(el.clientWidth * 0.62)));
    cv.width = Math.round(this.cssW * dpr);
    cv.height = Math.round(this.cssH * dpr);
    cv.style.width = `${this.cssW}px`;
    cv.style.height = `${this.cssH}px`;
    this.ts = Math.max(26, Math.floor(this.cssW / 13));
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    this.frame++;
    this.update();
    this.render();
  };

  private update(): void {
    if (this.stepping) {
      const p = this.stepMs <= 0 ? 1 : Math.min(1, (performance.now() - this.t0) / this.stepMs);
      this.visX = this.from.x + (this.to.x - this.from.x) * p;
      this.visY = this.from.y + (this.to.y - this.from.y) * p;
      if (p >= 1) this.stepping = false;
      return;
    }
    // pick a held direction and try to walk
    const dir = this.nextDir();
    if (!dir) return;
    this.svc.face(dir);
    const before = this.svc.player();
    if (!before) return;
    const res = this.svc.commitStep(dir);
    if (res.warped) {
      const np = this.svc.player()!;
      this.visX = np.x;
      this.visY = np.y;
    } else if (res.moved) {
      const np = this.svc.player()!;
      this.from = { x: before.x, y: before.y };
      this.to = { x: np.x, y: np.y };
      this.t0 = performance.now();
      this.stepping = this.stepMs > 0;
      if (!this.stepping) {
        this.visX = np.x;
        this.visY = np.y;
      }
    }
  }

  private nextDir(): Direction | null {
    for (const d of ['up', 'down', 'left', 'right'] as const) if (this.held.has(d)) return d;
    return null;
  }

  private render(): void {
    const ctx = this.ctx;
    const map = this.svc.map();
    const player = this.svc.player();
    if (!ctx || !map || !player) return;

    const ts = this.ts;
    const originX = this.cssW / 2 - (this.visX + 0.5) * ts;
    const originY = this.cssH / 2 - (this.visY + 0.5) * ts;

    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    const x0 = Math.floor(-originX / ts) - 1;
    const x1 = Math.ceil((this.cssW - originX) / ts) + 1;
    const y0 = Math.floor(-originY / ts) - 1;
    const y1 = Math.ceil((this.cssH - originY) / ts) + 1;

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const kind = map.tiles[ty]?.[tx];
        if (!kind) continue;
        drawTile(ctx, kind, originX + tx * ts, originY + ty * ts, ts, this.frame);
      }
    }

    // NPCs (none in P1, but render-ready)
    for (const npc of map.npcs) {
      drawCharacter(ctx, originX + npc.x * ts, originY + npc.y * ts, ts, npc.facing, '#ffd166', '#c5524a');
    }

    // player at camera centre
    drawCharacter(ctx, this.cssW / 2 - ts / 2, this.cssH / 2 - ts / 2, ts, player.facing);
  }
}
