import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  TeamBattle,
  abilityName,
  freshStages,
  BOOSTABLE_STATS,
  type Battler,
  type BattleEvent,
  type BattleMove,
  type BoostableStat,
  type SideIndex,
  type Stages,
  type StatusCondition,
  type TeamAction,
  type Terrain,
  type Weather as EngineWeather,
} from '../../../game/engine';
import { TypeBadgeComponent } from '../../../core/ui/type-badge/type-badge';
import { WeatherOverlayComponent } from '../../../core/ui/weather-overlay/weather-overlay';
import { StatusBadgeComponent } from '../../../core/ui/status-badge/status-badge';
import { FieldBannerComponent } from '../../../core/ui/field-banner/field-banner';
import { MoveButtonComponent } from '../../../core/ui/move-button/move-button';
import { BattleFxComponent } from '../../battle/pixi/battle-fx';
import { pickWeather, weatherForType, type Weather } from '../../../core/ui/weather-overlay/weather';
import { SeededRng } from '../../../core/utils/rng';
import { titleCase } from '../../../core/ui/format';
import type { PokemonType } from '../../../core/utils/type-chart';
import type { PlayerMatchSetup } from '../tournaments.service';

interface StageChip {
  readonly label: string;
  readonly value: number;
}
interface TrayMon {
  readonly mon: Battler;
  readonly hp: number;
  readonly maxHp: number;
  readonly active: boolean;
  readonly fainted: boolean;
  readonly index: number;
  readonly switchable: boolean;
}
interface MoveSlot {
  readonly move: BattleMove;
  readonly pp: number;
  readonly maxPp: number | null;
}
interface FloatNum {
  readonly id: number;
  readonly side: SideIndex;
  readonly text: string;
  readonly cls: string;
}

export interface MatchOutcome {
  readonly playerWon: boolean;
  readonly playerFinalHp: number[];
}

const STAGE_SHORT: Record<BoostableStat, string> = {
  attack: 'Atk', defense: 'Def', 'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe', accuracy: 'Acc', evasion: 'Eva',
};
const OVERLAY_WEATHER: Record<EngineWeather, Weather> = {
  none: 'clear', sun: 'sun', rain: 'rain', sand: 'sand', hail: 'snow', snow: 'snow',
};

function stageChips(stages: Stages): StageChip[] {
  return BOOSTABLE_STATS.filter((s) => stages[s] !== 0).map((s) => ({ label: STAGE_SHORT[s], value: stages[s] }));
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function effectivenessNote(mult: number): string | null {
  if (mult === 0) return "It doesn't affect the foe…";
  if (mult >= 2) return "It's super effective!";
  if (mult > 0 && mult < 1) return "It's not very effective…";
  return null;
}

/**
 * Interactive 3-v-3 match on the party-aware {@link TeamBattle} engine: the
 * player chooses a move **or a switch** each turn, the field (weather/terrain/
 * hazards) persists across switches, and a forced switch is requested when the
 * active Pokémon faints. Reused by Arena, Tournaments and the Spire.
 */
@Component({
  selector: 'pv-tournament-match',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TypeBadgeComponent, WeatherOverlayComponent, StatusBadgeComponent, FieldBannerComponent, MoveButtonComponent, BattleFxComponent],
  templateUrl: './tournament-match.html',
  styleUrl: './tournament-match.scss',
})
export class TournamentMatchComponent {
  readonly setup = input.required<PlayerMatchSetup>();
  readonly finished = output<MatchOutcome>();

  protected readonly titleCase = titleCase;
  protected readonly abilityName = abilityName;

  /** Active fighters + their live HP (animated). */
  protected readonly playerActive = signal<Battler | null>(null);
  protected readonly foeActive = signal<Battler | null>(null);
  protected readonly pHp = signal(0);
  protected readonly pMax = signal(1);
  protected readonly fHp = signal(0);
  protected readonly fMax = signal(1);

  protected readonly log = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly playerWon = signal(false);
  /** True while the player must pick a replacement after a faint. */
  protected readonly awaitingSwitch = signal(false);
  /** Whether the switch tray is open (manual switch chooser). */
  protected readonly switchOpen = signal(false);

  protected readonly shakeSide = signal<SideIndex | null>(null);
  protected readonly flashSide = signal<SideIndex | null>(null);
  protected readonly critSide = signal<SideIndex | null>(null);
  /** Sprite currently sliding in (send-out), per side; and the one dropping (faint). */
  protected readonly enterMine = signal(false);
  protected readonly enterFoe = signal(false);
  protected readonly faintSide = signal<SideIndex | null>(null);
  /** Floating damage / heal numbers over a fighter. */
  protected readonly floats = signal<FloatNum[]>([]);
  private floatId = 0;

