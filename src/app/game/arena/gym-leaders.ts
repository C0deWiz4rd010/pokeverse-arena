/**
 * Gym Arena domain data — one type-themed gym leader per Pokémon type.
 *
 * Pure, framework-free data so it can be reused and unit-tested. Each leader
 * fields a team built entirely from their signature type, and beating them
 * awards a unique badge. Collect all eighteen to become Arena Champion.
 */
import { POKEMON_TYPES, type PokemonType } from '../../core/utils/type-chart';

export interface GymLeader {
  /** The single type this leader specialises in. */
  readonly type: PokemonType;
  /** Leader's given name. */
  readonly name: string;
  /** Flavour title shown under the name. */
  readonly title: string;
  /** Badge awarded for defeating this leader. */
  readonly badge: string;
  /** Emoji shown for the badge / gym. */
  readonly icon: string;
  /** A short in-character taunt shown on the leader's card. */
  readonly blurb: string;
}

/** Per-type flavour: [name, title, badge, icon, blurb]. */
const FLAVOUR: Record<PokemonType, readonly [string, string, string, string, string]> = {
  normal: ['Cyrus', 'Pure Tactician', 'Balance Badge', '⚪', 'No gimmicks — just flawless fundamentals.'],
  fire: ['Pyra', 'Blaze Warden', 'Ember Badge', '🔥', 'Step in and you will be reduced to ash.'],
  water: ['Marina', 'Tidecaller', 'Cascade Badge', '💧', 'The current always wins in the end.'],
  electric: ['Volt', 'Storm Conductor', 'Thunder Badge', '⚡', 'Feel the charge before the strike.'],
  grass: ['Fern', 'Verdant Sage', 'Bloom Badge', '🌿', 'Patience grows the strongest roots.'],
  ice: ['Glace', 'Frost Monarch', 'Glacier Badge', '❄️', 'I will freeze your momentum solid.'],
  fighting: ['Bruno', 'Iron Fist', 'Fist Badge', '🥊', 'Show me the resolve in your knuckles.'],
  poison: ['Venoma', 'Toxic Maven', 'Venom Badge', '☠️', 'The longer you last, the worse it gets.'],
  ground: ['Terra', 'Quake Breaker', 'Earth Badge', '⛰️', 'The ground itself answers to me.'],
  flying: ['Skye', 'Galewing', 'Feather Badge', '🪶', 'You cannot hit what rides the wind.'],
  psychic: ['Mesmer', 'Mind Seer', 'Psyche Badge', '🔮', 'I have already seen how this ends.'],
  bug: ['Chitin', 'Swarm Keeper', 'Hive Badge', '🐛', 'Underestimate the swarm at your peril.'],
  rock: ['Boulder', 'Stone Wall', 'Boulder Badge', '🪨', 'Break through me — if you can.'],
  ghost: ['Mortis', 'Phantom Host', 'Spectre Badge', '👻', 'Fear is the first thing you will lose.'],
  dragon: ['Draken', 'Wyrm Lord', 'Drake Badge', '🐉', 'Few are worthy to face true power.'],
  dark: ['Umbra', 'Night Stalker', 'Shadow Badge', '🌑', 'In the dark, I never miss.'],
  steel: ['Forge', 'Steel Vanguard', 'Alloy Badge', '⚙️', 'My defence will outlast your rage.'],
  fairy: ['Lumi', 'Charm Weaver', 'Charm Badge', '🧚', 'Such a shame to crush something so bold.'],
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
