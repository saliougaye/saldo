import { CURRENCY_CODES, type CurrencyCode, type Settings } from '@saldo/core';
import {
  type AppLocale,
  currencyName,
  formatMoney,
  LANGUAGE_NAMES,
  type Translate,
} from '@saldo/i18n';

/**
 * What Profilo's panels list, resolved on the server: a client component must not import the root
 * of `@saldo/i18n` (the seven catalogs, the currency names), so it gets plain rows. The time zone
 * list is not here: the browser makes it from `@saldo/i18n/timeZones` (`timeZoneRows`).
 */
export interface ChoiceOption<V extends string = string> {
  value: V;
  label: string;
}

/** The phone's order: Sistema, the two the app was written in first, then the rest by their own names. */
const LANGUAGES = ['system', 'it', 'en', 'de', 'es', 'fr', 'pt', 'sv'] as const satisfies readonly [
  ...Settings['language'][],
];

/** Each language in its own tongue (`LANGUAGE_NAMES`), so someone who opened the wrong one finds theirs. */
export function languageOptions(systemLabel: string): ChoiceOption<Settings['language']>[] {
  return LANGUAGES.map((value) => ({
    value,
    label: value === 'system' ? systemLabel : LANGUAGE_NAMES[value],
  }));
}

const THEMES = ['system', 'dark', 'light'] as const;

export function themeOptions(t: Translate): ChoiceOption<Settings['theme']>[] {
  return THEMES.map((value) => ({ value, label: t(`profile.${value}`) }));
}

export interface CurrencyOption {
  code: CurrencyCode;
  name: string;
  /** Zero as every amount will look: the symbol, where it sits and how many decimals. */
  sample: string;
}

/** Every currency; the panel groups and searches them with core's `groupCurrencies`. */
export function currencyOptions(locale: AppLocale): CurrencyOption[] {
  return CURRENCY_CODES.map((code) => ({
    code,
    name: currencyName(code, locale),
    sample: formatMoney(0, code, locale),
  }));
}
