/**
 * Pure level-up evolution helpers. Parses a PokéAPI evolution chain into a
 * species → next-evolution map (level-up trigger only) and decides whether a
 * Pokémon should evolve at a given level. Item/trade/happiness evolutions are
 * intentionally ignored for v1.
 */
import { idFromUrl } from '../../core/api/pokeapi-endpoints';
import type { ChainLinkDto, EvolutionChainDto } from '../../core/dto/pokeapi.dto';

export interface EvoStep {
  readonly to: string;
  readonly toId: number;
  readonly minLevel: number;
}

/** species name → the level-up evolution it can undergo (if any). */
export function levelUpEvolutions(chain: EvolutionChainDto): Record<string, EvoStep> {
  const out: Record<string, EvoStep> = {};
  const walk = (link: ChainLinkDto): void => {
    for (const next of link.evolves_to) {
      const detail = next.evolution_details.find((d) => d.trigger?.name === 'level-up' && d.min_level != null);
      if (detail && detail.min_level != null) {
        out[link.species.name] = { to: next.species.name, toId: idFromUrl(next.species.url), minLevel: detail.min_level };
      }
      walk(next);
    }
  };
  walk(chain.chain);
  return out;
}

/** The evolution a species should undergo at `level`, or null. */
export function evolutionAt(map: Record<string, EvoStep>, species: string, level: number): EvoStep | null {
  const e = map[species];
  return e && level >= e.minLevel ? e : null;
}
