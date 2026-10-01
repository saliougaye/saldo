/**
 * Whether what was typed confirms what was asked for: trimmed, case-insensitive, and an empty field
 * never confirms. It imports nothing, so the delete dialog (a client component) can use it — the
 * views that name `expected` reach Drizzle through `auth/email`, which the browser must not load.
 */
export function confirmationMatches(typed: string, expected: string): boolean {
  const given = typed.trim().toLowerCase();
  return given !== '' && given === expected.trim().toLowerCase();
}
