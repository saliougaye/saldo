/**
 * The "Ripartizione" bar of §5.4: each segment's share of the total, in the order given. Null when
 * there is nothing to split, which callers draw as the empty track.
 */
export function splitShares<T extends { amount: number }>(
  segments: readonly T[],
): { segment: T; share: number }[] | null {
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);
  if (total <= 0) return null;
  return segments.map((segment) => ({ segment, share: segment.amount / total }));
}