  protected readonly pStatus = signal<StatusCondition>('none');
  protected readonly fStatus = signal<StatusCondition>('none');
  protected readonly pStages = signal<Stages>(freshStages());
  protected readonly fStages = signal<Stages>(freshStages());
  protected readonly engWeather = signal<EngineWeather>('none');
  protected readonly engTerrain = signal<Terrain>('none');
  protected readonly wTurns = signal(0);
  protected readonly tTurns = signal(0);

  protected readonly foeQuip = signal<string | null>(null);
  private foeAceShown = false;

  /** Bumped after every engine mutation so tray/move computeds refresh. */
  private readonly version = signal(0);

  protected readonly pStageChips = computed(() => stageChips(this.pStages()));
  protected readonly fStageChips = computed(() => stageChips(this.fStages()));
  protected readonly playerAbility = computed(() => abilityName(this.playerActive()?.ability));
  protected readonly foeAbility = computed(() => abilityName(this.foeActive()?.ability));
  protected readonly pHpPct = computed(() => (this.pHp() / this.pMax()) * 100);
  protected readonly fHpPct = computed(() => (this.fHp() / this.fMax()) * 100);

  /** The active Pokémon's moves with remaining PP. */
  protected readonly moveSlots = computed<MoveSlot[]>(() => {
    this.version();
    const side = this.tb?.active(0);
    if (!side) return [];
    return side.battler.moves.map((move, i) => ({
      move,
      pp: Number.isFinite(side.pp[i]) ? side.pp[i] : Infinity,
      maxPp: move.pp ?? null,
    }));
  });
  protected readonly canSwitch = computed(() => {
    this.version();
    return (this.tb?.benchedSwitches(0).length ?? 0) > 0;
  });

  protected readonly playerTray = computed<TrayMon[]>(() => this.tray(0));
  protected readonly foeTray = computed<TrayMon[]>(() => this.tray(1));

  protected readonly ruleBanner = computed(() => {
    const rules = this.setup().rules;
    if (rules?.inverse) return 'Inverse battle — the type chart is flipped!';
    if (rules?.weatherBoostType) return `${titleCase(rules.weatherBoostType)}-type moves are boosted 1.5×!`;
    return null;
  });

  /** Cosmetic backdrop: engine weather if set, else a type-evoked ambiance. */
  protected readonly weather = computed<Weather>(() => {
    const w = this.engWeather();
    if (w !== 'none') return OVERLAY_WEATHER[w];
    const boost = this.setup().rules?.weatherBoostType;
    if (boost) {
      const wf = weatherForType(boost);
      if (wf !== 'clear') return wf;
    }
    const me = this.playerActive();
    const foe = this.foeActive();
    if (!me || !foe) return 'clear';
    const rng = new SeededRng(`${this.setup().match.id}-wx`);
    return pickWeather(me.types, foe.types, (items) => rng.pick(items));
  });

  protected readonly rules = computed(() => this.setup().rules);
  protected readonly foeTypes = computed(() => this.foeActive()?.types);

  private tb: TeamBattle | null = null;
  private started = false;
  private readonly fx = viewChild(BattleFxComponent);
  private readonly logEl = viewChild<ElementRef<HTMLElement>>('logEl');
  private pendingMove: { side: SideIndex; type: PokemonType } | null = null;

