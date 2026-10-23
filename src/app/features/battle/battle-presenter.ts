/**
 * Shared battle presentation — the event→log/HP/FX pipeline used by all three
 * battle UIs (quick battle, tournament match, RPG battle). Components extend
 * this base: it owns the visual state signals (log lines, HP bars, shake/flash/
 * crit/faint/send-in pulses, floating numbers) and the paced {@link playEvents}
 * walker over engine {@link BattleEvent}s; hook methods let each UI add its
 * flavour (cries, hit-stop, ace quips) without forking the pipeline.
 */
import { computed, inject, signal, type Signal } from '@angular/core';
import { SfxService } from '../../core/audio/sfx.service';
import { HapticsService } from '../../core/haptics/haptics.service';
import {
  freshField,
  freshStages,
  type Battler,
  type BattleEvent,
  type BattleSide,
  type Field,
  type SideIndex,
  type Stages,
  type StatusCondition,
  type Terrain,
  type Weather as EngineWeather,
} from '../../game/engine';
import type { PokemonType } from '../../core/utils/type-chart';
import { titleCase } from '../../core/ui/format';
import type { BattleFxComponent } from './pixi/battle-fx';
import { fieldChips, stageChips, volatileChips } from './battle-view';
import { safeGet, safeSet } from '../../core/storage/safe-storage';

export type LogTone = 'crit' | 'super' | 'resist' | 'faint' | 'win' | 'switch';
export interface LogLine {
  readonly text: string;
  readonly tone?: LogTone;
}
/** A floating damage/heal number drifting over a fighter. */
export interface FloatNum {
  readonly id: number;
  readonly side: SideIndex;
  readonly text: string;
  readonly cls: string;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const SPEED_KEY = 'pv:battle:speed';
const SPEEDS = [1, 2, 3] as const;
export type BattleSpeed = (typeof SPEEDS)[number];

function readSpeed(): BattleSpeed {
  try {
    const v = Number(safeGet(SPEED_KEY));
    return (SPEEDS as readonly number[]).includes(v) ? (v as BattleSpeed) : 1;
  } catch {
    return 1;
  }
}

export function effectivenessNote(mult: number): string | null {
  if (mult === 0) return "It doesn't affect the foe…";
  if (mult >= 2) return "It's super effective!";
  if (mult > 0 && mult < 1) return "It's not very effective…";
  return null;
}

/** Per-event pacing (ms); components may override to re-pace their UI. */
export interface PresenterTimes {
  switch: number;
  move: number;
  miss: number;
  damage: number;
  heal: number;
  note: number;
  stage: number;
  faint: number;
  end: number;
}

export abstract class BattlePresenterBase {
  /* ------------------------------------------------------- visual state */
  protected readonly playerActive = signal<Battler | null>(null);
  protected readonly foeActive = signal<Battler | null>(null);
  protected readonly pHp = signal(0);
  protected readonly pMax = signal(1);
  protected readonly fHp = signal(0);
  protected readonly fMax = signal(1);
  protected readonly pStatus = signal<StatusCondition>('none');
  protected readonly fStatus = signal<StatusCondition>('none');
  protected readonly log = signal<LogLine[]>([]);
  protected readonly busy = signal(false);
  protected readonly shakeSide = signal<SideIndex | null>(null);
  protected readonly flashSide = signal<SideIndex | null>(null);
  protected readonly critSide = signal<SideIndex | null>(null);
  protected readonly enterMine = signal(false);
  protected readonly enterFoe = signal(false);
  protected readonly faintSide = signal<SideIndex | null>(null);
  protected readonly floats = signal<FloatNum[]>([]);
  private floatId = 0;

  /* Battle-state mirrors (stages, field, volatiles) filled by {@link applyBattleState}. */
  protected readonly pStages = signal<Stages>(freshStages());
  protected readonly fStages = signal<Stages>(freshStages());
  protected readonly engWeather = signal<EngineWeather>('none');
  protected readonly engTerrain = signal<Terrain>('none');
  protected readonly wTurns = signal(0);
  protected readonly tTurns = signal(0);
  private readonly pSide = signal<BattleSide | null>(null);
  private readonly fSide = signal<BattleSide | null>(null);
  private readonly fieldState = signal<Field>(freshField());

  protected readonly pStageChips = computed(() => stageChips(this.pStages()));
  protected readonly fStageChips = computed(() => stageChips(this.fStages()));
  /** Confusion, Substitute, Tera … of each side's active Pokémon. */
  protected readonly pStateChips = computed(() => volatileChips(this.pSide() ?? undefined));
  protected readonly fStateChips = computed(() => volatileChips(this.fSide() ?? undefined));
  /** Screens, Tailwind and Trick Room currently up. */
  protected readonly fieldChips = computed(() => fieldChips(this.fieldState()));

