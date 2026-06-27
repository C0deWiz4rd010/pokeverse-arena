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
  runAppealContest,
  type AppealRound,
  type Berry,
  type ContestCategory,
  type ContestEntrant,
  type ContestRank,
  type Flavor,
} from '../../game/contest/contest';

type Status = 'loading' | 'ready' | 'error';

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
  readonly rounds: AppealRound[];
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

  private attempt = 0;

  readonly conditions = computed(() => mixConditions(this.mix()));
  readonly mixFull = computed(() => this.mix().length >= MAX_MIX);
  readonly canEnter = computed(() => this.mix().length > 0 && this.performer() !== null);

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
    this.result.set(null);
  }

  inMix(berry: Berry): boolean {
    return this.mix().some((b) => b.name === berry.name);
  }

  clearMix(): void {
    this.mix.set([]);
    this.result.set(null);
  }

  setCategory(category: ContestCategory): void {
    this.category.set(category);
    this.result.set(null);
  }

  /** Swap the performer by name or dex number. */
  async choosePerformer(query: string): Promise<void> {
    const term = query.trim().toLowerCase();
    this.searchError.set(null);
    if (!term) return;
    try {
      await this.loadPerformer(term);
      this.result.set(null);
    } catch {
      this.searchError.set(`No Pokémon called “${query.trim()}” could take the stage.`);
    }
  }

  /** Run the contest with the current performer, mix and category. */
  enter(): void {
    const performer = this.performer();
    if (!performer || !this.mix().length) return;
    this.attempt += 1;
    const category = this.category();
    const rank = this.rank();
    const seed = `${performer.name}-${category}-${rank}-${this.mix()
      .map((b) => b.name)
      .join(',')}-${this.attempt}`;
    const outcome = runAppealContest(
      performer.name,
      this.conditions(),
      category,
      this.mix().length,
      rank,
      seed,
    );
    this.result.set({ category, rank, ...outcome });
    if (outcome.promoted) {
      const up = nextRank(rank);
      if (up) {
        this.rank.set(up);
        this.save.write('contest:rank', up);
      }
    }
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
