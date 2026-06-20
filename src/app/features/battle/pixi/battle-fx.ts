import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
} from '@angular/core';
import type { Application, Container, Graphics } from 'pixi.js';
import type { PokemonType } from '../../../core/utils/type-chart';
import type { SideIndex } from '../../../game/engine';

/** Official type colours as Pixi-friendly hex numbers (mirror of theme.scss). */
const TYPE_HEX: Record<PokemonType, number> = {
  normal: 0x9099a1,
  fire: 0xff9d55,
  water: 0x4d90d5,
  electric: 0xf4d23c,
  grass: 0x63bc5a,
  ice: 0x73cec0,
  fighting: 0xce4069,
  poison: 0xab6ac8,
  ground: 0xd97746,
  flying: 0x8fa8dd,
  psychic: 0xfa7179,
  bug: 0x90c12c,
  rock: 0xc7b78b,
  ghost: 0x5269ac,
  dragon: 0x0b6dc3,
  dark: 0x5a5366,
  steel: 0x5a8ea1,
  fairy: 0xec8fe6,
};

type ParticleKind = 'spark' | 'ring';

interface Particle {
  readonly gfx: Graphics;
  readonly kind: ParticleKind;
  vx: number;
  vy: number;
  life: number;
  readonly ttl: number;
  readonly grow: number;
}

/** Approximate fighter anchor points within the arena, as fractions of size. */
const ANCHOR: Record<SideIndex, { x: number; y: number }> = {
  0: { x: 0.22, y: 0.64 }, // player (lower-left)
  1: { x: 0.78, y: 0.34 }, // foe (upper-right)
};

/**
 * A lazily-loaded PixiJS overlay that paints GPU-accelerated combat effects
 * (impact bursts, crit flashes, charge swirls) over the CSS battle arena.
 *
 * It degrades gracefully: if WebGL is unavailable or the user prefers reduced
 * motion, the canvas is simply never created and every effect call is a no-op,
 * so the battle still plays out perfectly with its CSS animations alone.
 */
@Component({
  selector: 'pv-battle-fx',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: [
    `:host {
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
      z-index: 2;
    }`,
  ],
})
export class BattleFxComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  private app: Application | null = null;
  private layer: Container | null = null;
  private pixi: typeof import('pixi.js') | null = null;
  private readonly particles: Particle[] = [];
  private ready = false;
  private destroyed = false;
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    afterNextRender(() => void this.init());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.ready = false;
    this.particles.length = 0;
    if (this.app) {
      this.app.destroy({ removeView: true }, { children: true });
      this.app = null;
    }
  }

  /** Impact burst on the side that just took damage. */
  impact(side: SideIndex, type: PokemonType, crit = false): void {
    if (!this.ready || !this.app) return;
    const { x, y } = this.point(side);
    const color = TYPE_HEX[type] ?? 0xffffff;
    this.ring(x, y, color);
    const count = crit ? 28 : 18;
    for (let i = 0; i < count; i++) this.spark(x, y, color);
    if (crit) {
      this.ring(x, y, 0xffffff);
      for (let i = 0; i < 10; i++) this.spark(x, y, 0xffffff);
    }
  }

  /** A brief charge swirl at the attacker before the strike lands. */
  cast(side: SideIndex, type: PokemonType): void {
    if (!this.ready || !this.app) return;
    const { x, y } = this.point(side);
    const color = TYPE_HEX[type] ?? 0xffffff;
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      this.spark(x + Math.cos(a) * 24, y + Math.sin(a) * 24, color, -Math.cos(a) * 2, -Math.sin(a) * 2, 0.9);
    }
  }

  /* --------------------------------------------------------------- internals */

  private async init(): Promise<void> {
    if (this.reduceMotion || this.destroyed) return;
    try {
      const pixi = await import('pixi.js');
      if (this.destroyed) return;
      const app = new pixi.Application();
      await app.init({
        resizeTo: this.host.nativeElement,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2),
      });
      if (this.destroyed) {
        app.destroy({ removeView: true });
        return;
      }
      const layer = new pixi.Container();
      app.stage.addChild(layer);
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
      this.host.nativeElement.appendChild(app.canvas);
      app.ticker.add((ticker) => this.tick(ticker.deltaTime));
      this.pixi = pixi;
      this.app = app;
      this.layer = layer;
      this.ready = true;
    } catch {
      /* WebGL unavailable — effects silently disabled. */
    }
  }

  private point(side: SideIndex): { x: number; y: number } {
    const { width, height } = this.app!.screen;
    const a = ANCHOR[side];
    return { x: width * a.x, y: height * a.y };
  }

  private spark(x: number, y: number, color: number, vx?: number, vy?: number, speed = 1): void {
    if (!this.pixi || !this.layer) return;
    const r = 2 + Math.random() * 3;
    const g = new this.pixi.Graphics().circle(0, 0, r).fill({ color, alpha: 1 });
    g.position.set(x, y);
    this.layer.addChild(g);
    const angle = Math.random() * Math.PI * 2;
    const mag = (2 + Math.random() * 4) * speed;
    this.particles.push({
      gfx: g,
      kind: 'spark',
      vx: vx ?? Math.cos(angle) * mag,
      vy: vy ?? Math.sin(angle) * mag,
      life: 1,
      ttl: 28 + Math.random() * 16,
      grow: 0,
    });
  }

  private ring(x: number, y: number, color: number): void {
    if (!this.pixi || !this.layer) return;
    const g = new this.pixi.Graphics().circle(0, 0, 10).stroke({ color, width: 3, alpha: 1 });
    g.position.set(x, y);
    this.layer.addChild(g);
    this.particles.push({ gfx: g, kind: 'ring', vx: 0, vy: 0, life: 1, ttl: 22, grow: 0.12 });
  }

  private tick(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta / p.ttl;
      if (p.life <= 0) {
        p.gfx.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      if (p.kind === 'spark') {
        p.gfx.x += p.vx * delta;
        p.gfx.y += p.vy * delta;
        p.vy += 0.18 * delta; // gravity
        p.vx *= 0.98;
        p.gfx.alpha = p.life;
        p.gfx.scale.set(0.6 + p.life * 0.4);
      } else {
        p.gfx.scale.set(1 + (1 - p.life) * 3.2);
        p.gfx.alpha = p.life * 0.8;
      }
    }
  }
}
