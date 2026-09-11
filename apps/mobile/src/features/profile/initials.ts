/**
 * The two letters the home avatar shows (§6.1): the initials of the signed-in display name, or
 * `S` for Saldo when there is no name to take them from.
 *
 * Two words give one letter each ("Maria Carla" → MC); one word gives its first two ("Ada" → AD),
 * which reads better in a 34px circle than a single letter floating in the middle.
 */
export function initialsFrom(displayName: string | null): string {
  const words = (displayName ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return 'S';
  const [first = '', second] = words;
  const letters = second === undefined ? first.slice(0, 2) : `${first[0] ?? ''}${second[0] ?? ''}`;
  return letters.toLocaleUpperCase();
}
