/**
 * The ten tournament formats. Each mode is a declarative config the trainer
 * generator and the bracket runner read to shape team selection and the rules
 * that bend combat (inverse chart, weather boosts, climbing levels, …).
 */
import type { RoundId } from './types';

export type ModeId =
  | 'classic'
  | 'monotype'
  | 'random'
  | 'little'
  | 'legendary'
  | 'draft'
  | 'survival'
  | 'inverse'
  | 'weather'
  | 'ascent';

/** Which slice of the Pokédex a mode draws competitors from. */
export type PoolFilter = 'all' | 'little' | 'legendary';

export interface TournamentMode {
  readonly id: ModeId;
  readonly name: string;
  readonly icon: string;
  readonly tagline: string;
  readonly description: string;
  /** Pokémon per trainer team. */
  readonly teamSize: number;
  /** Balance teams so total base-stat totals stay close to fair. */
  readonly balanced: boolean;
  readonly pool: PoolFilter;
  /** All competitors share one randomly chosen type. */
  readonly monotype?: boolean;
  /** Player picks their team from a draft pool before the bracket. */
  readonly draft?: boolean;
  /** Survivor: the player's surviving Pokémon keep their HP between rounds. */
  readonly hpCarry?: boolean;
  /** Invert the type chart for every match. */
  readonly inverse?: boolean;
  /** Each match rolls random weather that boosts a matching move type 1.5×. */
  readonly weather?: boolean;
  /** Opponent levels climb each round (Boss Ascent). */
  readonly ascend?: boolean;
  /** Base team level (before any per-round scaling). */
  readonly baseLevel: number;
}

export const TOURNAMENT_MODES: readonly TournamentMode[] = [
  {
    id: 'classic',
    name: 'Classic Cup',
    icon: '🏆',
    tagline: '16 balanced trainers, one champion.',
    description:
      'The standard single-elimination ladder. Sixteen trainers receive randomly built but power-balanced teams. Win four rounds to lift the trophy.',
    teamSize: 3,
    balanced: true,
    pool: 'all',
    baseLevel: 50,
  },
  {
    id: 'monotype',
    name: 'Mono-Type Cup',
    icon: '🎨',
    tagline: 'Everyone fields a single shared type.',
    description:
      'A type is drawn for the whole bracket — including you. Every team is built purely from that type, turning the run into a mirror-matchup mind game.',
    teamSize: 3,
    balanced: true,
    pool: 'all',
    monotype: true,
    baseLevel: 50,
  },
  {
    id: 'random',
    name: 'Random Cup',
    icon: '🎲',
    tagline: 'No balancing. Pure chaos.',
    description:
      'Teams are rolled with zero balancing — you might draw three legendaries or three Magikarp. Embrace the variance.',
    teamSize: 3,
    balanced: false,
    pool: 'all',
    baseLevel: 50,
  },
  {
    id: 'little',
    name: 'Little Cup',
    icon: '🐣',
    tagline: 'Only the smallest contenders.',
    description:
      'Restricted to low base-stat, unevolved Pokémon. Speed and clever typing matter far more than raw power.',
    teamSize: 3,
    balanced: true,
    pool: 'little',
    baseLevel: 30,
  },
  {
    id: 'legendary',
    name: 'Legendary Cup',
    icon: '🌟',
    tagline: 'Titans only.',
    description:
      'A clash of the giants — only high base-stat and legendary Pokémon are eligible. Every hit lands like a meteor.',
    teamSize: 3,
    balanced: true,
    pool: 'legendary',
    baseLevel: 70,
  },
  {
    id: 'draft',
    name: 'Draft Mode',
    icon: '📝',
    tagline: 'Pick your squad from a shared pool.',
    description:
      'Before the bracket begins you draft your three Pokémon from a curated pool. Build your dream team, then prove it.',
    teamSize: 3,
    balanced: true,
    pool: 'all',
    draft: true,
    baseLevel: 50,
  },
  {
    id: 'survival',
    name: 'Survival Gauntlet',
    icon: '💀',
    tagline: 'HP carries over. No mercy.',
    description:
      'Single elimination where your surviving Pokémon keep their HP from one round to the next. There is no healing between matches — endure or fall.',
    teamSize: 3,
    balanced: true,
    pool: 'all',
    hpCarry: true,
    baseLevel: 55,
  },
  {
    id: 'inverse',
    name: 'Inverse Cup',
    icon: '🔄',
    tagline: 'The type chart, flipped.',
    description:
      'Resistances become weaknesses and immunities turn lethal. Everything you know about matchups is upside down.',
    teamSize: 3,
    balanced: true,
    pool: 'all',
    inverse: true,
    baseLevel: 50,
  },
  {
    id: 'weather',
    name: 'Weather Wars',
    icon: '⛈️',
    tagline: 'Every arena, a different sky.',
    description:
      'Each match rolls its own weather, empowering one move type by 50%. Read the forecast and pick your attacks wisely.',
    teamSize: 3,
    balanced: true,
    pool: 'all',
    weather: true,
    baseLevel: 50,
  },
  {
    id: 'ascent',
    name: 'Boss Ascent',
    icon: '⛰️',
    tagline: 'Each round, a stronger wall.',
    description:
      'Your rivals grow more powerful every round — levels climb from the Round of 16 to a towering Final boss. Can you keep pace?',
    teamSize: 3,
    balanced: true,
    pool: 'all',
    ascend: true,
    baseLevel: 45,
  },
];

export function modeById(id: ModeId): TournamentMode {
  const mode = TOURNAMENT_MODES.find((m) => m.id === id);
  if (!mode) throw new Error(`Unknown tournament mode: ${id}`);
  return mode;
}

/**
 * The level opponents fight at in a given round. Most modes are flat; Boss
 * Ascent ramps from the base level up by +6 per round (R16 → Final = +18).
 */
export function levelForRound(mode: TournamentMode, round: RoundId): number {
  if (!mode.ascend) return mode.baseLevel;
  const steps: Record<RoundId, number> = { r16: 0, qf: 1, sf: 2, final: 3 };
  return mode.baseLevel + steps[round] * 6;
}
