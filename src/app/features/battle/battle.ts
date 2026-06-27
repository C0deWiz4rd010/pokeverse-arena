import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { BattleService } from './battle.service';
import {
  Battle,
  abilityName,
  itemName,
  freshStages,
  BOOSTABLE_STATS,
  type Battler,
  type BattleEvent,
  type BoostableStat,
  type SideIndex,
  type Stages,
  type StatusCondition,
  type Terrain,
  type Weather as EngineWeather,
} from '../../game/engine';
import { TypeBadgeComponent } from '../../core/ui/type-badge/type-badge';
import { SpinnerComponent } from '../../core/ui/spinner/spinner';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header';
import { WeatherOverlayComponent } from '../../core/ui/weather-overlay/weather-overlay';
import { StatusBadgeComponent } from '../../core/ui/status-badge/status-badge';
import { FieldBannerComponent } from '../../core/ui/field-banner/field-banner';
import { MoveButtonComponent } from '../../core/ui/move-button/move-button';
import { IconComponent } from '../../core/ui/icon/icon';
import { BattleFxComponent } from './pixi/battle-fx';
import { PokedexService } from '../pokedex/pokedex.service';
import { titleCase } from '../../core/ui/format';
import { SeededRng } from '../../core/utils/rng';
import { pickWeather, WEATHER_INFO, type Weather } from './battle-weather';
import type { PokemonType } from '../../core/utils/type-chart';

type Phase = 'setup' | 'loading' | 'fighting' | 'done';

interface StageChip {
  readonly label: string;
  readonly value: number;
}
interface FloatNum {
  readonly id: number;
  readonly side: SideIndex;
  readonly text: string;
  readonly cls: string;
}

/** Engine weather → cosmetic overlay weather. */
const OVERLAY_WEATHER: Record<EngineWeather, Weather> = {
  none: 'clear',
  sun: 'sun',
  rain: 'rain',
  sand: 'sand',
  hail: 'snow',
  snow: 'snow',
};

const STAGE_SHORT: Record<BoostableStat, string> = {
  attack: 'Atk',
  defense: 'Def',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'Spe',
  accuracy: 'Acc',
  evasion: 'Eva',
};

@Component({
  selector: 'pv-battle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TypeBadgeComponent,
    SpinnerComponent,
    PageHeaderComponent,
    WeatherOverlayComponent,
    StatusBadgeComponent,
    FieldBannerComponent,
    MoveButtonComponent,
    IconComponent,
    BattleFxComponent,
  ],
  templateUrl: './battle.html',
  styleUrl: './battle.scss',
})
export class BattleComponent {
  private readonly svc = inject(BattleService);
  private readonly pokedex = inject(PokedexService);
  protected readonly titleCase = titleCase;
  protected readonly abilityName = abilityName;
  protected readonly itemName = itemName;

  protected readonly phase = signal<Phase>('setup');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly playerInput = signal('');
  protected readonly names = this.pokedex.names;

  protected readonly player = signal<Battler | null>(null);
  protected readonly opponent = signal<Battler | null>(null);

  protected readonly playerHp = signal(0);
  protected readonly playerMaxHp = signal(1);
  protected readonly oppHp = signal(0);
  protected readonly oppMaxHp = signal(1);

  protected readonly playerStatus = signal<StatusCondition>('none');
  protected readonly oppStatus = signal<StatusCondition>('none');
  protected readonly playerStages = signal<Stages>(freshStages());
  protected readonly oppStages = signal<Stages>(freshStages());

  protected readonly engineWeather = signal<EngineWeather>('none');
  protected readonly engineTerrain = signal<Terrain>('none');
  protected readonly weatherTurns = signal(0);
  protected readonly terrainTurns = signal(0);

