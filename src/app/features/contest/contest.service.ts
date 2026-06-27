import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import { titleCase } from '../../core/ui/format';
import { SaveService } from '../../core/storage/save.service';
import {
  FLAVORS,
  MAX_MIX,
  mixConditions,
  nextRank,
  rankInfo,
  type Berry,
  type ContestCategory,
  type ContestEntrant,
  type ContestRank,
  type Flavor,
} from '../../game/contest/contest';
import {
  APPEAL_MOVES,
  PERFORMANCE_ROUNDS,
  appeal as appealRound,
  performanceRanking,
  startPerformance,
  wouldCombo,
  type PerformanceState,
  type RoundOutcome,
} from '../../game/contest/performance';

type Status = 'loading' | 'ready' | 'error';
/** Where the player is in the contest flow. */
export type ContestPhase = 'prep' | 'stage' | 'result';

/** The Pokémon currently on stage. */
export interface Performer {
  readonly dex: number;
  readonly name: string;
  readonly sprite: string;
}

export interface ContestResult {
  readonly category: ContestCategory;
  readonly rank: ContestRank;
  readonly ranking: ContestEntrant[];
  readonly playerRank: number;
  readonly won: boolean;
  readonly promoted: boolean;
}

const DEFAULT_DEX = 133; // Eevee — a contest darling.

/**
 * Contest Hall state: a berry pantry (loaded from PokéAPI), the Poffin mix the
 * player assembles, the performer on stage, and the seeded contest outcome.
 */
@Injectable({ providedIn: 'root' })
export class ContestService {
  private readonly api = inject(PokeApiClient);
  private readonly save = inject(SaveService);

  readonly status = signal<Status>('loading');
  readonly error = signal<string | null>(null);
  readonly rank = signal<ContestRank>(this.save.read<ContestRank>('contest:rank', 'normal'));
  readonly rankLabel = computed(() => rankInfo(this.rank()).label);

  readonly pantry = signal<readonly Berry[]>([]);
  readonly mix = signal<readonly Berry[]>([]);
  readonly category = signal<ContestCategory>('cute');
  readonly performer = signal<Performer | null>(null);
  readonly result = signal<ContestResult | null>(null);
  readonly searchError = signal<string | null>(null);

  /* ----- interactive performance ----- */
  readonly phase = signal<ContestPhase>('prep');
  readonly performance = signal<PerformanceState | null>(null);
  readonly lastOutcome = signal<RoundOutcome | null>(null);
  readonly ribbons = signal<ReadonlySet<string>>(new Set(this.save.read<string[]>('contest:ribbons', [])));
  readonly appealMoves = APPEAL_MOVES;
  readonly totalRounds = PERFORMANCE_ROUNDS;

  private attempt = 0;
  private seed = '';

  readonly conditions = computed(() => mixConditions(this.mix()));
  readonly mixFull = computed(() => this.mix().length >= MAX_MIX);
  readonly canEnter = computed(() => this.mix().length > 0 && this.performer() !== null);
  /** Hearts the player has racked up so far this performance. */
  readonly playerHearts = computed(() => this.performance()?.playerTotal ?? 0);
  readonly topRivalHearts = computed(() => {
    const p = this.performance();
    return p ? Math.max(0, ...p.rivals.map((r) => r.total)) : 0;
  });

  /** Whether appealing in a category right now would land a combo. */
  comboHint(category: ContestCategory): boolean {
    return wouldCombo(this.performance()?.lastCategory ?? null, category);
  }

