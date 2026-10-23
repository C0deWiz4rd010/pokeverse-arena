import { SeededRng } from '../../core/utils/rng';
import { POKEMON_TYPES } from '../../core/utils/type-chart';
import type { AbilityId } from './abilities';
import type { Battler, BattleEvent, BattleMove } from './battle-types';
import type { ItemId } from './items';

/**
 * Deterministic random matchup material shared by the replay specs. The ability and item pools
 * are pinned so adding new abilities or items never reshuffles the existing replays.
 */
const ABILITY_POOL: AbilityId[] = [
  'intimidate',
  'levitate',
  'drought',
  'drizzle',
  'sand-stream',
  'snow-warning',
  'blaze',
  'torrent',
  'overgrow',
  'swarm',
  'guts',
  'flash-fire',
  'water-absorb',
  'volt-absorb',
  'sturdy',
  'speed-boost',
  'huge-power',
  'technician',
  'adaptability',
  'thick-fat',
  'regenerator',
  'magic-guard',
  'multiscale',
  'static',
  'flame-body',
  'poison-point',
  'rough-skin',
  'chlorophyll',
  'swift-swim',
  'sand-rush',
  'unaware',
  'immunity',
  'limber',
  'water-veil',
];
const ITEM_POOL: ItemId[] = [
  'leftovers',
  'black-sludge',
  'life-orb',
  'choice-band',
  'choice-specs',
  'choice-scarf',
  'assault-vest',
  'eviolite',
  'focus-sash',
  'rocky-helmet',
  'sitrus-berry',
  'lum-berry',
  'flame-orb',
  'toxic-orb',
  'expert-belt',
  'muscle-band',
  'wise-glasses',
  'heat-rock',
  'damp-rock',
  'smooth-rock',
  'icy-rock',
];
export const MOVE_POOL: BattleMove[] = [
  {
    name: 'Tackle',
    type: 'normal',
    power: 40,
    accuracy: 100,
    damageClass: 'physical',
    flags: { contact: true },
  },
  {
    name: 'Slash',
    type: 'normal',
    power: 70,
    accuracy: 100,
    damageClass: 'physical',
    critStage: 1,
    flags: { contact: true },
  },
  {
    name: 'Flamethrower',
    type: 'fire',
    power: 90,
    accuracy: 100,
    damageClass: 'special',
    secondary: { chance: 10, status: 'burn' },
  },
  { name: 'Surf', type: 'water', power: 90, accuracy: 100, damageClass: 'special' },
  {
    name: 'Thunderbolt',
    type: 'electric',
    power: 90,
    accuracy: 100,
    damageClass: 'special',
    secondary: { chance: 10, status: 'paralysis' },
  },
  { name: 'Earthquake', type: 'ground', power: 100, accuracy: 100, damageClass: 'physical' },
  {
    name: 'Ice Beam',
    type: 'ice',
    power: 90,
    accuracy: 100,
    damageClass: 'special',
    secondary: { chance: 10, status: 'freeze' },
  },
  {
    name: 'Rock Slide',
    type: 'rock',
    power: 75,
    accuracy: 90,
    damageClass: 'physical',
    secondary: { chance: 30, flinch: true },
  },
  {
    name: 'Quick Attack',
    type: 'normal',
    power: 40,
    accuracy: 100,
    damageClass: 'physical',
    priority: 1,
    flags: { contact: true },
  },
  {
    name: 'Double Kick',
    type: 'fighting',
    power: 30,
    accuracy: 100,
    damageClass: 'physical',
    multiHit: [2, 2],
    flags: { contact: true },
  },
  {
    name: 'Giga Drain',
    type: 'grass',
    power: 75,
    accuracy: 100,
    damageClass: 'special',
    drain: 0.5,
  },
  {
    name: 'Brave Bird',
    type: 'flying',
    power: 120,
    accuracy: 100,
    damageClass: 'physical',
    recoil: 0.33,
    flags: { contact: true },
  },
  {
    name: 'Psychic',
    type: 'psychic',
    power: 90,
    accuracy: 100,
    damageClass: 'special',
    secondary: { chance: 10, boosts: { 'special-defense': -1 } },
  },
  {
    name: 'Swords Dance',
    type: 'normal',
    power: 0,
    accuracy: 0,
    damageClass: 'status',
    target: 'self',
    boosts: { attack: 2 },
  },
  {
    name: 'Thunder Wave',
    type: 'electric',
    power: 0,
    accuracy: 90,
    damageClass: 'status',
    target: 'opponent',
    inflictStatus: 'paralysis',
  },
  {
    name: 'Toxic',
    type: 'poison',
    power: 0,
    accuracy: 90,
    damageClass: 'status',
    target: 'opponent',
    inflictStatus: 'toxic',
  },
  {
    name: 'Sunny Day',
    type: 'fire',
    power: 0,
    accuracy: 0,
    damageClass: 'status',
    target: 'self',
    setsWeather: 'sun',
  },
  {
    name: 'Rain Dance',
    type: 'water',
    power: 0,
    accuracy: 0,
    damageClass: 'status',
    target: 'self',
    setsWeather: 'rain',
  },
  {
    name: 'Electric Terrain',
    type: 'electric',
    power: 0,
    accuracy: 0,
    damageClass: 'status',
    target: 'self',
    setsTerrain: 'electric',
  },
  {
    name: 'Stealth Rock',
    type: 'rock',
    power: 0,
    accuracy: 0,
    damageClass: 'status',
    target: 'opponent',
    setsHazard: 'stealth-rock',
  },
  {
    name: 'Spikes',
    type: 'ground',
    power: 0,
    accuracy: 0,
    damageClass: 'status',
    target: 'opponent',
    setsHazard: 'spikes',
  },
  {
    name: 'Recover',
    type: 'normal',
    power: 0,
    accuracy: 0,
    damageClass: 'status',
    target: 'self',
    healing: 0.5,
  },
];

const STATS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'] as const;

export function makeMon(rng: SeededRng, n: number): Battler {
  const types = [rng.pick([...POKEMON_TYPES])];
  if (rng.chance(0.5)) types.push(rng.pick([...POKEMON_TYPES]));
  const stats = Object.fromEntries(
    STATS.map((s) => [s, s === 'hp' ? rng.int(120, 220) : rng.int(45, 130)]),
  ) as Battler['stats'];
  const moves: BattleMove[] = [];
  while (moves.length < 4) {
    const m = rng.pick(MOVE_POOL);
    if (!moves.includes(m)) moves.push({ ...m });
  }
  return {
    id: n,
    name: `mon${n}`,
    level: 50,
    types: [...new Set(types)],
    stats,
    moves,
    ability: rng.chance(0.7) ? rng.pick(ABILITY_POOL) : undefined,
    item: rng.chance(0.7) ? rng.pick(ITEM_POOL) : undefined,
  };
}

export function hash(events: readonly BattleEvent[]): string {
  const s = JSON.stringify(events);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${(h >>> 0).toString(16)}:${events.length}`;
}
