import { SPRITE_BASE, officialArtwork } from '../../core/api/pokeapi-endpoints';

/**
 * Trainer Card renderer — draws a shareable 1200×630 PNG of the trainer's
 * identity and records onto an offscreen canvas, themed with the active
 * accent palette. Pure DOM/canvas, no Angular: the profile page gathers the
 * data and hands it over.
 */

export interface TrainerCardData {
  readonly name: string;
  readonly title: string;
  readonly rank: string;
  /** Achievement completion 0–100. */
  readonly completion: number;
  readonly stats: readonly { label: string; value: string }[];
  /** Up to three favourite Pokémon ids, drawn as artwork on the right. */
  readonly favoriteIds: readonly number[];
  /** Today's Lab-Special donor pair, stamped in the corner (omit to skip). */
  readonly specialIds?: readonly [number, number];
  readonly accent: string;
  readonly accent2: string;
  readonly accent3: string;
  readonly version: string;
}

const W = 1200;
const H = 630;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // GitHub's sprite CDN sends ACAO:* — keeps the canvas exportable
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Render the card and return it as a PNG blob (null when canvas is unavailable). */
export async function renderTrainerCard(data: TrainerCardData): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  /* ---- backdrop: deep navy + two accent glows + subtle border ---- */
  ctx.fillStyle = '#0b0a1f';
  ctx.fillRect(0, 0, W, H);
  const glowA = ctx.createRadialGradient(W * 0.85, H * 0.1, 40, W * 0.85, H * 0.1, 520);
  glowA.addColorStop(0, data.accent2 + '55');
  glowA.addColorStop(1, 'transparent');
  ctx.fillStyle = glowA;
  ctx.fillRect(0, 0, W, H);
  const glowB = ctx.createRadialGradient(W * 0.05, H * 0.95, 40, W * 0.05, H * 0.95, 520);
  glowB.addColorStop(0, data.accent + '44');
  glowB.addColorStop(1, 'transparent');
  ctx.fillStyle = glowB;
  ctx.fillRect(0, 0, W, H);

  const border = ctx.createLinearGradient(0, 0, W, H);
  border.addColorStop(0, data.accent);
  border.addColorStop(1, data.accent2);
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  roundedPath(ctx, 14, 14, W - 28, H - 28, 30);
  ctx.stroke();

  /* ---- header: brand + rank pill ---- */
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = data.accent3;
  ctx.font = '700 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('⚡ POKÉVERSE ARENA · TRAINER CARD', 60, 92);

  const rankLabel = data.rank.toUpperCase();
  ctx.font = '800 30px "Segoe UI", system-ui, sans-serif';
  const rankW = ctx.measureText(rankLabel).width + 56;
  const rankGrad = ctx.createLinearGradient(W - 60 - rankW, 0, W - 60, 0);
  rankGrad.addColorStop(0, data.accent);
  rankGrad.addColorStop(1, data.accent2);
  ctx.fillStyle = rankGrad;
  roundedPath(ctx, W - 60 - rankW, 56, rankW, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#0b0a1f';
  ctx.fillText(rankLabel, W - 60 - rankW + 28, 93);

  /* ---- identity ---- */
  ctx.fillStyle = '#e9e8ff';
  ctx.font = '800 84px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(data.name.slice(0, 16), 58, 210);
  ctx.fillStyle = '#a9a7c9';
  ctx.font = 'italic 600 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(data.title.slice(0, 34), 60, 262);

  /* ---- achievement completion bar ---- */
  const barY = 300;
  const barW = 620;
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundedPath(ctx, 60, barY, barW, 18, 9);
  ctx.fill();
  if (data.completion > 0) {
    const fill = ctx.createLinearGradient(60, 0, 60 + barW, 0);
    fill.addColorStop(0, data.accent);
    fill.addColorStop(1, data.accent2);
    ctx.fillStyle = fill;
    roundedPath(ctx, 60, barY, Math.max(18, barW * (data.completion / 100)), 18, 9);
    ctx.fill();
  }
  ctx.fillStyle = '#a9a7c9';
  ctx.font = '600 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${data.completion}% achievements`, 60, barY + 52);

  /* ---- stat chips (two rows of three) ---- */
  const chipW = 214;
  const chipH = 84;
  const gap = 16;
  data.stats.slice(0, 6).forEach((s, i) => {
    const cx = 60 + (i % 3) * (chipW + gap);
    const cy = 400 + Math.floor(i / 3) * (chipH + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    roundedPath(ctx, cx, cy, chipW, chipH, 16);
    ctx.fill();
    ctx.fillStyle = '#e9e8ff';
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(s.value, cx + 20, cy + 42);
    ctx.fillStyle = '#a9a7c9';
    ctx.font = '600 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(s.label.toUpperCase(), cx + 20, cy + 68);
  });

  /* ---- favourite Pokémon (right column; a Poké-orb if none) ---- */
  const arts = (
    await Promise.all(data.favoriteIds.slice(0, 3).map((id) => loadImage(officialArtwork(id))))
  ).filter((i): i is HTMLImageElement => !!i);
  if (arts.length) {
    const size = arts.length === 1 ? 300 : arts.length === 2 ? 235 : 185;
    const x = W - 90 - size;
    const totalH = arts.length * size - (arts.length - 1) * size * 0.28;
    let y = 150 + (420 - totalH) / 2;
    for (const img of arts) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 12;
      ctx.drawImage(img, x, y, size, size);
      ctx.restore();
      y += size * 0.72;
    }
  } else {
    const cx = W - 240;
    const cy = 370;
    const orb = ctx.createLinearGradient(cx - 130, cy - 130, cx + 130, cy + 130);
    orb.addColorStop(0, data.accent);
    orb.addColorStop(1, data.accent2);
    ctx.strokeStyle = orb;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 120, cy);
    ctx.lineTo(cx + 120, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ---- rubber stamp: today's Lab Special pair, tilted, bottom-right ---- */
  if (data.specialIds) {
    const [imgA, imgB] = await Promise.all(
      data.specialIds.map((id) => loadImage(`${SPRITE_BASE}/pokemon/${id}.png`)),
    );
    ctx.save();
    ctx.translate(W - 172, H - 158);
    ctx.rotate(-0.1);
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = data.accent3;
    ctx.lineWidth = 4;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (imgA) ctx.drawImage(imgA, -64, -50, 70, 70);
    if (imgB) ctx.drawImage(imgB, -8, -44, 70, 70);
    ctx.fillStyle = data.accent3;
    ctx.font = '800 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAB SPECIAL', 0, 48);
    ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('of the day', 0, 64);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  /* ---- footer (right-aligned, clear of the stat chips) ---- */
  ctx.fillStyle = '#6f6d92';
  ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`pokeverse arena · v${data.version}`, W - 60, H - 34);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
