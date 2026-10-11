import { type Category, movableTargets } from '@saldo/core';

export interface ArchiveTarget {
  id: string;
  name: string;
  icon: string;
  colorIndex: number;
}

/**
 * Where the transactions of category `id` can move (§5.11): live, same direction, not itself nor
 * its children. Null when the dialog offers no move: nothing uses the category, or no category can
 * take its transactions (the only income category, say). The dialog then shows no «Sposta le
 * transazioni in», rather than a select whose only option is «Nessuna». The archive dialog calls it
 * on the page's categories (`sharedProps`).
 */
export function archiveMoveTargets(
  categories: readonly Category[],
  id: string,
  uses: number,
): ArchiveTarget[] | null {
  if (uses === 0) return null;
  const category = categories.find((row) => row.id === id);
  if (category === undefined) return null;
  const targets = movableTargets(categories, category).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    colorIndex: row.colorIndex,
  }));
  return targets.length === 0 ? null : targets;
}
