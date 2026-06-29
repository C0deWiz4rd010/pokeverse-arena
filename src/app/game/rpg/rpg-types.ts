/**
 * Classic RPG mode — framework-free domain types shared by the pure logic
 * (movement, encounters, xp, save) and the Angular feature. Kept dependency-light
 * so every module stays unit-testable.
 */
import type { StatusCondition } from '../engine';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Visual + behavioural tile kinds (walkability/grass derived in tiles.ts). */
export type TileKind =
  | 'grass'
  | 'tallgrass'
  | 'path'
  | 'sand'
  | 'water'
  | 'tree'
  | 'wall'
  | 'floor'
  | 'rug'
  | 'door'
  | 'sign'
  | 'ledge'
  | 'flower'
  | 'counter'
  | 'roof'
  | 'house'
  | 'fence';

export type ItemId =
  | 'poke-ball'
  | 'great-ball'
  | 'ultra-ball'
  | 'potion'
  | 'super-potion'
  | 'hyper-potion'
  | 'antidote'
  | 'paralyze-heal'
  | 'awakening'
  | 'burn-heal'
  | 'ice-heal'
  | 'full-heal'
  | 'revive';

/** A persisted party/box Pokémon (rebuilt into an engine Battler for battle). */
export interface PartyMon {
  readonly uid: string;
  readonly species: string; // PokéAPI name, lowercase
  readonly dexId: number;
  readonly nickname?: string;
  level: number;
  xp: number; // total accumulated xp
  currentHp: number;
  maxHp: number; // cached for the overworld; recomputed on build
  status: StatusCondition;
}

/* ----------------------------------------------------------------- scripting */

/** A dialogue/event script step run when the player interacts with an NPC/tile. */
export type ScriptNode =
  | { readonly say: string; readonly speaker?: string }
  | { readonly choice: string; readonly options: readonly { readonly label: string; readonly then: readonly ScriptNode[] }[] }
  | { readonly giveItem: ItemId; readonly qty?: number }
  | { readonly giveStarter: true }
  | { readonly startTrainer: true }
  | { readonly heal: true }
  | { readonly openShop: true }
  | { readonly setFlag: string }
  | { readonly badge: string }
  | { readonly starter: true }
  | { readonly ifFlag: string; readonly then: readonly ScriptNode[]; readonly else?: readonly ScriptNode[] };

/* -------------------------------------------------------------------- world */

export interface WarpDef {
  readonly x: number;
  readonly y: number;
  readonly to: string; // target map id
  readonly toX: number;
  readonly toY: number;
  readonly toFacing?: Direction;
}

export interface SignDef {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export interface GroundItemDef {
  readonly x: number;
  readonly y: number;
  readonly item: ItemId;
  readonly qty: number;
  readonly flag: string; // once-only pickup flag
}

export interface EncounterEntry {
  readonly species: string;
  readonly min: number;
  readonly max: number;
  readonly weight: number;
  /** Species capture rate 0–255 (higher = easier). Defaults applied in catch. */
  readonly catchRate?: number;
}
export interface EncounterZone {
  /** Probability per tall-grass step that a wild encounter triggers (0–1). */
  readonly rate: number;
  readonly table: readonly EncounterEntry[];
}

export interface TrainerDef {
  readonly name: string;
  readonly team: readonly { readonly species: string; readonly level: number }[];
  readonly reward: number;
  readonly intro: string;
  readonly defeat: string;
  readonly flag: string; // set once beaten
  /** Gym leaders award a badge on defeat. */
  readonly badge?: string;
  /** Shown as a victory epilogue (e.g. the demo's "to be continued"). */
  readonly ending?: string;
}

export type NpcKind = 'talk' | 'trainer' | 'heal' | 'shop' | 'professor';

export interface NpcDef {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
  /** A character palette key ('boy','girl','oldman','nurse','clerk','prof') or a dex id for a roaming Pokémon. */
  readonly sprite: string;
  readonly kind: NpcKind;
  readonly script: readonly ScriptNode[];
  readonly trainer?: TrainerDef;
}

export interface MapDef {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly outdoor: boolean;
  /** Row-major tile grid: tiles[y][x]. */
  readonly tiles: readonly (readonly TileKind[])[];
  readonly warps: readonly WarpDef[];
  readonly signs: readonly SignDef[];
  readonly npcs: readonly NpcDef[];
  readonly items: readonly GroundItemDef[];
  readonly encounter?: EncounterZone;
}

/* --------------------------------------------------------------------- save */

export interface RpgSave {
  v: number;
  created: number;
  name: string;
  map: string;
  x: number;
  y: number;
  facing: Direction;
  party: PartyMon[];
  box: PartyMon[];
  bag: Partial<Record<ItemId, number>>;
  money: number;
  flags: Record<string, boolean>;
  seen: number[];
  caught: number[];
  badges: string[];
  /** Where a whiteout returns the player (last Pokémon Center). */
  respawn: { map: string; x: number; y: number };
  /** Where an interior's exit door (`@return`) drops the player back outside. */
  doorReturn?: { map: string; x: number; y: number; facing: Direction };
}
