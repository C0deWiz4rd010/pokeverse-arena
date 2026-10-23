/**
 * Core data shapes for the battle engine.
 *
 * The engine is intentionally decoupled from the PokéAPI: callers map API moves
 * and computed stats into these plain structures, so the whole engine stays
 * pure, deterministic and unit-testable. The runtime side-state (status, stages,
 * volatiles) is owned by {@link BattleSide}; the persistent identity (ability,
 * item, moves) lives on {@link Battler}.
 */
import type { PokemonType } from '../../core/utils/type-chart';
import type { StatKey } from '../../core/utils/stat-calculator';
import type { BoostableStat, Stages } from './stat-stages';
import type { StatusCondition } from './status';
import type { Weather } from './weather';
import type { Terrain } from './terrain';
import { freshHazards, type HazardKind, type HazardState } from './hazards';
import { freshScreens, type ScreenKind, type Screens } from './field-effects';
import type { AbilityId } from './abilities';
import type { ItemId } from './items';

export type DamageClass = 'physical' | 'special' | 'status';

export type MoveTarget = 'opponent' | 'self';

/** A move's on-hit chance-based rider (status, stat change, or flinch). */
export interface SecondaryEffect {
  /** Probability 0–100 the secondary fires after a damaging hit. */
  readonly chance: number;
  readonly status?: StatusCondition;
  readonly boosts?: Partial<Record<BoostableStat, number>>;
  /** Whose stats the boosts target (default: the defender). */
  readonly boostTarget?: MoveTarget;
  readonly flinch?: boolean;
  /** Confuses the defender. */
  readonly confusion?: boolean;
}

export interface MoveFlags {
  readonly contact?: boolean;
  readonly sound?: boolean;
  readonly punch?: boolean;
  readonly bite?: boolean;
}

export interface BattleMove {
  name: string;
  type: PokemonType;
  /** Base power; 0 for status / non-damaging moves. */
  power: number;
  /** Accuracy 1–100; use 0 to mean "never misses". */
  accuracy: number;
  damageClass: DamageClass;
  /** Move priority bracket (e.g. Quick Attack = +1). Defaults to 0. */
  priority?: number;
  /** Optional power points; the engine tracks usage when provided. */
  pp?: number;
  /** Who the move acts on (status moves may target self). Defaults to opponent. */
  target?: MoveTarget;
  /** Self-targeting stat boosts applied when a status move is used. */
  boosts?: Partial<Record<BoostableStat, number>>;
  /** Non-volatile status a status move guarantees on the target. */
  inflictStatus?: StatusCondition;
  /** Field state a status move sets. */
  setsWeather?: Weather;
  setsTerrain?: Terrain;
  setsHazard?: HazardKind;
  /** Heal a fraction (0–1) of the user's max HP. */
  healing?: number;
  /** Fraction (0–1) of damage dealt returned to the user as HP. */
  drain?: number;
  /** Fraction (0–1) of damage dealt taken back as recoil. */
  recoil?: number;
  /** Multi-hit strike range, inclusive [min, max]. */
  multiHit?: readonly [number, number];
  /** Extra critical-hit stages (e.g. high-crit moves = 1). */
  critStage?: number;
  /** On-hit chance-based rider. */
  secondary?: SecondaryEffect;
  flags?: MoveFlags;
  /** A status move that confuses the target (Confuse Ray, Swagger's confusion half). */
  inflictConfusion?: boolean;
  /** Raises a side screen for five turns (Reflect, Light Screen, Aurora Veil). */
  setsScreen?: ScreenKind;
  /** Doubles the user's side Speed for four turns. */
  setsTailwind?: boolean;
  /** Reverses the Speed order for five turns. */
  setsTrickRoom?: boolean;
  /** Pay 25% HP for a decoy that soaks hits. */
  substitute?: boolean;
  /** The target can no longer use status moves for three turns. */
  taunt?: boolean;
  /** The target is forced to repeat its last move for three turns. */
  encore?: boolean;
  /** Seeds the target (drains 1/8 HP each turn; Grass types are immune). */
  leechSeed?: boolean;
  /** Blocks every move aimed at the user this turn (fails when spammed). */
  protect?: boolean;
  /** Fixed damage: the user's level, or a flat amount (Seismic Toss, Night Shade). */
  fixedDamage?: 'level' | number;
  /** Damage as a fraction of the target's current HP (Super Fang). */
  fractionDamage?: number;
  /** Removes the target's held item; ×1.5 power when it had one. */
  knockOff?: boolean;
  /** The user must recharge next turn (Hyper Beam, Giga Impact). */
  recharge?: boolean;
  /** Two-turn move: charges first, strikes next turn (skips the charge in `skipWeather`). */
  charge?: { skipWeather?: Weather };
  /** Switches the user out after hitting (U-turn, Volt Switch). */
  pivot?: boolean;
}

export interface Battler {
  id: number;
  name: string;
  level: number;
  types: PokemonType[];
  /** Final computed stats (already includes level / nature / IV / EV). */
  stats: Record<StatKey, number>;
  moves: BattleMove[];
  /** Optional held item (modifies damage, heals, cures, etc.). */
  ability?: AbilityId;
  /** Optional held item id. */
  item?: ItemId;
  /** The type this Pokémon becomes when it Terastallizes (defaults to its first type). */
  teraType?: PokemonType;
  /** Sprite/artwork URL — used by the UI, ignored by the engine. */
  sprite?: string;
  /** Palette hue-rotation in degrees for fused chimeras — UI only. */
  hue?: number;
}

