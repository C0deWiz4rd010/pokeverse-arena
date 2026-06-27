/**
 * Run-long relics for the Ascension Spire. Relics modify the economy, the number
 * of reward choices, or the player's team as it is built for each fight. Pure and
 * declarative so they stay testable.
 */
import type { IconName } from '../../core/ui/icon/icons.data';
import type { StatKey } from '../../core/utils/stat-calculator';
import type { Battler, ItemId } from '../engine';

export type RelicId =
  | 'lucky-coin'
  | 'type-lens'
  | 'vitamin-boost'
  | 'leftovers-aura'
  | 'sand-charm'
  | 'focus-charm'
  | 'swift-feather'
  | 'guardian-shell'
  | 'berserker-band'
  | 'mega-battery';

export interface Relic {
  readonly id: RelicId;
  readonly name: string;
  readonly icon: IconName;
  readonly blurb: string;
  /** Coin multiplier (1 = none). */
  readonly coinMult?: number;
  /** Extra reward choices offered after a win. */
  readonly rewardBonus?: number;
  /** Multiply every team member's stats (applied to the live battler). */
  readonly statMult?: Partial<Record<StatKey, number>>;
  /** Give the whole team an item when it has none. */
  readonly grantItem?: ItemId;
  /** Give only the lead an item when it has none. */
  readonly grantLeadItem?: ItemId;
}

const LIST: readonly Relic[] = [
  { id: 'lucky-coin', name: 'Lucky Coin', icon: 'gem', blurb: '+50% coins from every source.', coinMult: 1.5 },
  { id: 'type-lens', name: 'Type Lens', icon: 'search', blurb: 'Reward screens offer one extra choice.', rewardBonus: 1 },
  { id: 'vitamin-boost', name: 'Vitamin Boost', icon: 'heart', blurb: 'Your team gains +10% to all stats.', statMult: allStats(1.1) },
  { id: 'leftovers-aura', name: 'Leftovers Aura', icon: 'leaf', blurb: 'Itemless team members hold Leftovers.', grantItem: 'leftovers' },
  { id: 'sand-charm', name: 'Sand Charm', icon: 'mountain', blurb: 'Your lead holds a Smooth Rock.', grantLeadItem: 'smooth-rock' },
  { id: 'focus-charm', name: 'Focus Charm', icon: 'shield', blurb: 'Your lead holds a Focus Sash.', grantLeadItem: 'focus-sash' },
  { id: 'swift-feather', name: 'Swift Feather', icon: 'feather', blurb: 'Your team gains +15% Speed.', statMult: { speed: 1.15 } },
  { id: 'guardian-shell', name: 'Guardian Shell', icon: 'shield-half', blurb: '+15% Defense and Sp. Def.', statMult: { defense: 1.15, 'special-defense': 1.15 } },
  { id: 'berserker-band', name: 'Berserker Band', icon: 'flame', blurb: '+20% offences, −10% defences.', statMult: { attack: 1.2, 'special-attack': 1.2, defense: 0.9, 'special-defense': 0.9 } },
  { id: 'mega-battery', name: 'Mega Battery', icon: 'zap', blurb: 'Your lead holds Choice Specs.', grantLeadItem: 'choice-specs' },
];

const BY_ID = new Map<RelicId, Relic>(LIST.map((r) => [r.id, r]));

export const RELICS: readonly Relic[] = LIST;

export function relicById(id: RelicId): Relic | undefined {
  return BY_ID.get(id);
}

export function coinMultiplier(relics: readonly RelicId[]): number {
  return relics.reduce((mult, id) => mult * (relicById(id)?.coinMult ?? 1), 1);
}

export function rewardChoiceBonus(relics: readonly RelicId[]): number {
  return relics.reduce((bonus, id) => bonus + (relicById(id)?.rewardBonus ?? 0), 0);
}

/** Apply held relics to a freshly built team (returns new battlers). */
export function applyRelicsToTeam(team: readonly Battler[], relics: readonly RelicId[]): Battler[] {
  const active = relics.map(relicById).filter((r): r is Relic => !!r);
  return team.map((mon, index) => {
    let stats = mon.stats;
    let item = mon.item;
    for (const r of active) {
      if (r.statMult) stats = scaleStats(stats, r.statMult);
      if (r.grantItem && !item) item = r.grantItem;
      if (r.grantLeadItem && index === 0 && !item) item = r.grantLeadItem;
    }
    return { ...mon, stats, item };
  });
}

function scaleStats(stats: Record<StatKey, number>, mult: Partial<Record<StatKey, number>>): Record<StatKey, number> {
  const out = { ...stats };
  for (const key of Object.keys(mult) as StatKey[]) out[key] = Math.round(out[key] * (mult[key] ?? 1));
  return out;
}

function allStats(factor: number): Partial<Record<StatKey, number>> {
  return {
    hp: factor,
    attack: factor,
    defense: factor,
    'special-attack': factor,
    'special-defense': factor,
    speed: factor,
  };
}
