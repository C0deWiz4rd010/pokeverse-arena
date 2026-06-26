/**
 * Battlefield terrain (Gen VI+). Terrain only affects *grounded* Pokémon:
 * Electric/Grassy/Psychic boost a move type by 30%, Misty halves Dragon damage
 * to grounded targets, Grassy heals at end of turn, and Electric/Misty block
 * sleep / status respectively. Pure and deterministic.
 */
import type { PokemonType } from '../../core/utils/type-chart';
import type { StatusCondition } from './status';

export type Terrain = 'none' | 'electric' | 'grassy' | 'psychic' | 'misty';

export interface TerrainInfo {
  readonly key: Terrain;
  readonly label: string;
  /** The move type this terrain empowers (none for misty). */
  readonly boosts: PokemonType | null;
}

export const TERRAIN_INFO: Record<Terrain, TerrainInfo> = {
  none: { key: 'none', label: 'No terrain', boosts: null },
  electric: { key: 'electric', label: 'Electric Terrain', boosts: 'electric' },
  grassy: { key: 'grassy', label: 'Grassy Terrain', boosts: 'grass' },
  psychic: { key: 'psychic', label: 'Psychic Terrain', boosts: 'psychic' },
  misty: { key: 'misty', label: 'Misty Terrain', boosts: null },
};

export const TERRAIN_BOOST = 1.3;
export const GRASSY_HEAL_FRACTION = 1 / 16;

/** Flying types (and, in the full game, Levitate) are not grounded. */
export function isGrounded(types: readonly PokemonType[]): boolean {
  return !types.includes('flying');
}

/**
 * Damage factor terrain applies to a move, given the attacker/defender grounded
 * states. The boosting terrains require the *attacker* grounded; Misty's Dragon
 * halving requires the *defender* grounded.
 */
export function terrainDamageFactor(
  terrain: Terrain,
  moveType: PokemonType,
  attackerGrounded: boolean,
  defenderGrounded: boolean,
): number {
  const info = TERRAIN_INFO[terrain];
  if (info.boosts && info.boosts === moveType && attackerGrounded) return TERRAIN_BOOST;
  if (terrain === 'misty' && moveType === 'dragon' && defenderGrounded) return 0.5;
  return 1;
}

/** Whether terrain prevents a status being applied to a grounded target. */
export function terrainBlocksStatus(
  terrain: Terrain,
  status: StatusCondition,
  defenderGrounded: boolean,
): boolean {
  if (!defenderGrounded) return false;
  if (terrain === 'electric' && status === 'sleep') return true;
  if (terrain === 'misty' && status !== 'none') return true;
  return false;
}

/** Grassy Terrain end-of-turn heal for a grounded Pokémon. */
export function terrainHeal(terrain: Terrain, maxHp: number, grounded: boolean): number {
  if (terrain === 'grassy' && grounded) return Math.max(1, Math.floor(maxHp * GRASSY_HEAL_FRACTION));
  return 0;
}

/** Psychic Terrain blocks increased-priority moves against grounded targets. */
export function terrainBlocksPriority(
  terrain: Terrain,
  priority: number,
  defenderGrounded: boolean,
): boolean {
  return terrain === 'psychic' && priority > 0 && defenderGrounded;
}

export function terrainSetMessage(terrain: Terrain): string {
  switch (terrain) {
    case 'electric':
      return 'An electric current ran across the field!';
    case 'grassy':
      return 'Grass grew to cover the battlefield!';
    case 'psychic':
      return 'The battlefield got weird!';
    case 'misty':
      return 'Mist swirled around the battlefield!';
    default:
      return 'The terrain faded.';
  }
}
