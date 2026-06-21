/**
 * The nine core Pokémon regions, each mapped to its debut generation and the
 * National Dex range of the species that first appeared there. This static data
 * powers the World Explorer: pick a region to roam its native Pokémon, or search
 * a Pokémon to discover the world it calls home.
 */

import type { IconName } from '../../core/ui/icon/icons.data';

export interface Region {
  /** URL-safe slug, also the PokeAPI generation id source. */
  readonly id: string;
  /** Display name, e.g. "Kanto". */
  readonly name: string;
  /** Debut generation number (1–9), used to query the PokeAPI generation. */
  readonly generation: number;
  /** The mainline games set in this region. */
  readonly games: string;
  /** Inclusive National Dex range of the species that debuted here. */
  readonly dexStart: number;
  readonly dexEnd: number;
  /** Map emblem. */
  readonly icon: IconName;
  /** Themed accent colour (hex). */
  readonly accent: string;
  /** One-line evocative hook. */
  readonly tagline: string;
  /** A short paragraph of flavour. */
  readonly blurb: string;
  /** A signature landmark to set the scene. */
  readonly landmark: string;
}

export const REGIONS: readonly Region[] = [
  {
    id: 'kanto',
    name: 'Kanto',
    generation: 1,
    games: 'Red · Blue · Yellow',
    dexStart: 1,
    dexEnd: 151,
    icon: 'mountain-snow',
    accent: '#ff6b6b',
    tagline: 'Where every legend began.',
    blurb:
      'Rolling routes, the bustling Saffron City and the quiet of Pallet Town. Kanto is the cradle of the journey — 151 originals waiting beyond the tall grass.',
    landmark: 'Mt. Moon',
  },
  {
    id: 'johto',
    name: 'Johto',
    generation: 2,
    games: 'Gold · Silver · Crystal',
    dexStart: 152,
    dexEnd: 251,
    icon: 'fish',
    accent: '#f4d35e',
    tagline: 'Tradition, towers and quiet magic.',
    blurb:
      'A region steeped in history, where the Bell and Burned Towers watch over Ecruteak and legends of rainbow wings drift on the wind.',
    landmark: 'Bell Tower',
  },
  {
    id: 'hoenn',
    name: 'Hoenn',
    generation: 3,
    games: 'Ruby · Sapphire · Emerald',
    dexStart: 252,
    dexEnd: 386,
    icon: 'waves',
    accent: '#4dd0e1',
    tagline: 'Land and sea in perfect balance.',
    blurb:
      'Half ocean, half wild green, Hoenn brims with secret bases and storms on the horizon. The sea route to Sootopolis hides ancient titans below.',
    landmark: 'Sky Pillar',
  },
  {
    id: 'sinnoh',
    name: 'Sinnoh',
    generation: 4,
    games: 'Diamond · Pearl · Platinum',
    dexStart: 387,
    dexEnd: 493,
    icon: 'mountain',
    accent: '#9d8df1',
    tagline: 'Myths older than time itself.',
    blurb:
      'Snowbound peaks crown a region built on creation myths. Atop Mt. Coronet, the lake guardians and the architect of the universe await.',
    landmark: 'Mt. Coronet',
  },
  {
    id: 'unova',
    name: 'Unova',
    generation: 5,
    games: 'Black · White · B2 · W2',
    dexStart: 494,
    dexEnd: 649,
    icon: 'building-2',
    accent: '#7986cb',
    tagline: 'A modern world of black and white.',
    blurb:
      'Skyscrapers, bridges and a sprawling metropolis far from home. Unova asks the hardest questions about truth, ideals and what it means to be a trainer.',
    landmark: 'Skyarrow Bridge',
  },
  {
    id: 'kalos',
    name: 'Kalos',
    generation: 6,
    games: 'X · Y',
    dexStart: 650,
    dexEnd: 721,
    icon: 'landmark',
    accent: '#ec407a',
    tagline: 'Beauty, fashion and Mega power.',
    blurb:
      'Inspired by a land of art and elegance, Kalos sparkles from Lumiose City’s tower to the lavender fields — the birthplace of Mega Evolution.',
    landmark: 'Prism Tower',
  },
  {
    id: 'alola',
    name: 'Alola',
    generation: 7,
    games: 'Sun · Moon · US · UM',
    dexStart: 722,
    dexEnd: 809,
    icon: 'tree-palm',
    accent: '#ffb74d',
    tagline: 'Island trials under endless sun.',
    blurb:
      'Four sun-soaked islands replace gyms with island trials and totem guardians. Familiar Pokémon wear new regional forms beneath the palm trees.',
    landmark: 'Mount Lanakila',
  },
  {
    id: 'galar',
    name: 'Galar',
    generation: 8,
    games: 'Sword · Shield',
    dexStart: 810,
    dexEnd: 905,
    icon: 'castle',
    accent: '#4db6ac',
    tagline: 'Stadiums roar with Dynamax.',
    blurb:
      'A region of industrial grit and sporting glory, where Gym battles fill packed stadiums and Pokémon grow colossal in the Wild Area.',
    landmark: 'Wild Area',
  },
  {
    id: 'paldea',
    name: 'Paldea',
    generation: 9,
    games: 'Scarlet · Violet',
    dexStart: 906,
    dexEnd: 1025,
    icon: 'sunrise',
    accent: '#f06292',
    tagline: 'An open world to roam at will.',
    blurb:
      'A vast open land circling the Great Crater. Three storylines wind across Paldea, from Titan Pokémon to the mysteries of Area Zero.',
    landmark: 'Area Zero',
  },
];

/** Find the region a National Dex number debuted in, or `null` if out of range. */
export function regionForDex(dex: number): Region | null {
  return REGIONS.find((r) => dex >= r.dexStart && dex <= r.dexEnd) ?? null;
}

/** Look up a region by its slug. */
export function regionById(id: string): Region | null {
  return REGIONS.find((r) => r.id === id) ?? null;
}

/** Number of species that debuted in a region. */
export function regionDexCount(region: Region): number {
  return region.dexEnd - region.dexStart + 1;
}