export type SideIndex = 0 | 1;

/** Volatile, single-battle state that clears on switch-out. */
export interface Volatiles {
  flinch: boolean;
  confusionTurns: number;
  leechSeed: boolean;
  protect: boolean;
  /** Index of the move a Choice item / locking effect has locked in (or null). */
  lockedMove: number | null;
  /** Flash Fire is active: the holder's Fire moves are boosted. */
  flashFire?: boolean;
  /** Remaining HP of a Substitute decoy (0 = none). */
  substitute: number;
  /** Turns left on Taunt (status moves are blocked). */
  taunt: number;
  /** Encore: the move forced on the holder and the turns left. */
  encore: { index: number; turns: number } | null;
  /** Index of the move used last (null before the first move). */
  lastMove: number | null;
  /** Index of a two-turn move that is charging (null when idle). */
  charging: number | null;
  /** The holder must skip this turn to recharge. */
  recharging: boolean;
  /** Consecutive successful Protects (each makes the next likelier to fail). */
  protectCount: number;
}

export function freshVolatiles(): Volatiles {
  return {
    flinch: false,
    confusionTurns: 0,
    leechSeed: false,
    protect: false,
    lockedMove: null,
    substitute: 0,
    taunt: 0,
    encore: null,
    lastMove: null,
    charging: null,
    recharging: false,
    protectCount: 0,
  };
}

export interface BattleSide {
  battler: Battler;
  currentHp: number;
  maxHp: number;
  /** Remaining PP per move index (only tracked when a move defines `pp`). */
  pp: number[];
  /** Non-volatile status condition. */
  status: StatusCondition;
  /** Remaining sleep turns (only meaningful while asleep). */
  sleepTurns: number;
  /** Badly-poisoned ramp counter. */
  toxicCounter: number;
  /** In-battle stat stages. */
  stages: Stages;
  /** Volatile per-switch state. */
  volatiles: Volatiles;
  /** Whether the item has already been consumed (berry / Focus Sash). */
  itemUsed: boolean;
  /** Set once the holder Terastallized: its defensive typing is this single type. */
  terastallized?: PokemonType;
  /** True once Speed Boost / per-turn entry abilities have fired this switch. */
  switchedThisTurn?: boolean;
}

/** Shared field conditions plus per-side hazards. */
export interface Field {
  weather: Weather;
  weatherTurns: number;
  terrain: Terrain;
  terrainTurns: number;
  /** Hazards laid on each side (index = the side that gets hit switching in). */
  hazards: [HazardState, HazardState];
  /** Reflect / Light Screen / Aurora Veil turns per side. */
  screens: [Screens, Screens];
  /** Tailwind turns per side. */
  tailwind: [number, number];
  /** Trick Room turns left (0 = off). */
  trickRoom: number;
}

/** A clear field with no hazards. */
export function freshField(): Field {
  return {
    weather: 'none',
    weatherTurns: 0,
    terrain: 'none',
    terrainTurns: 0,
    hazards: [freshHazards(), freshHazards()],
    screens: [freshScreens(), freshScreens()],
    tailwind: [0, 0],
    trickRoom: 0,
  };
}

export type BattleEvent =
  | { kind: 'turn'; turn: number }
  | { kind: 'move'; side: SideIndex; attacker: string; move: string }
  | { kind: 'miss'; side: SideIndex; attacker: string; move: string }
  | {
      kind: 'damage';
      side: SideIndex; // the side that TAKES the damage
      amount: number;
      effectiveness: number;
      crit: boolean;
      remainingHp: number;
      maxHp: number;
    }
  | { kind: 'status'; text: string }
  | { kind: 'status-set'; side: SideIndex; status: StatusCondition; text: string }
  | { kind: 'cure'; side: SideIndex; text: string }
  | { kind: 'stage-change'; side: SideIndex; stat: BoostableStat; delta: number; text: string }
  | {
      kind: 'heal';
      side: SideIndex;
      amount: number;
      remainingHp: number;
      maxHp: number;
      text: string;
    }
  | { kind: 'weather'; weather: Weather; text: string }
  | { kind: 'terrain'; terrain: Terrain; text: string }
  | { kind: 'hazard'; side: SideIndex; hazard: HazardKind; text: string }
  | { kind: 'ability'; side: SideIndex; ability: AbilityId; text: string }
  | { kind: 'item'; side: SideIndex; item: ItemId; text: string }
  | { kind: 'switch'; side: SideIndex; name: string; text: string }
  | { kind: 'flinch'; side: SideIndex; text: string }
  | { kind: 'field'; text: string }
  | { kind: 'substitute'; side: SideIndex; up: boolean; text: string }
  | { kind: 'tera'; side: SideIndex; type: PokemonType; text: string }
  | { kind: 'faint'; side: SideIndex; name: string }
  | { kind: 'end'; winner: SideIndex; loser: SideIndex };

export interface BattleState {
  sides: [BattleSide, BattleSide];
  field: Field;
  turn: number;
  finished: boolean;
  winner: SideIndex | null;
}