  protected readonly pHpPct = computed(() => (this.pHp() / this.pMax()) * 100);
  protected readonly fHpPct = computed(() => (this.fHp() / this.fMax()) * 100);

  protected readonly sfx = inject(SfxService);
  protected readonly haptics = inject(HapticsService);

  /** The type of the move currently resolving (drives the impact burst). */
  protected pendingType: PokemonType | null = null;

  /** The Pixi FX layer (components provide their viewChild signal). */
  protected abstract readonly fx: Signal<BattleFxComponent | undefined>;

  protected readonly times: PresenterTimes = {
    switch: 460,
    move: 520,
    miss: 440,
    damage: 500,
    heal: 340,
    note: 300,
    stage: 270,
    faint: 700,
    end: 280,
  };

  /** Playback speed (1×/2×/3×) — divides every pacing beat; persisted app-wide. */
  protected readonly speed = signal<BattleSpeed>(readSpeed());

  protected cycleSpeed(): void {
    const next = SPEEDS[(SPEEDS.indexOf(this.speed()) + 1) % SPEEDS.length]!;
    this.speed.set(next);
    try {
      safeSet(SPEED_KEY, String(next));
    } catch {
      /* persistence is best-effort */
    }
  }

  /** Speed-aware pause — use instead of `sleep` for anything the player waits on. */
  protected wait(ms: number): Promise<void> {
    return sleep(ms / this.speed());
  }

  /**
   * Pull the authoritative state of both active sides and the field from an engine into the
   * view signals (HP, status, stages, weather/terrain, volatiles, screens). Hosts call this
   * after every turn; the engine objects are mutable, so the chip computeds re-read a fresh
   * reference each time.
   */
  protected applyBattleState(me: BattleSide, foe: BattleSide, field: Field): void {
    this.pMax.set(me.maxHp);
    this.fMax.set(foe.maxHp);
    this.pHp.set(me.currentHp);
    this.fHp.set(foe.currentHp);
    this.pStatus.set(me.status);
    this.fStatus.set(foe.status);
    this.pStages.set({ ...me.stages });
    this.fStages.set({ ...foe.stages });
    this.engWeather.set(field.weather);
    this.engTerrain.set(field.terrain);
    this.wTurns.set(field.weatherTurns);
    this.tTurns.set(field.terrainTurns);
    this.pSide.set({ ...me, volatiles: { ...me.volatiles } });
    this.fSide.set({ ...foe, volatiles: { ...foe.volatiles } });
    this.fieldState.set({
      ...field,
      screens: [{ ...field.screens[0] }, { ...field.screens[1] }],
      tailwind: [field.tailwind[0], field.tailwind[1]],
    });
  }

  /** The 1–N number a key press selects (null for anything else or out of range). */
  protected digitKey(event: KeyboardEvent, count: number): number | null {
    const n = Number(event.key);
    return Number.isInteger(n) && n >= 1 && n <= count ? n : null;
  }

  /* ------------------------------------------------------------- hooks */

  /** A side's active changed (switch resolved) — refresh sprites/HP from the engine. */
  protected abstract syncSide(side: SideIndex): void;
  /** After a switch-in has been presented (cries, ace quips…). */
  protected onSwitched(_side: SideIndex): void {}
  /** After a faint line has been shown (cries…). */
  protected onFainted(_side: SideIndex): void {}
  /** Just after the impact FX fires, before the HP drop (hit-stop…). */
  protected async onImpact(_side: SideIndex, _crit: boolean): Promise<void> {}
  /** The engine reported the end of the battle. */
  protected onEnd(_winner: SideIndex): void {}
  /** Whether the faint pose clears after its beat (parties switch in a new mon). */
  protected clearFaintAfterBeat = true;

  /* -------------------------------------------------------- the pipeline */

