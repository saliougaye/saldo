/**
 * Whether the user typed the confirmation word. Case and surrounding spaces do not count — the
 * word is there to make the deletion deliberate, not to test typing.
 */
export function matchesConfirmWord(typed: string, word: string): boolean {
  return typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
}
