import { normalizeText } from './filters';
import { COMMON_CURRENCY_CODES, CURRENCY_CODES, type CurrencyCode, getCurrency } from './money';

/** The two runs of the currency picker (§6.25): "Comuni" first, then everything else A–Z. */
export interface CurrencyGroups {
  common: CurrencyCode[];
  others: CurrencyCode[];
}

/**
 * What the currency picker shows for a search (§6.25).
 *
 * A currency matches on its code, its symbol or its name in the app's language, ignoring case
 * and accents — "franco" finds CHF, "€" finds EUR, "yen" finds JPY. The common four keep their own
 * group while searching, so a match among them still sits where the user last saw it; the other
 * group never repeats them. An empty search lists every currency.
 */
export function groupCurrencies(
  query: string,
  nameOf: (code: CurrencyCode) => string,
): CurrencyGroups {
  const needle = normalizeText(query);
  const matches = (code: CurrencyCode) =>
    needle === '' ||
    [code, getCurrency(code).symbol, nameOf(code)].some((value) =>
      normalizeText(value).includes(needle),
    );
  const common: readonly CurrencyCode[] = COMMON_CURRENCY_CODES;
  return {
    common: common.filter(matches),
    others: CURRENCY_CODES.filter((code) => !common.includes(code) && matches(code)),
  };
}
