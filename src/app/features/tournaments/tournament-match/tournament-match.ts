import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  Battle,
  abilityName,
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
} from '../../../game/engine';
import { TypeBadgeComponent } from '../../../core/ui/type-badge/type-badge';
import { WeatherOverlayComponent } from '../../../core/ui/weather-overlay/weather-overlay';
import { StatusBadgeComponent } from '../../../core/ui/status-badge/status-badge';
import { FieldBannerComponent } from '../../../core/ui/field-banner/field-banner';
import { MoveButtonComponent } from '../../../core/ui/move-button/move-button';
import { BattleFxComponent } from '../../battle/pixi/battle-fx';

interface StageChip {
  readonly label: string;
  readonly value: number;
}

const STAGE_SHORT: Record<BoostableStat, string> = {
  attack: 'Atk', defense: 'Def', 'special-attack': 'SpA', 'special-defense': 'SpD', speed: 'Spe', accuracy: 'Acc', evasion: 'Eva',
};

function stageChips(stages: Stages): StageChip[] {
  return BOOSTABLE_STATS.filter((s) => stages[s] !== 0).map((s) => ({ label: STAGE_SHORT[s], value: stages[s] }));
}
import { pickWeather, weatherForType, type Weather } from '../../../core/ui/weather-overlay/weather';
import { SeededRng } from '../../../core/utils/rng';
import { titleCase } from '../../../core/ui/format';
import type { PokemonType } from '../../../core/utils/type-chart';
import type { PlayerMatchSetup } from '../tournaments.service';

interface TrayMon {
  readonly mon: Battler;
  readonly hp: number;
  readonly maxHp: number;
  readonly active: boolean;
  readonly fainted: boolean;
}

