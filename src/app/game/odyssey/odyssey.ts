/**
 * Odyssey — an endless, seeded, wave-based roguelike (PokéRogue-inspired):
 * march through cycling biomes, every victory dazes the foe for a catch
 * attempt, the team levels (and evolves) as the waves climb, and every species
 * you catch is permanently unlocked as a future starter.
 *
 * Pure logic + data — the feature service orchestrates, this module decides.
 */
import { SeededRng } from '../../core/utils/rng';

export type WaveKind = 'wild' | 'elite' | 'boss';

export interface BiomeDef {
  readonly id: string;
  readonly name: string;
  /** CSS color the wave header tints toward. */
  readonly tint: string;
  /** Wild species pool (dex ids). */
  readonly pool: readonly number[];
  /** The guardian fought on this biome's final wave. */
  readonly boss: number;
}

export const BIOMES: readonly BiomeDef[] = [
  { id: 'meadow', name: 'Whisper Meadow', tint: '#63bc5a', pool: [16, 19, 10, 13, 43, 25, 29, 32, 39], boss: 143 },
  { id: 'forest', name: 'Gloomtangle Forest', tint: '#2f855a', pool: [46, 48, 102, 114, 123, 127, 214, 543, 12], boss: 3 },
  { id: 'cavern', name: 'Echo Cavern', tint: '#8b7355', pool: [41, 74, 95, 66, 111, 304, 293, 524, 50], boss: 208 },
  { id: 'coast', name: 'Siren Coast', tint: '#4d90d5', pool: [72, 90, 116, 118, 120, 129, 278, 456, 54], boss: 130 },
  { id: 'volcano', name: 'Cinderpeak', tint: '#e25822', pool: [58, 77, 126, 218, 322, 240, 631, 66, 104], boss: 6 },
  { id: 'tundra', name: 'Frostveil Tundra', tint: '#73cec0', pool: [124, 215, 220, 361, 459, 582, 613, 87, 42], boss: 144 },
  { id: 'ruins', name: 'Hollow Ruins', tint: '#7b6bb0', pool: [92, 200, 353, 355, 425, 562, 607, 63, 96], boss: 94 },
  { id: 'roost', name: "Dragon's Roost", tint: '#0b6dc3', pool: [147, 371, 443, 610, 621, 704, 133, 123, 142], boss: 149 },
];

/** Waves per biome (boss on the last one). */
export const WAVES_PER_BIOME = 10;

/** The biome a 1-based wave belongs to (cycles forever, harder each loop). */
export function biomeForWave(wave: number): BiomeDef {
  const idx = Math.floor((wave - 1) / WAVES_PER_BIOME) % BIOMES.length;
  return BIOMES[idx];
}

/** How many full biome cycles are behind this wave (0 on the first lap). */
export function loopForWave(wave: number): number {
  return Math.floor((wave - 1) / (WAVES_PER_BIOME * BIOMES.length));
}

export function waveKind(wave: number): WaveKind {
  if (wave % WAVES_PER_BIOME === 0) return 'boss';
  if (wave % 5 === 0) return 'elite';
  return 'wild';
}

/** Foe level curve: brisk early, then steady; loops add a hard +15 each. */
export function foeLevel(wave: number): number {
  return Math.min(100, 12 + Math.floor(wave * 1.6) + loopForWave(wave) * 15);
}

export interface WaveSpec {
  readonly wave: number;
  readonly kind: WaveKind;
  readonly biome: BiomeDef;
  /** Dex ids of the foe team (1 wild, 2 elite, 2 boss with the guardian last). */
  readonly species: readonly number[];
  readonly level: number;
  /** Chance (0–1) a thrown ball keeps the dazed lead foe after victory. */
  readonly catchChance: number;
}

