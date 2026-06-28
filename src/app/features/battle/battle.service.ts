import { Injectable, inject } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { MoveDto, PokemonDto } from '../../core/dto/pokeapi.dto';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';
import { quickStats, type StatKey } from '../../core/utils/stat-calculator';
import {
  isAbilityId,
  type AbilityId,
  type Battler,
  type BattleMove,
  type DamageClass,
  type SecondaryEffect,
  type StatusCondition,
} from '../../game/engine';

/** Map PokéAPI move ailment slugs onto the engine's status conditions. */
const AILMENT: Record<string, StatusCondition> = {
  paralysis: 'paralysis',
  sleep: 'sleep',
  freeze: 'freeze',
  burn: 'burn',
  poison: 'poison',
};

/** Number of distinct level-up moves to consider before filtering to damaging ones. */
const MOVE_CANDIDATES = 14;
const MOVE_SLOTS = 4;
const HIGHEST_DEX_ID = 1025;

/** A guaranteed fallback so every battler can always act. */
const STRUGGLE: BattleMove = {
  name: 'struggle',
  type: 'normal',
  power: 50,
  accuracy: 0,
  damageClass: 'physical',
};

@Injectable({ providedIn: 'root' })
export class BattleService {
  private readonly api = inject(PokeApiClient);

  /** A random valid dex id, optionally excluding one (so foe ≠ player). */
  randomId(exclude?: number): number {
    let id = 1 + Math.floor(Math.random() * HIGHEST_DEX_ID);
    if (exclude && id === exclude) id = (id % HIGHEST_DEX_ID) + 1;
    return id;
  }

  /**
   * Build an engine-ready Battler from a Pokémon id/name at a given level.
   * Pass `{ levelMoves: true }` (RPG mode) to use the moves the species would
   * actually know at that level instead of its strongest four.
   */
  async buildBattler(idOrName: string | number, level = 50, opts?: { levelMoves?: boolean }): Promise<Battler> {
    const dto = await this.api.pokemon(String(idOrName).toLowerCase());
    return this.buildBattlerFromDto(dto, level, opts);
  }

