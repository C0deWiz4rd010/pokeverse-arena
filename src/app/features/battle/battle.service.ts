import { Injectable, inject } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import { officialArtwork } from '../../core/api/pokeapi-endpoints';
import type { MoveDto, PokemonDto } from '../../core/dto/pokeapi.dto';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';
import { quickStats, type StatKey } from '../../core/utils/stat-calculator';
import type { Battler, BattleMove, DamageClass } from '../../game/engine';

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

  /** Build an engine-ready Battler from a Pokémon id/name at a given level. */
  async buildBattler(idOrName: string | number, level = 50): Promise<Battler> {
    const dto = await this.api.pokemon(String(idOrName).toLowerCase());
    const baseStats = this.baseStats(dto);
    const stats = quickStats(baseStats, level);
    const types = dto.types
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name)
      .filter(isPokemonType);
    const moves = await this.pickMoves(dto);
    return {
      id: dto.id,
      name: dto.name,
      level,
      types: types.length ? types : ['normal'],
      stats,
      moves,
      sprite: this.battleSprite(dto, 'front'),
    };
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

  private async pickMoves(dto: PokemonDto): Promise<BattleMove[]> {
    const names = [
      ...new Set(
        dto.moves
          .filter((m) =>
            m.version_group_details.some((d) => d.move_learn_method.name === 'level-up'),
          )
          .map((m) => m.move.name),
      ),
    ].slice(0, MOVE_CANDIDATES);

    const details = await Promise.all(
      names.map((n) =>
        this.api.move(n).catch(() => null as MoveDto | null),
      ),
    );

    const damaging = details
      .filter((d): d is MoveDto => !!d && (d.power ?? 0) > 0)
      .map((d) => this.toMove(d))
      .sort((a, b) => b.power - a.power)
      .slice(0, MOVE_SLOTS);

    return damaging.length ? damaging : [STRUGGLE];
  }

  private toMove(dto: MoveDto): BattleMove {
    const type = dto.type.name;
    const damageClass = (dto.damage_class?.name ?? 'physical') as DamageClass;
    return {
      name: dto.name,
      type: (isPokemonType(type) ? type : 'normal') as PokemonType,
      power: dto.power ?? 0,
      // API `accuracy: null` means the move never misses → 0 in the engine.
      accuracy: dto.accuracy ?? 0,
      damageClass: damageClass === 'status' ? 'physical' : damageClass,
      priority: dto.priority,
      pp: dto.pp ?? undefined,
    };
  }
}
