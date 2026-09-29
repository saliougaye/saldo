/** «Saliou Gaye» → «SG»; a single name gives its first two letters. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words.slice(0, 2).map((word) => word.charAt(0))
      : [...(words[0] ?? '')].slice(0, 2);
  return letters.join('').toLocaleUpperCase();
}
