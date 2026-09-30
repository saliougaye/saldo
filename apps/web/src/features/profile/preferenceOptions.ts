import { CURRENCY_CODES, type CurrencyCode, type Settings } from '@saldo/core';
import {
  type AppLocale,
  canonicalTimeZone,
  currencyName,
  formatMoney,
  formatWallTime,
  LANGUAGE_NAMES,
  TIME_ZONE_ALIASES,
  TIME_ZONES,
  type Translate,
  timeZoneCity,
  timeZoneName,
  wallClock,
} from '@saldo/i18n';

/**
 * What Profilo's panels list, resolved on the server: a client component must not import the root
 * of `@saldo/i18n` (the seven catalogs, the zone and currency names), so it gets plain rows.
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

export interface ZoneOption {
  zone: string;
  city: string;
  /** «Ora dell’Europa centrale»; absent for an id CLDR does not list. */
  name?: string;
  /** The wall time there at `now`, read once when the page renders, not ticked. */
  time?: string;
}

export interface TimeZoneOptions {
  /** Sorted by city in the app's language, as the phone's list. */
  zones: ZoneOption[];
  /** A current IANA name → the id `zones` lists it under, for the zone the browser reports. */
  aliases: Readonly<Record<string, string>>;
}

/**
 * Every zone of the list, plus the saved one if the list does not hold it (a zone `Intl` knows and
 * CLDR does not name), so the panel can always show what is selected.
 */
export function timeZoneOptions(
  locale: AppLocale,
  now: Date,
  saved: string | null,
): TimeZoneOptions {
  const ids: string[] = [...TIME_ZONES];
  const current = saved === null ? null : canonicalTimeZone(saved);
  if (current !== null && !ids.includes(current)) ids.push(current);
  const zones = ids
    .map((zone): ZoneOption => {
      const clock = wallClock(zone, now);
      return {
        zone,
        city: timeZoneCity(zone, locale),
        name: timeZoneName(zone, locale),
        time: clock === null ? undefined : formatWallTime(clock),
      };
    })
    .sort((a, b) => a.city.localeCompare(b.city, locale));
  return { zones, aliases: TIME_ZONE_ALIASES };
}
