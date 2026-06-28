/**
 * Stylized canvas drawing for the overworld — every tile and character is drawn
 * with shapes (no external art assets), themed to read as a clean retro map.
 */
import type { Direction, TileKind } from '../../../game/rpg/rpg-types';

export const VOID = '#05060f';

interface Palette {
  base: string;
  accent?: string;
}

const TILE_COLORS: Record<TileKind, Palette> = {
  grass: { base: '#3f9d5a', accent: '#379152' },
  tallgrass: { base: '#2f7d49', accent: '#256b3d' },
  path: { base: '#c9b07e', accent: '#bda472' },
  sand: { base: '#dcc58c' },
  water: { base: '#2f6fd0', accent: '#5b95e6' },
  tree: { base: '#3f9d5a', accent: '#1f6b39' },
  wall: { base: '#3a3550', accent: '#2b2740' },
  floor: { base: '#7a5a3c', accent: '#6b4e34' },
  rug: { base: '#8a3b5a', accent: '#6f2f49' },
  door: { base: '#221b33' },
  sign: { base: '#3f9d5a', accent: '#7a5a3c' },
  counter: { base: '#9a8466', accent: '#7d6a52' },
  roof: { base: '#c5524a', accent: '#a83f39' },
  house: { base: '#d8c7a6', accent: '#c3b08c' },
  fence: { base: '#3f9d5a', accent: '#8a6f4a' },
  flower: { base: '#3f9d5a' },
  ledge: { base: '#3f9d5a', accent: '#7a5a3c' },
};

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Draw a single tile of size `ts` at pixel (dx,dy). `frame` animates water. */
export function drawTile(ctx: CanvasRenderingContext2D, kind: TileKind, dx: number, dy: number, ts: number, frame: number): void {
  const pal = TILE_COLORS[kind];
  // Outdoor tiles sit on grass; furniture/buildings sit on floor — fill a sensible base first.
  const grounded: TileKind[] = ['tree', 'sign', 'flower', 'fence'];
  if (grounded.includes(kind)) px(ctx, dx, dy, ts, ts, TILE_COLORS.grass.base);
  else px(ctx, dx, dy, ts, ts, pal.base);

  switch (kind) {
    case 'grass':
      if (pal.accent) {
        ctx.fillStyle = pal.accent;
        ctx.fillRect(dx + ts * 0.2, dy + ts * 0.55, ts * 0.12, ts * 0.12);
        ctx.fillRect(dx + ts * 0.62, dy + ts * 0.28, ts * 0.12, ts * 0.12);
      }
      break;
    case 'tallgrass':
      ctx.fillStyle = pal.accent!;
      for (let i = 0; i < 4; i++) {
        const bx = dx + ts * (0.15 + i * 0.22);
        ctx.fillRect(bx, dy + ts * 0.45, ts * 0.08, ts * 0.45);
      }
      break;
    case 'water': {
      ctx.fillStyle = pal.accent!;
      const off = (Math.sin(frame / 22) + 1) * ts * 0.12;
      ctx.fillRect(dx + off, dy + ts * 0.32, ts * 0.45, ts * 0.08);
      ctx.fillRect(dx + ts * 0.4 - off, dy + ts * 0.66, ts * 0.45, ts * 0.08);
      break;
    }
    case 'path':
      ctx.strokeStyle = pal.accent!;
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 0.5, dy + 0.5, ts - 1, ts - 1);
      break;
    case 'tree':
      ctx.fillStyle = pal.accent!;
      ctx.beginPath();
      ctx.arc(dx + ts / 2, dy + ts * 0.42, ts * 0.42, 0, Math.PI * 2);
      ctx.fill();
      px(ctx, dx + ts * 0.44, dy + ts * 0.6, ts * 0.12, ts * 0.35, '#6b4a2a');
      break;
    case 'roof':
      ctx.fillStyle = pal.accent!;
      ctx.fillRect(dx, dy, ts, ts * 0.25);
      break;
    case 'house':
      ctx.fillStyle = pal.accent!;
      ctx.fillRect(dx + ts * 0.18, dy + ts * 0.2, ts * 0.28, ts * 0.3); // window
      break;
    case 'door':
      px(ctx, dx + ts * 0.18, dy + ts * 0.1, ts * 0.64, ts * 0.9, '#3a2c52');
      px(ctx, dx + ts * 0.62, dy + ts * 0.5, ts * 0.08, ts * 0.12, '#ffd166');
      break;
    case 'counter':
      ctx.strokeStyle = pal.accent!;
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 2, dy + 2, ts - 4, ts - 4);
      break;
    case 'rug':
      ctx.fillStyle = pal.accent!;
      ctx.fillRect(dx + ts * 0.12, dy + ts * 0.12, ts * 0.76, ts * 0.76);
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
