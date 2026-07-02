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

/** Move a party member to the front (the lead slot). */
export function setLead(party: readonly PartyMon[], i: number): PartyMon[] {
  if (i <= 0 || i >= party.length) return [...party];
  const next = [...party];
  const [mon] = next.splice(i, 1);
  next.unshift(mon);
  return next;
}

/** Move party[i] into the box. Keeps at least one Pokémon in the party. */
export function depositToBox(
  party: readonly PartyMon[],
  box: readonly PartyMon[],
  i: number,
): { party: PartyMon[]; box: PartyMon[]; ok: boolean } {
  if (party.length <= 1 || i < 0 || i >= party.length) return { party: [...party], box: [...box], ok: false };
  const p = [...party];
  const [mon] = p.splice(i, 1);
  return { party: p, box: [...box, mon], ok: true };
}

/** Move box[i] into the party (if there is room). */
export function withdrawFromBox(
  party: readonly PartyMon[],
  box: readonly PartyMon[],
  i: number,
): { party: PartyMon[]; box: PartyMon[]; ok: boolean } {
  if (party.length >= PARTY_MAX || i < 0 || i >= box.length) return { party: [...party], box: [...box], ok: false };
  const b = [...box];
  const [mon] = b.splice(i, 1);
  return { party: [...party, mon], box: b, ok: true };
}

/** Set (or clear) a Pokémon's nickname by uid in a list. */
export function rename(list: readonly PartyMon[], uid: string, name: string): PartyMon[] {
  const nickname = name.trim().slice(0, 16);
  return list.map((m) => (m.uid === uid ? { ...m, nickname: nickname || undefined } : m));
}

/** Equip a held item on party[i]; any previous item is returned for the bag. */
export function giveHeldItem(
  party: readonly PartyMon[],
  i: number,
  item: NonNullable<PartyMon['heldItem']>,
): { party: PartyMon[]; replaced?: NonNullable<PartyMon['heldItem']> } {
  const mon = party[i];
  if (!mon) return { party: [...party] };
  const replaced = mon.heldItem;
  const next = party.map((m, idx) => (idx === i ? { ...m, heldItem: item } : m));
  return replaced ? { party: next, replaced } : { party: next };
}

/** Unequip party[i]'s held item; the taken item goes back to the bag. */
export function takeHeldItem(
  party: readonly PartyMon[],
  i: number,
): { party: PartyMon[]; taken?: NonNullable<PartyMon['heldItem']> } {
  const mon = party[i];
  if (!mon?.heldItem) return { party: [...party] };
  const taken = mon.heldItem;
  const next = party.map((m, idx) => (idx === i ? { ...m, heldItem: undefined } : m));
  return { party: next, taken };
}
