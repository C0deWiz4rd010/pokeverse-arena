/**
 * Stylized canvas drawing for the overworld — every tile and character is drawn
 * with shapes (no external art assets), themed to read as a clean retro map.
 */
import type { Direction, TileKind } from '../../../game/rpg/rpg-types';

export const VOID = '#05060f';

interface Palette {
  base: string;
  accent?: string;
  /** Optional lighter top / darker bottom for a soft vertical gradient. */
  hi?: string;
  lo?: string;
}

const TILE_COLORS: Record<TileKind, Palette> = {
  grass: { base: '#47a862', accent: '#328a4c', hi: '#57bd72', lo: '#3c9455' },
  tallgrass: { base: '#2f8a4e', accent: '#20623a', hi: '#3aa05c', lo: '#256b3d' },
  path: { base: '#d3ba86', accent: '#b89a68', hi: '#e0ca97', lo: '#c2a877' },
  sand: { base: '#e2cc94', accent: '#cbb078', hi: '#eed9a4', lo: '#d6bd85' },
  water: { base: '#2f6fd0', accent: '#7fb6f2', hi: '#4a8ae6', lo: '#245bb0' },
  tree: { base: '#47a862', accent: '#1f6b39', hi: '#3f9d5a', lo: '#155229' },
  wall: { base: '#413b5c', accent: '#2b2740', hi: '#4c466b', lo: '#302b47' },
  floor: { base: '#8a6742', accent: '#6b4e34', hi: '#9a7550', lo: '#78593a' },
  rug: { base: '#9a4364', accent: '#6f2f49', hi: '#b3506f', lo: '#7a3450' },
  door: { base: '#2a2140', accent: '#ffd166' },
  sign: { base: '#47a862', accent: '#8a5a2f', hi: '#a9824f', lo: '#6b4a2a' },
  counter: { base: '#a68e6a', accent: '#7d6a52', hi: '#b89e78', lo: '#8c785c' },
  roof: { base: '#d05a52', accent: '#a83f39', hi: '#e06b62', lo: '#b0463f' },
  house: { base: '#e2d1af', accent: '#c3b08c', hi: '#efe0c2', lo: '#d0bd98' },
  fence: { base: '#47a862', accent: '#8a6f4a', hi: '#a9865a', lo: '#6f5738' },
  flower: { base: '#47a862', hi: '#57bd72', lo: '#3c9455' },
  ledge: { base: '#47a862', accent: '#8a6a3f', hi: '#57bd72', lo: '#6b4a2a' },
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Fill a tile with a soft top→bottom gradient (falls back to the flat base). */
function fillBase(ctx: CanvasRenderingContext2D, pal: Palette, dx: number, dy: number, ts: number): void {
  if (pal.hi && pal.lo) {
    const g = ctx.createLinearGradient(dx, dy, dx, dy + ts);
    g.addColorStop(0, pal.hi);
    g.addColorStop(1, pal.lo);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = pal.base;
  }
  ctx.fillRect(dx, dy, ts, ts);
}

/** Deterministic 0..1 hash for scattering static grass/sand speckles. */
function hash01(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Draw a single tile of size `ts` at pixel (dx,dy). `frame` animates water. */
export function drawTile(ctx: CanvasRenderingContext2D, kind: TileKind, dx: number, dy: number, ts: number, frame: number): void {
  const pal = TILE_COLORS[kind];
  // Outdoor tiles sit on grass; furniture/buildings sit on floor — fill a sensible base first.
  const grounded: TileKind[] = ['tree', 'sign', 'flower', 'fence'];
  if (grounded.includes(kind)) fillBase(ctx, TILE_COLORS.grass, dx, dy, ts);
  else fillBase(ctx, pal, dx, dy, ts);

  switch (kind) {
    case 'grass': {
      // Scattered blades + a couple of static speckles for a textured meadow.
      ctx.fillStyle = pal.accent!;
      const h = hash01(dx, dy);
      ctx.fillRect(dx + ts * (0.15 + h * 0.1), dy + ts * 0.58, ts * 0.1, ts * 0.14);
      ctx.fillRect(dx + ts * (0.6 - h * 0.1), dy + ts * 0.3, ts * 0.1, ts * 0.14);
      ctx.fillStyle = pal.hi!;
      ctx.fillRect(dx + ts * 0.42, dy + ts * 0.72, ts * 0.08, ts * 0.1);
      break;
    }
    case 'tallgrass': {
      // Denser, taller swaying tufts to clearly read as encounter grass.
      const sway = Math.sin(frame / 26 + dx * 0.3) * ts * 0.06;
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? pal.accent! : pal.hi!;
        const bx = dx + ts * (0.12 + i * 0.18);
        ctx.beginPath();
        ctx.moveTo(bx, dy + ts * 0.92);
        ctx.lineTo(bx + sway * (i % 2 ? 1 : -1), dy + ts * 0.34);
        ctx.lineTo(bx + ts * 0.09, dy + ts * 0.92);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'water': {
      // Layered ripples with a moving highlight for a livelier surface.
      const off = (Math.sin(frame / 22) + 1) * ts * 0.12;
      ctx.fillStyle = pal.hi!;
      ctx.fillRect(dx + off, dy + ts * 0.3, ts * 0.5, ts * 0.07);
      ctx.fillRect(dx + ts * 0.35 - off, dy + ts * 0.64, ts * 0.5, ts * 0.07);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(dx + ts * 0.2 + off * 0.5, dy + ts * 0.48, ts * 0.22, 2);
      break;
    }
    case 'path': {
      // Subtle cobble speckle + soft inset edge.
      ctx.fillStyle = pal.accent!;
      for (let i = 0; i < 3; i++) {
        const hx = hash01(dx + i, dy);
        const hy = hash01(dx, dy + i * 3);
        ctx.fillRect(dx + ts * (0.15 + hx * 0.7), dy + ts * (0.15 + hy * 0.7), ts * 0.12, ts * 0.1);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 0.5, dy + 0.5, ts - 1, ts - 1);
      break;
    }
    case 'tree': {
      // Two-tone rounded canopy with a highlight + trunk and drop shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(dx + ts * 0.52, dy + ts * 0.8, ts * 0.34, ts * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      px(ctx, dx + ts * 0.44, dy + ts * 0.58, ts * 0.12, ts * 0.34, '#6b4a2a');
      ctx.fillStyle = pal.accent!;
      ctx.beginPath();
      ctx.arc(dx + ts / 2, dy + ts * 0.4, ts * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.hi!;
      ctx.beginPath();
      ctx.arc(dx + ts * 0.4, dy + ts * 0.32, ts * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'roof': {
      const g = ctx.createLinearGradient(dx, dy, dx, dy + ts);
      g.addColorStop(0, pal.hi!);
      g.addColorStop(1, pal.accent!);
      ctx.fillStyle = g;
      ctx.fillRect(dx, dy, ts, ts);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(dx, dy, ts, ts * 0.18);
      break;
    }
    case 'house':
      ctx.fillStyle = '#2a3a52';
      ctx.fillRect(dx + ts * 0.16, dy + ts * 0.2, ts * 0.3, ts * 0.32); // window
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(dx + ts * 0.16, dy + ts * 0.2, ts * 0.3, ts * 0.1);
      ctx.strokeStyle = pal.accent!;
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + ts * 0.16, dy + ts * 0.2, ts * 0.3, ts * 0.32);
      break;
    case 'door': {
      const g = ctx.createLinearGradient(dx, dy, dx, dy + ts);
      g.addColorStop(0, '#3a2c52');
      g.addColorStop(1, '#241a38');
      ctx.fillStyle = g;
      ctx.fillRect(dx + ts * 0.16, dy + ts * 0.08, ts * 0.68, ts * 0.92);
      px(ctx, dx + ts * 0.64, dy + ts * 0.5, ts * 0.08, ts * 0.12, pal.accent!);
      break;
    }
    case 'counter':
      ctx.fillStyle = pal.accent!;
      ctx.fillRect(dx + 2, dy + 2, ts - 4, ts - 4);
      ctx.fillStyle = pal.hi!;
      ctx.fillRect(dx + 2, dy + 2, ts - 4, ts * 0.2);
      break;
    case 'rug':
      ctx.fillStyle = pal.accent!;
      ctx.fillRect(dx + ts * 0.1, dy + ts * 0.1, ts * 0.8, ts * 0.8);
      ctx.strokeStyle = pal.hi!;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(dx + ts * 0.18, dy + ts * 0.18, ts * 0.64, ts * 0.64);
      break;
    case 'sign':
      px(ctx, dx + ts * 0.2, dy + ts * 0.18, ts * 0.6, ts * 0.4, '#a9824f');
      px(ctx, dx + ts * 0.46, dy + ts * 0.5, ts * 0.08, ts * 0.4, '#6b4a2a');
      break;
    case 'flower':
      for (const [fx, fy, c] of [[0.3, 0.35, '#ff6b9d'], [0.65, 0.6, '#ffd166'], [0.5, 0.3, '#6ce0ff']] as const) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(dx + ts * fx, dy + ts * fy, ts * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'fence':
      px(ctx, dx, dy + ts * 0.4, ts, ts * 0.12, pal.accent!);
      px(ctx, dx + ts * 0.2, dy + ts * 0.25, ts * 0.1, ts * 0.5, pal.accent!);
      px(ctx, dx + ts * 0.7, dy + ts * 0.25, ts * 0.1, ts * 0.5, pal.accent!);
      break;
    case 'wall':
      ctx.strokeStyle = pal.accent!;
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 0.5, dy + 0.5, ts - 1, ts - 1);
      break;
    default:
      break;
  }
}

/** Draw a small Poké Ball pickup centered in a tile. */
export function drawBall(ctx: CanvasRenderingContext2D, dx: number, dy: number, ts: number): void {
  const cx = dx + ts / 2;
  const cy = dy + ts / 2;
  const r = ts * 0.22;
  ctx.fillStyle = '#e23b3b';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#f4f4ff';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = '#1a1430';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.stroke();
}

/** Draw a little trainer character centered in a tile, oriented by `facing`. */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  ts: number,
  facing: Direction,
  body = '#6ce0ff',
  cap = '#c46bff',
): void {
  const cx = dx + ts / 2;
  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, dy + ts * 0.86, ts * 0.28, ts * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(dx + ts * 0.28, dy + ts * 0.4, ts * 0.44, ts * 0.42, ts * 0.12);
  ctx.fill();
  // head
  ctx.fillStyle = '#f4d6b0';
  ctx.beginPath();
  ctx.arc(cx, dy + ts * 0.34, ts * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // cap
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.arc(cx, dy + ts * 0.3, ts * 0.2, Math.PI, Math.PI * 2);
  ctx.fill();
  // facing eyes
  ctx.fillStyle = '#1a1430';
  const eo = ts * 0.07;
  const ey = dy + ts * 0.36;
  if (facing === 'down') {
    ctx.fillRect(cx - eo - 1, ey, 2, 2);
    ctx.fillRect(cx + eo - 1, ey, 2, 2);
  } else if (facing === 'up') {
    /* back of head — no eyes */
  } else if (facing === 'left') {
    ctx.fillRect(cx - eo - 1, ey, 2, 2);
  } else {
    ctx.fillRect(cx + eo - 1, ey, 2, 2);
  }
}
