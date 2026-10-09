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

type ParticleKind = 'spark' | 'ring' | 'bolt';
type Shape = 'circle' | 'rect' | 'shard' | 'leaf' | 'star';

/** How a type's hits look: each one has its own silhouette and motion. */
type Style = 'ember' | 'splash' | 'bolt' | 'leaf' | 'shard' | 'psy' | 'burst' | 'debris';
const STYLE: Record<PokemonType, Style> = {
  fire: 'ember', water: 'splash', poison: 'splash', electric: 'bolt', grass: 'leaf', bug: 'leaf',
  ice: 'shard', psychic: 'psy', ghost: 'psy', fairy: 'psy', dark: 'psy',
  fighting: 'burst', normal: 'burst', steel: 'burst', dragon: 'burst', flying: 'burst',
  ground: 'debris', rock: 'debris',
};

interface SparkOpts {
  grav?: number;
  spin?: number;
  drag?: number;
  shape?: Shape;
  size?: number;
  ttl?: number;
}

interface Particle {
  readonly gfx: Graphics;
  readonly kind: ParticleKind;
  vx: number;
  vy: number;
  life: number;
  readonly ttl: number;
  readonly grow: number;
  readonly grav: number;
  readonly spin: number;
  readonly drag: number;
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
      const gl = (this.app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
      this.app.destroy({ removeView: true }, { children: true });
      this.app = null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }

