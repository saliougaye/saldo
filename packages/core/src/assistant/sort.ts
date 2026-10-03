/** Plain code-unit order: what SQLite's BINARY collation gives the phone's `ORDER BY name`. */
export function binary(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** The order the user set, the name breaking a tie. */
export function bySortOrder(
  a: { sortOrder: number; name: string },
  b: { sortOrder: number; name: string },
): number {
  return a.sortOrder - b.sortOrder || binary(a.name, b.name);
}
