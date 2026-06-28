/**
 * Party/box helpers for persisted {@link PartyMon}s. Pure and side-effect free
 * (callers persist the returned values).
 */
import type { PartyMon } from './rpg-types';
import { xpForLevel } from './xp';

export const PARTY_MAX = 6;

let uidCounter = 0;
/** A short unique id for a caught mon (stable enough; not security-sensitive). */
export function newUid(): string {
  uidCounter += 1;
  return `m${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

/** Create a fresh party member at a level (XP seeded to that level's floor). */
export function makePartyMon(species: string, dexId: number, level: number, maxHp: number, nickname?: string): PartyMon {
  return {
    uid: newUid(),
    species,
    dexId,
    nickname,
    level,
    xp: xpForLevel(level),
    currentHp: maxHp,
    maxHp,
    status: 'none',
  };
}

export function isFainted(m: PartyMon): boolean {
  return m.currentHp <= 0;
}

export function partyAlive(party: readonly PartyMon[]): boolean {
  return party.some((m) => m.currentHp > 0);
}

/** Index of the first non-fainted member, or -1. */
export function firstAlive(party: readonly PartyMon[]): number {
  return party.findIndex((m) => m.currentHp > 0);
}

export function healMon(m: PartyMon): PartyMon {
  return { ...m, currentHp: m.maxHp, status: 'none' };
}

export function healParty(party: readonly PartyMon[]): PartyMon[] {
  return party.map(healMon);
}

export function partyIsFull(party: readonly PartyMon[]): boolean {
  return party.length >= PARTY_MAX;
}