export interface MatchOutcome {
  readonly playerWon: boolean;
  readonly playerFinalHp: number[];
}

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

  private readonly hpA = signal<number[]>([]);
  private readonly hpB = signal<number[]>([]);
  private readonly ia = signal(0);
  private readonly ib = signal(0);

  protected readonly playerActive = signal<Battler | null>(null);
  protected readonly foeActive = signal<Battler | null>(null);
  protected readonly pHp = signal(0);
  protected readonly pMax = signal(1);
  protected readonly fHp = signal(0);
  protected readonly fMax = signal(1);

  protected readonly log = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly shakeSide = signal<SideIndex | null>(null);
  protected readonly flashSide = signal<SideIndex | null>(null);
  protected readonly critSide = signal<SideIndex | null>(null);
  protected readonly done = signal(false);
  protected readonly playerWon = signal(false);

  protected readonly pStatus = signal<StatusCondition>('none');
  protected readonly fStatus = signal<StatusCondition>('none');
  protected readonly pStages = signal<Stages>(freshStages());
  protected readonly fStages = signal<Stages>(freshStages());
  protected readonly engWeather = signal<EngineWeather>('none');
  protected readonly engTerrain = signal<Terrain>('none');
  protected readonly wTurns = signal(0);
  protected readonly tTurns = signal(0);

  protected readonly pStageChips = computed(() => stageChips(this.pStages()));
  protected readonly fStageChips = computed(() => stageChips(this.fStages()));
  protected readonly playerAbility = computed(() => abilityName(this.playerActive()?.ability));
  protected readonly foeAbility = computed(() => abilityName(this.foeActive()?.ability));

  protected readonly pHpPct = computed(() => (this.pHp() / this.pMax()) * 100);
  protected readonly fHpPct = computed(() => (this.fHp() / this.fMax()) * 100);
  protected readonly playerMoves = computed(() => this.playerActive()?.moves ?? []);

  protected readonly playerTray = computed<TrayMon[]>(() => this.tray(this.setup().playerTeam, this.hpA(), this.ia()));
  protected readonly foeTray = computed<TrayMon[]>(() => this.tray(this.setup().foeTeam, this.hpB(), this.ib()));

  /** A short banner describing any special rule in force (inverse / weather). */
  protected readonly ruleBanner = computed(() => {
    const rules = this.setup().rules;
    if (rules?.inverse) return 'Inverse battle — the type chart is flipped!';
    if (rules?.weatherBoostType) return `${titleCase(rules.weatherBoostType)}-type moves are boosted 1.5×!`;
    return null;
  });

  /** Atmospheric weather for this match. Driven by the boosted type in Weather
   *  mode, otherwise picked deterministically from the active fighters' types. */
  protected readonly weather = computed<Weather>(() => {
    const boost = this.setup().rules?.weatherBoostType;
    if (boost) {
      const w = weatherForType(boost);
      if (w !== 'clear') return w;
    }
    const me = this.playerActive();
    const foe = this.foeActive();
    if (!me || !foe) return 'clear';
    const rng = new SeededRng(`${this.setup().match.id}-wx`);
    return pickWeather(me.types, foe.types, (items) => rng.pick(items));
  });

  protected readonly rules = computed(() => this.setup().rules);
  protected readonly foeTypes = computed(() => this.foeActive()?.types);

  private battle: Battle | null = null;
  private duel = 0;
  private started = false;

  private readonly fx = viewChild(BattleFxComponent);
  private pendingMove: { side: SideIndex; type: PokemonType } | null = null;

  constructor() {
    effect(() => {
      const s = this.setup();
      if (this.started || !s) return;
      this.started = true;
      this.begin(s);
    });
  }

  protected async useMove(index: number): Promise<void> {
    if (!this.battle || this.busy() || this.done()) return;
    this.busy.set(true);
    const events = this.battle.takeTurn(index);
    await this.playEvents(events);
    this.persistActiveHp();
    this.syncState();

    if (this.battle.state.finished) {
      if (this.battle.state.winner === 0) this.advanceFoe();
      else this.advancePlayer();
      this.duel++;
      const s = this.setup();
      if (this.ia() >= s.playerTeam.length || this.ib() >= s.foeTeam.length) {
        this.endMatch();
      } else {
        await sleep(550);
        this.startDuel();
      }
    }
    this.busy.set(false);
  }

  protected continue(): void {
    this.finished.emit({ playerWon: this.playerWon(), playerFinalHp: this.hpA() });
  }

  /* ---------------------------------------------------------------- engine */

  private begin(s: PlayerMatchSetup): void {
    this.hpA.set(s.playerTeam.map((m, i) => clamp(s.playerStartHp?.[i] ?? m.stats.hp, m.stats.hp)));
    this.hpB.set(s.foeTeam.map((m, i) => clamp(s.foeStartHp?.[i] ?? m.stats.hp, m.stats.hp)));
    this.ia.set(skipFainted(this.hpA(), 0));
    this.ib.set(skipFainted(this.hpB(), 0));
    this.log.set([`${s.foe.name} wants to battle!`]);
    this.startDuel();
  }

  private startDuel(): void {
    const s = this.setup();
    const a = s.playerTeam[this.ia()];
    const b = s.foeTeam[this.ib()];
    this.battle = new Battle(a, b, `${s.match.id}-d${this.duel}`, s.rules, s.aiTier ?? 'strong');
    this.battle.state.sides[0].currentHp = clamp(this.hpA()[this.ia()], this.battle.state.sides[0].maxHp);
    this.battle.state.sides[1].currentHp = clamp(this.hpB()[this.ib()], this.battle.state.sides[1].maxHp);

    this.playerActive.set(a);
    this.foeActive.set(b);
    this.pMax.set(this.battle.state.sides[0].maxHp);
    this.fMax.set(this.battle.state.sides[1].maxHp);
    this.pHp.set(this.battle.player.currentHp);
    this.fHp.set(this.battle.opponent.currentHp);
    this.append(`Go, ${titleCase(a.name)}!`);
    this.append(`${s.foe.name} sent out ${titleCase(b.name)}!`);
    this.syncState();
  }

  /** Pull authoritative status/stages/field state from the engine. */
  private syncState(): void {
    if (!this.battle) return;
    this.pStatus.set(this.battle.player.status);
    this.fStatus.set(this.battle.opponent.status);
    this.pStages.set({ ...this.battle.player.stages });
    this.fStages.set({ ...this.battle.opponent.stages });
    const f = this.battle.state.field;
    this.engWeather.set(f.weather);
    this.engTerrain.set(f.terrain);
    this.wTurns.set(f.weatherTurns);
    this.tTurns.set(f.terrainTurns);
  }

  private persistActiveHp(): void {
    if (!this.battle) return;
    this.hpA.update((hp) => withAt(hp, this.ia(), this.battle!.player.currentHp));
    this.hpB.update((hp) => withAt(hp, this.ib(), this.battle!.opponent.currentHp));
  }

  private advancePlayer(): void {
    this.ia.set(skipFainted(this.hpA(), this.ia() + 1));
  }

  private advanceFoe(): void {
    this.ib.set(skipFainted(this.hpB(), this.ib() + 1));
  }

  private endMatch(): void {
    const won = this.ib() >= this.setup().foeTeam.length;
    this.playerWon.set(won);
    this.done.set(true);
    this.append(won ? 'Match won!' : 'You were knocked out…');
  }

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const ev of events) {
      switch (ev.kind) {
        case 'move':
          this.append(`${titleCase(ev.attacker)} used ${titleCase(ev.move)}!`);
          this.pendingMove = { side: ev.side, type: this.moveType(ev.side, ev.move) };
          this.fx()?.cast(ev.side, this.pendingMove.type);
          await sleep(520);
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
        case 'heal':
          if (ev.side === 0) this.pHp.set(ev.remainingHp);
          else this.fHp.set(ev.remainingHp);
          if (ev.text) this.append(ev.text);
          await sleep(340);
          break;
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
          await sleep(320);
          break;
        case 'stage-change':
          if (ev.text) this.append(ev.text);
          await sleep(280);
          break;
        case 'faint':
          this.append(`${titleCase(ev.name)} fainted!`);
          await sleep(650);
          break;
        default:
          break;
      }
    }
  }

  private tray(team: Battler[], hp: number[], active: number): TrayMon[] {
    return team.map((mon, i) => {
      const current = hp[i] ?? mon.stats.hp;
      return { mon, hp: current, maxHp: mon.stats.hp, active: i === active, fainted: current <= 0 };
    });
  }

  private append(line: string): void {
    this.log.update((l) => [...l, line]);
  }

  /** Resolve a move's type by name from the active fighter on the given side. */
  private moveType(side: SideIndex, name: string): PokemonType {
    const battler = side === 0 ? this.playerActive() : this.foeActive();
    const move = battler?.moves.find((m) => m.name === name);
    return move?.type ?? 'normal';
  }
}

function withAt(arr: number[], i: number, value: number): number[] {
  const copy = [...arr];
  copy[i] = value;
  return copy;
}

function clamp(hp: number, maxHp: number): number {
  if (!Number.isFinite(hp)) return maxHp;
  return Math.max(0, Math.min(hp, maxHp));
}

function skipFainted(hp: number[], from: number): number {
  let i = from;
  while (i < hp.length && hp[i] <= 0) i++;
  return i;
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
