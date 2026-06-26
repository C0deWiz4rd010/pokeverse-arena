/**
 * Curated, data-driven ability registry. Abilities are declarative descriptors
 * (not imperative hooks) so they stay pure, serialisable and unit-testable; the
 * turn engine reads the relevant fields at each decision point. This trades the
 * full breadth of the games for a coherent, high-impact subset (~30) that makes
 * battles strategically rich.
 */
import type { PokemonType } from '../../core/utils/type-chart';
import type { StatusCondition } from './status';
import type { Weather } from './weather';
import type { Terrain } from './terrain';

export type AbilityId =
  | 'intimidate'
  | 'levitate'
  | 'drought'
  | 'drizzle'
  | 'sand-stream'
  | 'snow-warning'
  | 'blaze'
  | 'torrent'
  | 'overgrow'
  | 'swarm'
  | 'guts'
  | 'flash-fire'
  | 'water-absorb'
  | 'volt-absorb'
  | 'sturdy'
  | 'speed-boost'
  | 'huge-power'
  | 'technician'
  | 'adaptability'
  | 'thick-fat'
  | 'regenerator'
  | 'magic-guard'
  | 'multiscale'
  | 'static'
  | 'flame-body'
  | 'poison-point'
  | 'rough-skin'
  | 'chlorophyll'
  | 'swift-swim'
  | 'sand-rush'
  | 'unaware'
  | 'immunity'
  | 'limber'
  | 'water-veil';

export interface Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly blurb: string;
  /** Weather/terrain set when this Pokémon switches in. */
  readonly weatherOnEntry?: Weather;
  readonly terrainOnEntry?: Terrain;
  /** Lower the opponent's Attack by N stages on switch-in (Intimidate). */
  readonly intimidate?: number;
  /** Not grounded — immune to Ground moves & ground hazards (Levitate). */
  readonly levitate?: boolean;
  /** Absorb a move type: take no damage, optionally heal or power up. */
  readonly absorb?: { type: PokemonType; effect: 'heal25' | 'flash-fire' | 'nullify' };
  /** Pinch boost: at ≤1/3 HP, moves of `type` get ×`factor` (Blaze etc.). */
  readonly pinch?: { type: PokemonType; factor: number };
  /** Multiply the holder's effective Attack stat (Huge Power = 2). */
  readonly attackMultiplier?: number;
  /** STAB becomes ×2 instead of ×1.5 (Adaptability). */
  readonly adaptability?: boolean;
  /** Moves with ≤60 base power get ×1.5 (Technician). */
  readonly technician?: boolean;
  /** Halve Fire/Ice damage taken (Thick Fat). */
  readonly thickFat?: boolean;
  /** Survive a would-be KO from full HP at 1 HP (Sturdy). */
  readonly sturdy?: boolean;
  /** +1 Speed stage at the end of every turn (Speed Boost). */
  readonly speedBoost?: boolean;
  /** Take no indirect (residual/hazard) damage (Magic Guard). */
  readonly magicGuard?: boolean;
  /** Halve damage taken while at full HP (Multiscale). */
  readonly multiscale?: boolean;
  /** Heal 1/3 max HP on switch-out (Regenerator). */
  readonly regenerator?: boolean;
  /** Attack isn't dropped by burn and gains ×1.5 when statused (Guts). */
  readonly guts?: boolean;
  /** Contact attackers get this status with the given chance (Static etc.). */
  readonly contactStatus?: { status: StatusCondition; chance: number };
  /** Contact attackers take this fraction of their max HP (Rough Skin). */
  readonly roughSkin?: number;
  /** Double Speed in matching weather (Chlorophyll/Swift Swim/Sand Rush). */
  readonly weatherSpeed?: Weather;
  /** Ignore the target's stat stages when dealing/taking damage (Unaware). */
  readonly unaware?: boolean;
  /** Immunity to one (or all) non-volatile statuses. */
  readonly statusImmunity?: StatusCondition | 'all';
}

