import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RpgService } from '../rpg.service';
import type { Direction, MapDef, TileKind, WeatherKind } from '../../../game/rpg/rpg-types';
import { dayGrade, timeBand, type TimeBand } from '../../../game/rpg/time';
import { OwPartyHudComponent } from './party-hud';
import {
  CHAR_SHEETS,
  CHAR_WALK_FRAMES,
  DOOR_OVERLAY,
  FLOWER_VARIANTS,
  GRASS,
  GRASS_VARIANTS,
  INDOOR_FLOOR,
  LILY_PAD,
  PINE,
  SHEET_URL,
  TALLGRASS_TUFT,
  TILE_ART,
  TILE_PX,
  TREE_SOLO,
  WATER_BASE,
  WATER_DEEP,
  WATER_GLINT,
  WATER_RIPPLE,
  charFrameRect,
  charSheetUrl,
  frameRect,
  pathAutoIndex,
  tileHash,
  wallAutoIndex,
  type Sheet,
  type TileArt,
} from './atlas';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type Pixi = typeof import('pixi.js');
type PApplication = import('pixi.js').Application;
type PContainer = import('pixi.js').Container;
type PTexture = import('pixi.js').Texture;
type PSprite = import('pixi.js').Sprite;

/** Tiles per culling block edge. */
const CHUNK = 8;
/** Upper bound on live dust/leaf particles. */
const MAX_PARTICLES = 120;
/** Phones / small laptops: render at 1x and keep effects lean. */
const lowEnd = (): boolean => {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4;
};
const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY_DIR: Record<string, Direction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

/**
 * High-end PixiJS (WebGL) overworld on the CC0 **Ninja Adventure** art pack:
 * auto-tiled paths and room walls, tree canopies that overlap the walkway,
 * seeded grass variants and lily ponds, animated water & tall grass, a follow
 * camera and characters with real 4-direction walk cycles. Movement/warps/
 * interaction stay in {@link RpgService}; input mirrors the canvas renderer
 * (keyboard + on-screen pad). Falls back to the canvas renderer (chosen by the
 * shell) when WebGL or motion is unavailable.
 */
