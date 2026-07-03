/**
 * Classic RPG mode — framework-free domain types shared by the pure logic
 * (movement, encounters, xp, save) and the Angular feature. Kept dependency-light
 * so every module stays unit-testable.
 */
import type { ItemId as HeldItemId, StatusCondition } from '../engine';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Ambient overworld weather (drives particles + a colour tint). */
export type WeatherKind = 'rain' | 'snow' | 'sun' | 'sandstorm';

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
  | 'revive'
  // Held items (ids match the engine's ItemId so they wire straight into battle).
  | 'leftovers'
  | 'sitrus-berry'
  | 'lum-berry'
  | 'muscle-band'
  | 'wise-glasses'
  // Field items.
  | 'repel'
  // Key items (passive, owned once).
  | 'exp-share'
  | 'old-rod';

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
  /** Engine held item carried into every battle (given/taken via the Bag). */
  heldItem?: HeldItemId;
  /** Rare sparkling variant — kept for life once caught. */
  shiny?: boolean;
}

/* ----------------------------------------------------------------- scripting */

/** A dialogue/event script step run when the player interacts with an NPC/tile. */
export type ScriptNode =
  | { readonly say: string; readonly speaker?: string }
  | { readonly choice: string; readonly options: readonly { readonly label: string; readonly then: readonly ScriptNode[] }[] }
  | { readonly giveItem: ItemId; readonly qty?: number }
  | { readonly giveStarter: true }
  | { readonly startTrainer: true }
  | { readonly rematch: true }
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
  /** Badge required to pass (a ranger turns you back without it). */
  readonly requiresBadge?: string;
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
  /** Probability per qualifying step that a wild encounter triggers (0–1). */
  readonly rate: number;
  readonly table: readonly EncounterEntry[];
  /** Cave mode: encounters roll on every walkable step, not just tall grass. */
  readonly everywhere?: boolean;
}

export interface TrainerDef {
  readonly name: string;
  readonly team: readonly { readonly species: string; readonly level: number }[];
  readonly reward: number;
  readonly intro: string;
  readonly defeat: string;
  readonly flag: string; // set once beaten
  /** Line-of-sight range in tiles — the trainer challenges when it spots you. */
  readonly sight?: number;
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
  /** Wander radius in tiles around the home tile (omit for a static NPC). */
  readonly wander?: number;
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
  /** Wild rolls when fishing off this map's water tiles (needs the Old Rod). */
  readonly fishing?: EncounterZone;
  /** Ambient weather rendered by the overworld (particles + tint). */
  readonly weather?: WeatherKind;
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
  /** Remaining Repel steps (wild encounters are suppressed while > 0). */
  repelSteps?: number;
}
