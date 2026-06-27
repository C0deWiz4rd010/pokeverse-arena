/**
 * Seeded generators for an Ascension Spire run: the per-floor node choices, the
 * CPU encounters, the reward drafts and the shops. Everything derives from the
 * run seed + floor so a given seed always produces the same climb (daily runs).
 */
import { SeededRng } from '../../core/utils/rng';
import { HELD_ITEMS, type AiTier, type ItemId } from '../engine';
import { RELICS, type RelicId } from './relics';
import { rewardChoiceBonus } from './relics';
import type { FoeSpec, RewardOption, ShopEntry, SpireNode, SpireNodeType } from './spire-types';
import type { IconName } from '../../core/ui/icon/icons.data';

export const TOTAL_FLOORS = 15;
export const BOSS_FLOORS: readonly number[] = [5, 10, 15];
const DEX_MAX = 1025;

const FOE_NAMES = ['Wanderer Kade', 'Seeker Iyla', 'Ronin Vex', 'Adept Sol', 'Nomad Bryn', 'Drifter Wren'];
const BOSS_NAMES = ['Warden of Ash', 'The Tide Sovereign', 'Stormcaller Prime', 'The Hollow Crown'];

const NODE_META: Record<SpireNodeType, { label: string; icon: IconName; blurb: string }> = {
  battle: { label: 'Battle', icon: 'swords', blurb: 'A challenger blocks the stair.' },
  elite: { label: 'Elite', icon: 'skull', blurb: 'A tougher foe — richer rewards.' },
  boss: { label: 'Boss', icon: 'crown', blurb: 'A guardian of the floor.' },
  rest: { label: 'Rest', icon: 'heart', blurb: 'Recover your party’s HP.' },
  treasure: { label: 'Treasure', icon: 'gem', blurb: 'Coins and a free relic.' },
  event: { label: 'Event', icon: 'sparkles', blurb: 'An uncertain encounter.' },
  shop: { label: 'Shop', icon: 'gem', blurb: 'Spend your coins.' },
};

export function isBossFloor(floor: number): boolean {
  return BOSS_FLOORS.includes(floor);
}

export function aiTierForFloor(floor: number): AiTier {
  if (floor <= 4) return 'basic';
  if (floor <= 9) return 'strong';
  return 'elite';
}

export function foeLevel(floor: number, boss: boolean, ascension = 0): number {
  return 28 + floor * 3 + (boss ? 6 : 0) + ascension * 4;
}

/** Build a CPU encounter for a floor. */
export function generateFoe(floor: number, seed: string | number, boss = false, ascension = 0): FoeSpec {
  const rng = new SeededRng(`foe-${seed}-${floor}-${boss ? 'b' : 'n'}`);
  const count = boss ? 4 : 3;
  const species = Array.from({ length: count }, () => rng.int(1, DEX_MAX));
  return {
    name: boss ? rng.pick(BOSS_NAMES) : rng.pick(FOE_NAMES),
    species,
    level: foeLevel(floor, boss, ascension),
    aiTier: boss ? 'elite' : aiTierForFloor(floor),
    boss,
  };
}

/** The 1–3 node choices offered at a floor (a single boss on boss floors). */
export function generateFloorChoices(floor: number, seed: string | number, ascension = 0): SpireNode[] {
  if (isBossFloor(floor)) {
    return [node('boss', floor, generateFoe(floor, seed, true, ascension))];
  }
  const rng = new SeededRng(`map-${seed}-${floor}`);
  const battle = node('battle', floor, generateFoe(floor, seed, false, ascension));
  const second = rng.pick<SpireNodeType>(['elite', 'treasure', 'event']);
  const third = rng.pick<SpireNodeType>(['rest', 'shop', 'treasure']);
  return [
    battle,
    second === 'elite' ? node('elite', floor, generateFoe(floor, `${seed}-e`, false, ascension)) : node(second, floor),
    node(third, floor),
  ];
}

function node(type: SpireNodeType, floor: number, foe?: FoeSpec): SpireNode {
  const m = NODE_META[type];
  return { id: `${type}-${floor}`, type, label: m.label, icon: m.icon, blurb: m.blurb, foe };
}

/** A reward draft after winning a fight. */
export function generateRewards(floor: number, seed: string | number, relics: readonly RelicId[]): RewardOption[] {
  const rng = new SeededRng(`reward-${seed}-${floor}`);
  const count = 3 + rewardChoiceBonus(relics);
  const out: RewardOption[] = [];
  const kinds = rng.shuffle(['mon', 'item', 'relic', 'heal', 'coins'] as const);
  for (let i = 0; i < count; i++) {
    out.push(rewardOption(kinds[i % kinds.length], rng, floor));
  }
  return out;
}

function rewardOption(kind: RewardOption['kind'], rng: SeededRng, floor: number): RewardOption {
  switch (kind) {
    case 'mon': {
      const dex = rng.int(1, DEX_MAX);
      return { kind, label: 'Recruit a Pokémon', icon: 'sparkles', blurb: 'Add a fresh ally to your party.', payload: dex };
    }
    case 'item': {
      const item = rng.pick(HELD_ITEMS).id as ItemId;
      return { kind, label: 'Held Item', icon: 'gem', blurb: 'Equip one of your team.', payload: item };
    }
    case 'relic': {
      const relic = rng.pick(RELICS).id;
      return { kind, label: 'Relic', icon: 'crown', blurb: 'A run-long blessing.', payload: relic };
    }
    case 'heal':
      return { kind, label: 'Potion', icon: 'heart', blurb: 'Heal your party by 40%.', payload: 0.4 };
    default:
      return { kind: 'coins', label: 'Coin Pouch', icon: 'gem', blurb: 'A handful of coins.', payload: 30 + floor * 6 };
  }
}

/** Shop stock for a floor. */
export function generateShop(floor: number, seed: string | number): ShopEntry[] {
  const rng = new SeededRng(`shop-${seed}-${floor}`);
  const items = rng.shuffle(HELD_ITEMS).slice(0, 3);
  const out: ShopEntry[] = items.map((it) => ({
    kind: 'item',
    label: it.name,
    icon: 'gem',
    cost: 40 + floor * 4,
    payload: it.id,
  }));
  out.push({ kind: 'relic', label: rng.pick(RELICS).name, icon: 'crown', cost: 80 + floor * 6, payload: rng.pick(RELICS).id });
  out.push({ kind: 'heal', label: 'Full Restore', icon: 'heart', cost: 50, payload: 1 });
  return out;
}
