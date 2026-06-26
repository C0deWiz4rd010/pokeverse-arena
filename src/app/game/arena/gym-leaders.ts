/**
 * Gym Arena domain data — one type-themed gym leader per Pokémon type.
 *
 * Each leader now fields a *designed* signature team (specific species carrying
 * abilities and held items that play to a theme — Drought + Sun, Sand Stream,
 * Trick-Room walls, …), sits at a fixed point on a difficulty ladder, fights at
 * its own AI tier, and has a little dialogue. Beating a leader awards a unique
 * badge; collect them to unlock the Champion Gauntlet (see `elite-four.ts`).
 *
 * Pure, framework-free data so it stays reusable and unit-testable.
 */
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import type { IconName } from '../../core/ui/icon/icons.data';
import type { AbilityId, AiTier, ItemId } from '../engine';

/** One member of a leader's signature team. */
export interface LeaderMon {
  readonly species: string;
  readonly ability?: AbilityId;
  readonly item?: ItemId;
}

export interface LeaderDialogue {
  readonly intro: string;
  readonly victory: string;
  readonly defeat: string;
}

export interface GymLeader {
  readonly type: PokemonType;
  readonly name: string;
  readonly title: string;
  readonly badge: string;
  readonly icon: IconName;
  readonly blurb: string;
  /** Recommended ladder position (1 = first). Drives level + AI scaling. */
  readonly order: number;
  /** The leader's three signature Pokémon (ace last). */
  readonly team: readonly LeaderMon[];
  readonly dialogue: LeaderDialogue;
}

/** Per-type flavour: [name, title, badge, icon, blurb]. */
const FLAVOUR: Record<PokemonType, readonly [string, string, string, IconName, string]> = {
  normal: ['Cyrus', 'Pure Tactician', 'Balance Badge', 'circle', 'No gimmicks — just flawless fundamentals.'],
  fire: ['Pyra', 'Blaze Warden', 'Ember Badge', 'flame', 'Step in and you will be reduced to ash.'],
  water: ['Marina', 'Tidecaller', 'Cascade Badge', 'droplet', 'The current always wins in the end.'],
  electric: ['Volt', 'Storm Conductor', 'Thunder Badge', 'zap', 'Feel the charge before the strike.'],
  grass: ['Fern', 'Verdant Sage', 'Bloom Badge', 'leaf', 'Patience grows the strongest roots.'],
  ice: ['Glace', 'Frost Monarch', 'Glacier Badge', 'snowflake', 'I will freeze your momentum solid.'],
  fighting: ['Bruno', 'Iron Fist', 'Fist Badge', 'dumbbell', 'Show me the resolve in your knuckles.'],
  poison: ['Venoma', 'Toxic Maven', 'Venom Badge', 'skull', 'The longer you last, the worse it gets.'],
  ground: ['Terra', 'Quake Breaker', 'Earth Badge', 'mountain', 'The ground itself answers to me.'],
  flying: ['Skye', 'Galewing', 'Feather Badge', 'feather', 'You cannot hit what rides the wind.'],
  psychic: ['Mesmer', 'Mind Seer', 'Psyche Badge', 'brain', 'I have already seen how this ends.'],
  bug: ['Chitin', 'Swarm Keeper', 'Hive Badge', 'bug', 'Underestimate the swarm at your peril.'],
  rock: ['Boulder', 'Stone Wall', 'Boulder Badge', 'gem', 'Break through me — if you can.'],
  ghost: ['Mortis', 'Phantom Host', 'Spectre Badge', 'ghost', 'Fear is the first thing you will lose.'],
  dragon: ['Draken', 'Wyrm Lord', 'Drake Badge', 'flame', 'Few are worthy to face true power.'],
  dark: ['Umbra', 'Night Stalker', 'Shadow Badge', 'moon', 'In the dark, I never miss.'],
  steel: ['Forge', 'Steel Vanguard', 'Alloy Badge', 'cog', 'My defence will outlast your rage.'],
  fairy: ['Lumi', 'Charm Weaver', 'Charm Badge', 'sparkles', 'Such a shame to crush something so bold.'],
};

/** Recommended ladder order (1 = first gym). */
const ORDER: Record<PokemonType, number> = {
  normal: 1, bug: 2, rock: 3, grass: 4, poison: 5, electric: 6, ground: 7, fighting: 8,
  water: 9, fire: 10, flying: 11, ice: 12, psychic: 13, ghost: 14, steel: 15, dark: 16,
  fairy: 17, dragon: 18,
};

