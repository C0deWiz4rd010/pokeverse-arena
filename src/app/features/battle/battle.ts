import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { BattlerFactory } from '../../core/battle/battler-factory';
import { DailyService } from './daily.service';
import { buildShareText, turnEmoji } from '../../game/daily/daily';
import { ToastService } from '../../core/ui/toast/toast.service';
import { Battle, abilityName, itemName, type Battler, type SideIndex } from '../../game/engine';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { WeatherOverlayComponent } from '../../core/ui/weather-overlay/weather-overlay';
import { StatusBadgeComponent } from '../../core/ui/status-badge/status-badge';
import { FieldBannerComponent } from '../../core/ui/field-banner/field-banner';
import { MoveButtonComponent } from '../../core/ui/move-button/move-button';
import { IconComponent } from '../../core/ui/icon/icon';
import { BattleFxComponent } from './pixi/battle-fx';
import { FieldChipsComponent, StateChipsComponent } from './state-chips';
import { BattlePresenterBase } from './battle-presenter';
import { PokedexService } from '../pokedex/pokedex.service';
import { titleCase } from '../../core/ui/format';
import { SeededRng } from '../../core/utils/rng';
import {
  pickWeather,
  AMBIENCE_FOR_ENGINE,
  AMBIENCE_INFO,
  type Ambience,
} from '../../core/ui/weather-overlay/weather';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

type Phase = 'setup' | 'loading' | 'fighting' | 'done';

@Component({
  selector: 'pv-battle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    TypeBadgeComponent,
    SpinnerComponent,
    PageHeaderComponent,
    WeatherOverlayComponent,
    StatusBadgeComponent,
    FieldBannerComponent,
    MoveButtonComponent,
    IconComponent,
    BattleFxComponent,
    StateChipsComponent,
    FieldChipsComponent,
  ],
  templateUrl: './battle.html',
  styleUrl: './battle.scss',
})
export class BattleComponent extends BattlePresenterBase {
  private readonly svc = inject(BattlerFactory);
  private readonly pokedex = inject(PokedexService);
  protected readonly daily = inject(DailyService);
  private readonly toasts = inject(ToastService);
  /** One emoji per player turn of the current daily run (for sharing). */
  private dailyMarks: string[] = [];

  /** `?daily=1` (e.g. from the command palette) jumps straight into the daily. */
  readonly dailyParam = input<string | undefined>(undefined, { alias: 'daily' });
  /** 'daily' battles are seeded from the date and feed the streak record. */
  protected readonly mode = signal<'free' | 'daily'>('free');
  protected readonly titleCase = titleCase;
  protected readonly abilityName = abilityName;
  protected readonly itemName = itemName;

  protected readonly phase = signal<Phase>('setup');
  protected readonly error = signal<string | null>(null);

  protected readonly playerInput = signal('');
  protected readonly names = this.pokedex.names;

  /* Template-facing aliases onto the shared presenter signals. */
  protected readonly player = this.playerActive;
  protected readonly opponent = this.foeActive;
  protected readonly playerHp = this.pHp;
  protected readonly playerMaxHp = this.pMax;
  protected readonly oppHp = this.fHp;
  protected readonly oppMaxHp = this.fMax;
  protected readonly playerStatus = this.pStatus;
  protected readonly oppStatus = this.fStatus;
  protected readonly playerStages = this.pStages;
  protected readonly oppStages = this.fStages;

  protected readonly engineWeather = this.engWeather;
  protected readonly engineTerrain = this.engTerrain;
  protected readonly weatherTurns = this.wTurns;
  protected readonly terrainTurns = this.tTurns;

  protected readonly winner = signal<SideIndex | null>(null);
  /** The 1-v-1 loser stays down — no bench sends in a replacement. */
  protected override clearFaintAfterBeat = false;

  /** Cosmetic backdrop: engine weather if set, else a type-evoked ambiance. */
  protected readonly weather = computed<Ambience>(() => {
    const w = this.engineWeather();
    if (w !== 'none') return AMBIENCE_FOR_ENGINE[w];
    return this.ambientWeather();
  });
  protected readonly weatherInfo = computed(() => AMBIENCE_INFO[this.weather()]);
  private readonly ambientWeather = signal<Ambience>('clear');

