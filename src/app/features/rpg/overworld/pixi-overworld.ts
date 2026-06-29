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
import type { Direction, MapDef, TileKind } from '../../../game/rpg/rpg-types';
import { CHAR_ART, GROUNDED, SHEET_URL, TILE_ART, TILE_PX, charIndex, frameRect, type Sheet, type TileArt } from './atlas';

type Pixi = typeof import('pixi.js');
type PApplication = import('pixi.js').Application;
type PContainer = import('pixi.js').Container;
type PTexture = import('pixi.js').Texture;
type PSprite = import('pixi.js').Sprite;

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

/**
 * High-end PixiJS (WebGL) overworld: real CC0 pixel tiles (Kenney Tiny Town /
 * Tiny Dungeon), animated water & tall grass, a follow camera and character
 * sprites. Movement/warps/interaction stay in {@link RpgService}; input mirrors
 * the canvas renderer (keyboard + on-screen pad). Falls back to the canvas
 * renderer (chosen by the shell) when WebGL or motion is unavailable.
 */
@Component({
  selector: 'pv-pixi-overworld',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ow" #host>
      <div class="ow-mount" #mount></div>
      @if (svc.map(); as m) { <div class="ow-loc">{{ m.name }}</div> }
      @if (svc.toast(); as t) { <div class="ow-toast" role="status">{{ t }}</div> }
      <button class="ow-menu" type="button" (click)="svc.openMenu()" aria-label="Menu">☰</button>
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
export class PixiOverworldComponent implements OnDestroy {
  protected readonly svc = inject(RpgService);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly mount = viewChild.required<ElementRef<HTMLDivElement>>('mount');

  private PIXI: Pixi | null = null;
  private app: PApplication | null = null;
  private world!: PContainer;
  private tilesLayer!: PContainer;
  private entitiesLayer!: PContainer;
  private destroyed = false;

  private frames = new Map<string, PTexture>();
  private sheets: Record<Sheet, PTexture | null> = { town: null, dungeon: null };
  private waterTiles: { g: import('pixi.js').Graphics; x: number; y: number }[] = [];
  private grassTiles: { c: PContainer; blades: import('pixi.js').Graphics[] }[] = [];
  private player: PSprite | null = null;
  private builtMapId = '';
  private zoom = 3;

  private visX = 0;
  private visY = 0;
  private stepping = false;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private t0 = 0;
  private readonly held = new Set<Direction>();
  private readonly stepMs = REDUCED ? 0 : 150;
  private frame = 0;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.svc.phase() !== 'overworld') return;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') { e.preventDefault(); this.svc.interact(); return; }
    if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') { e.preventDefault(); this.svc.openMenu(); return; }
    const dir = KEY_DIR[e.key];
    if (dir) { e.preventDefault(); this.held.add(dir); }
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const dir = KEY_DIR[e.key];
    if (dir) this.held.delete(dir);
  };
  private readonly onResize = (): void => this.resize();

  constructor() {
    afterNextRender(() => void this.init());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.app?.destroy(true, { children: true, texture: false });
    this.app = null;
  }

  protected press(dir: Direction, ev?: Event): void {
    ev?.preventDefault();
    if (this.svc.phase() === 'overworld') this.held.add(dir);
  }
  protected release(dir: Direction): void { this.held.delete(dir); }
  protected interact(ev?: Event): void {
    ev?.preventDefault();
    if (this.svc.phase() === 'overworld') this.svc.interact();
  }

  /* ------------------------------------------------------------- setup */

  private async init(): Promise<void> {
    const p = this.svc.player();
    if (p) { this.visX = p.x; this.visY = p.y; }
    try {
      this.PIXI = await import('pixi.js');
      if (this.destroyed) return;
      const app = new this.PIXI.Application();
      const host = this.host().nativeElement;
      await app.init({
        width: host.clientWidth || 640,
        height: this.targetHeight(host.clientWidth || 640),
        background: '#05060f',
        antialias: false,
        roundPixels: true,
      });
      if (this.destroyed) { app.destroy(true); return; }
      this.app = app;
      this.mount().nativeElement.appendChild(app.canvas);

      await this.loadSheets();
      if (this.destroyed) return;

      this.world = new this.PIXI.Container();
      this.tilesLayer = new this.PIXI.Container();
      this.entitiesLayer = new this.PIXI.Container();
      this.world.addChild(this.tilesLayer, this.entitiesLayer);
      app.stage.addChild(this.world);

      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('resize', this.onResize);

      this.resize();
      this.rebuildMap();
      app.ticker.add(() => this.tick());
    } catch {
      // WebGL unavailable — the shell's reduced/no-webgl path should have caught
      // this, but bail quietly so the page never crashes.
    }
  }

  private async loadSheets(): Promise<void> {
    const pixi = this.PIXI!;
    const urls = { town: new URL(SHEET_URL.town, document.baseURI).href, dungeon: new URL(SHEET_URL.dungeon, document.baseURI).href };
    const [town, dungeon] = await Promise.all([pixi.Assets.load(urls.town), pixi.Assets.load(urls.dungeon)]);
    for (const t of [town, dungeon] as PTexture[]) t.source.scaleMode = 'nearest';
    this.sheets = { town, dungeon };
  }

  private texFor(sheet: Sheet, i: number): PTexture {
    const key = `${sheet}:${i}`;
    let t = this.frames.get(key);
    if (!t) {
      const r = frameRect(i);
      t = new this.PIXI!.Texture({ source: this.sheets[sheet]!.source, frame: new this.PIXI!.Rectangle(r.x, r.y, r.w, r.h) });
      this.frames.set(key, t);
    }
    return t;
  }

  /* ------------------------------------------------------------- build map */

  private rebuildMap(): void {
    const map = this.svc.map();
    if (!map || !this.app) return;
    this.builtMapId = map.id;
    this.tilesLayer.removeChildren();
    this.entitiesLayer.removeChildren();
    this.waterTiles = [];
    this.grassTiles = [];

    const base: TileArt = map.outdoor ? TILE_ART.grass : TILE_ART.floor;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const kind = map.tiles[y][x] as TileKind;
        // ground underlay so decorations/walls sit on something
        this.drawArt(base, x, y);
        if (kind !== 'grass' && kind !== 'floor') this.drawTile(kind, x, y, map);
      }
    }

    // ground items
    const flags = this.svc.game()?.flags ?? {};
    for (const it of map.items) {
      if (flags[it.flag]) continue;
      this.entitiesLayer.addChild(this.makeBall(it.x, it.y));
    }
    // NPCs
    for (const npc of map.npcs) {
      this.entitiesLayer.addChild(this.makeChar(charIndex(npc.sprite), npc.x, npc.y));
    }
    // player
    this.player = this.makeChar(charIndex('boy'), this.visX, this.visY);
    this.entitiesLayer.addChild(this.player);
  }

  private drawTile(kind: TileKind, x: number, y: number, map: MapDef): void {
    const art = TILE_ART[kind];
    if ('proc' in art) {
      if (art.proc === 'water') this.tilesLayer.addChild(this.makeWater(x, y));
      else this.tilesLayer.addChild(this.makeTallGrass(x, y));
      return;
    }
    // grounded decorations already have grass under them from the base pass
    if (!GROUNDED.has(kind) || map.outdoor) this.drawArt(art, x, y);
    else this.drawArt(art, x, y);
  }

  private drawArt(art: TileArt, x: number, y: number): void {
    if ('proc' in art) return;
    const s = new this.PIXI!.Sprite(this.texFor(art.sheet, art.i));
    s.x = x * TILE_PX;
    s.y = y * TILE_PX;
    if (art.tint !== undefined) s.tint = art.tint;
    this.tilesLayer.addChild(s);
  }

  private makeWater(x: number, y: number): PContainer {
    const pixi = this.PIXI!;
    const c = new pixi.Container();
    c.x = x * TILE_PX; c.y = y * TILE_PX;
    const base = new pixi.Graphics().rect(0, 0, TILE_PX, TILE_PX).fill(0x2f6fd0);
    const ripple = new pixi.Graphics().rect(0, 5, 8, 1.5).fill(0x6fb0ff).rect(6, 11, 8, 1.5).fill(0x5b95e6);
    c.addChild(base, ripple);
    this.waterTiles.push({ g: ripple, x, y });
    return c;
  }

  private makeTallGrass(x: number, y: number): PContainer {
    const pixi = this.PIXI!;
    const c = new pixi.Container();
    c.x = x * TILE_PX; c.y = y * TILE_PX;
    const base = new pixi.Sprite(this.texFor('town', 0));
    c.addChild(base);
    const blades: import('pixi.js').Graphics[] = [];
    for (let i = 0; i < 4; i++) {
      const b = new pixi.Graphics().rect(0, 0, 2, 7).fill(0x256b3d);
      b.x = 2 + i * 4; b.y = 8; blades.push(b); c.addChild(b);
    }
    this.grassTiles.push({ c, blades });
    return c;
  }

  private makeBall(x: number, y: number): PContainer {
    const pixi = this.PIXI!;
    const c = new pixi.Container();
    c.x = x * TILE_PX + TILE_PX / 2; c.y = y * TILE_PX + TILE_PX / 2;
    const g = new pixi.Graphics();
    g.arc(0, 0, 4.5, Math.PI, 0).fill(0xe23b3b).arc(0, 0, 4.5, 0, Math.PI).fill(0xf4f4ff).circle(0, 0, 4.5).stroke({ width: 1, color: 0x1a1430 });
    c.addChild(g);
    return c;
  }

  private makeChar(index: number, x: number, y: number): PSprite {
    const s = new this.PIXI!.Sprite(this.texFor('dungeon', index));
    s.anchor.set(0.5, 0.5);
    s.x = (x + 0.5) * TILE_PX;
    s.y = (y + 0.5) * TILE_PX;
    return s;
  }

  /* ------------------------------------------------------------- loop */

  private tick(): void {
    if (!this.app) return;
    if (this.svc.map()?.id !== this.builtMapId) {
      const p = this.svc.player();
      if (p) { this.visX = p.x; this.visY = p.y; this.stepping = false; }
      this.rebuildMap();
    }
    this.frame++;
    this.updateMovement();
    this.animateTiles();
    this.updateCamera();
  }

  private updateMovement(): void {
    if (this.stepping) {
      const t = this.stepMs <= 0 ? 1 : Math.min(1, (performance.now() - this.t0) / this.stepMs);
      this.visX = this.from.x + (this.to.x - this.from.x) * t;
      this.visY = this.from.y + (this.to.y - this.from.y) * t;
      if (t >= 1) this.stepping = false;
    } else if (this.svc.phase() === 'overworld') {
      const dir = this.nextDir();
      if (dir) {
        this.svc.face(dir);
        const before = this.svc.player();
        const res = this.svc.commitStep(dir);
        const np = this.svc.player();
        if (np && this.player) this.flipFace(dir);
        if (res.warped && np) { this.visX = np.x; this.visY = np.y; }
        else if (res.moved && before && np) {
          this.from = { x: before.x, y: before.y };
          this.to = { x: np.x, y: np.y };
          this.t0 = performance.now();
          this.stepping = this.stepMs > 0;
          if (!this.stepping) { this.visX = np.x; this.visY = np.y; }
        }
      }
    }
    if (this.player) {
      this.player.x = (this.visX + 0.5) * TILE_PX;
      this.player.y = (this.visY + 0.5) * TILE_PX;
      // subtle walk bob
      this.player.y -= this.stepping && !REDUCED ? Math.abs(Math.sin(this.frame / 4)) * 1.5 : 0;
    }
  }

  private flipFace(dir: Direction): void {
    if (!this.player) return;
    if (dir === 'left') this.player.scale.x = -1;
    else if (dir === 'right') this.player.scale.x = 1;
  }

  private nextDir(): Direction | null {
    for (const d of ['up', 'down', 'left', 'right'] as const) if (this.held.has(d)) return d;
    return null;
  }

  private animateTiles(): void {
    if (REDUCED) return;
    const t = this.frame;
    for (const w of this.waterTiles) {
      w.g.x = Math.sin(t / 30 + w.x) * 2;
      w.g.alpha = 0.7 + Math.sin(t / 25 + w.y) * 0.25;
    }
    for (const g of this.grassTiles) {
      const sway = Math.sin(t / 18 + g.c.x) * 0.6;
      for (const b of g.blades) b.skew.x = sway;
    }
  }

  private updateCamera(): void {
    if (!this.app) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    this.world.scale.set(this.zoom);
    this.world.x = Math.round(w / 2 - (this.visX + 0.5) * TILE_PX * this.zoom);
    this.world.y = Math.round(h / 2 - (this.visY + 0.5) * TILE_PX * this.zoom);
  }

  /* ------------------------------------------------------------- resize */

  private targetHeight(width: number): number {
    return Math.max(360, Math.min(560, Math.round(width * 0.62)));
  }

  private resize(): void {
    if (!this.app) return;
    const host = this.host().nativeElement;
    const w = host.clientWidth || 640;
    const h = this.targetHeight(w);
    this.app.renderer.resize(w, h);
    // ~13 tiles tall in view
    this.zoom = Math.max(2, Math.round(h / (13 * TILE_PX)));
  }
}
