import { createHash, randomBytes } from 'node:crypto';

/**
 * Crockford's base32: no `I`, `L`, `O` or `U`, so no two symbols look alike in a message and none
 * of them can spell a word by accident. 32 symbols is exactly 5 bits, which is what lets the
 * generator slice random bytes without biasing the result.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS = 4;
const GROUP_SIZE = 4;
const LENGTH = GROUPS * GROUP_SIZE;

/** What a person may type instead of the symbol that is actually in the alphabet. */
const FOLD: Record<string, string> = { I: '1', L: '1', O: '0', U: 'V' };

/** 16 symbols of a 32-symbol alphabet: 80 bits, formatted `XXXX-XXXX-XXXX-XXXX`. */
export function generateInviteCode(): string {
  const bytes = randomBytes(LENGTH);
  let symbols = '';
  for (const byte of bytes) {
    // The low 5 bits of a uniform byte are themselves uniform over 0-31, so no rejection sampling.
    symbols += ALPHABET[byte & 31] ?? '0';
  }
  const groups: string[] = [];
  for (let i = 0; i < LENGTH; i += GROUP_SIZE) groups.push(symbols.slice(i, i + GROUP_SIZE));
  return groups.join('-');
}

/**
 * The canonical spelling of whatever was typed: upper case, ambiguous characters folded, and
 * everything that is not a symbol removed — so dashes, spaces and a stray full stop from a chat
 * client all lead to the same answer.
 */
export function normaliseInviteCode(raw: string): string {
  let out = '';
  for (const character of raw.toUpperCase()) {
    const folded = FOLD[character] ?? character;
    if (ALPHABET.includes(folded)) out += folded;
  }
  return out;
}

/**
 * The table stores this, never the code: a leaked database backup does not let anybody register.
 * A plain digest and not a password hash on purpose — this is 80 random bits, not a secret a
 * person chose, so there is nothing for a slow hash to defend.
 */
export function hashInviteCode(raw: string): string {
  return createHash('sha256').update(normaliseInviteCode(raw), 'utf8').digest('hex');
}