  /** Impact burst on the side that just took damage. */
  impact(side: SideIndex, type: PokemonType, crit = false): void {
    if (!this.ready || !this.app) return;
    const { x, y } = this.point(side);
    const color = TYPE_HEX[type] ?? 0xffffff;
    this.ring(x, y, color);
    this.styled((crit ? 1.5 : 1), STYLE[type] ?? 'burst', x, y, color);
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

  /** The type-specific part of an impact: embers rise, droplets fall, bolts fork, leaves spin … */
  private styled(n: number, style: Style, x: number, y: number, color: number): void {
    const r = Math.random;
    switch (style) {
      case 'ember':
        for (let i = 0; i < 16 * n; i++)
          this.spark(x + (r() - 0.5) * 24, y + (r() - 0.2) * 12, i % 3 === 0 ? 0xffe27a : color, (r() - 0.5) * 2, -1.2 - r() * 2.6, 1, { grav: -0.05, shape: 'circle', size: 2 + r() * 3, ttl: 34 + r() * 14, drag: 0.97 });
        break;
      case 'splash':
        for (let i = 0; i < 16 * n; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 2.4;
          const m = 2.5 + r() * 3.5;
          this.spark(x, y, color, Math.cos(a) * m, Math.sin(a) * m, 1, { grav: 0.3, shape: 'circle', size: 1.8 + r() * 2.6, ttl: 34 });
        }
        this.ring(x, y + 6, color);
        break;
      case 'bolt':
        for (let i = 0; i < 4 * n; i++) this.bolt(x, y, color);
        for (let i = 0; i < 8 * n; i++) this.spark(x, y, 0xfff6b0, undefined, undefined, 1.4, { shape: 'rect', size: 2, ttl: 20, grav: 0 });
        break;
      case 'leaf':
        for (let i = 0; i < 14 * n; i++)
          this.spark(x, y, color, undefined, undefined, 0.8, { shape: 'leaf', size: 6 + r() * 4, grav: 0.05, spin: (r() - 0.5) * 0.4, ttl: 46, drag: 0.96 });
        break;
      case 'shard':
        for (let i = 0; i < 14 * n; i++)
          this.spark(x, y, i % 2 ? 0xe9fbff : color, undefined, undefined, 1.1, { shape: 'shard', size: 5 + r() * 5, grav: 0.14, spin: (r() - 0.5) * 0.5, ttl: 38 });
        break;
      case 'psy':
        this.ring(x, y, color);
        for (let i = 0; i < 10 * n; i++)
          this.spark(x, y, color, undefined, undefined, 0.7, { shape: 'star', size: 5 + r() * 4, grav: 0, spin: 0.08, ttl: 50, drag: 0.94 });
        break;
      case 'debris':
        for (let i = 0; i < 14 * n; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
          const m = 2 + r() * 3.5;
          this.spark(x, y, color, Math.cos(a) * m, Math.sin(a) * m, 1, { shape: 'rect', size: 3 + r() * 4, grav: 0.34, spin: (r() - 0.5) * 0.5, ttl: 36 });
        }
        break;
      default: {
        // burst: radiating impact lines plus a few hard sparks
        this.rays(x, y, color, 10);
        for (let i = 0; i < 12 * n; i++) this.spark(x, y, color);
      }
    }
  }

  private shapeAt(gfx: Graphics, shape: Shape, size: number, color: number): Graphics {
    switch (shape) {
      case 'rect': return gfx.rect(-size / 2, -size / 2, size, size).fill(color);
      case 'shard': return gfx.poly([0, -size, size * 0.45, size * 0.6, -size * 0.45, size * 0.6]).fill(color);
      case 'leaf': return gfx.ellipse(0, 0, size, size * 0.45).fill(color).moveTo(-size, 0).lineTo(size, 0).stroke({ width: 0.8, color: 0xffffff, alpha: 0.35 });
      case 'star': {
        const pts: number[] = [];
        for (let i = 0; i < 8; i++) { const rr = i % 2 ? size * 0.4 : size; const a = (Math.PI / 4) * i; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
        return gfx.poly(pts).fill(color);
      }
      default: return gfx.circle(0, 0, size).fill({ color, alpha: 1 });
    }
  }

  /** A forked lightning stroke that flickers out. */
  private bolt(x: number, y: number, color: number): void {
    if (!this.pixi || !this.layer || this.particles.length >= 140) return;
    this.wake();
    const g = new this.pixi.Graphics();
    const a = Math.random() * Math.PI * 2;
    g.moveTo(0, 0);
    for (let i = 1; i <= 5; i++) {
      g.lineTo(Math.cos(a) * i * 9 + (Math.random() - 0.5) * 10, Math.sin(a) * i * 9 + (Math.random() - 0.5) * 10);
    }
    g.stroke({ width: 3, color, alpha: 0.9 });
    g.moveTo(0, 0);
    for (let i = 1; i <= 5; i++) g.lineTo(Math.cos(a) * i * 9 + (Math.random() - 0.5) * 6, Math.sin(a) * i * 9 + (Math.random() - 0.5) * 6);
    g.stroke({ width: 1, color: 0xffffff, alpha: 1 });
    g.position.set(x, y);
    this.layer.addChild(g);
    this.particles.push({ gfx: g, kind: 'bolt', vx: 0, vy: 0, life: 1, ttl: 16, grow: 0, grav: 0, spin: 0, drag: 1 });
  }

  /** Radiating impact lines (they scale outward like a ring). */
  private rays(x: number, y: number, color: number, count: number): void {
    if (!this.pixi || !this.layer) return;
    this.wake();
    const g = new this.pixi.Graphics();
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8).lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
    }
    g.stroke({ width: 2.5, color, alpha: 1 });
    g.position.set(x, y);
    this.layer.addChild(g);
    this.particles.push({ gfx: g, kind: 'ring', vx: 0, vy: 0, life: 1, ttl: 18, grow: 0.12, grav: 0, spin: 0, drag: 1 });
  }

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
      // an empty stage needs no frames: wake the ticker only while particles live
      app.ticker.autoStart = false;
      app.ticker.stop();
      app.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
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
    // aim at the real sprite when it can be found; the fixed anchors are only a fallback
    const root = this.host.nativeElement.parentElement;
    const img = root?.querySelector<HTMLElement>(side === 1 ? '.fighter.foe .sprite' : '.fighter:not(.foe) .sprite');
    if (img) {
      const r = img.getBoundingClientRect();
      const h = this.host.nativeElement.getBoundingClientRect();
      if (r.width > 0 && h.width > 0) return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height * 0.5 };
    }
    const a = ANCHOR[side];
    return { x: width * a.x, y: height * a.y };
  }

  private spark(x: number, y: number, color: number, vx?: number, vy?: number, speed = 1, o: SparkOpts = {}): void {
    if (!this.pixi || !this.layer || this.particles.length >= 140) return;
    this.wake();
    const r = o.size ?? 2 + Math.random() * 3;
    const g = this.shapeAt(new this.pixi.Graphics(), o.shape ?? 'circle', r, color);
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
      ttl: o.ttl ?? 28 + Math.random() * 16,
      grow: 0,
      grav: o.grav ?? 0.18,
      spin: o.spin ?? 0,
      drag: o.drag ?? 0.98,
    });
  }

  private ring(x: number, y: number, color: number): void {
    if (!this.pixi || !this.layer) return;
    this.wake();
    const g = new this.pixi.Graphics().circle(0, 0, 10).stroke({ color, width: 3, alpha: 1 });
    g.position.set(x, y);
    this.layer.addChild(g);
    this.particles.push({ gfx: g, kind: 'ring', vx: 0, vy: 0, life: 1, ttl: 22, grow: 0.12, grav: 0, spin: 0, drag: 1 });
  }

  private wake(): void {
    if (this.app && !this.app.ticker.started && !document.hidden) this.app.ticker.start();
  }

  private tick(delta: number): void {
    if (!this.particles.length) {
      this.app?.ticker.stop();
      return;
    }
    delta = Math.min(delta, 3);
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
        p.vy += p.grav * delta;
        p.vx *= Math.pow(p.drag, delta);
        p.gfx.rotation += p.spin * delta;
        p.gfx.alpha = Math.min(1, p.life * 1.6);
        p.gfx.scale.set(0.6 + p.life * 0.4);
      } else if (p.kind === 'bolt') {
        p.gfx.alpha = p.life > 0.45 ? (Math.random() > 0.3 ? 1 : 0.35) : p.life * 2;
      } else {
        p.gfx.scale.set(1 + (1 - p.life) * 3.2);
        p.gfx.alpha = p.life * 0.8;
      }
    }
  }
}
