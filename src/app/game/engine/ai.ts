/**
 * Tiered battle AI. The engine drives every random choice through a
 * {@link SeededRng}, so AI decisions stay reproducible. Higher tiers think
 * harder: `basic` mirrors the legacy "power × STAB × effectiveness" pick,
 * `strong`/`elite` estimate real expected damage, spot guaranteed KOs, value
 * priority finishers and weigh status / setup / field-control utility.
 */
import { SeededRng } from '../../core/utils/rng';
import { computeMoveDamage, moveEffectiveness, stabFor } from './damage';
import type { BattleMove, BattleSide, Field } from './battle-types';
import type { BattleRules } from './rules';

export type AiTier = 'random' | 'basic' | 'strong' | 'elite';

export interface AiContext {
  readonly attacker: BattleSide;
  readonly defender: BattleSide;
  readonly field: Field;
  readonly rng: SeededRng;
  readonly rules?: BattleRules;
}

/** A representative roll for damage estimation (slightly below max). */
const ESTIMATE_ROLL = 0.9;

/** Pick the move index the AI will use this turn. */
export function chooseAiMove(ctx: AiContext, tier: AiTier): number {
  const moves = ctx.attacker.battler.moves;
  const usable = moves.map((_, i) => i).filter((i) => hasPp(ctx.attacker, i));
  const pool = usable.length ? usable : moves.map((_, i) => i);
  if (tier === 'random') return ctx.rng.pick(pool);

  let best = pool[0];
  let bestScore = -Infinity;
  for (const i of pool) {
    // Tiny deterministic jitter breaks ties without changing rankings.
    const score = scoreMove(moves[i], ctx, tier) + ctx.rng.next() * 0.001;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Estimated damage a move would deal right now (no crit, representative roll). */
export function estimateDamage(move: BattleMove, ctx: AiContext): number {
  if (move.power <= 0 || move.damageClass === 'status') return 0;
  return computeMoveDamage({
    attacker: ctx.attacker,
    defender: ctx.defender,
    field: ctx.field,
    move,
    crit: false,
    roll: ESTIMATE_ROLL,
    rules: ctx.rules,
    flashFire: ctx.attacker.volatiles.flashFire,
  }).damage;
}

function hasPp(side: BattleSide, i: number): boolean {
  const pp = side.pp[i];
  return pp === undefined || !Number.isFinite(pp) || pp > 0;
}

function scoreMove(move: BattleMove, ctx: AiContext, tier: AiTier): number {
  if (move.power > 0 && move.damageClass !== 'status') return scoreDamaging(move, ctx, tier);
  return scoreStatus(move, ctx, tier);
}

function scoreDamaging(move: BattleMove, ctx: AiContext, tier: AiTier): number {
  if (tier === 'basic') {
    return (
      move.power *
      stabFor(ctx.attacker.battler, move) *
      moveEffectiveness(move, ctx.defender.battler.types, ctx.rules)
    );
  }
  const dmg = estimateDamage(move, ctx);
  const frac = dmg / Math.max(1, ctx.defender.currentHp);
  let score = Math.min(1, frac) * 100;
  if (dmg >= ctx.defender.currentHp) {
    score += 60; // guaranteed-ish KO
    if ((move.priority ?? 0) > 0) score += 25; // finish before they can act
  }
  return score;
}

function scoreStatus(move: BattleMove, ctx: AiContext, tier: AiTier): number {
  if (tier === 'basic') return 1; // legacy AI barely values status moves
  const { attacker, defender } = ctx;
  const hpFrac = attacker.currentHp / attacker.maxHp;
  let score = 0;

  if (move.healing && hpFrac < 0.65) score += (1 - hpFrac) * 80;

  if (move.boosts && hpFrac > 0.55) {
    score += sumPositiveBoosts(move.boosts) * 16;
  }

  const inflicts = move.inflictStatus ?? move.secondary?.status;
  if (inflicts && inflicts !== 'none' && defender.status === 'none') score += 34;

  if (move.setsWeather || move.setsTerrain || move.setsHazard) score += 24;

  return tier === 'elite' ? score * 1.1 : score;
}

function sumPositiveBoosts(boosts: Partial<Record<string, number>>): number {
  return Object.values(boosts).reduce<number>((sum, v) => sum + Math.max(0, v ?? 0), 0);
}
