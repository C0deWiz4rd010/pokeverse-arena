import { Injectable, computed, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { SPRITE_BASE, idFromUrl } from '../../core/api/pokeapi-endpoints';
import { titleCase } from '../../core/ui/format';
import { SaveService } from '../../core/storage/save.service';
import { CryService } from '../../core/audio/cry.service';
import {
  REGIONS,
  regionDexCount,
  regionForDex,
  type Region,
} from '../../game/world/regions';
import {
  BALLS,
  attemptCatch,
  catchChance,
  regionCaught,
  regionCompletion,
  rollEncounter,
  type BallId,
  type WildEncounter,
} from '../../game/world/encounters';

/** A wild encounter enriched with its display name + sprite. */
export interface ActiveEncounter extends WildEncounter {
  readonly displayName: string;
  readonly sprite: string;
  readonly chancePct: number;
  readonly shiny: boolean;
  caught: boolean;
}

/** Odds that a wild encounter is shiny (1 in N). */
const SHINY_ODDS = 40;

/** Pixel front sprite, shiny palette. */
function shinySpriteFor(dex: number): string {
  return `${SPRITE_BASE}/pokemon/shiny/${dex}.png`;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

/** A single Pokémon that debuted in the selected region. */
export interface RegionMember {
  readonly dex: number;
  readonly name: string;
  readonly sprite: string;
}

/** The outcome of a "where does it live?" lookup. */
export interface Sighting {
  readonly dex: number;
  readonly name: string;
  readonly region: Region;
}

const SPECIES_MAX = 1025;

/** Pixel front sprite — light enough to render a whole region as a grid. */
function spriteFor(dex: number): string {
  return `${SPRITE_BASE}/pokemon/${dex}.png`;
}

/**
 * World Explorer state. Pick a region to roam the Pokémon that first appeared
 * there, or search a Pokémon by name/number to reveal the region it calls home.
 */
@Injectable({ providedIn: 'root' })
export class WorldService {
  private readonly api = inject(PokeApiClient);
  private readonly save = inject(SaveService);
  private readonly cry = inject(CryService);

  readonly regions = REGIONS;
  readonly balls = BALLS;

  readonly status = signal<Status>('idle');
  readonly error = signal<string | null>(null);
  readonly activeRegion = signal<Region | null>(null);
  readonly members = signal<readonly RegionMember[]>([]);

  /* ----- expedition: wild encounters + a personal dex ----- */
  readonly caught = signal<ReadonlySet<number>>(new Set(this.save.read<number[]>('world:caught', [])));
  /** Dex numbers caught in their shiny variant — a separate collector's goal. */
  readonly shinyCaught = signal<ReadonlySet<number>>(new Set(this.save.read<number[]>('world:shiny', [])));
  readonly shinyCount = computed(() => this.shinyCaught().size);
  readonly ball = signal<BallId>('poke');
  readonly encounter = signal<ActiveEncounter | null>(null);
  readonly expeditionToast = signal<string | null>(null);
  private roamStep = 0;

  readonly regionCaughtCount = computed(() => {
    const r = this.activeRegion();
    return r ? regionCaught(this.caught(), r) : 0;
  });
  readonly regionCompletion = computed(() => {
    const r = this.activeRegion();
    return r ? regionCompletion(this.caught(), r) : 0;
  });

  /** Ball-throw suspense flag (drives the wiggle animation). */
  readonly throwing = signal(false);

  /** Per-region registration progress for the overview grid. */
  readonly regionProgress = computed(() => {
    const caught = this.caught();
    return REGIONS.map((region) => ({
      region,
      caught: regionCaught(caught, region),
      total: regionDexCount(region),
      pct: regionCompletion(caught, region),
    }));
  });

  /** Total species registered across the whole world. */
  readonly worldCaught = computed(() => this.caught().size);
  readonly worldTotal = 1025;

  isCaught(dex: number): boolean {
    return this.caught().has(dex);
  }

  setBall(ball: BallId): void {
    this.ball.set(ball);
  }

  /** Find the next wild Pokémon in the active region. */
  roam(): void {
    const region = this.activeRegion();
    if (!region) return;
    this.roamStep += 1;
    const enc = rollEncounter(region, `${this.roamStep}-${Math.floor(Math.random() * 1e9)}`);
    const member = this.members().find((m) => m.dex === enc.dex);
    const shiny = Math.random() < 1 / SHINY_ODDS;
    this.encounter.set({
      ...enc,
      displayName: member?.name ?? `#${enc.dex}`,
      sprite: shiny ? shinySpriteFor(enc.dex) : member?.sprite ?? `${SPRITE_BASE}/pokemon/${enc.dex}.png`,
      chancePct: Math.round(catchChance(enc, this.ball()) * 100),
      shiny,
      caught: false,
    });
    this.expeditionToast.set(shiny ? `✨ A shiny ${member?.name ?? 'Pokémon'} appeared!` : null);
    this.cry.play(enc.dex, 0.35);
  }

  /** Throw the selected ball — a short wiggle of suspense, then the result. */
  throwBall(): void {
    const enc = this.encounter();
    if (!enc || enc.caught || this.throwing()) return;
    const success = attemptCatch(enc, this.ball(), Math.random());
    this.throwing.set(true);
    this.expeditionToast.set(null);
    setTimeout(() => {
      this.throwing.set(false);
      if (success) {
        const next = new Set(this.caught());
        next.add(enc.dex);
        this.caught.set(next);
        this.save.write('world:caught', [...next]);
        if (enc.shiny) {
          const shinies = new Set(this.shinyCaught());
          shinies.add(enc.dex);
          this.shinyCaught.set(shinies);
          this.save.write('world:shiny', [...shinies]);
        }
        this.encounter.set({ ...enc, caught: true });
        this.expeditionToast.set(
          enc.shiny
            ? `✨ Gotcha! A shiny ${enc.displayName} joined your dex!`
            : `Gotcha! ${enc.displayName} was registered to your dex.`,
        );
        this.cry.play(enc.dex, 0.4);
      } else {
        this.expeditionToast.set(`Oh no! ${enc.displayName} broke free!`);
      }
    }, 850);
  }

  fleeEncounter(): void {
    this.encounter.set(null);
    this.expeditionToast.set(null);
  }

  /** A located Pokémon to highlight after a search. */
  readonly sighting = signal<Sighting | null>(null);
  readonly searchError = signal<string | null>(null);

  readonly count = computed(() => this.members().length);

  /** Load and display the native Pokémon of a region. */
  async select(region: Region): Promise<void> {
    if (this.activeRegion()?.id === region.id && this.status() === 'ready') return;
    this.status.set('loading');
    this.error.set(null);
    this.activeRegion.set(region);
    this.members.set([]);
    try {
      const gen = await this.api.generation(region.generation);
      const members = gen.pokemon_species
        .map((s) => idFromUrl(s.url))
        .filter((dex) => Number.isFinite(dex) && dex >= 1 && dex <= SPECIES_MAX)
        .sort((a, b) => a - b)
        .map<RegionMember>((dex) => ({
          dex,
          name: this.speciesName(gen.pokemon_species, dex),
          sprite: spriteFor(dex),
        }));
      this.members.set(members);
      this.status.set('ready');
    } catch {
      this.error.set('Could not reach the region right now. Please try again.');
      this.status.set('error');
    }
  }

  /** Resolve a Pokémon name or dex number to its debut region. */
  async locate(query: string): Promise<void> {
    const term = query.trim().toLowerCase();
    this.searchError.set(null);
    this.sighting.set(null);
    if (!term) return;
    try {
      const dto = await this.api.pokemon(term);
      const region = regionForDex(dto.id);
      if (!region) {
        this.searchError.set(`${titleCase(dto.name)} roams beyond the charted regions.`);
        return;
      }
      this.sighting.set({ dex: dto.id, name: titleCase(dto.name), region });
      await this.select(region);
    } catch {
      this.searchError.set(`No Pokémon called “${query.trim()}” was found.`);
    }
  }

  /** Clear an active search highlight. */
  clearSearch(): void {
    this.sighting.set(null);
    this.searchError.set(null);
  }

  /** Return to the region picker. */
  back(): void {
    this.status.set('idle');
    this.activeRegion.set(null);
    this.members.set([]);
    this.encounter.set(null);
    this.expeditionToast.set(null);
    this.clearSearch();
  }

  private speciesName(
    species: { name: string; url: string }[],
    dex: number,
  ): string {
    const match = species.find((s) => idFromUrl(s.url) === dex);
    return titleCase(match?.name ?? `#${dex}`);
  }
}
