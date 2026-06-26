/**
 * Entry hazards (Stealth Rock, Spikes, Toxic Spikes). Each side accumulates
 * hazards that bite a Pokémon as it switches in. Pure and deterministic so the
 * switch logic stays unit-testable.
 */
import { effectiveness, type PokemonType } from '../../core/utils/type-chart';
import type { StatusCondition } from './status';
import { isGrounded } from './terrain';

export type HazardKind = 'stealth-rock' | 'spikes' | 'toxic-spikes';

export const HAZARD_INFO: Record<HazardKind, { label: string; maxLayers: number }> = {
  'stealth-rock': { label: 'Stealth Rock', maxLayers: 1 },
  spikes: { label: 'Spikes', maxLayers: 3 },
  'toxic-spikes': { label: 'Toxic Spikes', maxLayers: 2 },
};

/** Per-side hazard layer counts. */
export interface HazardState {
  'stealth-rock': number;
  spikes: number;
  'toxic-spikes': number;
}

export function freshHazards(): HazardState {
  return { 'stealth-rock': 0, spikes: 0, 'toxic-spikes': 0 };
}

/** Add a layer of a hazard, capped at its max; returns whether it stuck. */
export function addHazard(state: HazardState, kind: HazardKind): { state: HazardState; added: boolean } {
  const max = HAZARD_INFO[kind].maxLayers;
  if (state[kind] >= max) return { state, added: false };
  return { state: { ...state, [kind]: state[kind] + 1 }, added: true };
}

/** Spikes damage by layer count (grounded only): 1/8, 1/6, 1/4. */
const SPIKE_FRACTION = [0, 1 / 8, 1 / 6, 1 / 4];

export interface HazardEntry {
  /** Fraction-based damage to apply (already resolved to an HP amount). */
  readonly damage: number;
  /** A status to inflict (toxic spikes), or 'none'. */
  readonly status: StatusCondition;
  /** Log lines for each hazard that triggered. */
  readonly messages: string[];
  /** Whether the hazards were absorbed (poison-type clears toxic spikes). */
  readonly clearsToxicSpikes: boolean;
}

/**
 * Resolve everything that happens to a Pokémon switching into `state` hazards.
 *
 * - Stealth Rock: Rock-type effectiveness × 1/8 of max HP.
 * - Spikes: grounded only, by layer.
 * - Toxic Spikes: grounded only — 1 layer poisons, 2 badly-poisons; a grounded
 *   Poison-type instead *absorbs* (clears) the toxic spikes.
 */
export function resolveSwitchInHazards(
  state: HazardState,
  name: string,
  types: readonly PokemonType[],
  maxHp: number,
): HazardEntry {
  const messages: string[] = [];
  let damage = 0;
  let status: StatusCondition = 'none';
  let clearsToxicSpikes = false;
  const grounded = isGrounded(types);

  if (state['stealth-rock'] > 0) {
    const mult = effectiveness('rock', types);
    const rock = Math.max(1, Math.floor((maxHp * mult) / 8));
    damage += rock;
    messages.push(`Pointed stones dug into ${name}!`);
  }

  if (grounded && state.spikes > 0) {
    const spikes = Math.max(1, Math.floor(maxHp * SPIKE_FRACTION[state.spikes]));
    damage += spikes;
    messages.push(`${name} is hurt by spikes!`);
  }

  if (grounded && state['toxic-spikes'] > 0) {
    if (types.includes('poison')) {
      clearsToxicSpikes = true;
      messages.push(`${name} absorbed the toxic spikes!`);
    } else if (!types.includes('steel') && !types.includes('flying')) {
      status = state['toxic-spikes'] >= 2 ? 'toxic' : 'poison';
    }
  }

  return { damage, status, messages, clearsToxicSpikes };
}

export function hazardSetMessage(kind: HazardKind, foeSide: string): string {
  switch (kind) {
    case 'stealth-rock':
      return `Pointed stones floated up around ${foeSide}!`;
    case 'spikes':
      return `Spikes were scattered around ${foeSide}!`;
    case 'toxic-spikes':
      return `Poison spikes were scattered around ${foeSide}!`;
  }
}