  constructor() {
    effect(() => {
      const s = this.setup();
      if (this.started || !s) return;
      this.started = true;
      this.begin(s);
    });
    // Keep the battle log pinned to the newest line as it streams in.
    effect(() => {
      this.log();
      const el = this.logEl()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  /* ----------------------------------------------------------- actions */

  protected async useMove(index: number): Promise<void> {
    if (!this.ready()) return;
    this.switchOpen.set(false);
    await this.resolveTurn({ type: 'move', index });
  }

  protected toggleSwitch(): void {
    if (this.busy() || this.done()) return;
    this.switchOpen.update((v) => !v);
  }

  protected async onTraySelect(side: SideIndex, index: number): Promise<void> {
    if (side !== 0 || !this.tb) return;
    if (!this.tb.benchedSwitches(0).includes(index)) return;
    if (this.awaitingSwitch()) {
      await this.doForcedSwitch(index);
    } else if (this.ready()) {
      this.switchOpen.set(false);
      await this.resolveTurn({ type: 'switch', to: index });
    }
  }

  protected continue(): void {
    this.finished.emit({ playerWon: this.playerWon(), playerFinalHp: this.tb?.hp(0) ?? [] });
  }

  private ready(): boolean {
    return !!this.tb && !this.busy() && !this.done() && !this.awaitingSwitch();
  }

  /* ----------------------------------------------------------- engine */

  private begin(s: PlayerMatchSetup): void {
    this.foeAceShown = false;
    this.tb = new TeamBattle(s.playerTeam, s.foeTeam, s.match.id, {
      rules: s.rules,
      aiTier: s.aiTier ?? 'strong',
      startHpA: s.playerStartHp,
      startHpB: s.foeStartHp,
      field: s.field,
    });
    this.log.set([`${s.foe.name} wants to battle!`]);
    this.syncAll();
    this.pulseEnter(0);
    this.pulseEnter(1);
    this.append(`Go, ${titleCase(this.tb.active(0).battler.name)}!`);
    this.append(`${s.foe.name} sent out ${titleCase(this.tb.active(1).battler.name)}!`);
    this.maybeAceQuip();
  }

  private async resolveTurn(playerAction: TeamAction): Promise<void> {
    const tb = this.tb;
    if (!tb) return;
    this.busy.set(true);
    const events = tb.takeTurn(playerAction, tb.chooseAction(1));
    await this.playEvents(events);
    this.syncAll();
    await this.afterTurn();
  }

  /** Resolve forced switches and decide whether control returns to the player. */
  private async afterTurn(): Promise<void> {
    const tb = this.tb!;
    if (tb.state.finished) return this.end();

    if (tb.mustSwitch(1)) {
      await sleep(350);
      await this.playEvents(tb.autoForceSwitch(1));
      this.syncAll();
      if (tb.state.finished) return this.end();
    }

    if (tb.mustSwitch(0)) {
      this.awaitingSwitch.set(true);
      this.switchOpen.set(true);
      this.append('Choose your next Pokémon!');
      this.busy.set(false); // tray is interactive, moves stay locked
      return;
    }
    this.busy.set(false);
  }

  private async doForcedSwitch(index: number): Promise<void> {
    const tb = this.tb!;
    this.awaitingSwitch.set(false);
    this.switchOpen.set(false);
    this.busy.set(true);
    await this.playEvents(tb.forceSwitch(0, index));
    this.syncAll();
    // A hazard could KO the incoming Pokémon → ask again, or end the match.
    if (tb.state.finished) return this.end();
    if (tb.mustSwitch(0)) {
      this.awaitingSwitch.set(true);
      this.switchOpen.set(true);
      this.append('Choose your next Pokémon!');
      this.busy.set(false);
      return;
    }
    this.busy.set(false);
  }

  private end(): void {
    const tb = this.tb!;
    this.playerWon.set(tb.state.winner === 0);
    this.done.set(true);
    this.busy.set(false);
    this.append(this.playerWon() ? 'Match won!' : 'You were knocked out…');
  }

  /* ----------------------------------------------------------- sync + fx */

  private syncAll(): void {
    const tb = this.tb;
    if (!tb) return;
    const me = tb.active(0);
    const foe = tb.active(1);
    this.playerActive.set(me.battler);
    this.foeActive.set(foe.battler);
    this.pMax.set(me.maxHp);
    this.fMax.set(foe.maxHp);
    this.pHp.set(me.currentHp);
    this.fHp.set(foe.currentHp);
    this.pStatus.set(me.status);
    this.fStatus.set(foe.status);
    this.pStages.set({ ...me.stages });
    this.fStages.set({ ...foe.stages });
    const f = tb.state.field;
    this.engWeather.set(f.weather);
    this.engTerrain.set(f.terrain);
    this.wTurns.set(f.weatherTurns);
    this.tTurns.set(f.terrainTurns);
    this.version.update((v) => v + 1);
  }

  private maybeAceQuip(): void {
    const s = this.setup();
    const tb = this.tb;
    if (!tb || !s.foeAce || this.foeAceShown || s.foeTeam.length < 2) return;
    if (tb.state.active[1] !== s.foeTeam.length - 1) return;
    this.foeAceShown = true;
    this.foeQuip.set(s.foeAce);
    this.append(s.foeAce);
    setTimeout(() => this.foeQuip.set(null), 3200);
  }

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.kind) {
        case 'switch':
          this.syncSide(ev.side);
          this.pulseEnter(ev.side);
          this.append(ev.text);
          if (ev.side === 1) this.maybeAceQuip();
          await sleep(480);
          break;
        case 'move':
          this.append(`${titleCase(ev.attacker)} used ${titleCase(ev.move)}!`);
          this.pendingMove = { side: ev.side, type: this.moveType(ev.side, ev.move) };
          this.fx()?.cast(ev.side, this.pendingMove.type);
          await sleep(520);
          break;
        case 'miss':
          this.append(`${titleCase(ev.attacker)}'s attack missed!`);
          this.pendingMove = null;
          await sleep(440);
          break;
        case 'damage': {
          this.flashSide.set(ev.side);
          this.shakeSide.set(ev.side);
          if (this.pendingMove) this.fx()?.impact(ev.side, this.pendingMove.type, ev.crit);
          const before = ev.side === 0 ? this.pHp() : this.fHp();
          const dealt = Math.max(0, before - ev.remainingHp);
          if (dealt > 0) this.spawnFloat(ev.side, `-${dealt}`, this.dmgClass(ev.crit, ev.effectiveness));
          if (ev.side === 0) this.pHp.set(ev.remainingHp);
          else this.fHp.set(ev.remainingHp);
          if (ev.crit) {
            this.critSide.set(ev.side);
            this.append('A critical hit!');
          }
          const note = effectivenessNote(ev.effectiveness);
          if (note) this.append(note);
          await sleep(500);
          this.shakeSide.set(null);
          this.flashSide.set(null);
          this.critSide.set(null);
          break;
        }
        case 'heal': {
          const before = ev.side === 0 ? this.pHp() : this.fHp();
          const gained = Math.max(0, ev.remainingHp - before);
          if (gained > 0) this.spawnFloat(ev.side, `+${gained}`, 'heal');
          if (ev.side === 0) this.pHp.set(ev.remainingHp);
          else this.fHp.set(ev.remainingHp);
          if (ev.text) this.append(ev.text);
          await sleep(330);
          break;
        }
        case 'status-set':
        case 'cure':
        case 'weather':
        case 'terrain':
        case 'hazard':
        case 'ability':
        case 'item':
        case 'flinch':
        case 'status':
          if (ev.text) this.append(ev.text);
          await sleep(300);
          break;
        case 'stage-change':
          if (ev.text) this.append(ev.text);
          await sleep(260);
          break;
        case 'faint':
          this.append(`${titleCase(ev.name)} fainted!`);
          this.faintSide.set(ev.side);
          await sleep(700);
          this.faintSide.set(null);
          break;
        default:
          break;
      }
    }
  }