/** The fully deterministic spec for a wave of a seeded run. */
export function waveSpec(wave: number, seed: string): WaveSpec {
  const rng = new SeededRng(`${seed}-w${wave}`);
  const biome = biomeForWave(wave);
  const kind = waveKind(wave);
  const level = foeLevel(wave) + (kind === 'elite' ? 2 : kind === 'boss' ? 4 : 0);
  let species: number[];
  if (kind === 'boss') species = [rng.pick(biome.pool), biome.boss];
  else if (kind === 'elite') species = [rng.pick(biome.pool), rng.pick(biome.pool)];
  else species = [rng.pick(biome.pool)];
  const catchChance = kind === 'wild' ? 0.65 : kind === 'elite' ? 0.45 : 0.25;
  return { wave, kind, biome, species, level, catchChance };
}

/** Levels the whole team gains for clearing a wave of `kind`. */
export function levelGain(kind: WaveKind): number {
  return kind === 'boss' ? 3 : kind === 'elite' ? 2 : 1;
}

/* -------------------------------------------------------------- rewards */

export type OdysseyRewardKind = 'heal' | 'balls' | 'candy' | 'item';

export interface OdysseyReward {
  readonly kind: OdysseyRewardKind;
  readonly label: string;
  readonly desc: string;
  /** heal: fraction · balls: count · candy: levels · item: engine item id. */
  readonly payload: number | string;
}

const ITEM_POOL = ['leftovers', 'sitrus-berry', 'lum-berry', 'muscle-band', 'wise-glasses', 'life-orb', 'choice-scarf'] as const;

/** Three distinct reward choices after a cleared wave (seeded). */
export function generateOdysseyRewards(wave: number, seed: string): OdysseyReward[] {
  const rng = new SeededRng(`${seed}-reward-${wave}`);
  const all: OdysseyReward[] = [
    { kind: 'heal', label: 'Take a breather', desc: 'The whole team recovers 40% HP.', payload: 0.4 },
    { kind: 'balls', label: 'Ball cache', desc: 'Pick up 2 Poké Balls.', payload: 2 },
    { kind: 'candy', label: 'Rare Candy', desc: 'One team member gains 2 extra levels.', payload: 2 },
    { kind: 'item', label: 'Found gear', desc: 'A held item for a bare-handed member.', payload: rng.pick([...ITEM_POOL]) },
  ];
  return rng.shuffle(all).slice(0, 3);
}

/* ----------------------------------------------------------------- meta */

export interface OdysseyMeta {
  readonly bestWave: number;
  readonly runs: number;
  /** Species (dex ids) caught at least once — the permanent starter roster. */
  readonly unlocked: readonly number[];
  readonly totalCaught: number;
}

/** Everyone begins with the classic trio + Pikachu. */
export const BASE_STARTERS: readonly number[] = [1, 4, 7, 25];

const KEY = 'odyssey:meta';

export function defaultOdysseyMeta(): OdysseyMeta {
  return { bestWave: 0, runs: 0, unlocked: [], totalCaught: 0 };
}

export function loadOdysseyMeta(): OdysseyMeta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultOdysseyMeta();
    return { ...defaultOdysseyMeta(), ...(JSON.parse(raw) as Partial<OdysseyMeta>) };
  } catch {
    return defaultOdysseyMeta();
  }
}

export function saveOdysseyMeta(meta: OdysseyMeta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
}

/** All starter choices: the base roster plus every species ever caught. */
export function starterRoster(meta: OdysseyMeta): number[] {
  return [...new Set([...BASE_STARTERS, ...meta.unlocked])];
}

/** Register a catch (idempotent per species) — returns a fresh meta. */
export function unlockSpecies(meta: OdysseyMeta, dexId: number): OdysseyMeta {
  const next: OdysseyMeta = {
    ...meta,
    unlocked: meta.unlocked.includes(dexId) ? meta.unlocked : [...meta.unlocked, dexId],
    totalCaught: meta.totalCaught + 1,
  };
  saveOdysseyMeta(next);
  return next;
}

/** Fold a finished run into the meta record. */
export function recordOdysseyRun(meta: OdysseyMeta, waveReached: number): OdysseyMeta {
  const next: OdysseyMeta = { ...meta, bestWave: Math.max(meta.bestWave, waveReached), runs: meta.runs + 1 };
  saveOdysseyMeta(next);
  return next;
}
