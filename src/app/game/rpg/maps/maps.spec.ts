import { describe, expect, it } from 'vitest';
import { MAPS } from './index';
import { TILE } from '../tiles';
import { inBounds, tileAt } from '../movement';

/**
 * Registry-wide integrity checks: every authored map must be internally
 * consistent and every warp must land on a walkable tile of an existing map —
 * so adding a new route/town can't silently break the world graph.
 */
describe('map registry integrity', () => {
  const entries = Object.values(MAPS);

  it('has consistent dimensions and legend-known tiles', () => {
    for (const m of entries) {
      expect(m.tiles.length, `${m.id} height`).toBe(m.height);
      for (const row of m.tiles) expect(row.length, `${m.id} row width`).toBe(m.width);
    }
  });

  it('warps target existing maps on walkable tiles', () => {
    for (const m of entries) {
      for (const w of m.warps) {
        expect(inBounds(m, w.x, w.y), `${m.id} warp origin (${w.x},${w.y})`).toBe(true);
        if (w.to === '@return') continue; // resolved from the door-return save state
        const target = MAPS[w.to];
        expect(target, `${m.id} warp → ${w.to}`).toBeDefined();
        const tile = tileAt(target, w.toX, w.toY);
        expect(tile, `${m.id} warp → ${w.to} (${w.toX},${w.toY}) in bounds`).not.toBeNull();
        expect(TILE[tile!].walkable, `${m.id} warp → ${w.to} lands on walkable '${tile}'`).toBe(true);
      }
    }
  });

  it('places NPCs, signs and items in bounds (and NPCs on distinct tiles)', () => {
    for (const m of entries) {
      const seen = new Set<string>();
      for (const n of m.npcs) {
        expect(inBounds(m, n.x, n.y), `${m.id} npc ${n.id}`).toBe(true);
        const key = `${n.x},${n.y}`;
        expect(seen.has(key), `${m.id} npc overlap at ${key}`).toBe(false);
        seen.add(key);
      }
      for (const s of m.signs) expect(inBounds(m, s.x, s.y), `${m.id} sign (${s.x},${s.y})`).toBe(true);
      for (const it of m.items) {
        expect(inBounds(m, it.x, it.y), `${m.id} item ${it.item}`).toBe(true);
        expect(TILE[tileAt(m, it.x, it.y)!].walkable, `${m.id} item ${it.item} reachable`).toBe(true);
      }
      for (const f of m.forage ?? []) {
        expect(inBounds(m, f.x, f.y), `${m.id} forage (${f.x},${f.y})`).toBe(true);
        expect(TILE[tileAt(m, f.x, f.y)!].walkable, `${m.id} forage (${f.x},${f.y}) reachable`).toBe(true);
      }
    }
  });

  it('encounter tables are well-formed', () => {
    for (const m of entries) {
      if (!m.encounter) continue;
      expect(m.encounter.rate).toBeGreaterThan(0);
      expect(m.encounter.rate).toBeLessThanOrEqual(1);
      expect(m.encounter.table.length).toBeGreaterThan(0);
      for (const e of m.encounter.table) {
        expect(e.min).toBeLessThanOrEqual(e.max);
        expect(e.weight).toBeGreaterThan(0);
      }
    }
  });

  it('badge-gated warps reference badges a leader actually awards', () => {
    const awarded = new Set(
      entries.flatMap((m) => m.npcs.map((n) => n.trainer?.badge).filter((b): b is string => !!b)),
    );
    for (const m of entries) {
      for (const w of m.warps) {
        if (w.requiresBadge) expect(awarded, `${m.id} gate needs ${w.requiresBadge}`).toContain(w.requiresBadge);
      }
    }
  });
});