  /** Update one side's active sprite + HP mid-animation (after a switch). */
  private syncSide(side: SideIndex): void {
    const s = this.tb?.active(side);
    if (!s) return;
    if (side === 0) {
      this.playerActive.set(s.battler);
      this.pMax.set(s.maxHp);
      this.pHp.set(s.currentHp);
    } else {
      this.foeActive.set(s.battler);
      this.fMax.set(s.maxHp);
      this.fHp.set(s.currentHp);
    }
    this.version.update((v) => v + 1);
  }

  private tray(side: SideIndex): TrayMon[] {
    this.version();
    const tb = this.tb;
    if (!tb) return [];
    const benched = side === 0 ? tb.benchedSwitches(0) : [];
    return tb.state.parties[side].map((s, i) => ({
      mon: s.battler,
      hp: s.currentHp,
      maxHp: s.maxHp,
      active: i === tb.state.active[side],
      fainted: s.currentHp <= 0,
      index: i,
      switchable: side === 0 && benched.includes(i) && (this.switchOpen() || this.awaitingSwitch()),
    }));
  }

  private append(line: string): void {
    this.log.update((l) => [...l, line]);
  }

  /** Retrigger a side's send-out slide-in animation. */
  private pulseEnter(side: SideIndex): void {
    const sig = side === 0 ? this.enterMine : this.enterFoe;
    sig.set(false);
    // Next microtask so the class is removed→added and the animation replays.
    queueMicrotask(() => {
      sig.set(true);
      setTimeout(() => sig.set(false), 520);
    });
  }

  /** Spawn a floating damage/heal number that drifts up and fades. */
  private spawnFloat(side: SideIndex, text: string, cls: string): void {
    const id = ++this.floatId;
    this.floats.update((f) => [...f, { id, side, text, cls }]);
    setTimeout(() => this.floats.update((f) => f.filter((x) => x.id !== id)), 1100);
  }

  private dmgClass(crit: boolean, effectiveness: number): string {
    if (crit) return 'crit';
    if (effectiveness >= 2) return 'super';
    if (effectiveness > 0 && effectiveness < 1) return 'resist';
    return 'normal';
  }

  private moveType(side: SideIndex, name: string): PokemonType {
    const battler = side === 0 ? this.playerActive() : this.foeActive();
    return battler?.moves.find((m) => m.name === name)?.type ?? 'normal';
  }
}