  protected readonly log = signal<string[]>([]);
  protected readonly shakeSide = signal<SideIndex | null>(null);
  protected readonly flashSide = signal<SideIndex | null>(null);
  protected readonly critSide = signal<SideIndex | null>(null);
  protected readonly winner = signal<SideIndex | null>(null);
  /** Send-out slide-in (per side) and the sprite currently fainting. */
  protected readonly enterMine = signal(false);
  protected readonly enterFoe = signal(false);
  protected readonly faintSide = signal<SideIndex | null>(null);
  /** Floating damage / heal numbers over a fighter. */
  protected readonly floats = signal<FloatNum[]>([]);
  private floatId = 0;

  /** Cosmetic backdrop: engine weather if set, else a type-evoked ambiance. */
  protected readonly weather = computed<Weather>(() => {
    const w = this.engineWeather();
    if (w !== 'none') return OVERLAY_WEATHER[w];
    return this.ambientWeather();
  });
  protected readonly weatherInfo = computed(() => WEATHER_INFO[this.weather()]);
  private readonly ambientWeather = signal<Weather>('clear');

  protected readonly playerHpPct = computed(() => (this.playerHp() / this.playerMaxHp()) * 100);
  protected readonly oppHpPct = computed(() => (this.oppHp() / this.oppMaxHp()) * 100);
  protected readonly playerMoves = computed(() => this.player()?.moves ?? []);
  protected readonly outcomeWon = computed(() => this.winner() === 0);

  protected readonly playerStageChips = computed(() => chips(this.playerStages()));
  protected readonly oppStageChips = computed(() => chips(this.oppStages()));
  protected readonly playerAbility = computed(() => abilityName(this.player()?.ability));
  protected readonly oppAbility = computed(() => abilityName(this.opponent()?.ability));

  private readonly fx = viewChild(BattleFxComponent);
  private battle: Battle | null = null;
  private pendingMove: { side: SideIndex; type: PokemonType } | null = null;

  constructor() {
    void this.pokedex.ensureLoaded();
  }

  protected setPlayerInput(event: Event): void {
    this.playerInput.set((event.target as HTMLInputElement).value);
  }

