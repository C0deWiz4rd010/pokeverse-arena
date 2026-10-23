/**
 * Pure trainer helpers for tournaments: CPU identities, DiceBear avatars, the lightweight
 * synthetic move set CPU Pokémon fight with, and small team-math utilities.
 */
import type { StatKey } from '../../core/utils/stat-calculator';
import type { PokemonType } from '../../core/utils/type-chart';
import type { Battler, BattleMove } from '../engine';
import type { Trainer } from './types';

export const TRAINER_TITLES = [
  'Ace Trainer',
  'Veteran',
  'Gym Hopeful',
  'Elite Hopeful',
  'Ranger',
  'Hex Maniac',
  'Black Belt',
  'Cooltrainer',
  'Dragon Tamer',
  'Psychic',
  'Bug Catcher',
  'Champion-in-Training',
  'Ruin Maniac',
  'Beauty',
  'Guitarist',
];

export const TRAINER_NAMES = [
  'Rowan',
  'Sable',
  'Iris',
  'Cyrus',
  'Lyra',
  'Volk',
  'Mira',
  'Ezra',
  'Nova',
  'Kael',
  'Wren',
  'Drake',
  'Suki',
  'Bram',
  'Faye',
  'Onyx',
  'Vesper',
  'Cleo',
  'Roan',
  'Thea',
];

/**
 * Deterministic trainer portrait via the DiceBear avatar library (HTTP API, no
 * bundled assets). The same seed always yields the same character, so a trainer
 * looks identical across the bracket, the match and the champion screen.
 */
export function trainerAvatar(seed: string, accent = false): string {
  const params = new URLSearchParams({
    seed,
    radius: '50',
    backgroundType: 'gradientLinear',
    backgroundColor: accent ? 'ffd166,ffb703,fb8500' : 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c8f7c5',
  });
  return `https://api.dicebear.com/9.x/adventurer/svg?${params.toString()}`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Lightweight, type-accurate move set for CPU Pokémon. Avoids fetching real move
 * data for ~45 Pokémon per tournament — STAB + effectiveness already make these
 * battles meaningful, and it keeps generation to a single request per Pokémon.
 */
export function synthMoves(types: PokemonType[]): BattleMove[] {
  const moves: BattleMove[] = types.map((ty, i) => ({
    name: `${titleCase(ty)} ${i === 0 ? 'Blast' : 'Strike'}`,
    type: ty,
    power: 85,
    accuracy: 100,
    damageClass: i % 2 === 0 ? 'physical' : 'special',
  }));
  moves.push({ name: 'Tackle', type: 'normal', power: 50, accuracy: 100, damageClass: 'physical' });
  return moves;
}

/** Scale every stat by `factor` (level boosts for rivals and Boss Ascent foes). */
export function scaleStats(
  stats: Record<StatKey, number>,
  factor: number,
): Record<StatKey, number> {
  const out = {} as Record<StatKey, number>;
  for (const key of Object.keys(stats) as StatKey[]) out[key] = Math.round(stats[key] * factor);
  return out;
}

/** Sum of every stat on every team member — the seeding / rival-pick yardstick. */
export function teamStrength(t: Trainer): number {
  return t.team.reduce((sum, m) => sum + Object.values(m.stats).reduce((a, b) => a + b, 0), 0);
}

/** The player or the CPU trainer at `index`, with a stable identity. */
export function makeTrainer(index: number, isPlayer: boolean, team: Battler[]): Trainer {
  if (isPlayer) {
    return {
      id: 'player',
      name: 'You',
      title: 'Challenger',
      avatar: trainerAvatar('Champion-Ace', true),
      team,
      isPlayer: true,
    };
  }
  const name = TRAINER_NAMES[(index * 7) % TRAINER_NAMES.length]!;
  return {
    id: `cpu-${index}`,
    name,
    title: TRAINER_TITLES[index % TRAINER_TITLES.length]!,
    avatar: trainerAvatar(`${name}-${index}`),
    team,
  };
}