@Component({
  selector: 'pv-pixi-overworld',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, OwPartyHudComponent],
  template: `
    <div class="ow" #host>
      <div class="ow-mount" #mount role="img" [attr.aria-label]="'Adventure map' | t"></div>
      @if (svc.map(); as m) { <div class="ow-loc">{{ m.name | t }}@if (weatherIcon(m.weather); as wi) { <span class="ow-wx">{{ wi }}</span> }<span class="ow-wx" [title]="'It is {0}' | t: [(band() | t)]">{{ timeIcon() }}</span>@if (svc.nuzlocke()) { <span class="ow-wx" [attr.title]="'Nuzlocke run' | t">💀</span> }@if (svc.comboHud(); as ch) { <span class="ow-wx" [attr.title]="'Catch combo — keep catching the same species!' | t">🔗 {{ ch }}</span> }</div> }
      @if (banner(); as b) { <div class="ow-banner" aria-hidden="true">{{ b | t }}</div> }
      @if (svc.toast(); as t) { <div class="ow-toast" role="status">{{ t }}</div> }
      <pv-ow-party-hud />
      <button class="ow-menu" type="button" (click)="svc.openMenu()" [attr.aria-label]="'Menu' | t">☰</button>
      <div class="pad" aria-hidden="true">
        <button class="pad-btn up" (pointerdown)="press('up', $event)" (pointerup)="release('up')" (pointerleave)="release('up')">▲</button>
        <button class="pad-btn left" (pointerdown)="press('left', $event)" (pointerup)="release('left')" (pointerleave)="release('left')">◀</button>
        <button class="pad-btn right" (pointerdown)="press('right', $event)" (pointerup)="release('right')" (pointerleave)="release('right')">▶</button>
        <button class="pad-btn down" (pointerdown)="press('down', $event)" (pointerup)="release('down')" (pointerleave)="release('down')">▼</button>
      </div>
      <div class="ab" aria-hidden="true">
        <button class="ab-btn r" [class.on]="touchRun()" (pointerdown)="toggleRun($event)" [attr.title]="'Run' | t">🏃</button>
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
  /** Static tiles grouped in CHUNK x CHUNK blocks so off-screen blocks cost nothing. */
  private chunks = new Map<string, { c: PContainer; x0: number; y0: number }>();
  private entitiesLayer!: PContainer;
  private canopyLayer!: PContainer;
  private destroyed = false;

  private frames = new Map<string, PTexture>();
  private sheets: Record<Sheet, PTexture | null> = { world: null, interior: null, wall: null };
  /** Character walk sheets (4 direction columns × walk-frame rows). */
  private charBases = new Map<string, PTexture>();
  /** Per-character animation state: sheet key, facing and gait. */
  private charMeta = new Map<PContainer, { key: string; dir: Direction; moving: boolean }>();
  private waterTiles: { g: import('pixi.js').Graphics; glint?: import('pixi.js').Graphics; foam?: import('pixi.js').Graphics; x: number; y: number }[] = [];
  private grassTiles: { c: PContainer; tufts: PSprite[]; x: number; y: number }[] = [];
  private canopyTops: { s: PSprite; x: number; y: number }[] = [];
  private player: PContainer | null = null;
  private builtMapId = '';
  private builtDirty = 0;
  private zoom = 3;

  // --- effects (Phase B) ---
  private fx!: PContainer; // screen-space overlays (vignette/light/night/ambient)
  private particlesLayer!: PContainer; // world-space particles
  private ambientLayer!: PContainer; // screen-space ambient (fireflies/weather)
  private vignette: PSprite | null = null;
  private light: PSprite | null = null;
  private nightTint: import('pixi.js').Graphics | null = null;
  private parts: { node: PContainer; vx: number; vy: number; life: number; max: number; grav: number }[] = [];
  private ambient: { s: PSprite; vx: number; vy: number; ph: number }[] = [];
  // --- weather (Phase C) ---
  private weatherLayer!: PContainer;
  private weatherTint: import('pixi.js').Graphics | null = null;
  private weather: WeatherKind | null = null;
  private rain: { g: PSprite; vy: number; vx: number }[] = [];
  private snow: { s: PSprite; vy: number; ph: number }[] = [];
  // --- ambient petals/leaves, tinted per region ---
  private petalLayer: PContainer | null = null;
  private petals: { g: PSprite; vx: number; vy: number; ph: number }[] = [];
  private shakeUntil = 0;
  private shakeMag = 0;
  /** npc id → container, so wanderers can glide to their runtime tile. */
  private readonly npcSprites = new Map<string, PContainer>();

  private visX = 0;
  private visY = 0;
  private stepping = false;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private t0 = 0;
  private readonly held = new Set<Direction>();
  private readonly baseStepMs = REDUCED ? 0 : 150;
  private stepDur = REDUCED ? 0 : 150;
  private running = false;
  /** Sticky run toggle for touch players (keyboard holds Shift, gamepad holds X). */
  protected readonly touchRun = signal(false);
  private frame = 0;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.running = e.shiftKey;
    if (this.svc.phase() !== 'overworld') return;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter') { e.preventDefault(); this.svc.interact(); return; }
    if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') { e.preventDefault(); this.svc.openMenu(); return; }
    const dir = KEY_DIR[e.key];
    if (dir) { e.preventDefault(); this.held.add(dir); }
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.running = e.shiftKey;
    const dir = KEY_DIR[e.key];
    if (dir) this.held.delete(dir);
  };
  private readonly onResize = (): void => this.resize();
  /** Losing focus would otherwise leave a key "held" and keep the hero walking. */
  private readonly onBlur = (): void => { this.held.clear(); this.running = false; };

  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private onScreen = true;
  private ctxLost = false;
  private readonly onVisibility = (): void => this.syncRun();
  private readonly onCtxLost = (e: Event): void => { e.preventDefault(); this.ctxLost = true; this.syncRun(); };
  private readonly onCtxRestored = (): void => { this.ctxLost = false; this.syncRun(); };

  private syncRun(): void {
    const t = this.app?.ticker;
    if (!t) return;
    const run = !document.hidden && this.onScreen && !this.ctxLost;
    if (run && !t.started) t.start();
    else if (!run && t.started) t.stop();
  }

  /* ------------------------------------------------- adaptive quality */

  private slowFor = 0;
  private lowQuality = false;

  /** Sustained slow frames switch the pretty-but-optional effects off. */
  private watchFps(delta: number): void {
    if (this.lowQuality || REDUCED) return;
    this.slowFor = delta > 1.6 ? this.slowFor + delta : Math.max(0, this.slowFor - 1);
    if (this.slowFor > 240) this.degrade();
  }

  private degrade(): void {
    this.lowQuality = true;
    this.world.filters = [];
    if (this.ambientLayer) this.ambientLayer.visible = false;
    if (this.petalLayer) this.petalLayer.visible = false;
    if (this.light) this.light.visible = false;
    const r = this.app?.renderer;
    if (r && r.resolution > 1) { r.resize(r.screen.width, r.screen.height, 1); this.resizeFx(); }
  }

  constructor() {
    afterNextRender(() => void this.init());
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ro?.disconnect();
    this.io?.disconnect();
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    const app = this.app;
    // keep the GL handle: browsers cap live contexts, so hand ours back explicitly
    const gl = (app?.renderer as unknown as { gl?: WebGLRenderingContext } | undefined)?.gl;
    app?.destroy(true, { children: true, texture: false });
    this.app = null;
    for (const t of this.frames.values()) t.destroy(false);
    this.frames.clear();
    for (const t of this.radialCache.values()) t.destroy(true);
    this.radialCache.clear();
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }

  protected press(dir: Direction, ev?: Event): void {
    ev?.preventDefault();
    if (this.svc.phase() === 'overworld') this.held.add(dir);
  }
  protected release(dir: Direction): void { this.held.delete(dir); }
  protected toggleRun(ev?: Event): void {
    ev?.preventDefault();
    this.touchRun.update((v) => !v);
  }
  protected interact(ev?: Event): void {
    ev?.preventDefault();
    if (this.svc.phase() === 'overworld') this.svc.interact();
  }

  protected weatherIcon(w?: WeatherKind): string {
    return w === 'rain' ? '🌧' : w === 'snow' ? '❄' : w === 'sun' ? '☀' : w === 'sandstorm' ? '🌪' : '';
  }

  protected band(): TimeBand {
    return timeBand();
  }
  protected timeIcon(): string {
    return this.band() === 'night' ? '🌙' : '🌞';
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
        // crisp on retina, but a phone's 3x panel would shade 9x the pixels for no visible gain
        resolution: lowEnd() ? 1 : Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (this.destroyed) { app.destroy(true); return; }
      this.app = app;
      this.mount().nativeElement.appendChild(app.canvas);

      await this.loadSheets();
      if (this.destroyed) return;

      this.world = new this.PIXI.Container();
      this.tilesLayer = new this.PIXI.Container();
      this.entitiesLayer = new this.PIXI.Container();
      this.particlesLayer = new this.PIXI.Container();
      this.canopyLayer = new this.PIXI.Container();
      // canopy sits above entities so players walk behind treetops
      this.world.addChild(this.tilesLayer, this.particlesLayer, this.entitiesLayer, this.canopyLayer);
      app.stage.addChild(this.world);
      if (!REDUCED) {
        // a gentle filmic colour-grade — richer greens/blues, a touch of contrast
        const grade = new this.PIXI.ColorMatrixFilter();
        grade.saturate(0.16, true);
        grade.brightness(1.03, true);
        grade.contrast(0.06, true);
        this.world.filters = [grade];
      }
      if (!REDUCED) this.buildFx();

      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onBlur);
      this.ro = new ResizeObserver(this.onResize);
      this.ro.observe(host);
      // sleep while the tab is hidden, the map is scrolled out of view or the GPU context is gone
      document.addEventListener('visibilitychange', this.onVisibility);
      this.io = new IntersectionObserver((e) => { this.onScreen = e[e.length - 1]?.isIntersecting ?? true; this.syncRun(); });
      this.io.observe(host);
      app.canvas.addEventListener('webglcontextlost', this.onCtxLost);
      app.canvas.addEventListener('webglcontextrestored', this.onCtxRestored);

      this.resize();
      this.rebuildMap();
      app.ticker.add((t) => this.tick(t.deltaTime));
    } catch {
      // WebGL unavailable — the shell's reduced/no-webgl path should have caught
      // this, but bail quietly so the page never crashes.
    }
  }

  private async loadSheets(): Promise<void> {
    const pixi = this.PIXI!;
    const abs = (u: string): string => new URL(u, document.baseURI).href;
    const keys = Object.keys(CHAR_SHEETS);
    const [world, interior, wall, ...chars] = (await Promise.all([
      pixi.Assets.load(abs(SHEET_URL.world)),
      pixi.Assets.load(abs(SHEET_URL.interior)),
      pixi.Assets.load(abs(SHEET_URL.wall)),
      ...keys.map((k) => pixi.Assets.load(abs(charSheetUrl(k)))),
    ])) as PTexture[];
    for (const t of [world, interior, wall, ...chars]) t.source.scaleMode = 'nearest';
    this.sheets = { world, interior, wall };
    keys.forEach((k, idx) => this.charBases.set(k, chars[idx]));
  }

  private texFor(sheet: Sheet, i: number): PTexture {
    const key = `${sheet}:${i}`;
    let t = this.frames.get(key);
    if (!t) {
      const r = frameRect(sheet, i);
      t = new this.PIXI!.Texture({ source: this.sheets[sheet]!.source, frame: new this.PIXI!.Rectangle(r.x, r.y, r.w, r.h) });
      this.frames.set(key, t);
    }
    return t;
  }

  /** Walk-frame texture of a character sheet (direction column × frame row). */
  private charTex(key: string, dir: Direction, frame: number): PTexture {
    const base = this.charBases.get(key) ?? this.charBases.get('boy')!;
    const cacheKey = `char:${key}:${dir}:${frame % CHAR_WALK_FRAMES}`;
    let t = this.frames.get(cacheKey);
    if (!t) {
      const r = charFrameRect(dir, frame);
      t = new this.PIXI!.Texture({ source: base.source, frame: new this.PIXI!.Rectangle(r.x, r.y, r.w, r.h) });
      this.frames.set(cacheKey, t);
    }
    return t;
  }

  /* ------------------------------------------------------------- build map */

  private rebuildMap(): void {
    const map = this.svc.map();
    if (!map || !this.app) return;
    this.builtMapId = map.id;
    this.showBanner(map.name);
    for (const ch of this.chunks.values()) ch.c.destroy({ children: true });
    this.chunks.clear();
    this.tilesLayer.removeChildren();
    this.entitiesLayer.removeChildren();
    this.canopyLayer.removeChildren();
    this.charMeta.clear();
    this.canopyTops = [];
    this.waterTiles = [];
    this.grassTiles = [];

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const kind = map.tiles[y][x] as TileKind;
        // ground underlay so decorations/walls sit on something; outdoor grass
        // sprinkles seeded texture variants for a hand-planted meadow look
        if (map.outdoor) {
          const h = tileHash(x, y);
          this.drawArt(h % 4 === 0 ? GRASS_VARIANTS[h % GRASS_VARIANTS.length] : GRASS, x, y);
          // sprinkle rare colour-graded wildflowers on open grass for a lived-in meadow
          if (kind === 'grass' && h % 37 === 0)
            this.drawArt(FLOWER_VARIANTS[(h >> 3) % FLOWER_VARIANTS.length], x, y);
          // scatter the odd mossy rock elsewhere so meadows aren't a flat carpet
          else if (kind === 'grass' && h % 53 === 0) this.drawRock(x, y, h);
        } else {
          this.drawArt(INDOOR_FLOOR, x, y);
        }
        if (kind !== 'grass' && kind !== 'floor') this.drawTile(kind, x, y, map);
      }
    }

    // ground items
    const flags = this.svc.game()?.flags ?? {};
    for (const it of map.items) {
      if (flags[it.flag]) continue;
      this.entitiesLayer.addChild(this.makeBall(it.x, it.y));
    }
    // daily berry bushes — ripe ones glow amber, picked ones sit dull
    for (const f of map.forage ?? []) {
      this.entitiesLayer.addChild(this.makeBush(f.x, f.y, this.svc.canForageAt(f.x, f.y)));
    }
    // NPCs (runtime positions — wanderers glide between tiles)
    this.npcSprites.clear();
    const positions = this.svc.npcPos();
    for (const npc of map.npcs) {
      const at = positions[npc.id] ?? npc;
      const s = this.makeChar(npc.sprite, at.x, at.y, npc.facing);
      this.npcSprites.set(npc.id, s);
      this.entitiesLayer.addChild(s);
    }
    // player
    this.player = this.makeChar(this.svc.appearance(), this.visX, this.visY, this.svc.player()?.facing ?? 'down');
    this.entitiesLayer.addChild(this.player);

    this.buildWeather(map.weather);
    this.buildPetals(map);
  }

  /** True when the neighbor tile joins a path run (paths flow into doors). */
  private joinsPath(map: MapDef, x: number, y: number): boolean {
    const k = map.tiles[y]?.[x];
    return k === 'path' || k === 'door';
  }

  private drawTile(kind: TileKind, x: number, y: number, map: MapDef): void {
    const art = TILE_ART[kind];
    if ('proc' in art) {
      if (art.proc === 'water') this.chunk(x, y).addChild(this.makeWater(x, y, map));
      else this.chunk(x, y).addChild(this.makeTallGrass(x, y));
      return;
    }
    if (kind === 'path') {
      const i = pathAutoIndex(
        this.joinsPath(map, x, y - 1), this.joinsPath(map, x + 1, y),
        this.joinsPath(map, x, y + 1), this.joinsPath(map, x - 1, y),
      );
      this.drawArt({ sheet: 'world', i }, x, y);
      return;
    }
    if (kind === 'wall') {
      const isWall = (tx: number, ty: number): boolean => map.tiles[ty]?.[tx] === 'wall';
      const floorish = (tx: number, ty: number): boolean => {
        const k = map.tiles[ty]?.[tx];
        return k === 'floor' || k === 'rug' || k === 'counter' || k === 'door';
      };
      const i = wallAutoIndex(
        isWall(x, y - 1), isWall(x + 1, y), isWall(x, y + 1), isWall(x - 1, y),
        floorish(x + 1, y), floorish(x, y - 1),
      );
      this.drawArt({ sheet: 'wall', i }, x, y);
      return;
    }
    if (kind === 'tree') {
      // a soft contact shadow grounds every trunk so forests gain depth
      const sx = x * TILE_PX + TILE_PX / 2;
      const shade = new this.PIXI!.Graphics()
        .ellipse(sx, y * TILE_PX + TILE_PX * 0.9, TILE_PX * 0.34, TILE_PX * 0.12)
        .fill({ color: 0x000000, alpha: 0.16 });
      this.chunk(x, y).addChild(shade);
      const isTree = (tx: number): boolean => map.tiles[y]?.[tx] === 'tree';
      let runStart = x;
      while (isTree(runStart - 1)) runStart--;
      let runEnd = x;
      while (isTree(runEnd + 1)) runEnd++;
      const runLen = runEnd - runStart + 1;
      const offset = x - runStart;
      // Rows alternate pine halves so pairs fuse into full conifers; isolated
      // trunks and the odd tail of a row get the self-contained round tree.
      if (runLen === 1 || (runLen % 2 === 1 && x === runEnd)) {
        this.drawArt({ sheet: 'world', i: TREE_SOLO }, x, y);
        return;
      }
      const right = offset % 2 === 1;
      this.drawArt({ sheet: 'world', i: right ? PINE.botR : PINE.botL }, x, y);
      const top = new this.PIXI!.Sprite(this.texFor('world', right ? PINE.topR : PINE.topL));
      top.x = x * TILE_PX;
      top.y = (y - 1) * TILE_PX;
      this.canopyLayer.addChild(top); // crown overlaps the tile above, over entities
      this.canopyTops.push({ s: top, x, y: y - 1 });
      return;
    }
    if (kind === 'rock' || kind === 'bush' || kind === 'stump') {
      this.drawProp(kind, x, y);
      return;
    }
    if (kind === 'door') {
      // outdoors the leaf sits in a house wall; indoors it lies on the floor
      if (map.outdoor) this.drawArt(art, x, y);
      const leaf = new this.PIXI!.Sprite(this.texFor('world', DOOR_OVERLAY));
      leaf.x = x * TILE_PX;
      leaf.y = y * TILE_PX;
      this.chunk(x, y).addChild(leaf);
      return;
    }
    // grounded decorations already have grass under them from the base pass
    this.drawArt(art, x, y);
  }

  /** The chunk container holding tile (x, y); created on first use. */
  private chunk(x: number, y: number): PContainer {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const key = `${cx},${cy}`;
    let ch = this.chunks.get(key);
    if (!ch) {
      const c = new this.PIXI!.Container();
      c.eventMode = 'none';
      ch = { c, x0: cx * CHUNK, y0: cy * CHUNK };
      this.chunks.set(key, ch);
      this.tilesLayer.addChild(c);
    }
    return ch.c;
  }

  /** Hide chunks (and skip tile animation) outside the camera, with a one-tile margin. */
  private cullChunks(w: number, h: number): void {
    const z = this.zoom * TILE_PX;
    const left = -this.world.x / z - 1, top = -this.world.y / z - 1;
    const right = (w - this.world.x) / z + 1, bottom = (h - this.world.y) / z + 1;
    this.view = { left, top, right, bottom };
    for (const ch of this.chunks.values()) {
      ch.c.visible = ch.x0 + CHUNK >= left && ch.x0 <= right && ch.y0 + CHUNK >= top && ch.y0 <= bottom;
    }
  }
  private view = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };

  private drawArt(art: TileArt, x: number, y: number): void {
    if ('proc' in art) return;
    const s = new this.PIXI!.Sprite(this.texFor(art.sheet, art.i));
    s.x = x * TILE_PX;
    s.y = y * TILE_PX;
    if (art.tint !== undefined) s.tint = art.tint;
    this.chunk(x, y).addChild(s);
  }

  private makeWater(x: number, y: number, map: MapDef): PContainer {
    const pixi = this.PIXI!;
    const c = new pixi.Container();
    c.x = x * TILE_PX; c.y = y * TILE_PX;
    const base = new pixi.Graphics().rect(0, 0, TILE_PX, TILE_PX).fill(WATER_BASE);
    c.addChild(base);
    // shorelines: a deep rim on every land side plus a bright foam thread that
    // laps the edge (foam pulses in animateTiles for a living surf line)
    const water = (tx: number, ty: number): boolean => (map.tiles[ty]?.[tx] ?? 'water') === 'water';
    const shore = new pixi.Graphics();
    const foam = new pixi.Graphics();
    const FOAM = { color: 0xeafcff, alpha: 0.9 } as const;
    const nN = !water(x, y - 1), nS = !water(x, y + 1), nW = !water(x - 1, y), nE = !water(x + 1, y);
    if (nN) { shore.rect(0, 0, TILE_PX, 2.5).fill(WATER_DEEP); foam.rect(0, 0, TILE_PX, 1).fill(FOAM); }
    if (nS) { shore.rect(0, TILE_PX - 2.5, TILE_PX, 2.5).fill(WATER_DEEP); foam.rect(0, TILE_PX - 1, TILE_PX, 1).fill(FOAM); }
    if (nW) { shore.rect(0, 0, 2.5, TILE_PX).fill(WATER_DEEP); foam.rect(0, 0, 1, TILE_PX).fill(FOAM); }
    if (nE) { shore.rect(TILE_PX - 2.5, 0, 2.5, TILE_PX).fill(WATER_DEEP); foam.rect(TILE_PX - 1, 0, 1, TILE_PX).fill(FOAM); }
    c.addChild(shore, foam);
    const h = tileHash(x, y);
    if (h % 13 === 0 && water(x, y - 1) && water(x, y + 1) && water(x - 1, y) && water(x + 1, y)) {
      // a lily pad drifts on calm open water (its baked bg matches WATER_BASE)
      c.addChild(new pixi.Sprite(this.texFor('world', LILY_PAD)));
    }
    const ripple = new pixi.Graphics().rect(0, 5, 8, 1.5).fill(WATER_RIPPLE).rect(6, 11, 8, 1.5).fill({ color: WATER_RIPPLE, alpha: 0.7 });
    const glint = new pixi.Graphics().rect(0, 0, 2, 2).fill(WATER_GLINT);
    glint.x = 3 + ((x * 7 + y * 13) % 10); glint.y = 2 + ((x * 5 + y * 3) % 9);
    glint.alpha = 0;
    c.addChild(ripple, glint);
    this.waterTiles.push({ g: ripple, glint, foam: nN || nS || nW || nE ? foam : undefined, x, y });
    return c;
  }

  private makeTallGrass(x: number, y: number): PContainer {
    const pixi = this.PIXI!;
    const c = new pixi.Container();
    c.x = x * TILE_PX; c.y = y * TILE_PX;
    const gArt = GRASS as Extract<TileArt, { sheet: Sheet }>;
    // a darker bed makes encounter grass unmistakable next to plain meadow
    const bed = new pixi.Sprite(this.texFor(gArt.sheet, gArt.i));
    bed.tint = 0x9fdc74;
    c.addChild(bed);
    // three staggered tufts fill the tile — the classic dense-thicket read
    const tufts: PSprite[] = [];
    for (const [ox, oy, scale] of [[-3.5, 0, 0.9], [4, 1, 1], [0.5, -3, 0.8]] as const) {
      const tuft = new pixi.Sprite(this.texFor('world', TALLGRASS_TUFT));
      tuft.anchor.set(0.5, 1);
      tuft.x = TILE_PX / 2 + ox;
      tuft.y = TILE_PX + oy;
      tuft.scale.set(scale);
      tufts.push(tuft);
      c.addChild(tuft);
    }
    this.grassTiles.push({ c, tufts, x, y });
    return c;
  }

  /** A small mossy rock — pure decoration on the ground layer, no collision.
   *  Tone/size are seeded from the tile hash so each boulder looks hand-placed. */
  private drawRock(x: number, y: number, h: number): void {
    const pixi = this.PIXI!;
    const cx = x * TILE_PX + TILE_PX / 2;
    const base = y * TILE_PX + TILE_PX * 0.72;
    const big = (h & 1) === 0;
    const rx = big ? 4.4 : 3.2;
    const ry = big ? 3.0 : 2.2;
    const grey = 0x8b8f96 + (h % 3) * 0x060606; // subtle tone variation
    const g = new pixi.Graphics()
      .ellipse(cx, base + ry * 0.9, rx * 1.1, ry * 0.5).fill({ color: 0x000000, alpha: 0.18 }) // ground shadow
      .ellipse(cx, base, rx, ry).fill(grey) // body
      .ellipse(cx - rx * 0.28, base - ry * 0.3, rx * 0.4, ry * 0.35).fill({ color: 0xffffff, alpha: 0.16 }); // top highlight
    if ((h % 5) === 0) g.ellipse(cx + rx * 0.2, base + ry * 0.2, rx * 0.5, ry * 0.35).fill({ color: 0x6faa5c, alpha: 0.5 }); // moss
    this.chunk(x, y).addChild(g);
  }

  /** Solid decorative obstacles authored into maps: a boulder, leafy bush or
   *  cut stump. Drawn procedurally (no atlas guessing) over the grass base. */
  private drawProp(kind: 'rock' | 'bush' | 'stump', x: number, y: number): void {
    const pixi = this.PIXI!;
    const px = x * TILE_PX, py = y * TILE_PX, cx = px + TILE_PX / 2;
    const h = tileHash(x, y);
    const g = new pixi.Graphics();
    // shared ground shadow so props sit on the grass
    g.ellipse(cx, py + TILE_PX * 0.86, TILE_PX * 0.38, TILE_PX * 0.13).fill({ color: 0x000000, alpha: 0.2 });
    if (kind === 'rock') {
      const grey = 0x8f949c + (h % 3) * 0x060606;
      g.ellipse(cx, py + TILE_PX * 0.62, TILE_PX * 0.42, TILE_PX * 0.34).fill(grey)
        .ellipse(cx - 2, py + TILE_PX * 0.5, TILE_PX * 0.18, TILE_PX * 0.14).fill({ color: 0xffffff, alpha: 0.18 })
        .ellipse(cx + 2.5, py + TILE_PX * 0.68, TILE_PX * 0.2, TILE_PX * 0.16).fill({ color: 0x000000, alpha: 0.12 });
      if (h % 3 === 0) g.ellipse(cx + 2, py + TILE_PX * 0.74, TILE_PX * 0.22, TILE_PX * 0.12).fill({ color: 0x6faa5c, alpha: 0.55 });
    } else if (kind === 'bush') {
      const lo = 0x3f8a4a, hi = 0x67b85f;
      g.circle(cx - 3.5, py + TILE_PX * 0.6, 4.2).fill(lo)
        .circle(cx + 3.5, py + TILE_PX * 0.6, 4.2).fill(lo)
        .circle(cx, py + TILE_PX * 0.5, 5).fill(hi)
        .circle(cx - 1.6, py + TILE_PX * 0.44, 1.8).fill({ color: 0xffffff, alpha: 0.14 });
      if (h % 4 === 0) g.circle(cx + 2, py + TILE_PX * 0.56, 1.1).fill(0xff5d73).circle(cx - 2.5, py + TILE_PX * 0.62, 1.1).fill(0xffd166);
    } else {
      // stump: a short trunk ring with a cut top
      const bark = 0x8a5a34, top = 0xc79461;
      g.roundRect(cx - 4, py + TILE_PX * 0.5, 8, TILE_PX * 0.34, 2).fill(bark)
        .ellipse(cx, py + TILE_PX * 0.5, 4.4, 2.4).fill(top)
        .ellipse(cx, py + TILE_PX * 0.5, 2.2, 1.2).stroke({ width: 0.8, color: 0x8a5a34, alpha: 0.7 });
    }
    this.chunk(x, y).addChild(g);
  }

  /** A forage berry bush: a tinted tuft, ripe ones topped with berry dots. */
  private makeBush(x: number, y: number, ripe: boolean): PContainer {
    const pixi = this.PIXI!;
    const c = new pixi.Container();
    c.x = x * TILE_PX; c.y = y * TILE_PX;
    const tuft = new pixi.Sprite(this.texFor('world', TALLGRASS_TUFT));
    tuft.anchor.set(0.5, 1);
    tuft.x = TILE_PX / 2;
    tuft.y = TILE_PX;
    if (!ripe) { tuft.tint = 0x9aa39a; tuft.alpha = 0.75; }
    c.addChild(tuft);
    if (ripe) {
      const berries = new pixi.Graphics()
        .circle(5, 7, 1.6).fill(0xff5d73)
        .circle(10, 5, 1.6).fill(0xff5d73)
        .circle(8, 10, 1.6).fill(0xffd166);
      c.addChild(berries);
    }
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

  /** A character = soft drop shadow + a 4-direction walk sprite, in one container. */
  private makeChar(key: string, x: number, y: number, facing: Direction = 'down'): PContainer {
    const pixi = this.PIXI!;
    const c = new pixi.Container();
    c.x = (x + 0.5) * TILE_PX;
    c.y = (y + 0.5) * TILE_PX;
    const shadow = new pixi.Graphics().ellipse(0, TILE_PX * 0.38, TILE_PX * 0.3, TILE_PX * 0.12).fill({ color: 0x000000, alpha: 0.32 });
    const s = new pixi.Sprite(this.charTex(key, facing, 0));
    s.anchor.set(0.5, 0.5);
    c.addChild(shadow, s);
    this.charMeta.set(c, { key, dir: facing, moving: false });
    return c;
  }

  /** The walk sprite inside a character container. */
  private charSprite(c: PContainer | null): PSprite | null {
    return (c?.children[1] as PSprite | undefined) ?? null;
  }

  /** Point a character in a direction and step its walk cycle (frame 0 = idle). */
  private poseChar(c: PContainer | null, dir: Direction | null, moving: boolean): void {
    if (!c) return;
    const meta = this.charMeta.get(c);
    const s = this.charSprite(c);
    if (!meta || !s) return;
    meta.dir = dir ?? meta.dir;
    meta.moving = moving;
    const frame = moving && !REDUCED ? Math.floor(this.frame / 7) % CHAR_WALK_FRAMES : 0;
    s.texture = this.charTex(meta.key, meta.dir, frame);
  }

  /* ------------------------------------------------------------- effects */

  private readonly radialCache = new Map<string, PTexture>();
  private radial(size: number, inner: string, outer: string): PTexture {
    const key = `${size}|${inner}|${outer}`;
    const hit = this.radialCache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, inner);
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    const tex = this.PIXI!.Texture.from(c);
    this.radialCache.set(key, tex);
    return tex;
  }

  private buildFx(): void {
    const pixi = this.PIXI!;
    this.fx = new pixi.Container();
    this.fx.eventMode = 'none';
    this.nightTint = new pixi.Graphics();
    this.nightTint.blendMode = 'multiply';
    this.nightTint.alpha = 0;
    this.light = new pixi.Sprite(this.radial(256, 'rgba(255,238,200,0.55)', 'rgba(255,238,200,0)'));
    this.light.anchor.set(0.5);
    this.light.blendMode = 'add';
    this.light.alpha = 0.18;
    this.vignette = new pixi.Sprite(this.radial(256, 'rgba(0,0,0,0)', 'rgba(0,0,0,1)'));
    this.vignette.alpha = 0.5;
    this.ambientLayer = new pixi.Container();
    this.weatherTint = new pixi.Graphics();
    this.weatherTint.blendMode = 'screen';
    this.weatherTint.alpha = 0;
    this.weatherLayer = new pixi.Container();
    this.weatherLayer.eventMode = 'none';
    this.fx.addChild(this.nightTint, this.weatherTint, this.light, this.vignette, this.ambientLayer, this.weatherLayer);
    this.app!.stage.addChild(this.fx);
    // ambient firefly/pollen pool
    for (let i = 0; i < 14; i++) {
      const s = new pixi.Sprite(this.radial(16, 'rgba(255,245,180,0.9)', 'rgba(255,245,180,0)'));
      s.anchor.set(0.5);
      s.width = s.height = 4 + Math.random() * 4;
      s.blendMode = 'add';
      s.alpha = 0;
      this.ambientLayer.addChild(s);
      this.ambient.push({ s, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, ph: Math.random() * 6.28 });
    }
    this.resizeFx();
  }

  private resizeFx(): void {
    if (!this.app || !this.vignette || !this.light || !this.nightTint) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    this.vignette.width = w; this.vignette.height = h;
    this.nightTint.clear().rect(0, 0, w, h).fill(0xffffff);
    this.light.width = this.light.height = Math.max(w, h) * 1.15;
    this.light.x = w / 2; this.light.y = h / 2;
    for (const a of this.ambient) { if (a.s.x === 0 && a.s.y === 0) { a.s.x = Math.random() * w; a.s.y = Math.random() * h; } }
  }

  private updateDayNight(): void {
    if (!this.nightTint || REDUCED) return;
    const hr = this.hourNow();
    // [tintColor, tintAlpha, fireflyVisibility]
    const { color, alpha, fire } = dayGrade(hr);
    // ease toward target
    this.nightTint.tint = color;
    const k = this.ease(0.04);
    this.nightTint.alpha += (alpha - this.nightTint.alpha) * k;
    this.light!.alpha += ((0.12 + fire * 0.22) - this.light!.alpha) * k;
    this.fireflyVis += (fire - this.fireflyVis) * k;
  }
  private fireflyVis = 0;
  private hourCache = { at: -1e9, hr: 12 };
  /** The clock hour, re-read at most once a second instead of allocating a Date every frame. */
  private hourNow(): number {
    const now = performance.now();
    if (now - this.hourCache.at > 1000) {
      const d = new Date();
      this.hourCache = { at: now, hr: d.getHours() + d.getMinutes() / 60 };
    }
    return this.hourCache.hr;
  }
  /** Per-frame easing factor that behaves the same at any frame rate. */
  private ease(k: number): number {
    return 1 - Math.pow(1 - k, this.dt);
  }

  private updateAmbient(): void {
    if (REDUCED || !this.app) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    for (const a of this.ambient) {
      a.s.x += a.vx * this.dt; a.s.y += a.vy * this.dt;
      if (a.s.x < -8) a.s.x = w + 8; if (a.s.x > w + 8) a.s.x = -8;
      if (a.s.y < -8) a.s.y = h + 8; if (a.s.y > h + 8) a.s.y = -8;
      a.s.alpha = this.fireflyVis * (0.4 + 0.6 * Math.abs(Math.sin(this.frame / 40 + a.ph)));
    }
  }

  private spawnParticle(wx: number, wy: number, color: number, size: number, vx: number, vy: number, life: number, grav: number): void {
    if (this.parts.length >= MAX_PARTICLES) return;
    const g = this.partPool.pop() ?? new this.PIXI!.Sprite(this.PIXI!.Texture.WHITE);
    g.anchor.set(0.5);
    g.width = size; g.height = size;
    g.tint = color; g.alpha = 1;
    g.x = wx; g.y = wy;
    this.particlesLayer.addChild(g);
    this.parts.push({ node: g, vx, vy, life, max: life, grav });
  }

  private readonly partPool: PSprite[] = [];
  private freeParticle(n: PContainer): void {
    n.removeFromParent();
    if (this.partPool.length < MAX_PARTICLES) this.partPool.push(n as PSprite);
    else n.destroy();
  }

  /* ------------------------------------------------------------- weather */

  /** Ambient petal/leaf tint per region — sakura at home, sand in the desert… */
  private petalColor(mapId: string): number {
    if (/home|verdant/.test(mapId)) return 0xffc2d6; // sakura pink
    if (/sunreach|route-3/.test(mapId)) return 0xf3c877; // desert amber
    if (/mistfall|route-4/.test(mapId)) return 0xa9d6ef; // sea mist
    return 0x9fd77a; // fresh leaf green
  }

  /** A sparse pool of drifting petals gives outdoor maps a living breeze. */
  private buildPetals(map: MapDef): void {
    if (REDUCED || !this.app || !this.fx) return;
    if (!this.petalLayer) {
      this.petalLayer = new this.PIXI!.Container();
      this.petalLayer.eventMode = 'none';
      this.fx.addChild(this.petalLayer);
    }
    this.petalLayer.removeChildren();
    this.petals = [];
    if (!map.outdoor || map.weather === 'rain' || map.weather === 'snow' || map.weather === 'sandstorm') return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const color = this.petalColor(map.id);
    for (let i = 0; i < 10; i++) {
      const g = new this.PIXI!.Sprite(this.PIXI!.Texture.WHITE);
      g.anchor.set(0.5);
      g.width = 4; g.height = 2.4; g.tint = color; g.alpha = 0.8;
      g.x = Math.random() * w;
      g.y = Math.random() * h;
      g.rotation = Math.random() * Math.PI;
      this.petalLayer.addChild(g);
      this.petals.push({ g, vx: -0.25 - Math.random() * 0.35, vy: 0.35 + Math.random() * 0.4, ph: Math.random() * 6.28 });
    }
  }

  private updatePetals(): void {
    if (REDUCED || !this.app || !this.petals.length) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    for (const p of this.petals) {
      p.g.x += (p.vx + Math.sin(this.frame / 34 + p.ph) * 0.3) * this.dt;
      p.g.y += p.vy * this.dt;
      p.g.rotation += 0.012 * this.dt;
      if (p.g.y > h + 6 || p.g.x < -6) {
        p.g.y = -6;
        p.g.x = Math.random() * (w + 30);
      }
    }
  }

  /** Rebuild the ambient weather field (rain streaks / drifting snow) for a map. */
  private buildWeather(kind: WeatherKind | undefined): void {
    if (REDUCED || !this.app || !this.weatherLayer) return;
    this.weather = kind ?? null;
    this.weatherLayer.removeChildren();
    this.rain = [];
    this.snow = [];
    const pixi = this.PIXI!;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    if (this.weatherTint) {
      this.weatherTint.clear();
      const tint =
        kind === 'rain' ? 0x2a3d66
        : kind === 'snow' ? 0x9fc2e0
        : kind === 'sandstorm' ? 0xc2a15a
        : kind === 'sun' ? 0xffcf7a
        : 0x000000;
      this.weatherCol = tint;
      if (kind) this.weatherTint.rect(0, 0, w, h).fill(tint);
    }
    if (kind === 'rain') {
      for (let i = 0; i < 90; i++) {
        const g = new pixi.Sprite(pixi.Texture.WHITE);
        g.anchor.set(0.5, 0);
        g.width = 1.4; g.height = 11; g.rotation = 0.22; g.tint = 0xbcd4ff; g.alpha = 0.5;
        g.x = Math.random() * (w + 40); g.y = Math.random() * h;
        this.weatherLayer.addChild(g);
        this.rain.push({ g, vy: 13 + Math.random() * 4, vx: -3 });
      }
    } else if (kind === 'sandstorm') {
      // Dust streaks race sideways; reuse the rain pool with horizontal motion.
      for (let i = 0; i < 70; i++) {
        const g = new pixi.Sprite(pixi.Texture.WHITE);
        g.anchor.set(0, 0.5);
        g.width = 9.1; g.height = 1.3; g.rotation = 0.165; g.tint = 0xe8c98a; g.alpha = 0.45;
        g.x = Math.random() * (w + 40) - 20; g.y = Math.random() * h;
        this.weatherLayer.addChild(g);
        this.rain.push({ g, vy: (Math.random() - 0.5) * 1.2, vx: 8 + Math.random() * 5 });
      }
    } else if (kind === 'snow') {
      for (let i = 0; i < 64; i++) {
        const s = new pixi.Sprite(this.radial(16, 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0)'));
        s.anchor.set(0.5);
        s.width = s.height = 2 + Math.random() * 3;
        s.x = Math.random() * w; s.y = Math.random() * h;
        this.weatherLayer.addChild(s);
        this.snow.push({ s, vy: 0.7 + Math.random() * 1.1, ph: Math.random() * 6.28 });
      }
    }
  }

  private weatherCol = 0;
  /** Re-fit the full-screen weather tint after a resize (particles just keep wrapping). */
  private layoutWeather(): void {
    if (!this.app || !this.weatherTint || !this.weather) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    this.weatherTint.clear().rect(0, 0, w, h).fill(this.weatherCol);
  }

  private updateWeather(): void {
    if (REDUCED || !this.app) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    if (this.weatherTint) {
      const target =
        this.weather === 'rain' ? 0.22
        : this.weather === 'snow' ? 0.14
        : this.weather === 'sandstorm' ? 0.2
        : this.weather === 'sun' ? 0.1
        : 0;
      this.weatherTint.alpha += (target - this.weatherTint.alpha) * this.ease(0.05);
    }
    for (const r of this.rain) {
      r.g.y += r.vy * this.dt; r.g.x += r.vx * this.dt;
      if (r.g.y > h) { r.g.y = -12; r.g.x = Math.random() * (w + 40); }
      if (r.g.y < -12) { r.g.y = h + 6; r.g.x = Math.random() * (w + 40); }
      if (r.g.x < -20) r.g.x = w + 10;
      else if (r.g.x > w + 20) r.g.x = -14;
    }
    for (const f of this.snow) {
      f.s.y += f.vy * this.dt;
      f.s.x += Math.sin(this.frame / 40 + f.ph) * 0.5 * this.dt;
      if (f.s.y > h + 4) { f.s.y = -4; f.s.x = Math.random() * w; }
      if (f.s.x < -6) f.s.x = w + 6; else if (f.s.x > w + 6) f.s.x = -6;
    }
  }

  private spawnDust(tileX: number, tileY: number): void {
    if (REDUCED) return;
    const cx = (tileX + 0.5) * TILE_PX, cy = (tileY + 0.9) * TILE_PX;
    for (let i = 0; i < 4; i++) this.spawnParticle(cx + (Math.random() - 0.5) * 6, cy, 0xcaa86a, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.6, -0.4 - Math.random() * 0.4, 22, 0.04);
  }

  private spawnLeaves(tileX: number, tileY: number): void {
    if (REDUCED) return;
    const cx = (tileX + 0.5) * TILE_PX, cy = (tileY + 0.5) * TILE_PX;
    for (let i = 0; i < 6; i++) this.spawnParticle(cx + (Math.random() - 0.5) * 10, cy, 0x3fa35a, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.2, -0.6 - Math.random() * 0.6, 28, 0.03);
  }

  private updateParticles(): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.vy += p.grav * this.dt;
      p.node.x += p.vx * this.dt; p.node.y += p.vy * this.dt;
      p.life -= this.dt;
      p.node.alpha = Math.max(0, p.life / p.max);
      if (p.life <= 0) { this.freeParticle(p.node); this.parts.splice(i, 1); }
    }
  }

  screenShake(mag = 5, ms = 240): void {
    this.shakeMag = mag;
    this.shakeUntil = performance.now() + ms;
  }

  /* ------------------------------------------------------------- loop */

  /** Frame-rate independent step: 1 = one 60 fps frame (capped so a tab-switch never teleports things). */
  private dt = 1;
  private tick(delta: number): void {
    if (!this.app) return;
    this.dt = Math.min(delta, 3);
    this.watchFps(delta);
    const m = this.svc.map();
    const dirty = this.svc.mapDirty();
    if (m && (m.id !== this.builtMapId || dirty !== this.builtDirty)) {
      const p = this.svc.player();
      if (p) { this.visX = p.x; this.visY = p.y; this.stepping = false; }
      this.builtDirty = dirty;
      this.rebuildMap();
    }
    // live-swap the player's look when customization changes (sheets preloaded)
    if (this.player) {
      const meta = this.charMeta.get(this.player);
      const look = this.svc.appearance();
      if (meta && meta.key !== look && this.charBases.has(look)) {
        meta.key = look;
        this.poseChar(this.player, null, this.stepping);
      }
    }
    this.frame += this.dt;
    this.pollGamepad();
    this.updateMovement();
    this.animateTiles();
    this.updateParticles();
    this.updateDayNight();
    this.updateAmbient();
    this.updateWeather();
    this.updatePetals();
    this.updateNpcs();
    this.updateCamera();
  }

  /** Glide NPC sprites toward their runtime tiles (wanderers move; statics sit). */
  private updateNpcs(): void {
    const positions = this.svc.npcPos();
    const ease = REDUCED ? 1 : this.ease(0.18);
    for (const [id, s] of this.npcSprites) {
      const p = positions[id];
      if (!p) continue;
      const tx = (p.x + 0.5) * TILE_PX;
      const ty = (p.y + 0.5) * TILE_PX;
      const dx = tx - s.x;
      const dy = ty - s.y;
      s.x += dx * ease;
      s.y += dy * ease;
      if (Math.abs(tx - s.x) < 0.4) s.x = tx;
      if (Math.abs(ty - s.y) < 0.4) s.y = ty;
      // wanderers face their travel direction and cycle walk frames mid-glide
      const gliding = Math.abs(dx) + Math.abs(dy) > 1.2;
      const dir: Direction | null = !gliding ? null : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      this.poseChar(s, dir, gliding);
    }
  }

  private updateMovement(): void {
    if (this.stepping) {
      const t = this.stepDur <= 0 ? 1 : Math.min(1, (performance.now() - this.t0) / this.stepDur);
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
        if (np && this.player) this.poseChar(this.player, dir, false);
        if (res.warped && np) { this.visX = np.x; this.visY = np.y; }
        else if (res.moved && before && np) {
          this.from = { x: before.x, y: before.y };
          this.to = { x: np.x, y: np.y };
          this.t0 = performance.now();
          this.hopping = !!res.hopped;
          this.stepDur = REDUCED ? 0 : res.hopped ? 260 : this.running || this.runningPad || this.touchRun() ? 95 : this.baseStepMs;
          this.stepping = this.stepDur > 0;
          if (!this.stepping) { this.visX = np.x; this.visY = np.y; }
          this.spawnDust(before.x, before.y);
          if (res.hopped) this.spawnDust(np.x, np.y);
          if (this.svc.map()?.tiles[np.y]?.[np.x] === 'tallgrass') this.spawnLeaves(np.x, np.y);
        }
      }
    }
    if (this.player) {
      this.player.x = (this.visX + 0.5) * TILE_PX;
      this.player.y = (this.visY + 0.5) * TILE_PX;
      // Real walk frames while stepping; the sprite arcs over ledges while the
      // shadow stays grounded.
      this.poseChar(this.player, null, this.stepping);
      const s = this.charSprite(this.player);
      if (s && !REDUCED) {
        if (this.stepping && this.hopping) {
          const t = Math.min(1, (performance.now() - this.t0) / Math.max(1, this.stepDur));
          s.y = -Math.sin(t * Math.PI) * 7;
        } else {
          s.y = this.stepping ? -Math.abs(Math.sin(this.frame / 5)) * 1 : 0;
        }
      }
    }
  }
  private hopping = false;

  private nextDir(): Direction | null {
    for (const d of ['up', 'down', 'left', 'right'] as const) if (this.held.has(d) || this.padDirs.has(d)) return d;
    return null;
  }

  /* ---------------------------------------------------------- gamepad */

  private readonly padDirs = new Set<Direction>();
  private runningPad = false;
  private padPrev = [false, false];

  /** Poll the first connected gamepad: stick/d-pad walk, A interacts, B opens the menu, X runs. */
  private pollGamepad(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
    let gp: Gamepad | null = null;
    if (pads) for (let i = 0; i < pads.length; i++) if (pads[i]?.connected) { gp = pads[i]; break; }
    this.padDirs.clear();
    if (!gp) { this.runningPad = false; return; }
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    if (ay < -0.5 || gp.buttons[12]?.pressed) this.padDirs.add('up');
    if (ay > 0.5 || gp.buttons[13]?.pressed) this.padDirs.add('down');
    if (ax < -0.5 || gp.buttons[14]?.pressed) this.padDirs.add('left');
    if (ax > 0.5 || gp.buttons[15]?.pressed) this.padDirs.add('right');
    this.runningPad = gp.buttons[2]?.pressed ?? false;
    const a = gp.buttons[0]?.pressed ?? false;
    const b = gp.buttons[1]?.pressed ?? false;
    if (a && !this.padPrev[0] && this.svc.phase() === 'overworld') this.svc.interact();
    if (b && !this.padPrev[1] && this.svc.phase() === 'overworld') this.svc.openMenu();
    this.padPrev = [a, b];
  }

  /* ------------------------------------------------------ area banner */

  protected readonly banner = signal('');
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;

  private showBanner(name: string): void {
    this.banner.set(name);
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.set(''), 2400);
  }

  private animateTiles(): void {
    if (REDUCED) return;
    const t = this.frame;
    const v = this.view;
    for (const w of this.waterTiles) {
      if (w.x < v.left || w.x > v.right || w.y < v.top || w.y > v.bottom) continue;
      w.g.x = Math.sin(t / 30 + w.x) * 2;
      w.g.alpha = 0.7 + Math.sin(t / 25 + w.y) * 0.25;
      if (w.glint) {
        // brief sparkles that wander tile to tile
        const ph = Math.sin(t / 90 + w.x * 2.7 + w.y * 1.9);
        w.glint.alpha = ph > 0.92 ? (ph - 0.92) * 11 : 0;
      }
      // surf line laps the shore — a slow breathing pulse per edge tile
      if (w.foam) w.foam.alpha = 0.6 + Math.sin(t / 18 + w.x * 1.3 + w.y * 0.7) * 0.32;
    }
    for (const g of this.grassTiles) {
      if (g.x < v.left || g.x > v.right || g.y < v.top || g.y > v.bottom) continue;
      const sway = Math.sin(t / 22 + g.c.x * 0.08);
      g.tufts.forEach((tuft, i) => { tuft.skew.x = sway * (i === 0 ? 0.12 : -0.09); });
    }
  }

  private updateCamera(): void {
    if (!this.app) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    this.world.scale.set(this.zoom);
    let sx = 0, sy = 0;
    if (performance.now() < this.shakeUntil) {
      sx = (Math.random() - 0.5) * this.shakeMag * 2;
      sy = (Math.random() - 0.5) * this.shakeMag * 2;
    }
    this.world.x = Math.round(w / 2 - (this.visX + 0.5) * TILE_PX * this.zoom + sx);
    this.world.y = Math.round(h / 2 - (this.visY + 0.5) * TILE_PX * this.zoom + sy);
    this.cullChunks(w, h);
    const v = this.view;
    for (const t of this.canopyTops) t.s.visible = t.x >= v.left - 1 && t.x <= v.right && t.y >= v.top - 1 && t.y <= v.bottom;
  }

  /* ------------------------------------------------------------- resize */

  private targetHeight(width: number): number {
    return Math.max(360, Math.min(560, Math.round(width * 0.62)));
  }

  private lastW = 0;
  private lastH = 0;
  private resize(): void {
    if (!this.app) return;
    const host = this.host().nativeElement;
    const w = host.clientWidth || 640;
    const h = this.targetHeight(w);
    if (w === this.lastW && h === this.lastH) return;
    this.lastW = w; this.lastH = h;
    this.app.renderer.resize(w, h);
    // ~13 tiles tall in view
    this.zoom = Math.max(2, Math.round(h / (13 * TILE_PX)));
    this.resizeFx();
    this.layoutWeather();
  }
}
