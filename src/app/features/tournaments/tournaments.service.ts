import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { quickStats, type StatKey } from '../../core/utils/stat-calculator';
import { isPokemonType, POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import { SeededRng } from '../../core/utils/rng';
import type { AiTier, Battler, BattleMove, BattleRules, Terrain, Weather } from '../../game/engine';
import {
  buildBracket,
  levelForRound,
  modeById,
  nextReadyMatch,
  playerMatch,
  reportResult,
  simulateMatch,
  seedTrainers,
  initStandings,
  applyMatch,
  rankStandings,
  roundRobinSchedule,
  swissPairings,
  swissRounds,
  pairKey,
  prizeFor,
  pushHistory,
  loadHistory,
  formatById,
  type Bracket,
  type BracketMatch,
  type BracketFormat,
  type Fixture,
  type ModeId,
  type RoundId,
  type Standing,
  type TournamentMode,
  type TournamentRecord,
  type Trainer,
} from '../../game/tournament';
import { BattleService } from '../battle/battle.service';

type Status = 'idle' | 'loading' | 'draft' | 'ready' | 'done';

/** Context the interactive 3-v-3 player match needs to run. */
export interface PlayerMatchSetup {
  readonly match: BracketMatch;
  readonly round: RoundId;
  readonly player: Trainer;
  readonly foe: Trainer;
  readonly playerTeam: Battler[];
  readonly foeTeam: Battler[];
  readonly rules?: BattleRules;
  readonly playerStartHp?: number[];
  readonly foeStartHp?: number[];
  /** AI difficulty the foe plays at (defaults to 'strong'). */
  readonly aiTier?: AiTier;
  /** A persistent battlefield condition imposed from the first turn (gym fields). */
  readonly field?: { readonly weather?: Weather; readonly terrain?: Terrain };
  /** Accent colour for a themed match frame (hex/css). */
  readonly accent?: string;
}

/** In-progress league (round-robin / swiss) run state. */
interface LeagueRun {
  readonly format: BracketFormat;
  readonly byId: Map<string, Trainer>;
  readonly teamSize: number;
  fixtures: Fixture[];
  cursor: number;
  played: Set<string>;
  swissRound: number;
  swissTotal: number;
  pending: { fixture: Fixture; playerIsA: boolean } | null;
}

const DEX_MAX = 1025;
const FIELD = 16;
/** Smaller field for round-robin so the league isn't dozens of matches. */
const LEAGUE_FIELD = 8;

const TITLES = [
  'Ace Trainer', 'Veteran', 'Gym Hopeful', 'Elite Hopeful', 'Ranger', 'Hex Maniac',
  'Black Belt', 'Cooltrainer', 'Dragon Tamer', 'Psychic', 'Bug Catcher', 'Champion-in-Training',
  'Ruin Maniac', 'Beauty', 'Guitarist',
];
const NAMES = [
  'Rowan', 'Sable', 'Iris', 'Cyrus', 'Lyra', 'Volk', 'Mira', 'Ezra', 'Nova', 'Kael',
  'Wren', 'Drake', 'Suki', 'Bram', 'Faye', 'Onyx', 'Vesper', 'Cleo', 'Roan', 'Thea',
];

/**
 * Deterministic trainer portrait via the DiceBear avatar library (HTTP API, no
 * bundled assets). The same seed always yields the same character, so a trainer
 * looks identical across the bracket, the match and the champion screen.
 */
function trainerAvatar(seed: string, accent = false): string {
  const params = new URLSearchParams({
    seed,
    radius: '50',
    backgroundType: 'gradientLinear',
    backgroundColor: accent
      ? 'ffd166,ffb703,fb8500'
      : 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c8f7c5',
  });
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

function idFromUrl(url: string): number | null {
  const m = url.match(/\/pokemon\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Lightweight, type-accurate move set for CPU Pokémon. Avoids fetching real move
 * data for ~45 Pokémon per tournament — STAB + effectiveness already make these
 * battles meaningful, and it keeps generation to a single request per Pokémon.
 */
function synthMoves(types: PokemonType[]): BattleMove[] {
  const moves: BattleMove[] = types.map((ty, i) => ({
    name: `${titleCase(ty)} ${i === 0 ? 'Blast' : 'Strike'}`,
    type: ty,
    power: 85,
    accuracy: 100,
    damageClass: i % 2 === 0 ? 'physical' : 'special',
  }));
  moves.push({ name: 'Tackle', type: 'normal', power: 50, accuracy: 100, damageClass: 'physical' });
  return moves;
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private readonly api = inject(PokeApiClient);
  private readonly battle = inject(BattleService);

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
  readonly history = signal<TournamentRecord[]>(loadHistory());

  /** Survival HP carry: trainer id → remaining HP per team member. */
  private readonly carry = new Map<string, number[]>();
  private chosenType: PokemonType | null = null;

  /** League run state (round-robin / swiss). */
  private league: LeagueRun | null = null;
  private leagueMatch = signal<PlayerMatchSetup | null>(null);
  private leagueWinner = signal<Trainer | null>(null);
  private historyLogged = false;

  readonly champion = computed<Trainer | null>(() =>
    this.format() === 'single-elim' ? this.bracket()?.champion ?? null : this.leagueWinner(),
  );

  readonly rankedStandings = computed(() => {
    const s = this.standings();
    return s ? rankStandings(s) : [];
  });

  readonly playerEliminated = computed(() => {
    const b = this.bracket();
    if (!b || b.champion) return !!b?.champion && b.champion.id !== 'player';
    // Eliminated if the player no longer appears in any unplayed match and isn't champion.
    return !playerMatch(b) && !this.anyPlayerRemaining(b);
  });

  /** Everything the interactive player match needs (or null when none pending). */
  readonly currentMatchSetup = computed<PlayerMatchSetup | null>(() =>
    this.format() === 'single-elim' ? this.bracketMatchSetup() : this.leagueMatch(),
  );

  private readonly bracketMatchSetup = computed<PlayerMatchSetup | null>(() => {
    const b = this.bracket();
    const mode = this.mode();
    if (!b || !mode) return null;
    const pm = playerMatch(b);
    if (!pm) return null;
    const playerIsA = !!pm.a?.isPlayer;
    const player = (playerIsA ? pm.a : pm.b) as Trainer;
    const foe = (playerIsA ? pm.b : pm.a) as Trainer;
    return {
      match: pm,
      round: pm.round,
      player,
      foe,
      playerTeam: player.team,
      foeTeam: this.teamForRound(foe, pm.round),
      rules: this.rulesForMatch(pm),
      playerStartHp: mode.hpCarry ? this.carry.get(player.id) : undefined,
      foeStartHp: mode.hpCarry ? this.carry.get(foe.id) : undefined,
    };
  });

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
        this.chosenType = POKEMON_TYPES[Math.floor(Math.random() * POKEMON_TYPES.length)];
        this.monoType.set(this.chosenType);
      }
      // Draft picks only apply to the knockout bracket.
      if (mode.draft && format === 'single-elim') {
        const dtos = await this.selectDtos(mode, 9);
        const pool = await Promise.all(dtos.map((d) => this.battle.buildBattlerFromDto(d, mode.baseLevel)));
        this.draftPool.set(pool);
        this.status.set('draft');
        return;
      }

      const field = format === 'round-robin' ? LEAGUE_FIELD : FIELD;
      const dtos = await this.selectDtos(mode, field * mode.teamSize);
      const teams = this.distribute(dtos, field, mode.teamSize, mode.balanced);
      const trainers = await this.buildTrainers(teams, mode, 0);

      if (format === 'single-elim') {
        this.bracket.set(buildBracket(this.seed(trainers)));
        this.status.set('ready');
        this.runAiMatches();
      } else {
        this.setupLeague(format, trainers, mode.teamSize);
      }
    } catch {
      this.error.set('Could not load the tournament. Please try again.');
      this.status.set('idle');
    }
  }

  /** Power-seed a 16-strong field so the strongest teams are spread out. */
  private seed(trainers: Trainer[]): Trainer[] {
    const sorted = [...trainers].sort((a, b) => this.teamStrength(b) - this.teamStrength(a));
    return seedTrainers(sorted);
  }

  private teamStrength(t: Trainer): number {
    return t.team.reduce((sum, m) => sum + Object.values(m.stats).reduce((a, b) => a + b, 0), 0);
  }

  /* ------------------------------------------------------ league formats */

  private setupLeague(format: BracketFormat, trainers: Trainer[], teamSize: number): void {
    const standings = initStandings(trainers);
    this.standings.set(standings);
    const ids = trainers.map((t) => t.id);
    const swissTotal = format === 'swiss' ? swissRounds(ids.length) : 0;
    const fixtures = format === 'round-robin'
      ? roundRobinSchedule(ids).flat()
      : swissPairings(standings, new Set());
    this.league = {
      format,
      byId: new Map(trainers.map((t) => [t.id, t])),
      teamSize,
      fixtures,
      cursor: 0,
      played: new Set(),
      swissRound: 1,
      swissTotal,
      pending: null,
    };
    this.status.set('ready');
    this.advanceLeague();
  }

  /** Resolve CPU fixtures until the player's next match, or finish the league. */
  private advanceLeague(): void {
    const lg = this.league;
    if (!lg) return;
    let guard = 0;
    while (lg.cursor < lg.fixtures.length && guard++ < 256) {
      const fx = lg.fixtures[lg.cursor];
      const a = lg.byId.get(fx.aId)!;
      const b = lg.byId.get(fx.bId)!;
      if (a.isPlayer || b.isPlayer) {
        this.exposeLeagueMatch(fx, a, b);
        return;
      }
      const res = simulateMatch(a.team, b.team, `lg-${lg.format}-${fx.aId}-${fx.bId}`, { rules: this.leagueRules(fx) });
      this.recordFixture(fx, res.winner, res.survivorsA, res.survivorsB);
      lg.cursor++;
    }
    // Round exhausted: Swiss may have more rounds.
    if (lg.format === 'swiss' && lg.swissRound < lg.swissTotal) {
      lg.swissRound++;
      lg.fixtures = swissPairings(this.standings()!, lg.played);
      lg.cursor = 0;
      this.advanceLeague();
      return;
    }
    this.finishLeague();
  }

  private exposeLeagueMatch(fx: Fixture, a: Trainer, b: Trainer): void {
    const playerIsA = !!a.isPlayer;
    const player = playerIsA ? a : b;
    const foe = playerIsA ? b : a;
    this.league!.pending = { fixture: fx, playerIsA };
    this.leagueMatch.set({
      match: { id: `lg-${fx.aId}-${fx.bId}`, round: 'final', slot: 0, a: player, b: foe, winner: null, played: false },
      round: 'final',
      player,
      foe,
      playerTeam: player.team,
      foeTeam: foe.team,
      aiTier: 'strong',
    });
  }

  private recordFixture(fx: Fixture, winner: 0 | 1, survivorsA: number, survivorsB: number): void {
    const lg = this.league!;
    this.standings.update((s) => applyMatch(s!, fx.aId, fx.bId, { winner, survivorsA, survivorsB }, lg.teamSize));
    lg.played.add(pairKey(fx.aId, fx.bId));
  }

  private finishLeague(): void {
    const lg = this.league;
    if (!lg) return;
    const ranked = rankStandings(this.standings()!);
    const championId = ranked[0]?.trainerId;
    const champ = championId ? lg.byId.get(championId) ?? null : null;
    this.leagueWinner.set(champ);
    this.leagueMatch.set(null);
    this.status.set('done');
    const placement = ranked.findIndex((s) => s.isPlayer) + 1;
    this.logHistory(placement, ranked.length, champ);
  }

  private leagueRules(fx: Fixture): BattleRules | undefined {
    const mode = this.mode();
    if (!mode) return undefined;
    if (mode.inverse) return { inverse: true };
    if (mode.weather) {
      const rng = new SeededRng(`weather-${fx.aId}-${fx.bId}`);
      return { weatherBoostType: rng.pick([...POKEMON_TYPES]) };
    }
    return undefined;
  }

  /** Finish a draft: the player's picks become their team, then the field fills. */
  async confirmDraft(picks: Battler[]): Promise<void> {
    const mode = this.mode();
    if (!mode) return;
    this.status.set('loading');
    try {
      const dtos = await this.selectDtos(mode, (FIELD - 1) * mode.teamSize);
      const cpuTeams = this.distribute(dtos, FIELD - 1, mode.teamSize, mode.balanced);
      const cpu = cpuTeams.map((team, i) =>
        this.makeTrainer(i + 1, false, team.map((d) => this.buildLight(d, mode.baseLevel))),
      );
      const player = this.makeTrainer(0, true, picks);
      this.bracket.set(buildBracket([player, ...cpu]));
      this.status.set('ready');
      this.runAiMatches();
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

    if (mode.hpCarry && playerWon && playerFinalHp) {
      const player = (playerIsA ? pm.a : pm.b) as Trainer;
      this.carry.set(player.id, playerFinalHp);
    }

    this.bracket.set(reportResult(b0, pm.id, winnerSide));
    this.runAiMatches();
  }

  /** Record the player's league-fixture result, then resolve onward. */
  private recordLeagueOutcome(playerWon: boolean, playerFinalHp?: number[]): void {
    const lg = this.league;
    if (!lg?.pending) return;
    const { fixture, playerIsA } = lg.pending;
    const playerSurv = (playerFinalHp ?? []).filter((h) => h > 0).length;
    const aSurv = playerIsA ? playerSurv : playerWon ? 0 : 1;
    const bSurv = playerIsA ? (playerWon ? 0 : 1) : playerSurv;
    const winner: 0 | 1 = playerIsA === playerWon ? 0 : 1;
    this.recordFixture(fixture, winner, aSurv, bSurv);
    lg.pending = null;
    lg.cursor++;
    this.leagueMatch.set(null);
    this.advanceLeague();
  }

  private logHistory(placement: number, field: number, champ: Trainer | null): void {
    if (this.historyLogged) return;
    this.historyLogged = true;
    const playerWon = !!champ?.isPlayer;
    const place = playerWon ? 1 : placement > 0 ? placement : Math.ceil(field / 2) + 1;
    const rec: TournamentRecord = {
      date: new Date().toISOString(),
      modeName: this.mode()?.name ?? 'Tournament',
      formatName: formatById(this.format()).name,
      field,
      placement: place,
      champion: champ?.name ?? '—',
      playerWon,
      prize: prizeFor(place, field),
    };
    this.history.set(pushHistory(rec));
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
    this.historyLogged = false;
  }

  /* -------------------------------------------------------- bracket runner */

  private runAiMatches(): void {
    let b = this.bracket();
    const mode = this.mode();
    if (!b || !mode) return;
    let m = nextReadyMatch(b);
    let guard = 0;
    while (m && !(m.a?.isPlayer || m.b?.isPlayer) && guard++ < 32) {
      const res = simulateMatch(
        this.teamForRound(m.a as Trainer, m.round),
        this.teamForRound(m.b as Trainer, m.round),
        `sim-${m.id}`,
        {
          rules: this.rulesForMatch(m),
          startHpA: mode.hpCarry ? this.carry.get((m.a as Trainer).id) : undefined,
          startHpB: mode.hpCarry ? this.carry.get((m.b as Trainer).id) : undefined,
        },
      );
      if (mode.hpCarry) {
        const winner = res.winner === 0 ? (m.a as Trainer) : (m.b as Trainer);
        this.carry.set(winner.id, res.winner === 0 ? res.hpA : res.hpB);
      }
      b = reportResult(b, m.id, res.winner);
      m = nextReadyMatch(b);
    }
    this.bracket.set(b);
    if (b.champion) {
      this.status.set('done');
      this.logHistory(b.champion.isPlayer ? 1 : 0, FIELD, b.champion);
    }
  }

  /** Opponent teams scale up each round in Boss Ascent; the player stays fixed. */
  private teamForRound(t: Trainer, round: RoundId): Battler[] {
    const mode = this.mode();
    if (!mode?.ascend || t.isPlayer) return t.team;
    const level = levelForRound(mode, round);
    const factor = level / mode.baseLevel;
    return t.team.map((b) => ({
      ...b,
      level,
      stats: this.scaleStats(b.stats, factor),
    }));
  }

  private scaleStats(stats: Record<StatKey, number>, factor: number): Record<StatKey, number> {
    const out = {} as Record<StatKey, number>;
    for (const key of Object.keys(stats) as StatKey[]) out[key] = Math.round(stats[key] * factor);
    return out;
  }

  private rulesForMatch(match: BracketMatch): BattleRules | undefined {
    const mode = this.mode();
    if (!mode) return undefined;
    if (mode.inverse) return { inverse: true };
    if (mode.weather) {
      const rng = new SeededRng(`weather-${match.id}`);
      return { weatherBoostType: rng.pick([...POKEMON_TYPES]) };
    }
    return undefined;
  }

  private anyPlayerRemaining(b: Bracket): boolean {
    return Object.values(b.rounds)
      .flat()
      .some((m) => (m.a?.isPlayer || m.b?.isPlayer) && !m.played);
  }

  /* --------------------------------------------------------- team building */

  private async buildTrainers(
    teams: PokemonDto[][],
    mode: TournamentMode,
    playerIndex: number,
  ): Promise<Trainer[]> {
    const out: Trainer[] = [];
    for (let i = 0; i < teams.length; i++) {
      const isPlayer = i === playerIndex;
      const team = isPlayer
        ? await Promise.all(teams[i].map((d) => this.battle.buildBattlerFromDto(d, mode.baseLevel)))
        : teams[i].map((d) => this.buildLight(d, mode.baseLevel));
      out.push(this.makeTrainer(i, isPlayer, team));
    }
    return out;
  }

  private buildLight(dto: PokemonDto, level: number): Battler {
    const types = dto.types
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isPokemonType);
    const t = types.length ? types : (['normal'] as PokemonType[]);
    return {
      id: dto.id,
      name: dto.name,
      level,
      types: t,
      stats: quickStats(this.baseStats(dto), level),
      moves: synthMoves(t),
      sprite: this.battle.battleSprite(dto, 'front'),
    };
  }

  private baseStats(dto: PokemonDto): Record<StatKey, number> {
    const stats = {} as Record<StatKey, number>;
    for (const s of dto.stats) stats[s.stat.name as StatKey] = s.base_stat;
    return stats;
  }

  private makeTrainer(index: number, isPlayer: boolean, team: Battler[]): Trainer {
    if (isPlayer) {
      return {
        id: 'player',
        name: 'You',
        title: 'Challenger',
        avatar: trainerAvatar('Champion-Ace', true),
        team,
        isPlayer: true,
      };
    }
    const name = NAMES[(index * 7) % NAMES.length];
    return {
      id: `cpu-${index}`,
      name,
      title: TITLES[index % TITLES.length],
      avatar: trainerAvatar(`${name}-${index}`),
      team,
    };
  }

  /* ----------------------------------------------------- candidate selection */

  /** Fetch a pool of DTOs sized for the mode, honouring type/BST restrictions. */
  private async selectDtos(mode: TournamentMode, count: number): Promise<PokemonDto[]> {
    const over = Math.ceil(count * (mode.pool === 'all' ? 1.4 : 2.4));
    const ids = mode.monotype && this.chosenType
      ? await this.sampleTypeIds(this.chosenType, over)
      : this.randomIds(over);
    let dtos = await this.fetchDtos(ids);

    while (dtos.length < count) {
      dtos = dtos.concat(await this.fetchDtos(this.randomIds(count)));
    }
    if (mode.pool === 'little') dtos.sort((a, b) => this.battle.totalBaseStats(a) - this.battle.totalBaseStats(b));
    else if (mode.pool === 'legendary') dtos.sort((a, b) => this.battle.totalBaseStats(b) - this.battle.totalBaseStats(a));
    return dtos.slice(0, count);
  }

  private async sampleTypeIds(type: PokemonType, n: number): Promise<number[]> {
    const dto = await this.api.type(type);
    const pool = dto.pokemon
      .map((p) => idFromUrl(p.pokemon.url))
      .filter((id): id is number => id !== null && id <= DEX_MAX);
    if (!pool.length) return this.randomIds(n);
    return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]);
  }

  private randomIds(n: number): number[] {
    return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * DEX_MAX));
  }

  private async fetchDtos(ids: number[]): Promise<PokemonDto[]> {
    const res = await Promise.all(ids.map((id) => this.api.pokemon(id).catch(() => null)));
    return res.filter((d): d is PokemonDto => !!d);
  }

  /** Snake-distribute DTOs into teams; balanced mode sorts by BST first to even out totals. */
  private distribute(dtos: PokemonDto[], teams: number, size: number, balanced: boolean): PokemonDto[][] {
    const ordered = balanced
      ? [...dtos].sort((a, b) => this.battle.totalBaseStats(b) - this.battle.totalBaseStats(a))
      : this.shuffle(dtos);
    const out: PokemonDto[][] = Array.from({ length: teams }, () => []);
    let idx = 0;
    for (let r = 0; r < size; r++) {
      const order = r % 2 === 0 ? this.range(teams) : this.range(teams).reverse();
      for (const t of order) {
        if (idx < ordered.length) out[t].push(ordered[idx++]);
      }
    }
    return out;
  }

  private range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