/** Designed signature teams (ace last), with thematic abilities + items. */
const TEAMS: Record<PokemonType, readonly LeaderMon[]> = {
  normal: [
    { species: 'kangaskhan', ability: 'intimidate', item: 'rocky-helmet' },
    { species: 'staraptor', ability: 'intimidate', item: 'choice-scarf' },
    { species: 'snorlax', ability: 'thick-fat', item: 'leftovers' },
  ],
  bug: [
    { species: 'galvantula', item: 'focus-sash' },
    { species: 'heracross', ability: 'guts', item: 'flame-orb' },
    { species: 'scizor', ability: 'technician', item: 'life-orb' },
  ],
  rock: [
    { species: 'aerodactyl', item: 'focus-sash' },
    { species: 'rhyperior', ability: 'sturdy', item: 'assault-vest' },
    { species: 'tyranitar', ability: 'sand-stream', item: 'smooth-rock' },
  ],
  grass: [
    { species: 'leafeon', ability: 'chlorophyll', item: 'life-orb' },
    { species: 'tangrowth', ability: 'regenerator', item: 'assault-vest' },
    { species: 'venusaur', ability: 'overgrow', item: 'leftovers' },
  ],
  poison: [
    { species: 'crobat', ability: 'intimidate', item: 'choice-scarf' },
    { species: 'toxicroak', item: 'life-orb' },
    { species: 'muk', item: 'black-sludge' },
  ],
  electric: [
    { species: 'magnezone', item: 'choice-specs' },
    { species: 'raichu', item: 'life-orb' },
    { species: 'jolteon', ability: 'volt-absorb', item: 'choice-specs' },
  ],
  ground: [
    { species: 'hippowdon', ability: 'sand-stream', item: 'smooth-rock' },
    { species: 'excadrill', ability: 'sand-rush', item: 'life-orb' },
    { species: 'garchomp', ability: 'rough-skin', item: 'rocky-helmet' },
  ],
  fighting: [
    { species: 'hitmonlee', item: 'choice-scarf' },
    { species: 'lucario', ability: 'adaptability', item: 'life-orb' },
    { species: 'machamp', ability: 'guts', item: 'flame-orb' },
  ],
  water: [
    { species: 'kingdra', ability: 'swift-swim', item: 'life-orb' },
    { species: 'gyarados', ability: 'intimidate', item: 'leftovers' },
    { species: 'politoed', ability: 'drizzle', item: 'damp-rock' },
  ],
  fire: [
    { species: 'arcanine', ability: 'intimidate', item: 'choice-band' },
    { species: 'charizard', ability: 'blaze', item: 'life-orb' },
    { species: 'ninetales', ability: 'drought', item: 'heat-rock' },
  ],
  flying: [
    { species: 'pidgeot', item: 'choice-specs' },
    { species: 'gyarados', ability: 'intimidate', item: 'leftovers' },
    { species: 'talonflame', item: 'choice-band' },
  ],
  ice: [
    { species: 'glaceon', item: 'choice-specs' },
    { species: 'lapras', ability: 'water-absorb', item: 'assault-vest' },
    { species: 'abomasnow', ability: 'snow-warning', item: 'icy-rock' },
  ],
  psychic: [
    { species: 'espeon', ability: 'magic-guard', item: 'life-orb' },
    { species: 'metagross', item: 'assault-vest' },
    { species: 'alakazam', ability: 'magic-guard', item: 'focus-sash' },
  ],
  ghost: [
    { species: 'mismagius', item: 'life-orb' },
    { species: 'chandelure', ability: 'flash-fire', item: 'choice-specs' },
    { species: 'gengar', ability: 'levitate', item: 'life-orb' },
  ],
  steel: [
    { species: 'aggron', ability: 'sturdy', item: 'rocky-helmet' },
    { species: 'scizor', ability: 'technician', item: 'choice-band' },
    { species: 'metagross', item: 'assault-vest' },
  ],
  dark: [
    { species: 'weavile', item: 'choice-band' },
    { species: 'hydreigon', item: 'choice-specs' },
    { species: 'tyranitar', ability: 'sand-stream', item: 'smooth-rock' },
  ],
  fairy: [
    { species: 'togekiss', item: 'leftovers' },
    { species: 'sylveon', item: 'choice-specs' },
    { species: 'gardevoir', item: 'life-orb' },
  ],
  dragon: [
    { species: 'salamence', ability: 'intimidate', item: 'life-orb' },
    { species: 'haxorus', item: 'choice-band' },
    { species: 'dragonite', ability: 'multiscale', item: 'leftovers' },
  ],
};

function dialogueFor(name: string, title: string, blurb: string): LeaderDialogue {
  return {
    intro: `${name}, the ${title}: "${blurb}"`,
    victory: `${name}: "Come back when you have truly trained."`,
    defeat: `${name}: "Impressive. The badge is yours — you earned it."`,
  };
}

/** The full roster of gym leaders, one per type, in canonical type order. */
export const GYM_LEADERS: readonly GymLeader[] = POKEMON_TYPES.map((type) => {
  const [name, title, badge, icon, blurb] = FLAVOUR[type];
  return { type, name, title, badge, icon, blurb, order: ORDER[type], team: TEAMS[type], dialogue: dialogueFor(name, title, blurb) } satisfies GymLeader;
});

/** Leaders sorted by the recommended ladder order. */
export const LEADER_LADDER: readonly GymLeader[] = [...GYM_LEADERS].sort((a, b) => a.order - b.order);

/** Look up a leader by their specialty type. */
export function leaderByType(type: PokemonType): GymLeader | undefined {
  return GYM_LEADERS.find((l) => l.type === type);
}

/** The level a leader (and the fair challenge it sets) fights at. */
export function leaderLevel(order: number): number {
  return 16 + order * 3; // gym 1 ≈ Lv19 → gym 18 ≈ Lv70
}

/** The AI tier a leader uses, ramping with the ladder. */
export function leaderTier(order: number): AiTier {
  if (order <= 4) return 'basic';
  if (order <= 12) return 'strong';
  return 'elite';
}
