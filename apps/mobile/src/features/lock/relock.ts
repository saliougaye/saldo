/** §6.32: re-lock after this long in the background. */
export const LOCK_AFTER_BACKGROUND_MS = 60_000;

/**
 * Whether the app should re-lock, given how long it spent in the background. Kept in its own
 * module with no React Native imports, so the 60-second rule is testable in plain Node.
 */
export function shouldRelock(
  enabled: boolean,
  backgroundedAt: number | null,
  now: number,
  thresholdMs: number = LOCK_AFTER_BACKGROUND_MS,
): boolean {
  if (!enabled || backgroundedAt === null) return false;
  return now - backgroundedAt >= thresholdMs;
}
