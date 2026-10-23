/**
 * Persisted tournament history & prize helpers, stored through the versioned app
 * store (`pv:tournaments:history`; the old raw key is imported once).
 */
import { appStore } from '../../core/storage/envelope-store';

export interface TournamentRecord {
  /** ISO date the run finished. */
  readonly date: string;
  readonly modeName: string;
  readonly formatName: string;
  /** Field size. */
  readonly field: number;
  /** 1 = champion. */
  readonly placement: number;
  readonly champion: string;
  readonly playerWon: boolean;
  /** Coins awarded for the run (includes any crystal-ball bonus). */
  readonly prize: number;
  /** Crystal-ball pick'em bonus included in `prize` (absent when no hit). */
  readonly pickBonus?: number;
}

const KEY = 'tournaments:history';
const CAP = 30;

export function loadHistory(): TournamentRecord[] {
  const list = appStore.read<unknown>(KEY, []);
  return Array.isArray(list) ? (list as TournamentRecord[]) : [];
}

export function pushHistory(record: TournamentRecord): TournamentRecord[] {
  const list = [record, ...loadHistory()].slice(0, CAP);
  appStore.write(KEY, list);
  return list;
}

/**
 * Prize for a finishing placement in a field. Winner gets the most; everyone who
 * finishes top half gets something. Scales with field size.
 */
export function prizeFor(placement: number, field: number): number {
  if (placement === 1) return 200 + field * 10;
  if (placement === 2) return 100 + field * 4;
  if (placement <= Math.ceil(field / 2)) return 40;
  return 15;
}
