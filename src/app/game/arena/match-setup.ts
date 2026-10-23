/**
 * Small pure builders shared by the Arena's gym fights and the Champion Gauntlet: the
 * player's trainer card and the placeholder bracket match the interactive match needs.
 */
import type { Battler } from '../engine';
import { trainerAvatar, type BracketMatch, type Trainer } from '../tournament';

/** The player as a trainer (gold portrait for the Champion Gauntlet). */
export function playerTrainer(team: Battler[], champion = false): Trainer {
  return {
    id: 'player',
    name: 'You',
    title: 'Challenger',
    avatar: trainerAvatar('Champion-Ace', champion),
    team,
    isPlayer: true,
  };
}

/** One-off match record for fights that are not part of a bracket. */
export function dummyMatch(id: string, player: Trainer, foe: Trainer): BracketMatch {
  return { id, round: 'final', slot: 0, a: player, b: foe, winner: null, played: false };
}