const LIST: readonly Ability[] = [
  { id: 'intimidate', name: 'Intimidate', blurb: 'Lowers the foe’s Attack on entry.', intimidate: 1 },
  { id: 'levitate', name: 'Levitate', blurb: 'Immune to Ground moves and ground hazards.', levitate: true, absorb: { type: 'ground', effect: 'nullify' } },
  { id: 'drought', name: 'Drought', blurb: 'Summons harsh sunlight on entry.', weatherOnEntry: 'sun' },
  { id: 'drizzle', name: 'Drizzle', blurb: 'Summons rain on entry.', weatherOnEntry: 'rain' },
  { id: 'sand-stream', name: 'Sand Stream', blurb: 'Whips up a sandstorm on entry.', weatherOnEntry: 'sand' },
  { id: 'snow-warning', name: 'Snow Warning', blurb: 'Summons snow on entry.', weatherOnEntry: 'snow' },
  { id: 'blaze', name: 'Blaze', blurb: 'Powers up Fire moves in a pinch.', pinch: { type: 'fire', factor: 1.5 } },
  { id: 'torrent', name: 'Torrent', blurb: 'Powers up Water moves in a pinch.', pinch: { type: 'water', factor: 1.5 } },
  { id: 'overgrow', name: 'Overgrow', blurb: 'Powers up Grass moves in a pinch.', pinch: { type: 'grass', factor: 1.5 } },
  { id: 'swarm', name: 'Swarm', blurb: 'Powers up Bug moves in a pinch.', pinch: { type: 'bug', factor: 1.5 } },
  { id: 'guts', name: 'Guts', blurb: 'Boosts Attack when statused; ignores burn.', guts: true },
  { id: 'flash-fire', name: 'Flash Fire', blurb: 'Absorbs Fire moves and powers up its own.', absorb: { type: 'fire', effect: 'flash-fire' } },
  { id: 'water-absorb', name: 'Water Absorb', blurb: 'Heals when hit by Water moves.', absorb: { type: 'water', effect: 'heal25' } },
  { id: 'volt-absorb', name: 'Volt Absorb', blurb: 'Heals when hit by Electric moves.', absorb: { type: 'electric', effect: 'heal25' } },
  { id: 'sturdy', name: 'Sturdy', blurb: 'Survives a one-hit KO from full HP.', sturdy: true },
  { id: 'speed-boost', name: 'Speed Boost', blurb: 'Speed rises every turn.', speedBoost: true },
  { id: 'huge-power', name: 'Huge Power', blurb: 'Doubles Attack.', attackMultiplier: 2 },
  { id: 'technician', name: 'Technician', blurb: 'Boosts weak moves.', technician: true },
  { id: 'adaptability', name: 'Adaptability', blurb: 'Boosts same-type moves further.', adaptability: true },
  { id: 'thick-fat', name: 'Thick Fat', blurb: 'Halves Fire and Ice damage taken.', thickFat: true },
  { id: 'regenerator', name: 'Regenerator', blurb: 'Restores HP on switching out.', regenerator: true },
  { id: 'magic-guard', name: 'Magic Guard', blurb: 'Only takes damage from direct attacks.', magicGuard: true },
  { id: 'multiscale', name: 'Multiscale', blurb: 'Halves damage taken at full HP.', multiscale: true },
  { id: 'static', name: 'Static', blurb: 'May paralyse on contact.', contactStatus: { status: 'paralysis', chance: 30 } },
  { id: 'flame-body', name: 'Flame Body', blurb: 'May burn on contact.', contactStatus: { status: 'burn', chance: 30 } },
  { id: 'poison-point', name: 'Poison Point', blurb: 'May poison on contact.', contactStatus: { status: 'poison', chance: 30 } },
  { id: 'rough-skin', name: 'Rough Skin', blurb: 'Hurts attackers that make contact.', roughSkin: 1 / 8 },
  { id: 'chlorophyll', name: 'Chlorophyll', blurb: 'Doubles Speed in sun.', weatherSpeed: 'sun' },
  { id: 'swift-swim', name: 'Swift Swim', blurb: 'Doubles Speed in rain.', weatherSpeed: 'rain' },
  { id: 'sand-rush', name: 'Sand Rush', blurb: 'Doubles Speed in a sandstorm.', weatherSpeed: 'sand' },
  { id: 'unaware', name: 'Unaware', blurb: 'Ignores the foe’s stat changes.', unaware: true },
  { id: 'immunity', name: 'Immunity', blurb: 'Cannot be poisoned.', statusImmunity: 'poison' },
  { id: 'limber', name: 'Limber', blurb: 'Cannot be paralysed.', statusImmunity: 'paralysis' },
  { id: 'water-veil', name: 'Water Veil', blurb: 'Cannot be burned.', statusImmunity: 'burn' },
];

const BY_ID = new Map<AbilityId, Ability>(LIST.map((a) => [a.id, a]));

export const ABILITIES: readonly Ability[] = LIST;

export function abilityById(id: AbilityId | undefined): Ability | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Type guard: is this slug one of the abilities the engine models? */
export function isAbilityId(slug: string): slug is AbilityId {
  return BY_ID.has(slug as AbilityId);
}

export function abilityName(id: AbilityId | undefined): string {
  return abilityById(id)?.name ?? '';
}
