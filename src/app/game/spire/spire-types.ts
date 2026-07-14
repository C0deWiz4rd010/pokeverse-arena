/**
 * Domain types for the Ascension Spire — a run-based roguelike climb. A run is a
 * sequence of floors; at each floor the player picks one of several offered nodes
 * (battle / elite / rest / treasure / event / shop / boss), keeps HP between
 * fights, drafts rewards, buys from shops and collects run-long relics. Pure data
 * so generation stays seeded and unit-testable.
 */
import type { IconName } from '../../core/ui/icon/icons.data';
import type { AiTier } from '../engine';
import type { RelicId } from './relics';

export type SpireNodeType = 'battle' | 'elite' | 'boss' | 'rest' | 'treasure' | 'event' | 'shop';

/** A CPU encounter spec the feature turns into a real foe team. */
export interface FoeSpec {
  readonly name: string;
  /** National-dex ids to build the foe team from. */
  readonly species: number[];
  readonly level: number;
  readonly aiTier: AiTier;
  readonly boss: boolean;
  /** Secret chimera ace: fuse these two dex ids and append it to the team. */
  readonly fusion?: { readonly head: number; readonly body: number };
}

export interface SpireNode {
  readonly id: string;
  readonly type: SpireNodeType;
  readonly label: string;
  readonly icon: IconName;
  readonly blurb: string;
  /** Present on battle/elite/boss nodes. */
  readonly foe?: FoeSpec;
}

export type RewardKind = 'mon' | 'item' | 'relic' | 'heal' | 'coins' | 'chimera';

export interface RewardOption {
  readonly kind: RewardKind;
  readonly label: string;
  readonly icon: IconName;
  readonly blurb: string;
  /** dex id (mon), ItemId (item), RelicId (relic), amount (heal %, coins). */
  readonly payload: string | number;
}

export interface ShopEntry {
  readonly kind: 'mon' | 'item' | 'relic' | 'heal';
  readonly label: string;
  readonly icon: IconName;
  readonly cost: number;
  readonly payload: string | number;
}

export type RunPhase =
  | 'setup'
  | 'map'
  | 'battle'
  | 'reward'
  | 'shop'
  | 'rest'
  | 'event'
  | 'won'
  | 'lost';

export interface SpireMeta {
  /** Deepest floor ever reached. */
  bestDepth: number;
  /** Total runs started. */
  runs: number;
  /** Times the Spire has been cleared. */
  clears: number;
  /** Lifetime coins banked. */
  bankedCoins: number;
  /** Highest ascension tier unlocked. */
  ascension: number;
  /** Secret chimera bosses defeated (lifetime). */
  chimeraWins: number;
}

export interface RelicState {
  readonly id: RelicId;
}
