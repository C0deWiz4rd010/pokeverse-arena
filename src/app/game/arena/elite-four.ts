/**
 * The Champion Gauntlet — four Elite trainers plus the Champion, fought
 * back-to-back with no healing between matches (HP/PP/status carry). Unlocks once
 * the player holds enough gym badges. Pure data + helpers.
 */
import type { IconName } from '../../core/ui/icon/icons.data';
import type { PokemonType } from '../../core/utils/type-chart';
import type { LeaderMon } from './gym-leaders';

export interface EliteTrainer {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly blurb: string;
  readonly icon: IconName;
  readonly level: number;
  readonly team: readonly LeaderMon[];
  readonly champion?: boolean;
}

/** Badges required before the gauntlet opens. */
export const GAUNTLET_UNLOCK_BADGES = 8;

export const GAUNTLET: readonly EliteTrainer[] = [
  {
    id: 'e4-aria',
    name: 'Aria',
    title: 'Mistral Dancer',
    blurb: 'The sky is my stage — and you are about to fall.',
    icon: 'feather',
    level: 70,
    team: [
      { species: 'pidgeot', item: 'choice-specs' },
      { species: 'talonflame', item: 'choice-band' },
      { species: 'gyarados', ability: 'intimidate', item: 'leftovers' },
      { species: 'dragonite', ability: 'multiscale', item: 'life-orb' },
    ],
  },
  {
    id: 'e4-morgath',
    name: 'Morgath',
    title: 'Hollow King',
    blurb: 'Every shadow in this hall already knows your name.',
    icon: 'ghost',
    level: 71,
    team: [
      { species: 'mismagius', item: 'life-orb' },
      { species: 'dusknoir', item: 'leftovers' },
      { species: 'chandelure', ability: 'flash-fire', item: 'choice-specs' },
      { species: 'gengar', ability: 'levitate', item: 'life-orb' },
    ],
  },
  {
    id: 'e4-sable',
    name: 'Sable',
    title: 'Umbral Fang',
    blurb: 'I do not need light to find your weakness.',
    icon: 'moon',
    level: 72,
    team: [
      { species: 'weavile', item: 'choice-band' },
      { species: 'umbreon', item: 'leftovers' },
      { species: 'hydreigon', item: 'choice-specs' },
      { species: 'tyranitar', ability: 'sand-stream', item: 'smooth-rock' },
    ],
  },
  {
    id: 'e4-aurelia',
    name: 'Aurelia',
    title: 'Steel Maiden',
    blurb: 'My wall has never been breached. Do not flatter yourself.',
    icon: 'cog',
    level: 73,
    team: [
      { species: 'excadrill', ability: 'sand-rush', item: 'life-orb' },
      { species: 'aggron', ability: 'sturdy', item: 'rocky-helmet' },
      { species: 'scizor', ability: 'technician', item: 'choice-band' },
      { species: 'metagross', item: 'assault-vest' },
    ],
  },
  {
    id: 'champion-reign',
    name: 'Reign',
    title: 'Arena Sovereign',
    blurb: 'Eight badges and four Elites behind you — and yet here we are. Show me everything.',
    icon: 'crown',
    level: 76,
    champion: true,
    team: [
      { species: 'gyarados', ability: 'intimidate', item: 'leftovers' },
      { species: 'gardevoir', item: 'choice-specs' },
      { species: 'tyranitar', ability: 'sand-stream', item: 'smooth-rock' },
      { species: 'metagross', item: 'life-orb' },
      { species: 'garchomp', ability: 'rough-skin', item: 'rocky-helmet' },
      { species: 'dragonite', ability: 'multiscale', item: 'life-orb' },
    ],
  },
];

export const CHAMPION = GAUNTLET[GAUNTLET.length - 1];

/** Whether the gauntlet is open given the set of earned badge types. */
export function gauntletUnlocked(badges: ReadonlySet<PokemonType>): boolean {
  return badges.size >= GAUNTLET_UNLOCK_BADGES;
}
