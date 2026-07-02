/**
 * The rival — a persistent nemesis who enters every tournament you do. One
 * rival identity is generated per browser profile and stored alongside the
 * run history; they take over the strongest CPU seed each run, grow a little
 * stronger every time you meet, and taunt you based on the head-to-head score.
 * Pure helpers + a thin localStorage layer (same pattern as history.ts).
 */

export interface RivalState {
  readonly v: 1;
  readonly name: string;
  readonly title: string;
  /** Stable DiceBear avatar seed. */
  readonly seed: string;
  /** Head-to-head matches the player has won. */
  readonly playerWins: number;
  /** Head-to-head matches the rival has won. */
  readonly rivalWins: number;
  readonly lastWinner: 'player' | 'rival' | null;
}

const KEY = 'tournaments:rival';

const RIVAL_NAMES = ['Silas', 'Vera', 'Corvin', 'Mara', 'Dorian', 'Selene', 'Jett', 'Anya'];
const RIVAL_TITLES = ['Your Rival', 'The Rival', 'Eternal Rival'];

/** Generate a fresh rival identity (rand ∈ [0,1) — injectable for tests). */
export function createRival(rand: () => number = Math.random): RivalState {
  const name = RIVAL_NAMES[Math.floor(rand() * RIVAL_NAMES.length)];
  return {
    v: 1,
    name,
    title: RIVAL_TITLES[Math.floor(rand() * RIVAL_TITLES.length)],
    seed: `rival-${name}-${Math.floor(rand() * 1e6)}`,
    playerWins: 0,
    rivalWins: 0,
    lastWinner: null,
  };
}

/** Load the persisted rival, creating (and persisting) one on first use. */
export function loadRival(): RivalState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<RivalState>;
      if (s && s.v === 1 && typeof s.name === 'string') return s as RivalState;
    }
  } catch {
    /* storage unavailable */
  }
  const fresh = createRival();
  saveRival(fresh);
  return fresh;
}

export function saveRival(state: RivalState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

/** Record a head-to-head meeting's outcome. */
export function recordRivalMeeting(state: RivalState, playerWon: boolean): RivalState {
  return {
    ...state,
    playerWins: state.playerWins + (playerWon ? 1 : 0),
    rivalWins: state.rivalWins + (playerWon ? 0 : 1),
    lastWinner: playerWon ? 'player' : 'rival',
  };
}

/** Total times the two of you have clashed. */
export function rivalMeetings(state: RivalState): number {
  return state.playerWins + state.rivalWins;
}

/**
 * The rival trains between runs: +1 level per past meeting, capped at +6, so
 * the grudge match stays dangerous as your own results pile up.
 */
export function rivalLevelBoost(state: RivalState): number {
  return Math.min(6, rivalMeetings(state));
}

const FIRST = [
  "So you're the one everyone keeps talking about. Keep up — if you can.",
  'A new face in my bracket? Fine. Remember this loss.',
];
const RIVAL_LEADS = [
  'Our score says it all — {r}–{p}. Care for another lesson?',
  "{r}–{p}. At this point I'm just collecting your badges.",
];
const PLAYER_LEADS = [
  "Don't get comfortable at {p}–{r}. I trained for this exact match.",
  '{p}–{r}? Statistics lie. Today the real me shows up.',
];
const TIED = [
  'Dead even at {p}–{r}. Today we settle it.',
  '{p}–{r}. Everything before this was warm-up.',
];

/** A taunt line for the pre-match panel, themed by the head-to-head record. */
export function rivalTaunt(state: RivalState): string {
  const meetings = rivalMeetings(state);
  const pool =
    meetings === 0
      ? FIRST
      : state.rivalWins > state.playerWins
        ? RIVAL_LEADS
        : state.playerWins > state.rivalWins
          ? PLAYER_LEADS
          : TIED;
  const line = pool[meetings % pool.length];
  return line.replace('{p}', String(state.playerWins)).replace('{r}', String(state.rivalWins));
}
