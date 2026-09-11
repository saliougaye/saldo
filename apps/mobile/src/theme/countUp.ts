/** Pure arithmetic behind {@link useCountUp}, kept out of the animation module so it can be
 * tested without the Reanimated runtime.
 */
/**
 * Where a count-up sits at progress `t` (0..1), on the same curve the rest of the app uses.
 * Rounded, because a money amount has no fractional minor units to show.
 */
export function countUpValue(from: number, to: number, t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  const eased = 1 - (1 - clamped) ** 3;
  return Math.round(from + (to - from) * eased);
}
