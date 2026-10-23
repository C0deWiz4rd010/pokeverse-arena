import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
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
  type Battler,
  type BattleMove,
  type SideIndex,
  type TeamAction,
} from '../../../game/engine';
import { TypeBadgeComponent } from '../../../core/ui/type-badge/type-badge';
import { WeatherOverlayComponent } from '../../../core/ui/weather-overlay/weather-overlay';
import { StatusBadgeComponent } from '../../../core/ui/status-badge/status-badge';
import { FieldBannerComponent } from '../../../core/ui/field-banner/field-banner';
import { MoveButtonComponent } from '../../../core/ui/move-button/move-button';
import { BattleFxComponent } from '../../battle/pixi/battle-fx';
import { FieldChipsComponent, StateChipsComponent } from '../../battle/state-chips';
import { BattlePresenterBase } from '../../battle/battle-presenter';
import {
  pickWeather,
  weatherForType,
  AMBIENCE_FOR_ENGINE,
  type Ambience,
} from '../../../core/ui/weather-overlay/weather';
import { SeededRng } from '../../../core/utils/rng';
import { titleCase } from '../../../core/ui/format';
import type { MatchOutcome, PlayerMatchSetup } from '../../../game/tournament';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

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
  /** Locked out this turn (Choice lock, Encore or a charging move forces another move). */
  readonly locked: boolean;
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
  imports: [
    TranslatePipe,
    TypeBadgeComponent,
    WeatherOverlayComponent,
    StatusBadgeComponent,
    FieldBannerComponent,
    MoveButtonComponent,
    BattleFxComponent,
    StateChipsComponent,
    FieldChipsComponent,
  ],
  templateUrl: './tournament-match.html',
  styleUrl: './tournament-match.scss',
})
export class TournamentMatchComponent extends BattlePresenterBase {
  readonly setup = input.required<PlayerMatchSetup>();
  readonly finished = output<MatchOutcome>();

  protected readonly titleCase = titleCase;
  protected readonly abilityName = abilityName;

  protected readonly done = signal(false);
  protected readonly playerWon = signal(false);
  /** True while the player must pick a replacement after a faint. */
  protected readonly awaitingSwitch = signal(false);
  /** The forced switch comes from a pivot move (U-turn…), not from a faint. */
  protected readonly pivoting = signal(false);
  /** Whether the switch tray is open (manual switch chooser). */
  protected readonly switchOpen = signal(false);

  protected readonly foeQuip = signal<string | null>(null);
  private foeAceShown = false;

  /** Bumped after every engine mutation so tray/move computeds refresh. */
  private readonly version = signal(0);

  protected readonly playerAbility = computed(() => abilityName(this.playerActive()?.ability));
  protected readonly foeAbility = computed(() => abilityName(this.foeActive()?.ability));

  /** The active Pokémon's moves with remaining PP. */
  protected readonly moveSlots = computed<MoveSlot[]>(() => {
    this.version();
    const side = this.tb?.active(0);
    if (!side) return [];
    const forced = this.tb?.forcedMove(0) ?? null;
    return side.battler.moves.map((move, i) => ({
      move,
      pp: Number.isFinite(side.pp[i]) ? side.pp[i]! : Infinity,
      maxPp: move.pp ?? null,
      locked: forced !== null && forced !== i,
    }));
  });
  /** Every move is out of PP: the only option left is Struggle. */
  protected readonly struggling = computed(() => {
    this.version();
    return this.tb?.mustStruggle(0) ?? false;
  });
  /** Terastallization: armed for the next move. */
  protected readonly teraArmed = signal(false);
  protected readonly canTera = computed(() => {
    this.version();
    return !!this.tb && this.tb.canTerastallize(0) && !this.awaitingSwitch();
  });
  protected readonly teraType = computed(() => {
    const mon = this.playerActive();
    return mon ? (mon.teraType ?? mon.types[0] ?? null) : null;
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
    if (rules?.weatherBoostType)
      return `${titleCase(rules.weatherBoostType)}-type moves are boosted 1.5×!`;
    return null;
  });

  /** Cosmetic backdrop: engine weather if set, else a type-evoked ambiance. */
  protected readonly weather = computed<Ambience>(() => {
    const w = this.engWeather();
    if (w !== 'none') return AMBIENCE_FOR_ENGINE[w];
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
  protected readonly fx = viewChild(BattleFxComponent);
  private readonly logEl = viewChild<ElementRef<HTMLElement>>('logEl');

  constructor() {
    super();
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

  /** Keyboard: 1–4 fire moves (or pick a replacement when switching), S toggles the switch tray. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.done() || this.busy() || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (this.awaitingSwitch()) {
      const bench = this.tb?.benchedSwitches(0) ?? [];
      const n = this.digitKey(event, bench.length);
      if (n !== null) {
        event.preventDefault();
        void this.onTraySelect(0, bench[n - 1]!);
      }
      return;
    }
    if (key === 't') {
      if (this.canTera()) {
        event.preventDefault();
        this.toggleTera();
      }
      return;
    }
    if (key === 's') {
      if (this.canSwitch()) {
        event.preventDefault();
        this.toggleSwitch();
      }
      return;
    }
    const n = this.digitKey(event, this.moveSlots().length);
    if (n !== null) {
      const slot = this.moveSlots()[n - 1]!;
      if (slot.pp > 0 && !slot.locked) {
        event.preventDefault();
        void this.useMove(n - 1);
      }
    }
  }

  protected async useMove(index: number): Promise<void> {
    if (!this.ready()) return;
    this.switchOpen.set(false);
    const tera = this.teraArmed() && this.canTera();
    this.teraArmed.set(false);
    await this.resolveTurn({ type: 'move', index, tera });
  }

  protected toggleTera(): void {
    if (this.busy() || this.done() || !this.canTera()) return;
    this.teraArmed.update((v) => !v);
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
    this.log.set([{ text: `${s.foe.name} wants to battle!` }]);
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
      await this.wait(350);
      await this.playEvents(tb.autoForceSwitch(1));
      this.syncAll();
      if (tb.state.finished) return this.end();
    }

    if (tb.mustSwitch(0)) {
      this.askForSwitch();
      this.busy.set(false); // tray is interactive, moves stay locked
      return;
    }
    this.busy.set(false);
  }

  /** The tray opens for a replacement (after a faint) or for a pivot move's switch. */
  private askForSwitch(): void {
    const pivoting = (this.tb?.active(0).currentHp ?? 0) > 0;
    this.pivoting.set(pivoting);
    this.awaitingSwitch.set(true);
    this.switchOpen.set(true);
    this.append(pivoting ? 'Choose who takes over!' : 'Choose your next Pokémon!');
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
      this.askForSwitch();
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
    this.append(
      this.playerWon() ? 'Match won!' : 'You were knocked out…',
      this.playerWon() ? 'win' : 'faint',
    );
  }

  /* ----------------------------------------------------------- sync + fx */

  private syncAll(): void {
    const tb = this.tb;
    if (!tb) return;
    const me = tb.active(0);
    const foe = tb.active(1);
    this.playerActive.set(me.battler);
    this.foeActive.set(foe.battler);
    this.applyBattleState(me, foe, tb.state.field);
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

  /** The ace gets its quip the moment it walks on stage. */
  protected override onSwitched(side: SideIndex): void {
    if (side === 1) this.maybeAceQuip();
  }

  /** Update one side's active sprite + HP mid-animation (after a switch). */
  protected syncSide(side: SideIndex): void {
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
}
