export interface UnlockDiff {
  /** Ids newly unlocked since the last check — these get a toast. */
  readonly newly: readonly string[];
  /** What to persist as "seen": exactly the currently unlocked set. */
  readonly nextSeen: readonly string[];
}

/**
 * Compare currently unlocked ids against the persisted "seen" set.
 * `seen === null` means first ever run: baseline silently (no toasts for
 * progress earned before this feature existed). Mirroring `nextSeen` to the
 * current set (rather than a union) means a progress reset re-arms the toasts.
 */
export function diffUnlocked(unlocked: readonly string[], seen: readonly string[] | null): UnlockDiff {
  if (seen === null) return { newly: [], nextSeen: unlocked };
  const seenSet = new Set(seen);
  return { newly: unlocked.filter((id) => !seenSet.has(id)), nextSeen: unlocked };
}
