/**
 * Pure view-model helpers shared by the battle screens: stat-stage chips, per-side volatile chips
 * (confusion, Substitute, Tera …) and the field-condition chips (screens, Tailwind, Trick Room).
 */
import {
  BOOSTABLE_STATS,
  SCREEN_INFO,
  type BattleSide,
  type BoostableStat,
  type Field,
  type ScreenKind,
  type Stages,
} from '../../game/engine';

export interface StageChip {
  readonly label: string;
  readonly value: number;
}

const STAGE_SHORT: Record<BoostableStat, string> = {
  attack: 'Atk',
  defense: 'Def',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'Spe',
  accuracy: 'Acc',
  evasion: 'Eva',
};

/** One chip per stat that is currently boosted or dropped. */
export function stageChips(stages: Stages): StageChip[] {
  return BOOSTABLE_STATS.filter((s) => stages[s] !== 0).map((s) => ({
    label: STAGE_SHORT[s],
    value: stages[s],
  }));
}

export type ChipTone = 'good' | 'bad' | 'info';

export interface StateChip {
  readonly id: string;
  /** English label; templates translate it with the `t` pipe. */
  readonly label: string;
  readonly tone: ChipTone;
}

/** Volatile conditions of a side's active Pokémon, as small status chips. */
export function volatileChips(side: BattleSide | undefined): StateChip[] {
  if (!side) return [];
  const v = side.volatiles;
  const out: StateChip[] = [];
  if (side.terastallized) {
    const type = side.terastallized;
    out.push({
      id: 'tera',
      label: `Tera ${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      tone: 'good',
    });
  }
  if (v.substitute > 0) out.push({ id: 'substitute', label: 'Substitute', tone: 'good' });
  if (v.protect) out.push({ id: 'protect', label: 'Protected', tone: 'good' });
  if (v.confusionTurns > 0) out.push({ id: 'confusion', label: 'Confused', tone: 'bad' });
  if (v.leechSeed) out.push({ id: 'seeded', label: 'Seeded', tone: 'bad' });
  if (v.taunt > 0) out.push({ id: 'taunt', label: 'Taunted', tone: 'bad' });
  if (v.encore) out.push({ id: 'encore', label: 'Encore', tone: 'bad' });
  if (v.charging !== null) out.push({ id: 'charging', label: 'Charging', tone: 'info' });
  if (v.recharging) out.push({ id: 'recharging', label: 'Recharging', tone: 'info' });
  if (v.lockedMove !== null) out.push({ id: 'locked', label: 'Move locked', tone: 'info' });
  return out;
}

export interface FieldChip {
  readonly id: string;
  readonly label: string;
  readonly owner: 'you' | 'foe' | 'field';
  readonly turns: number;
}

/** Screens, Tailwind and Trick Room currently in effect. */
export function fieldChips(field: Field): FieldChip[] {
  const out: FieldChip[] = [];
  const owners = ['you', 'foe'] as const;
  for (const side of [0, 1] as const) {
    const screens = field.screens[side];
    for (const kind of Object.keys(screens) as ScreenKind[]) {
      if (screens[kind] > 0) {
        out.push({
          id: `${kind}-${side}`,
          label: SCREEN_INFO[kind].label,
          owner: owners[side],
          turns: screens[kind],
        });
      }
    }
    if (field.tailwind[side] > 0) {
      out.push({
        id: `tailwind-${side}`,
        label: 'Tailwind',
        owner: owners[side],
        turns: field.tailwind[side],
      });
    }
  }
  if (field.trickRoom > 0) {
    out.push({ id: 'trick-room', label: 'Trick Room', owner: 'field', turns: field.trickRoom });
  }
  return out;
}
