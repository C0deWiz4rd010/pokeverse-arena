import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { CacheService } from '../../core/cache/cache.service';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { isPokemonType, type PokemonType, analyzeTeamTypes } from '../../core/utils/type-chart';
import { quickStats, type StatKey } from '../../core/utils/stat-calculator';
import { natureByName } from '../../core/utils/natures';

export const MAX_TEAM = 6;
export const MAX_MOVES = 4;
const SAVE_KEY = 'team-builder:roster';

/** A configured roster slot. */
export interface TeamMember {
  uid: string;
  id: number;
  name: string;
  nickname: string;
  types: PokemonType[];
  baseStats: Record<StatKey, number>;
  abilities: string[];
  ability: string;
  movePool: string[];
  moves: string[];
  level: number;
  natureName: string;
  artwork: string;
}

/** Minimal serialisable shape for export / persistence. */
interface StoredMember {
  id: number;
  nickname: string;
  ability: string;
  moves: string[];
  level: number;
  natureName: string;
}

let uidCounter = 0;
const nextUid = () => `m${Date.now().toString(36)}-${uidCounter++}`;

@Injectable({ providedIn: 'root' })
export class TeamBuilderService {
  private readonly api = inject(PokeApiClient);
  private readonly cache = inject(CacheService);

  readonly team = signal<TeamMember[]>([]);
  readonly adding = signal(false);
  readonly error = signal<string | null>(null);
  private restored = false;

  readonly full = computed(() => this.team().length >= MAX_TEAM);

  /** Defensive matchup summary across the whole roster. */
  readonly analysis = computed(() =>
    analyzeTeamTypes(this.team().map((m) => ({ name: m.name, types: m.types }))),
  );

  /** Live computed stats per member at its chosen level + nature. */
  readonly memberStats = computed(() =>
    new Map(
      this.team().map((m) => [
        m.uid,
        quickStats(m.baseStats, m.level, natureByName(m.natureName)),
      ]),
    ),
  );

  constructor() {
    void this.restore();
    // Persist whenever the roster changes (after the initial restore).
    effect(() => {
      const snapshot = this.team();
      if (!this.restored) return;
      void this.persist(snapshot);
    });
  }

  async add(nameOrId: string): Promise<void> {
    const key = nameOrId.trim().toLowerCase();
    if (!key || this.full()) return;
    this.adding.set(true);
    this.error.set(null);
    try {
      const dto = await this.api.pokemon(key);
      this.team.update((t) => [...t, this.toMember(dto)]);
    } catch {
      this.error.set(`Could not find "${nameOrId}". Try an exact name or dex number.`);
    } finally {
      this.adding.set(false);
    }
  }

  remove(uid: string): void {
    this.team.update((t) => t.filter((m) => m.uid !== uid));
  }

  clear(): void {
    this.team.set([]);
  }

  patch(uid: string, change: Partial<Pick<TeamMember, 'nickname' | 'ability' | 'level' | 'natureName'>>): void {
    this.team.update((t) =>
      t.map((m) => (m.uid === uid ? { ...m, ...this.sanitise(change) } : m)),
    );
  }

  toggleMove(uid: string, move: string): void {
    this.team.update((t) =>
      t.map((m) => {
        if (m.uid !== uid) return m;
        if (m.moves.includes(move)) {
          return { ...m, moves: m.moves.filter((x) => x !== move) };
        }
        if (m.moves.length >= MAX_MOVES) return m;
        return { ...m, moves: [...m.moves, move] };
      }),
    );
  }

  /* --------------------------------------------------------- import/export */

  exportJson(): string {
    return JSON.stringify({ version: 1, team: this.team().map(toStored) }, null, 2);
  }

  async importJson(json: string): Promise<void> {
    let parsed: { team?: StoredMember[] };
    try {
      parsed = JSON.parse(json);
    } catch {
      this.error.set('That does not look like valid team JSON.');
      return;
    }
    const stored = Array.isArray(parsed.team) ? parsed.team.slice(0, MAX_TEAM) : [];
    if (!stored.length) {
      this.error.set('No team members found in that file.');
      return;
    }
    this.adding.set(true);
    this.error.set(null);
    try {
      const members = await Promise.all(stored.map((s) => this.hydrate(s)));
      this.team.set(members.filter((m): m is TeamMember => m !== null));
    } finally {
      this.adding.set(false);
    }
  }

  /* ------------------------------------------------------------- internals */

  private async restore(): Promise<void> {
    const stored = await this.cache.loadState<StoredMember[]>(SAVE_KEY);
    if (stored?.length) {
      const members = await Promise.all(stored.map((s) => this.hydrate(s)));
      this.team.set(members.filter((m): m is TeamMember => m !== null));
    }
    this.restored = true;
  }

  private async persist(team: TeamMember[]): Promise<void> {
    await this.cache.saveState(SAVE_KEY, team.map(toStored));
  }

  private async hydrate(stored: StoredMember): Promise<TeamMember | null> {
    try {
      const dto = await this.api.pokemon(stored.id);
      const member = this.toMember(dto);
      return {
        ...member,
        nickname: stored.nickname ?? '',
        level: this.clampLevel(stored.level),
        natureName: stored.natureName || member.natureName,
        ability: member.abilities.includes(stored.ability) ? stored.ability : member.ability,
        moves: (stored.moves ?? []).filter((m) => member.movePool.includes(m)).slice(0, MAX_MOVES),
      };
    } catch {
      return null;
    }
  }

  private toMember(dto: PokemonDto): TeamMember {
    const baseStats = {} as Record<StatKey, number>;
    for (const s of dto.stats) {
      baseStats[s.stat.name as StatKey] = s.base_stat;
    }
    const types = dto.types
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isPokemonType);
    const abilities = [...new Set(dto.abilities.map((a) => a.ability.name))];
    const movePool = [...new Set(dto.moves.map((m) => m.move.name))].sort();
    const levelUp = dto.moves
      .filter((m) =>
        m.version_group_details.some((d) => d.move_learn_method.name === 'level-up'),
      )
      .map((m) => m.move.name)
      .slice(0, MAX_MOVES);
    return {
      uid: nextUid(),
      id: dto.id,
      name: dto.name,
      nickname: '',
      types,
      baseStats,
      abilities,
      ability: abilities[0] ?? '',
      movePool,
      moves: levelUp,
      level: 50,
      natureName: 'Hardy',
      artwork:
        dto.sprites.other?.['official-artwork']?.front_default ?? officialArtwork(dto.id),
    };
  }

  private sanitise(
    change: Partial<Pick<TeamMember, 'nickname' | 'ability' | 'level' | 'natureName'>>,
  ): Partial<TeamMember> {
    const out: Partial<TeamMember> = { ...change };
    if (change.level !== undefined) out.level = this.clampLevel(change.level);
    return out;
  }

  private clampLevel(level: number): number {
    if (!Number.isFinite(level)) return 50;
    return Math.min(100, Math.max(1, Math.round(level)));
  }
}

function toStored(m: TeamMember): StoredMember {
  return {
    id: m.id,
    nickname: m.nickname,
    ability: m.ability,
    moves: m.moves,
    level: m.level,
    natureName: m.natureName,
  };
}
