/** Breathing room between the field and the edge of what the keypad leaves visible. */
export const REVEAL_MARGIN = 16;

export interface RevealBox {
  /** Window coordinates of the field. */
  fieldTop: number;
  fieldBottom: number;
  /** Window coordinates of what stays visible above the footer and the keypad. */
  top: number;
  bottom: number;
}

/**
 * How far to scroll so a field the keypad would cover comes back into view: positive moves the
 * content towards the end of the list, negative back towards its start, 0 leaves it alone.
 *
 * The top wins over the bottom, so a field taller than the gap the keypad leaves shows its first
 * digits rather than its last.
 */
export function revealOffset({ fieldTop, fieldBottom, top, bottom }: RevealBox): number {
  if (fieldTop - REVEAL_MARGIN < top) return fieldTop - REVEAL_MARGIN - top;
  if (fieldBottom + REVEAL_MARGIN > bottom) return fieldBottom + REVEAL_MARGIN - bottom;
  return 0;
}