  protected async start(): Promise<void> {
    const wanted = this.playerInput().trim().toLowerCase();
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

  private beginBattle(player: Battler, opponent: Battler): void {
    this.battle = new Battle(player, opponent, Date.now(), undefined, 'strong');
    this.player.set(player);
    this.opponent.set(opponent);
    this.playerMaxHp.set(this.battle.player.maxHp);
    this.oppMaxHp.set(this.battle.opponent.maxHp);
    this.playerHp.set(this.battle.player.maxHp);
    this.oppHp.set(this.battle.opponent.maxHp);
    this.playerStatus.set('none');
    this.oppStatus.set('none');
    this.playerStages.set(freshStages());
    this.oppStages.set(freshStages());
    this.engineWeather.set('none');
    this.engineTerrain.set('none');
    this.winner.set(null);

    const rng = new SeededRng(`${player.id}-${opponent.id}`);
    this.ambientWeather.set(pickWeather(player.types, opponent.types, (items) => rng.pick(items)));
    const info = WEATHER_INFO[this.weather()];
    this.log.set([
      `A wild ${titleCase(opponent.name)} appeared!`,
      `Go, ${titleCase(player.name)}!`,
      ...(this.weather() === 'clear' ? [] : [`${info.label}!`]),
    ]);
    this.faintSide.set(null);
    this.floats.set([]);
    this.pulseEnter(0);
    this.pulseEnter(1);
    this.phase.set('fighting');
  }

  protected async useMove(index: number): Promise<void> {
    if (!this.battle || this.busy() || this.phase() !== 'fighting') return;
    this.busy.set(true);
    const events = this.battle.takeTurn(index);
    await this.playEvents(events);
    this.syncState();
    this.busy.set(false);
    if (this.battle.state.finished) {
      this.winner.set(this.battle.state.winner);
      this.phase.set('done');
    }
  }

  protected rematch(): void {
    const player = this.player();
    const opponent = this.opponent();
    if (player && opponent) this.beginBattle(player, opponent);
  }

  protected newBattle(): void {
    this.battle = null;
    this.player.set(null);
    this.opponent.set(null);
    this.log.set([]);
    this.winner.set(null);
    this.phase.set('setup');
  }

  /* --------------------------------------------------- event presentation */

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.kind) {
        case 'move':
          this.append(`${titleCase(ev.attacker)} used ${titleCase(ev.move)}!`);
          this.pendingMove = { side: ev.side, type: this.moveType(ev.side, ev.move) };
          this.fx()?.cast(ev.side, this.pendingMove.type);
          await sleep(560);
          break;
        case 'miss':
          this.append(`${titleCase(ev.attacker)}'s attack missed!`);
          this.pendingMove = null;
          await sleep(450);
          break;
        case 'damage': {
          this.flashSide.set(ev.side);
          this.shakeSide.set(ev.side);
          if (this.pendingMove) this.fx()?.impact(ev.side, this.pendingMove.type, ev.crit);
          const before = ev.side === 0 ? this.playerHp() : this.oppHp();
          const dealt = Math.max(0, before - ev.remainingHp);
          if (dealt > 0) this.spawnFloat(ev.side, `-${dealt}`, this.dmgClass(ev.crit, ev.effectiveness));
          this.setHp(ev.side, ev.remainingHp);
          if (ev.crit) {
            this.critSide.set(ev.side);
            this.append('A critical hit!');
          }
          const note = effectivenessNote(ev.effectiveness);
          if (note) this.append(note);
          await sleep(520);
          this.shakeSide.set(null);
          this.flashSide.set(null);
          this.critSide.set(null);
          break;
        }
        case 'heal': {
          const before = ev.side === 0 ? this.playerHp() : this.oppHp();
          const gained = Math.max(0, ev.remainingHp - before);
          if (gained > 0) this.spawnFloat(ev.side, `+${gained}`, 'heal');
          this.setHp(ev.side, ev.remainingHp);
          if (ev.text) this.append(ev.text);
          await sleep(380);
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
          await sleep(360);
          break;
        case 'stage-change':
          if (ev.text) this.append(ev.text);
          await sleep(320);
          break;
        case 'faint':
          this.append(`${titleCase(ev.name)} fainted!`);
          this.faintSide.set(ev.side);
          await sleep(700);
          break;
        case 'end':
          this.append(ev.winner === 0 ? 'You won the battle!' : 'You were defeated…');
          await sleep(280);
          break;
        default:
          break;
      }
    }
  }

  /** Pull authoritative status/stages/field state from the engine after a turn. */
  private syncState(): void {
    if (!this.battle) return;
    const p = this.battle.player;
    const o = this.battle.opponent;
    this.playerHp.set(p.currentHp);
    this.oppHp.set(o.currentHp);
    this.playerStatus.set(p.status);
    this.oppStatus.set(o.status);
    this.playerStages.set({ ...p.stages });
    this.oppStages.set({ ...o.stages });
    const f = this.battle.state.field;
    this.engineWeather.set(f.weather);
    this.engineTerrain.set(f.terrain);
    this.weatherTurns.set(f.weatherTurns);
    this.terrainTurns.set(f.terrainTurns);
  }

  private setHp(side: SideIndex, hp: number): void {
    if (side === 0) this.playerHp.set(hp);
    else this.oppHp.set(hp);
  }

  private append(line: string): void {
    this.log.update((l) => [...l, line]);
  }

  /** Retrigger a side's send-out slide-in animation. */
  private pulseEnter(side: SideIndex): void {
    const sig = side === 0 ? this.enterMine : this.enterFoe;
    sig.set(false);
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
    const battler = side === 0 ? this.player() : this.opponent();
    const move = battler?.moves.find((m) => m.name === name);
    return move?.type ?? 'normal';
  }
}

function chips(stages: Stages): StageChip[] {
  return BOOSTABLE_STATS.filter((s) => stages[s] !== 0).map((s) => ({
    label: STAGE_SHORT[s],
    value: stages[s],
  }));
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