  hasRibbon(category: ContestCategory): boolean {
    return this.ribbons().has(category);
  }

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    try {
      const [pantry] = await Promise.all([this.loadPantry(), this.loadPerformer(DEFAULT_DEX)]);
      this.pantry.set(pantry);
      this.status.set('ready');
    } catch {
      this.error.set('The contest pantry could not be stocked right now. Please retry.');
      this.status.set('error');
    }
  }

  retry(): void {
    void this.init();
  }

  /** Toggle a berry in the Poffin mix (capped at {@link MAX_MIX}). */
  toggleBerry(berry: Berry): void {
    const current = this.mix();
    const has = current.some((b) => b.name === berry.name);
    if (has) {
      this.mix.set(current.filter((b) => b.name !== berry.name));
    } else if (current.length < MAX_MIX) {
      this.mix.set([...current, berry]);
    }
    this.toPrep();
  }

  inMix(berry: Berry): boolean {
    return this.mix().some((b) => b.name === berry.name);
  }

  clearMix(): void {
    this.mix.set([]);
    this.toPrep();
  }

  setCategory(category: ContestCategory): void {
    this.category.set(category);
    this.toPrep();
  }

  /** Swap the performer by name or dex number. */
  async choosePerformer(query: string): Promise<void> {
    const term = query.trim().toLowerCase();
    this.searchError.set(null);
    if (!term) return;
    try {
      await this.loadPerformer(term);
      this.toPrep();
    } catch {
      this.searchError.set(`No Pokémon called “${query.trim()}” could take the stage.`);
    }
  }

  /** Take the stage: start an interactive performance. */
  beginPerformance(): void {
    const performer = this.performer();
    if (!performer || !this.mix().length) return;
    this.attempt += 1;
    this.seed = `${performer.name}-${this.category()}-${this.rank()}-${this.mix().map((b) => b.name).join(',')}-${this.attempt}`;
    this.performance.set(startPerformance(this.rank(), this.seed));
    this.lastOutcome.set(null);
    this.result.set(null);
    this.phase.set('stage');
  }

  /** Play one appeal move; finalises the contest after the last round. */
  appeal(category: ContestCategory): void {
    const state = this.performance();
    if (!state || state.finished) return;
    const next = appealRound(state, category, this.conditions(), this.category(), this.rank(), this.seed);
    this.performance.set(next);
    this.lastOutcome.set(next.history[next.history.length - 1] ?? null);
    if (next.finished) this.finalise(next);
  }

  /** Return to the prep bench (keeps mix, performer and rank). */
  backToPrep(): void {
    this.toPrep();
  }

  private finalise(state: PerformanceState): void {
    const performer = this.performer();
    const rank = this.rank();
    const category = this.category();
    const outcome = performanceRanking(state, performer?.name ?? 'You');
    const promoted = outcome.won && nextRank(rank) !== null;
    this.result.set({ category, rank, promoted, ...outcome });
    this.phase.set('result');

    if (outcome.won) {
      // Award the category ribbon and (below Master) promote a rank.
      if (!this.ribbons().has(category)) {
        const next = new Set(this.ribbons());
        next.add(category);
        this.ribbons.set(next);
        this.save.write('contest:ribbons', [...next]);
      }
      const up = nextRank(rank);
      if (up) {
        this.rank.set(up);
        this.save.write('contest:rank', up);
      }
    }
  }

  private toPrep(): void {
    this.phase.set('prep');
    this.performance.set(null);
    this.lastOutcome.set(null);
    this.result.set(null);
  }

  private async loadPerformer(idOrName: number | string): Promise<void> {
    const dto = await this.api.pokemon(idOrName);
    const art = dto.sprites.other?.['official-artwork']?.front_default;
    this.performer.set({
      dex: dto.id,
      name: titleCase(dto.name),
      sprite: art ?? officialArtwork(dto.id),
    });
  }

  /**
   * Reconstruct every berry's full flavour profile from the five berry-flavour
   * endpoints — five requests instead of one per berry.
   */
  private async loadPantry(): Promise<Berry[]> {
    const flavorDtos = await Promise.all(FLAVORS.map((f) => this.api.berryFlavor(f)));
    const byName = new Map<string, Record<Flavor, number>>();

    flavorDtos.forEach((dto, i) => {
      const flavor = FLAVORS[i];
      for (const entry of dto.berries) {
        if (entry.potency <= 0) continue;
        const name = entry.berry.name;
        const flavors =
          byName.get(name) ?? { spicy: 0, dry: 0, sweet: 0, bitter: 0, sour: 0 };
        flavors[flavor] = entry.potency;
        byName.set(name, flavors);
      }
    });

    return [...byName.entries()]
      .map<Berry>(([name, flavors]) => ({ name: titleCase(name), flavors }))
      .sort((a, b) => this.totalPotency(b) - this.totalPotency(a) || a.name.localeCompare(b.name));
  }

  private totalPotency(berry: Berry): number {
    return FLAVORS.reduce((sum, f) => sum + berry.flavors[f], 0);
  }
}
