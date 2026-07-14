import { SeededRng } from '../../core/utils/rng';
import type { Pokemon, PokemonStats } from '../../core/models/pokemon.model';
import type { PokemonType } from '../../core/utils/type-chart';
import type { Battler } from '../engine';

/**
 * Fusion Lab core — pure, deterministic splicing of two Pokémon into one.
 *
 * The *head* donor drives the name prefix, primary type and the mental stats
 * (HP / Sp. Atk / Sp. Def); the *body* donor drives the name suffix, the
 * physique stats (Atk / Def / Speed) and the artwork silhouette, which is
 * re-tinted toward the head's palette via a hue rotation. Everything is
 * seeded on the pair of ids, so the same fusion always comes out identical.
 */

export interface FusionResult {
  /** Spliced display name, e.g. "Bulbizard". */
  name: string;
  /** Dex-style code, e.g. "1.6" (head.body). */
  code: string;
  types: PokemonType[];
  stats: PokemonStats;
  bst: number;
  ability: string;
  heightM: number;
  weightKg: number;
  /** Degrees to `hue-rotate()` the body artwork toward the head's palette. */
  hueShift: number;
  /** Seeded flavor title, e.g. "the Twin-Soul Chimera". */
  epithet: string;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

/** Positions where a new "syllable" starts (a vowel following a non-vowel). */
function syllableStarts(name: string): number[] {
  const starts: number[] = [];
  for (let i = 1; i < name.length; i++) {
    if (VOWELS.has(name[i]) && !VOWELS.has(name[i - 1])) starts.push(i);
  }
  return starts;
}

function nearest(points: number[], target: number, fallback: number): number {
  if (!points.length) return fallback;
  return points.reduce((best, p) => (Math.abs(p - target) < Math.abs(best - target) ? p : best));
}

/**
 * Splice two names into a pronounceable hybrid: the head keeps its opening
 * syllables, the body contributes its ending, and doubled letters at the seam
 * collapse. Deterministic — no randomness involved.
 */
export function spliceName(head: string, body: string): string {
  const a = head.toLowerCase().replace(/[^a-z]/g, '');
  const b = body.toLowerCase().replace(/[^a-z]/g, '');
  if (!a || !b) return a || b || 'fusion';

  const cutA = nearest(syllableStarts(a), Math.ceil(a.length * 0.55), Math.ceil(a.length / 2));
  const cutB = nearest(syllableStarts(b), Math.floor(b.length * 0.45), Math.floor(b.length / 2));

  let prefix = a.slice(0, cutA);
  let suffix = b.slice(cutB);
  if (prefix.length < 2) prefix = a.slice(0, 2);
  if (suffix.length < 2) suffix = b.slice(-2);
  if (prefix[prefix.length - 1] === suffix[0]) suffix = suffix.slice(1);

  let spliced = prefix + suffix;
  if (spliced === a || spliced === b) {
    spliced = a.slice(0, Math.ceil(a.length / 2)) + b.slice(Math.floor(b.length / 2));
  }
  return spliced[0].toUpperCase() + spliced.slice(1);
}

/** Head donates the mental stats (2:1), body donates the physique (2:1). */
export function fuseStats(head: PokemonStats, body: PokemonStats): PokemonStats {
  const mental = (h: number, b: number) => Math.floor((2 * h + b) / 3);
  const physique = (h: number, b: number) => Math.floor((h + 2 * b) / 3);
  return {
    hp: mental(head.hp, body.hp),
    attack: physique(head.attack, body.attack),
    defense: physique(head.defense, body.defense),
    'special-attack': mental(head['special-attack'], body['special-attack']),
    'special-defense': mental(head['special-defense'], body['special-defense']),
    speed: physique(head.speed, body.speed),
  };
}

/** Head's primary type + the first body type that differs (max two, unique). */
export function fuseTypes(head: PokemonType[], body: PokemonType[]): PokemonType[] {
  const primary = head[0] ?? 'normal';
  const second = [...body, ...head.slice(1)].find((t) => t !== primary);
  return second ? [primary, second] : [primary];
}

/** Approximate hue (degrees) of each type's theme color, for palette-shifting. */
const TYPE_HUE: Record<PokemonType, number> = {
  normal: 210, fire: 26, water: 210, electric: 48, grass: 114, ice: 172,
  fighting: 343, poison: 281, ground: 20, flying: 221, psychic: 357, bug: 80,
  rock: 44, ghost: 224, dragon: 208, dark: 270, steel: 196, fairy: 304,
};

/** Signed shortest rotation from the body's palette hue to the head's. */
export function fusionHueShift(headType: PokemonType, bodyType: PokemonType): number {
  let delta = (TYPE_HUE[headType] ?? 0) - (TYPE_HUE[bodyType] ?? 0);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/**
 * Deterministic donor pair for a given seed (e.g. `dailySeed('fusion')`) —
 * the same "Lab Special" for every trainer on the same day. Head and body
 * are guaranteed to differ.
 */
export function dailyFusionPair(seed: string, maxId = 1025): { head: number; body: number } {
  const rng = new SeededRng(seed);
  const head = rng.int(1, maxId);
  let body = rng.int(1, maxId);
  if (body === head) body = (body % maxId) + 1;
  return { head, body };
}

const EPITHETS = [
  'the Twin-Soul Chimera', 'the Impossible Splice', 'the Gene-Woven Wonder',
  'the Laboratory Legend', 'the Double Helix', 'the Spliced Sovereign',
  'the Hybrid Horizon', 'the Mended Myth', 'the Chromatic Chimera',
  'the Fused Frontier', 'the Patchwork Prodigy', 'the Synthesis Spirit',
];

/**
 * Fuse two battle-ready {@link Battler}s into one chimera, using the same
 * head/body split as {@link fusePokemon}: head donates the mind (name prefix,
 * primary type, HP/SpA/SpD and its moveset's front half), body donates the
 * physique (Atk/Def/Speed, the artwork and its palette baseline). Moves are
 * interleaved head-first and deduped to four. The synthetic id keeps chimeras
 * out of the real dex range so UI `track` keys never collide with donors.
 */
export function fuseBattlers(head: Battler, body: Battler): Battler {
  const types = fuseTypes(head.types, body.types);
  const seen = new Set<string>();
  const moves: Battler['moves'] = [];
  const pool = [head.moves, body.moves];
  for (let i = 0; moves.length < 4 && i < 8; i++) {
    const move = pool[i % 2][Math.floor(i / 2)];
    if (move && !seen.has(move.name)) {
      seen.add(move.name);
      moves.push(move);
    }
  }
  return {
    id: head.id * 10_000 + body.id,
    name: spliceName(head.name, body.name),
    level: Math.max(head.level, body.level),
    types,
    stats: fuseStats(head.stats, body.stats),
    moves: moves.length ? moves : head.moves,
    ability: head.ability ?? body.ability,
    sprite: body.sprite,
    hue: fusionHueShift(types[0], body.types[0] ?? 'normal'),
  };
}

/** Deterministic fusion of two fully-loaded Pokémon (order matters: head, body). */
export function fusePokemon(head: Pokemon, body: Pokemon): FusionResult {
  const rng = new SeededRng(`fusion-${head.id}-${body.id}`);
  const stats = fuseStats(head.stats, body.stats);
  const types = fuseTypes(head.types, body.types);
  const abilities = [...head.abilities, ...body.abilities].filter((a) => !a.isHidden);
  const ability = abilities.length
    ? rng.pick(abilities).name
    : (head.abilities[0]?.name ?? body.abilities[0]?.name ?? 'pressure');

  return {
    name: spliceName(head.name, body.name),
    code: `${head.id}.${body.id}`,
    types,
    stats,
    bst: Object.values(stats).reduce((sum, v) => sum + v, 0),
    ability,
    heightM: Math.round(((head.heightM + body.heightM) / 2) * 10) / 10,
    weightKg: Math.round(((head.weightKg + body.weightKg) / 2) * 10) / 10,
    hueShift: fusionHueShift(types[0], body.types[0] ?? 'normal'),
    epithet: rng.pick(EPITHETS),
  };
}