  /** Build an engine-ready Battler from an already-fetched DTO (saves a request). */
  async buildBattlerFromDto(dto: PokemonDto, level = 50, opts?: { levelMoves?: boolean }): Promise<Battler> {
    const baseStats = this.baseStats(dto);
    const stats = quickStats(baseStats, level);
    const types = dto.types
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isPokemonType);
    const moves = await this.pickMoves(dto, opts?.levelMoves ? level : undefined);
    return {
      id: dto.id,
      name: dto.name,
      level,
      types: types.length ? types : ['normal'],
      stats,
      moves,
      ability: this.pickAbility(dto),
      sprite: this.battleSprite(dto, 'front'),
    };
  }

  /** First ability slot (non-hidden preferred) the engine actually models. */
  private pickAbility(dto: PokemonDto): AbilityId | undefined {
    const slots = [...dto.abilities].sort(
      (a, b) => Number(a.is_hidden) - Number(b.is_hidden) || a.slot - b.slot,
    );
    for (const s of slots) if (isAbilityId(s.ability.name)) return s.ability.name;
    return undefined;
  }

  /** Base-stat total (BST) — used to gauge a Pokémon's raw power tier. */
  totalBaseStats(dto: PokemonDto): number {
    return dto.stats.reduce((sum, s) => sum + s.base_stat, 0);
  }

  /** Front (opponent) or back (player) battle sprite, with sensible fallbacks. */
  /**
   * Battle sprite for a fighter. We prefer the high-resolution official artwork
   * so it stays crisp when scaled up on desktop; the small Showdown pixel
   * sprites blur badly at 140px. Falls back to Showdown, then the artwork CDN.
   */
  battleSprite(dto: PokemonDto, facing: 'front' | 'back'): string {
    const art = dto.sprites.other?.['official-artwork']?.front_default;
    const showdown = dto.sprites.other?.showdown;
    const fallback = facing === 'back' ? showdown?.back_default : showdown?.front_default;
    return art ?? fallback ?? officialArtwork(dto.id);
  }

  /* ------------------------------------------------------------- internals */

  private baseStats(dto: PokemonDto): Record<StatKey, number> {
    const stats = {} as Record<StatKey, number>;
    for (const s of dto.stats) stats[s.stat.name as StatKey] = s.base_stat;
    return stats;
  }

  /**
   * Pick up to four damaging moves. Default: the species' strongest level-up
   * moves (fair level-50 fights). When `atLevel` is given (RPG mode): the moves
   * known at that level, most-recently-learned first — so movesets scale as a
   * Pokémon levels up.
   */
  private async pickMoves(dto: PokemonDto, atLevel?: number): Promise<BattleMove[]> {
    let names: string[];
    if (atLevel !== undefined) {
      // Earliest level-up level per move, capped at the current level.
      const byMove = new Map<string, number>();
      for (const m of dto.moves) {
        for (const d of m.version_group_details) {
          if (d.move_learn_method.name !== 'level-up') continue;
          if (d.level_learned_at > atLevel) continue;
          const prev = byMove.get(m.move.name);
          if (prev === undefined || d.level_learned_at < prev) byMove.set(m.move.name, d.level_learned_at);
        }
      }
      names = [...byMove.entries()]
        .sort((a, b) => b[1] - a[1]) // most recently learned first
        .slice(0, MOVE_CANDIDATES)
        .map(([name]) => name);
    } else {
      names = [
        ...new Set(
          dto.moves
            .filter((m) => m.version_group_details.some((d) => d.move_learn_method.name === 'level-up'))
            .map((m) => m.move.name),
        ),
      ].slice(0, MOVE_CANDIDATES);
    }

    const details = await Promise.all(names.map((n) => this.api.move(n).catch(() => null as MoveDto | null)));

    const damaging = details.filter((d): d is MoveDto => !!d && (d.power ?? 0) > 0).map((d) => this.toMove(d));

    // Level mode keeps recency order (already sorted); default takes the strongest.
    const chosen = atLevel !== undefined ? damaging.slice(0, MOVE_SLOTS) : damaging.sort((a, b) => b.power - a.power).slice(0, MOVE_SLOTS);

    return chosen.length ? chosen : [STRUGGLE];
  }

  private toMove(dto: MoveDto): BattleMove {
    const type = dto.type.name;
    const rawClass = (dto.damage_class?.name ?? 'physical') as DamageClass;
    const damageClass: DamageClass = rawClass === 'status' ? 'physical' : rawClass;
    const meta = dto.meta;

    // Secondary on-hit rider: a status ailment, else a flinch chance.
    let secondary: SecondaryEffect | undefined;
    const status = meta ? AILMENT[meta.ailment?.name ?? ''] : undefined;
    if (status && meta && meta.ailment_chance > 0) {
      secondary = { chance: meta.ailment_chance, status };
    } else if (meta && meta.flinch_chance > 0) {
      secondary = { chance: meta.flinch_chance, flinch: true };
    }

    const drainPct = meta?.drain ?? 0;
    const multiHit =
      meta && meta.min_hits && meta.max_hits ? ([meta.min_hits, meta.max_hits] as const) : undefined;

    return {
      name: dto.name,
      type: (isPokemonType(type) ? type : 'normal') as PokemonType,
      power: dto.power ?? 0,
      // API `accuracy: null` means the move never misses → 0 in the engine.
      accuracy: dto.accuracy ?? 0,
      damageClass,
      priority: dto.priority,
      pp: dto.pp ?? undefined,
      secondary,
      drain: drainPct > 0 ? drainPct / 100 : undefined,
      recoil: drainPct < 0 ? -drainPct / 100 : undefined,
      multiHit,
      critStage: meta?.crit_rate || undefined,
      // We don't capture move flags from the API, so approximate contact by class.
      flags: damageClass === 'physical' ? { contact: true } : undefined,
    };
  }
}
