/**
 * Gym Arena domain data — one type-themed gym leader per Pokémon type.
 *
 * Pure, framework-free data so it can be reused and unit-tested. Each leader
 * fields a team built entirely from their signature type, and beating them
 * awards a unique badge. Collect all eighteen to become Arena Champion.
 */
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';
import type { IconName } from '../../core/ui/icon/icons.data';

export interface GymLeader {
  /** The single type this leader specialises in. */
  readonly type: PokemonType;
  /** Leader's given name. */
  readonly name: string;
  /** Flavour title shown under the name. */
  readonly title: string;
  /** Badge awarded for defeating this leader. */
  readonly badge: string;
  /** Icon shown for the badge / gym. */
  readonly icon: IconName;
  /** A short in-character taunt shown on the leader's card. */
  readonly blurb: string;
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

/** The full roster of gym leaders, one per type, in canonical type order. */
export const GYM_LEADERS: readonly GymLeader[] = POKEMON_TYPES.map((type) => {
  const [name, title, badge, icon, blurb] = FLAVOUR[type];
  return { type, name, title, badge, icon, blurb } satisfies GymLeader;
});

/** Look up a leader by their specialty type. */
export function leaderByType(type: PokemonType): GymLeader | undefined {
  return GYM_LEADERS.find((l) => l.type === type);
}
