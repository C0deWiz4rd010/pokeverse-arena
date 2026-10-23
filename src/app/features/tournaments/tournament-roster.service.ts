import { Injectable, inject } from '@angular/core';
import { PokeApiClient } from '../../core/api/pokeapi.client';
import type { PokemonDto } from '../../core/dto/pokeapi.dto';
import { BattlerFactory, baseStatsOf } from '../../core/battle/battler-factory';
import { quickStats } from '../../core/utils/stat-calculator';
import { isPokemonType, type PokemonType } from '../../core/utils/type-chart';
import type { Battler } from '../../game/engine';
import { makeTrainer, synthMoves, type TournamentMode, type Trainer } from '../../game/tournament';

const DEX_MAX = 1025;

function idFromUrl(url: string): number | null {
  const m = url.match(/\/pokemon\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
}

/**
 * Fetches candidate Pokémon for a tournament mode and turns them into trainers: the
 * player gets fully built battlers, CPU trainers the cheap synthetic ones.
 */
@Injectable({ providedIn: 'root' })
export class TournamentRoster {
  private readonly api = inject(PokeApiClient);
  private readonly battle = inject(BattlerFactory);

  /** Fetch a pool of DTOs sized for the mode, honouring type/BST restrictions. */
  async selectDtos(
    mode: TournamentMode,
    count: number,
    monoType: PokemonType | null,
  ): Promise<PokemonDto[]> {
    const over = Math.ceil(count * (mode.pool === 'all' ? 1.4 : 2.4));
    const ids =
      mode.monotype && monoType ? await this.sampleTypeIds(monoType, over) : this.randomIds(over);
    let dtos = await this.fetchDtos(ids);

    while (dtos.length < count) {
      dtos = dtos.concat(await this.fetchDtos(this.randomIds(count)));
    }
    if (mode.pool === 'little')
      dtos.sort((a, b) => this.battle.totalBaseStats(a) - this.battle.totalBaseStats(b));
    else if (mode.pool === 'legendary')
      dtos.sort((a, b) => this.battle.totalBaseStats(b) - this.battle.totalBaseStats(a));
    return dtos.slice(0, count);
  }

  /** Snake-distribute DTOs into teams; balanced mode sorts by BST first to even out totals. */
  distribute(dtos: PokemonDto[], teams: number, size: number, balanced: boolean): PokemonDto[][] {
    const ordered = balanced
      ? [...dtos].sort((a, b) => this.battle.totalBaseStats(b) - this.battle.totalBaseStats(a))
      : this.shuffle(dtos);
    const out: PokemonDto[][] = Array.from({ length: teams }, () => []);
    let idx = 0;
    for (let r = 0; r < size; r++) {
      const order = r % 2 === 0 ? this.range(teams) : this.range(teams).reverse();
      for (const t of order) {
        if (idx < ordered.length) out[t]!.push(ordered[idx++]!);
      }
    }
    return out;
  }

  /** The draft pool the player picks from (fully built battlers). */
  async draftPool(
    mode: TournamentMode,
    count: number,
    monoType: PokemonType | null,
  ): Promise<Battler[]> {
    const dtos = await this.selectDtos(mode, count, monoType);
    return Promise.all(dtos.map((d) => this.battle.buildBattlerFromDto(d, mode.baseLevel)));
  }

  /** Trainers for `teams`; the one at `playerIndex` is the player with fully built battlers. */
  async buildTrainers(
    teams: PokemonDto[][],
    mode: TournamentMode,
    playerIndex: number,
  ): Promise<Trainer[]> {
    const out: Trainer[] = [];
    for (let i = 0; i < teams.length; i++) {
      const isPlayer = i === playerIndex;
      const team = isPlayer
        ? await Promise.all(
            teams[i]!.map((d) => this.battle.buildBattlerFromDto(d, mode.baseLevel)),
          )
        : teams[i]!.map((d) => this.buildLight(d, mode.baseLevel));
      out.push(makeTrainer(i, isPlayer, team));
    }
    return out;
  }

  /** CPU trainers numbered from 1 (index 0 is the drafted player). */
  buildCpuTrainers(teams: PokemonDto[][], mode: TournamentMode): Trainer[] {
    return teams.map((team, i) =>
      makeTrainer(
        i + 1,
        false,
        team.map((d) => this.buildLight(d, mode.baseLevel)),
      ),
    );
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
      stats: quickStats(baseStatsOf(dto), level),
      moves: synthMoves(t),
      sprite: this.battle.battleSprite(dto, 'front'),
    };
  }

  private async sampleTypeIds(type: PokemonType, n: number): Promise<number[]> {
    const dto = await this.api.type(type);
    const pool = dto.pokemon
      .map((p) => idFromUrl(p.pokemon.url))
      .filter((id): id is number => id !== null && id <= DEX_MAX);
    if (!pool.length) return this.randomIds(n);
    return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]!);
  }

  private randomIds(n: number): number[] {
    return Array.from({ length: n }, () => 1 + Math.floor(Math.random() * DEX_MAX));
  }

  private async fetchDtos(ids: number[]): Promise<PokemonDto[]> {
    const res = await Promise.all(ids.map((id) => this.api.pokemon(id).catch(() => null)));
    return res.filter((d): d is PokemonDto => !!d);
  }

  private range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }
}
