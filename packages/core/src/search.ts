import type { LocalDate } from './dates';
import { normalizeText } from './filters';
import type { MinorDigits, MinorUnits } from './money';

/**
 * The command palette (spec 2026-10-23, §04): what one row can be found by. A transaction also
 * carries its amount, which a query of digits matches, and its date, which breaks a tie.
 */
export interface SearchEntry<T> {
  value: T;
  text: string;
  amount?: MinorUnits;
  date?: LocalDate;
}

/** The scores of the rules, best first. A higher score comes first in its group. */
export const SEARCH_SCORE = {
  exact: 400,
  prefix: 300,
  wordPrefix: 200,
  contains: 100,
  allWords: 50,
  amountExact: 300,
  amountWhole: 200,
} as const;

/** The palette shows at most this many rows in one group. */
export const SEARCH_GROUP_LIMIT = 5;

/** Both sides already through `normalizeText`. The first rule that applies wins. */
function scoreNormalized(query: string, text: string): number | null {
  if (query === '') return null;
  if (text === query) return SEARCH_SCORE.exact;
  if (text.startsWith(query)) return SEARCH_SCORE.prefix;
  const words = query.split(' ');
  const textWords = text.split(' ');
  if (words.every((word) => textWords.some((textWord) => textWord.startsWith(word)))) {
    return SEARCH_SCORE.wordPrefix;
  }
  if (text.includes(query)) return SEARCH_SCORE.contains;
  if (words.every((word) => text.includes(word))) return SEARCH_SCORE.allWords;
  return null;
}

/** How well `text` matches `query` (case, accents and spaces ignored), or null for no match. */
export function textScore(query: string, text: string): number | null {
  return scoreNormalized(normalizeText(query), normalizeText(text));
}

/** The amounts a query of digits stands for, in minor units: a whole number is a range. */
export interface AmountQuery {
  min: MinorUnits;
  max: MinorUnits;
  exact: MinorUnits;
}

/**
 * A query of digits read as an amount of a currency with `minorDigits` decimals. Spaces, signs and
 * currency symbols are dropped; anything else (a letter, a `/`) means it is not an amount. The last
 * separator is the decimal one when 1 to `minorDigits` digits follow it, whichever character it is:
 * `12,50` and `12.50` are the same, and `1.234` groups thousands in a two-decimal currency.
 */
export function amountQuery(query: string, minorDigits: MinorDigits): AmountQuery | null {
  if (!/\d/.test(query) || !/^[\s\d.,+\-−\p{Sc}]+$/u.test(query)) return null;
  const compact = query.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  const last = Math.max(compact.lastIndexOf('.'), compact.lastIndexOf(','));
  const decimals = last === -1 ? '' : compact.slice(last + 1);
  const isDecimal = minorDigits > 0 && last !== -1 && decimals.length <= minorDigits;
  const whole = (isDecimal ? compact.slice(0, last) : compact).replace(/[.,]/g, '');
  const scale = 10 ** minorDigits;
  const exact = Number(whole || '0') * scale;
  if (!Number.isSafeInteger(exact)) return null;
  if (isDecimal) {
    const minor = exact + Number(decimals.padEnd(minorDigits, '0'));
    return { min: minor, max: minor, exact: minor };
  }
  return { min: exact, max: exact + scale - 1, exact };
}

function amountScore(query: AmountQuery | null, amount: MinorUnits | undefined): number | null {
  if (query === null || amount === undefined) return null;
  if (amount === query.exact) return SEARCH_SCORE.amountExact;
  if (amount >= query.min && amount <= query.max) return SEARCH_SCORE.amountWhole;
  return null;
}

/**
 * The values of `entries` that match `query`, best first: the higher score, then the newer date,
 * then the order of `entries` (the order a page shows them in). Nothing for an empty query.
 */
export function rankSearch<T>(
  query: string,
  entries: readonly SearchEntry<T>[],
  options: { minorDigits?: MinorDigits; limit?: number } = {},
): T[] {
  const text = normalizeText(query);
  if (text === '') return [];
  const amount = amountQuery(query, options.minorDigits ?? 2);
  const scored: { entry: SearchEntry<T>; index: number; score: number }[] = [];
  entries.forEach((entry, index) => {
    const score = Math.max(
      scoreNormalized(text, normalizeText(entry.text)) ?? -1,
      amountScore(amount, entry.amount) ?? -1,
    );
    if (score >= 0) scored.push({ entry, index, score });
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.entry.date !== undefined && b.entry.date !== undefined
        ? b.entry.date.localeCompare(a.entry.date)
        : 0) ||
      a.index - b.index,
  );
  return scored.slice(0, options.limit ?? scored.length).map((item) => item.entry.value);
}
