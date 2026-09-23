/**
 * Target cards (§5.13): Budget and Obiettivi on Home feature one item each. The caller ranks its
 * own items into tiers and scores; this applies the tiers and the hysteresis, so the card does not
 * change face at every transaction.
 */

/** At most this many exceptions get a row of their own on a target card. */
export const MAX_TARGET_EVENTS = 3;

/** How much a rival must beat the featured item by: 5% of a limit, or 5 points of a ratio. */
export const FEATURE_MARGIN = 0.05;

export interface RankedTarget {
  id: string;
  /** Higher tiers win outright, whatever the score. */
  tier: number;
  /** Ranks items inside a tier, higher first. */
  score: number;
  /** How far a rival in the same tier must beat this item's score to take its place. */
  margin: number;
}

/**
 * @param previousId the item featured last time (device-local), or null
 * @returns the id to feature, or null when there are no items
 */
export function featuredTarget(
  items: readonly RankedTarget[],
  previousId: string | null,
): string | null {
  let best: RankedTarget | undefined;
  for (const item of items) {
    if (
      best === undefined ||
      item.tier > best.tier ||
      (item.tier === best.tier && item.score > best.score)
    ) {
      best = item;
    }
  }
  if (best === undefined) return null;
  const previous =
    previousId === null ? undefined : items.find((item) => item.id === previousId);
  if (previous === undefined || best.tier > previous.tier) return best.id;
  return best.score - previous.score > previous.margin ? best.id : previous.id;
}
