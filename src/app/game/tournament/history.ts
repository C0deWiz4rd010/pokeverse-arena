/**
 * Persisted tournament history & prize helpers. Stored in localStorage for now;
 * the progression backbone (profile/save service) folds these in later.
 */

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
  /** Coins awarded for the run. */
  readonly prize: number;
}

const KEY = 'tournaments:history';
const CAP = 30;

export function loadHistory(): TournamentRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list as TournamentRecord[]) : [];
  } catch {
    return [];
  }
}

export function pushHistory(record: TournamentRecord): TournamentRecord[] {
  const list = [record, ...loadHistory()].slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
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
