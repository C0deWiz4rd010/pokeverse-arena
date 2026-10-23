import { Injectable, computed, inject, signal } from '@angular/core';
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import type { Battler } from '../../game/engine';
import {
  League,
  anyPlayerRemaining,
  bracketMatchSetup,
  buildBracket,
  modeById,
  pickemMultiplier,
  pickemPayout,
  playerMatch,
  rankStandings,
  reportResult,
  runAiMatches,
  seedTrainers,
  teamPower,
  teamStrength,
  makeTrainer,
  type Bracket,
  type BracketFormat,
  type LeagueFinish,
  type ModeId,
  type PlayerMatchSetup,
  type Standing,
  type TournamentMode,
  type Trainer,
} from '../../game/tournament';
import { TournamentRecords } from './tournament-records.service';
import { TournamentRoster } from './tournament-roster.service';

type Status = 'idle' | 'loading' | 'draft' | 'ready' | 'done';

const FIELD = 16;
/** Smaller field for round-robin so the league isn't dozens of matches. */
const LEAGUE_FIELD = 8;

/**
 * The tournament run: owns the signals the screens bind to and sequences the pure game
 * logic (`game/tournament`), the roster building ({@link TournamentRoster}) and the
 * persistent records ({@link TournamentRecords}).
 */
@Injectable({ providedIn: 'root' })
export class TournamentService {
  private readonly roster = inject(TournamentRoster);
  private readonly records = inject(TournamentRecords);

  readonly status = signal<Status>('idle');
  readonly error = signal<string | null>(null);
  readonly mode = signal<TournamentMode | null>(null);
  readonly bracket = signal<Bracket | null>(null);
  readonly draftPool = signal<Battler[]>([]);
  /** Type chosen for a Mono-Type Cup (so the UI can show it). */
  readonly monoType = signal<PokemonType | null>(null);

  /** Active bracket format. */
  readonly format = signal<BracketFormat>('single-elim');
  /** League standings (round-robin / swiss only). */
  readonly standings = signal<Standing[] | null>(null);
  /** Persisted tournament history. */
  readonly history = this.records.history;
  /** The record just logged for the current finished run (placement + prize). */
  readonly lastRun = this.records.lastRun;
  /** Your persistent rival (identity + head-to-head record; survives resets). */
  readonly rival = this.records.rival;

  /** Everyone in the current field (for the crystal-ball pick strip). */
  readonly fieldList = signal<Trainer[]>([]);
  /** The run's champion call (null = no call made). */
  readonly pick = signal<{
    trainerId: string;
    name: string;
    avatar: string;
    mult: number;
    payout: number;
  } | null>(null);
  /** Picks lock the moment you fight your first match. */
  readonly pickLocked = signal(false);
  /** Outcome of the call once the run is done (null when no call was made). */
  readonly pickResult = computed(() => {
    const p = this.pick();
    const champ = this.champion();
    if (!p || !champ || this.status() !== 'done') return null;
    return { ...p, hit: champ.id === p.trainerId };
  });

  /** Survival HP carry: trainer id → remaining HP per team member. */
  private readonly carry = new Map<string, number[]>();
  private chosenType: PokemonType | null = null;

  /** League run (round-robin / swiss), its pending player match and winner. */
  private league: League | null = null;
  private readonly leagueMatch = signal<PlayerMatchSetup | null>(null);
  private readonly leagueWinner = signal<Trainer | null>(null);

  readonly champion = computed<Trainer | null>(() =>
    this.format() === 'single-elim' ? (this.bracket()?.champion ?? null) : this.leagueWinner(),
  );

  readonly rankedStandings = computed(() => {
    const s = this.standings();
    return s ? rankStandings(s) : [];
  });

  readonly playerEliminated = computed(() => {
    const b = this.bracket();
    if (!b || b.champion) return !!b?.champion && b.champion.id !== 'player';
    // Eliminated if the player no longer appears in any unplayed match and isn't champion.
    return !playerMatch(b) && !anyPlayerRemaining(b);
  });

  /** Everything the interactive player match needs (or null when none pending). */
  readonly currentMatchSetup = computed<PlayerMatchSetup | null>(() =>
    this.format() === 'single-elim'
      ? bracketMatchSetup(this.bracket(), this.mode(), this.carry)
      : this.leagueMatch(),
  );

  /* --------------------------------------------------------------- public */

  /** Start a tournament in the given mode + format (draft modes pause for picks). */
  async startMode(modeId: ModeId, format: BracketFormat = 'single-elim'): Promise<void> {
    const mode = modeById(modeId);
    this.reset();
    this.format.set(format);
    this.mode.set(mode);
    this.status.set('loading');
    try {
      if (mode.monotype) {
        this.chosenType = POKEMON_TYPES[Math.floor(Math.random() * POKEMON_TYPES.length)]!;
        this.monoType.set(this.chosenType);
      }
      // Draft picks only apply to the knockout bracket.
      if (mode.draft && format === 'single-elim') {
        this.draftPool.set(await this.roster.draftPool(mode, 9, this.chosenType));
        this.status.set('draft');
        return;
      }

      const field = format === 'round-robin' ? LEAGUE_FIELD : FIELD;
      const dtos = await this.roster.selectDtos(mode, field * mode.teamSize, this.chosenType);
      const teams = this.roster.distribute(dtos, field, mode.teamSize, mode.balanced);
      const trainers = this.records.injectRival(await this.roster.buildTrainers(teams, mode, 0));
      this.fieldList.set(trainers);

      if (format === 'single-elim') {
        this.bracket.set(buildBracket(this.seed(trainers)));
        this.status.set('ready');
        this.resolveCpuMatches();
      } else {
        this.startLeague(format, trainers, mode);
      }
    } catch {
      this.error.set('Could not load the tournament. Please try again.');
      this.status.set('idle');
    }
  }

