import { Injectable, computed, inject, signal } from '@angular/core';
import { SaveService } from '../../core/storage/save.service';
import { getMap } from '../../game/rpg/maps';
import { ahead, canEnter, isTallGrass, npcAt, signAt, warpAt } from '../../game/rpg/movement';
import { defaultSave, isValidSave } from '../../game/rpg/save';
import type { Direction, MapDef, RpgSave } from '../../game/rpg/rpg-types';

const SAVE_KEY = 'rpg:save';

export type RpgPhase = 'title' | 'overworld' | 'battle' | 'dialogue' | 'menu' | 'shop';

/** Result of attempting a step, so the overworld can animate / react. */
export interface StepResult {
  readonly moved: boolean;
  readonly warped: boolean;
  readonly grass: boolean;
}

/**
 * Classic RPG mode state hub. Holds the single {@link RpgSave}, the current map,
 * and the player's grid position; resolves movement, warps and interactions; and
 * persists to localStorage via {@link SaveService}. Battle/dialogue flows hook in
 * during later phases.
 */
@Injectable({ providedIn: 'root' })
export class RpgService {
  private readonly store = inject(SaveService);

  readonly phase = signal<RpgPhase>('title');
  readonly game = signal<RpgSave | null>(null);
  readonly hasSave = signal<boolean>(this.readSave() !== null);
  /** A transient one-line message (signs, pickups, …). */
  readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly map = computed<MapDef | null>(() => {
    const g = this.game();
    return g ? getMap(g.map) ?? null : null;
  });
  readonly player = computed(() => {
    const g = this.game();
    return g ? { x: g.x, y: g.y, facing: g.facing } : null;
  });

  /* ------------------------------------------------------------- lifecycle */

  newGame(name = 'Red'): void {
    const g = defaultSave(name);
    this.game.set(g);
    this.persist();
    this.phase.set('overworld');
  }

  continue(): void {
    const g = this.readSave();
    if (g) {
      this.game.set(g);
      this.phase.set('overworld');
    }
  }

  exitToTitle(): void {
    this.persist();
    this.phase.set('title');
  }

  persist(): void {
    const g = this.game();
    if (!g) return;
    this.store.write(SAVE_KEY, g);
    this.hasSave.set(true);
  }

  private readSave(): RpgSave | null {
    const g = this.store.read<RpgSave | null>(SAVE_KEY, null);
    return g && isValidSave(g) ? g : null;
  }

  /* ------------------------------------------------------------- movement */

  /** Turn to face a direction without moving. */
  face(dir: Direction): void {
    const g = this.game();
    if (!g || g.facing === dir) return;
    this.game.set({ ...g, facing: dir });
  }

  /** Whether the tile ahead in `dir` can be entered. */
  canStep(dir: Direction): boolean {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return false;
    const t = ahead(g.x, g.y, dir);
    return canEnter(m, t.x, t.y);
  }

  /**
   * Commit a step in `dir`: updates facing + position, applies any warp, reports
   * whether we entered tall grass (the overworld rolls encounters in P2).
   */
  commitStep(dir: Direction): StepResult {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return { moved: false, warped: false, grass: false };

    const t = ahead(g.x, g.y, dir);
    if (!canEnter(m, t.x, t.y)) {
      this.face(dir);
      return { moved: false, warped: false, grass: false };
    }

    let next: RpgSave = { ...g, x: t.x, y: t.y, facing: dir };
    const warp = warpAt(m, t.x, t.y);
    if (warp) {
      next = { ...next, map: warp.to, x: warp.toX, y: warp.toY, facing: warp.toFacing ?? dir };
      this.game.set(next);
      this.persist();
      return { moved: true, warped: true, grass: false };
    }

    this.game.set(next);
    const grass = isTallGrass(m, t.x, t.y);
    return { moved: true, warped: false, grass };
  }

  /** Interact with whatever the player faces (signs for now; NPCs in P4). */
  interact(): void {
    const g = this.game();
    const m = this.map();
    if (!g || !m) return;
    const t = ahead(g.x, g.y, g.facing);
    const sign = signAt(m, t.x, t.y);
    if (sign) {
      this.showToast(sign);
      return;
    }
    const npc = npcAt(m, t.x, t.y);
    if (npc) this.showToast(`${npc.id} has nothing to say yet.`);
  }

  showToast(text: string, ms = 2600): void {
    this.toast.set(text);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), ms);
  }
}