  protected readonly playerHpPct = this.pHpPct;
  protected readonly oppHpPct = this.fHpPct;
  protected readonly playerMoves = computed(() => this.player()?.moves ?? []);
  /** Bumped after every engine mutation so the move lock state refreshes. */
  private readonly version = signal(0);
  /** Moves the player cannot pick right now: out of PP, or locked by Choice / Encore / a charge. */
  protected readonly blockedMoves = computed<boolean[]>(() => {
    this.version();
    const battle = this.battle;
    const moves = this.playerMoves();
    if (!battle) return moves.map(() => false);
    const forced = battle.forcedMove(0);
    return moves.map((_, i) => {
      const pp = battle.player.pp[i];
      const empty = pp !== undefined && Number.isFinite(pp) && pp <= 0;
      return empty || (forced !== null && forced !== i);
    });
  });
  /** Every move is out of PP: only Struggle is left. */
  protected readonly struggling = computed(() => {
    this.version();
    return this.battle?.mustStruggle(0) ?? false;
  });
  protected readonly outcomeWon = computed(() => this.winner() === 0);

  protected readonly playerStageChips = this.pStageChips;
  protected readonly oppStageChips = this.fStageChips;
  protected readonly playerAbility = computed(() => abilityName(this.player()?.ability));
  protected readonly oppAbility = computed(() => abilityName(this.opponent()?.ability));

  protected readonly fx = viewChild(BattleFxComponent);
  private readonly logEl = viewChild<ElementRef<HTMLElement>>('logLines');
  private battle: Battle | null = null;

  constructor() {
    super();
    void this.pokedex.ensureLoaded();
    // Keep the battle log pinned to the newest line as it streams in.
    effect(() => {
      this.log();
      const el = this.logEl()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
    // Deep link (?daily=1): start today's challenge as soon as we land — also
    // when the palette navigates here while a finished battle is on screen.
    let autoStarted = false;
    effect(() => {
      const idle = this.phase() === 'setup' || this.phase() === 'done';
      if (this.dailyParam() === '1' && !autoStarted && idle) {
        autoStarted = true;
        void this.startDaily();
      }
    });
  }

  protected setPlayerInput(event: Event): void {
    this.playerInput.set((event.target as HTMLInputElement).value);
  }

  protected async start(): Promise<void> {
    const wanted = this.playerInput().trim().toLowerCase();
    this.mode.set('free');
    this.phase.set('loading');
    this.error.set(null);
    try {
      const playerId = wanted || this.svc.randomId();
      const player = await this.svc.buildBattler(playerId);
      const opponent = await this.svc.buildBattler(this.svc.randomId(player.id));
      this.beginBattle(player, opponent);
    } catch {
      this.error.set('Could not load that Pokémon. Try another name or number.');
      this.phase.set('setup');
    }
  }

  protected async surpriseMe(): Promise<void> {
    this.playerInput.set('');
    await this.start();
  }

  /** Today's seeded matchup — identical for every trainer, streak on the line. */
  protected async startDaily(): Promise<void> {
    this.mode.set('daily');
    this.phase.set('loading');
    this.error.set(null);
    try {
      const m = this.daily.matchup;
      const [player, opponent] = await Promise.all([
        this.svc.buildBattler(m.playerId, m.level),
        this.svc.buildBattler(m.opponentId, m.level),
      ]);
      this.beginBattle(player, opponent, m.seed);
    } catch {
      this.error.set('Could not load today’s challengers. Check your connection and retry.');
      this.mode.set('free');
      this.phase.set('setup');
    }
  }

  private beginBattle(
    player: Battler,
    opponent: Battler,
    seed: number | string = Date.now(),
  ): void {
    this.dailyMarks = [];
    this.battle = new Battle(player, opponent, seed, undefined, 'strong');
    this.player.set(player);
    this.opponent.set(opponent);
    this.playerMaxHp.set(this.battle.player.maxHp);
    this.oppMaxHp.set(this.battle.opponent.maxHp);
    this.playerHp.set(this.battle.player.maxHp);
    this.oppHp.set(this.battle.opponent.maxHp);
    this.applyBattleState(this.battle.player, this.battle.opponent, this.battle.state.field);
    this.version.update((v) => v + 1);
    this.winner.set(null);

    const rng = new SeededRng(`${player.id}-${opponent.id}`);
    this.ambientWeather.set(pickWeather(player.types, opponent.types, (items) => rng.pick(items)));
    const info = AMBIENCE_INFO[this.weather()];
    this.log.set([
      { text: `A wild ${titleCase(opponent.name)} appeared!` },
      { text: `Go, ${titleCase(player.name)}!` },
      ...(this.weather() === 'clear' ? [] : [{ text: `${info.label}!` }]),
    ]);
    this.faintSide.set(null);
    this.floats.set([]);
    this.pulseEnter(0);
    this.pulseEnter(1);
    this.phase.set('fighting');
  }

  /** Number keys 1–4 fire the matching move while fighting. */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.phase() !== 'fighting' || this.busy()) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const n = this.digitKey(event, this.playerMoves().length);
    if (n !== null && !this.blockedMoves()[n - 1]) {
      event.preventDefault();
      void this.useMove(n - 1);
    }
  }