  protected async playEvents(events: BattleEvent[]): Promise<void> {
    const t = this.times;
    for (const ev of events) {
      switch (ev.kind) {
        case 'switch':
          this.syncSide(ev.side);
          this.pulseEnter(ev.side);
          this.onSwitched(ev.side);
          this.append(ev.text, 'switch');
          await this.wait(t.switch);
          break;
        case 'move':
          this.append(`${titleCase(ev.attacker)} used ${titleCase(ev.move)}!`);
          this.pendingType = this.moveType(ev.side, ev.move);
          this.fx()?.cast(ev.side, this.pendingType);
          this.sfx.play('whoosh');
          await this.wait(t.move);
          break;
        case 'miss':
          this.append(`${titleCase(ev.attacker)}'s attack missed!`);
          this.pendingType = null;
          await this.wait(t.miss);
          break;
        case 'damage': {
          this.flashSide.set(ev.side);
          this.shakeSide.set(ev.side);
          if (this.pendingType) this.fx()?.impact(ev.side, this.pendingType, ev.crit);
          this.sfx.play(ev.crit ? 'crit' : ev.effectiveness >= 2 ? 'super' : 'hit');
          this.haptics.fire(ev.crit || ev.effectiveness >= 2 ? 'heavy' : 'impact');
          await this.onImpact(ev.side, ev.crit);
          const before = ev.side === 0 ? this.pHp() : this.fHp();
          const dealt = Math.max(0, before - ev.remainingHp);
          if (dealt > 0)
            this.spawnFloat(ev.side, `-${dealt}`, this.dmgClass(ev.crit, ev.effectiveness));
          this.setHp(ev.side, ev.remainingHp);
          if (ev.crit) {
            this.critSide.set(ev.side);
            this.append('A critical hit!', 'crit');
          }
          const note = effectivenessNote(ev.effectiveness);
          if (note) this.append(note, ev.effectiveness >= 2 ? 'super' : 'resist');
          await this.wait(t.damage);
          this.shakeSide.set(null);
          this.flashSide.set(null);
          this.critSide.set(null);
          break;
        }
        case 'heal': {
          const before = ev.side === 0 ? this.pHp() : this.fHp();
          const gained = Math.max(0, ev.remainingHp - before);
          if (gained > 0) this.spawnFloat(ev.side, `+${gained}`, 'heal');
          if (gained > 0) this.sfx.play('heal');
          this.setHp(ev.side, ev.remainingHp);
          if (ev.text) this.append(ev.text);
          await this.wait(t.heal);
          break;
        }
        case 'status-set':
          this.sfx.play('status');
          if (ev.text) this.append(ev.text);
          await this.wait(t.note);
          break;
        case 'tera':
          this.sfx.play('up');
          this.append(ev.text);
          await this.wait(t.move);
          break;
        case 'cure':
        case 'weather':
        case 'terrain':
        case 'hazard':
        case 'ability':
        case 'item':
        case 'flinch':
        case 'field':
        case 'substitute':
        case 'status':
          if (ev.text) this.append(ev.text);
          await this.wait(t.note);
          break;
        case 'stage-change':
          this.sfx.play(ev.delta > 0 ? 'up' : 'down');
          if (ev.text) this.append(ev.text);
          await this.wait(t.stage);
          break;
        case 'faint':
          this.append(`${titleCase(ev.name)} fainted!`, 'faint');
          this.sfx.play('faint');
          this.haptics.fire('heavy');
          this.onFainted(ev.side);
          this.faintSide.set(ev.side);
          await this.wait(t.faint);
          if (this.clearFaintAfterBeat) this.faintSide.set(null);
          break;
        case 'end':
          this.onEnd(ev.winner);
          await this.wait(t.end);
          break;
        default:
          break;
      }
    }
  }

  /* --------------------------------------------------------------- atoms */

  protected append(text: string, tone?: LogTone): void {
    this.log.update((l) => [...l, { text, tone }]);
  }

  protected setHp(side: SideIndex, hp: number): void {
    if (side === 0) this.pHp.set(hp);
    else this.fHp.set(hp);
  }

  /** Retrigger a side's send-out slide-in animation. */
  protected pulseEnter(side: SideIndex): void {
    const sig = side === 0 ? this.enterMine : this.enterFoe;
    sig.set(false);
    // Next microtask so the class is removed→added and the animation replays.
    queueMicrotask(() => {
      sig.set(true);
      setTimeout(() => sig.set(false), 520);
    });
  }

  /** Spawn a floating damage/heal number that drifts up and fades. */
  protected spawnFloat(side: SideIndex, text: string, cls: string): void {
    const id = ++this.floatId;
    this.floats.update((f) => [...f, { id, side, text, cls }]);
    setTimeout(() => this.floats.update((f) => f.filter((x) => x.id !== id)), 1100);
  }

  protected dmgClass(crit: boolean, effectiveness: number): string {
    if (crit) return 'crit';
    if (effectiveness >= 2) return 'super';
    if (effectiveness > 0 && effectiveness < 1) return 'resist';
    return 'normal';
  }

  protected moveType(side: SideIndex, name: string): PokemonType {
    const battler = side === 0 ? this.playerActive() : this.foeActive();
    return battler?.moves.find((m) => m.name === name)?.type ?? 'normal';
  }
}
