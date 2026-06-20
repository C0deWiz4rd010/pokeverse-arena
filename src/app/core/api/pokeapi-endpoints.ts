/**
 * Central definition of PokeAPI endpoints. Keeping every URL in one place makes
 * the client easy to audit and the cache keys consistent.
 */

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
export const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

export type ResourceId = number | string;

export const endpoints = {
  pokemonList: (limit: number, offset: number) =>
    `${POKEAPI_BASE}/pokemon?limit=${limit}&offset=${offset}`,
  pokemon: (id: ResourceId) => `${POKEAPI_BASE}/pokemon/${id}`,
  pokemonSpecies: (id: ResourceId) => `${POKEAPI_BASE}/pokemon-species/${id}`,
  pokemonForm: (id: ResourceId) => `${POKEAPI_BASE}/pokemon-form/${id}`,
  pokemonEncounters: (id: ResourceId) => `${POKEAPI_BASE}/pokemon/${id}/encounters`,
  evolutionChain: (id: ResourceId) => `${POKEAPI_BASE}/evolution-chain/${id}`,
  type: (id: ResourceId) => `${POKEAPI_BASE}/type/${id}`,
  typeList: () => `${POKEAPI_BASE}/type?limit=100`,
  move: (id: ResourceId) => `${POKEAPI_BASE}/move/${id}`,
  ability: (id: ResourceId) => `${POKEAPI_BASE}/ability/${id}`,
  nature: (id: ResourceId) => `${POKEAPI_BASE}/nature/${id}`,
  natureList: () => `${POKEAPI_BASE}/nature?limit=50`,
  stat: (id: ResourceId) => `${POKEAPI_BASE}/stat/${id}`,
  generation: (id: ResourceId) => `${POKEAPI_BASE}/generation/${id}`,
  generationList: () => `${POKEAPI_BASE}/generation?limit=20`,
  item: (id: ResourceId) => `${POKEAPI_BASE}/item/${id}`,
  berry: (id: ResourceId) => `${POKEAPI_BASE}/berry/${id}`,
  region: (id: ResourceId) => `${POKEAPI_BASE}/region/${id}`,
  regionList: () => `${POKEAPI_BASE}/region?limit=50`,
  location: (id: ResourceId) => `${POKEAPI_BASE}/location/${id}`,
  locationArea: (id: ResourceId) => `${POKEAPI_BASE}/location-area/${id}`,
  raw: (url: string) => url,
} as const;

/** Extract the trailing numeric id from a PokeAPI resource URL. */
export function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  return match ? Number(match[1]) : NaN;
}

/** Official artwork CDN URL for a Pokemon id (used as a reliable fallback). */
export function officialArtwork(id: number, shiny = false): string {
  const dir = shiny ? 'other/official-artwork/shiny' : 'other/official-artwork';
  return `${SPRITE_BASE}/pokemon/${dir}/${id}.png`;
}