  protected async useMove(index: number): Promise<void> {
    if (!this.battle || this.busy() || this.phase() !== 'fighting') return;
    this.busy.set(true);
    const events = this.battle.takeTurn(index);
    if (this.mode() === 'daily') this.dailyMarks.push(turnEmoji(events));
    await this.playEvents(events);
    this.syncState();
    this.busy.set(false);
    if (this.battle.state.finished) {
      this.winner.set(this.battle.state.winner);
      this.phase.set('done');
      // First daily attempt of the day feeds the streak; retries are for fun.
      if (this.mode() === 'daily') this.daily.report(this.battle.state.winner === 0);
    }
  }

  /** Copy (or natively share) the Wordle-style result of a daily run. */
  protected async shareDaily(): Promise<void> {
    const text = buildShareText({
      key: this.daily.today,
      won: this.outcomeWon(),
      turns: this.battle?.state.turn ?? this.dailyMarks.length,
      streak: this.daily.streak(),
      marks: this.dailyMarks,
    });
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      throw new Error('no web share');
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        this.toasts.show({
          title: 'Result copied to clipboard',
          text: 'Paste it anywhere to challenge a friend.',
          icon: 'copy',
          kind: 'info',
        });
      } catch {
        this.toasts.show({
          title: 'Could not copy the result',
          icon: 'triangle-alert',
          kind: 'info',
        });
      }
    }
  }

  protected rematch(): void {
    const player = this.player();
    const opponent = this.opponent();
    if (!player || !opponent) return;
    // A daily rematch replays the exact same seeded battle.
    this.beginBattle(
      player,
      opponent,
      this.mode() === 'daily' ? this.daily.matchup.seed : Date.now(),
    );
  }

  protected newBattle(): void {
    this.mode.set('free');
    this.battle = null;
    this.player.set(null);
    this.opponent.set(null);
    this.log.set([]);
    this.winner.set(null);
    this.phase.set('setup');
  }

  /* --------------------------------------------------- event presentation */

  /** 1-v-1 has no switches — nothing to resync mid-stream. */
  protected syncSide(): void {}

  protected override onEnd(winner: SideIndex): void {
    this.append(
      winner === 0 ? 'You won the battle!' : 'You were defeated…',
      winner === 0 ? 'win' : 'faint',
    );
  }

  /** Pull authoritative status/stages/field state from the engine after a turn. */
  private syncState(): void {
    if (!this.battle) return;
    const p = this.battle.player;
    const o = this.battle.opponent;
    this.applyBattleState(p, o, this.battle.state.field);
    this.version.update((v) => v + 1);
  }
}
