/** A stored row without the stamp: `stampAndApply` mints a new one for every write. */
export function unstamped<T extends { updatedAt: string }>(row: T): Omit<T, 'updatedAt'> {
  const { updatedAt: _stamp, ...rest } = row;
  return rest;
}

/** The row as a tombstone (§7), stamp dropped. */
export function tombstoned<T extends { updatedAt: string; deletedAt: string | null }>(
  row: T,
  at: string,
): Omit<T, 'updatedAt'> & { deletedAt: string } {
  return { ...unstamped(row), deletedAt: at };
}