  /** Finish a draft: the player's picks become their team, then the field fills. */
  async confirmDraft(picks: Battler[]): Promise<void> {
    const mode = this.mode();
    if (!mode) return;
    this.status.set('loading');
    try {
      const dtos = await this.roster.selectDtos(mode, (FIELD - 1) * mode.teamSize, this.chosenType);
      const cpuTeams = this.roster.distribute(dtos, FIELD - 1, mode.teamSize, mode.balanced);
      const cpu = this.records.injectRival(this.roster.buildCpuTrainers(cpuTeams, mode));
      const player = makeTrainer(0, true, picks);
      this.fieldList.set([player, ...cpu]);
      this.bracket.set(buildBracket([player, ...cpu]));
      this.status.set('ready');
      this.resolveCpuMatches();
    } catch {
      this.error.set('Could not start the tournament. Please try again.');
      this.status.set('idle');
    }
  }

  /**
   * Record the human's match outcome, carry HP for Survival, then auto-resolve
   * every remaining CPU match up to the player's next match (or the champion).
   */
  recordPlayerOutcome(playerWon: boolean, playerFinalHp?: number[]): void {
    if (this.format() !== 'single-elim') {
      this.recordLeagueOutcome(playerWon, playerFinalHp);
      return;
    }
    const b0 = this.bracket();
    const mode = this.mode();
    if (!b0 || !mode) return;
    const pm = playerMatch(b0);
    if (!pm) return;
    const playerIsA = !!pm.a?.isPlayer;
    const winnerSide: 0 | 1 = playerWon === playerIsA ? 0 : 1;
    const foe = (playerIsA ? pm.b : pm.a) as Trainer;
    if (foe?.isRival) this.records.recordRival(playerWon);

    if (mode.hpCarry && playerWon && playerFinalHp) {
      const player = (playerIsA ? pm.a : pm.b) as Trainer;
      this.carry.set(player.id, playerFinalHp);
    }

    this.bracket.set(reportResult(b0, pm.id, winnerSide));
    this.resolveCpuMatches();
  }

  /** Back to the mode-selection screen. */
  reset(): void {
    this.status.set('idle');
    this.error.set(null);
    this.mode.set(null);
    this.bracket.set(null);
    this.draftPool.set([]);
    this.monoType.set(null);
    this.carry.clear();
    this.chosenType = null;
    this.format.set('single-elim');
    this.standings.set(null);
    this.league = null;
    this.leagueMatch.set(null);
    this.leagueWinner.set(null);
    this.records.resetRun();
    this.fieldList.set([]);
    this.pick.set(null);
    this.pickLocked.set(false);
  }

  /* ------------------------------------------------------------- pick'em */

  /** Call the run's champion (allowed until your first match starts). */
  makePick(trainerId: string): void {
    if (this.pickLocked() || this.status() !== 'ready') return;
    const field = this.fieldList();
    const t = field.find((x) => x.id === trainerId);
    if (!t) return;
    const powers = field.map((x) => teamPower(x.team));
    const power = teamPower(t.team);
    this.pick.set({
      trainerId,
      name: t.isPlayer ? 'You' : t.name,
      avatar: t.avatar,
      mult: pickemMultiplier(power, powers),
      payout: pickemPayout(power, powers),
    });
  }

  /** Withdraw the call (only while it isn't locked). */
  clearPick(): void {
    if (!this.pickLocked()) this.pick.set(null);
  }

  /** Lock the call — your first battle is starting. */
  lockPick(): void {
    this.pickLocked.set(true);
  }

  /* -------------------------------------------------------------- internals */

  /** Power-seed a 16-strong field so the strongest teams are spread out. */
  private seed(trainers: Trainer[]): Trainer[] {
    const sorted = [...trainers].sort((a, b) => teamStrength(b) - teamStrength(a));
    return seedTrainers(sorted);
  }

  /** Auto-resolve CPU matches in the bracket and log the run once a champion stands. */
  private resolveCpuMatches(): void {
    const b = this.bracket();
    const mode = this.mode();
    if (!b || !mode) return;
    const next = runAiMatches(b, mode, this.carry);
    this.bracket.set(next);
    if (next.champion) {
      this.status.set('done');
      this.logRun(next.champion.isPlayer ? 1 : 0, FIELD, next.champion);
    }
  }

  private startLeague(format: BracketFormat, trainers: Trainer[], mode: TournamentMode): void {
    if (format === 'single-elim') return;
    this.league = new League(format, trainers, mode.teamSize, mode);
    this.status.set('ready');
    this.syncLeague(this.league.advance());
  }

  private recordLeagueOutcome(playerWon: boolean, playerFinalHp?: number[]): void {
    const result = this.league?.recordPlayerOutcome(playerWon, playerFinalHp);
    if (!result) return;
    if (result.foeIsRival) this.records.recordRival(playerWon);
    this.syncLeague(result.finish);
  }

  /** Mirror the league state machine into the signals; wrap up when it finished. */
  private syncLeague(finish: LeagueFinish | null): void {
    const lg = this.league;
    if (!lg) return;
    this.standings.set(lg.standings);
    this.leagueMatch.set(lg.match);
    if (!finish) return;
    this.leagueWinner.set(finish.champion);
    this.status.set('done');
    this.logRun(finish.placement, finish.field, finish.champion);
  }

  private logRun(placement: number, field: number, champion: Trainer | null): void {
    const p = this.pick();
    this.records.log({
      placement,
      field,
      champion,
      mode: this.mode(),
      format: this.format(),
      pick: p ? { trainerId: p.trainerId, payout: p.payout } : null,
    });
  }
}
