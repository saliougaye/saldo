// apps/web/src/features/profile/profileRows.ts
import { getCurrency, type Settings } from '@saldo/core';
import { type AppLocale, canonicalTimeZone, LANGUAGE_NAMES, timeZoneCity } from '@saldo/i18n';

/** The five preferences, in the phone's order; each is also the `?edit=` value that opens its panel. */
export const PREFERENCE_KEYS = ['period', 'currency', 'language', 'theme', 'timeZone'] as const;
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export const PREFERENCES_PATH = '/profile/preferences';

export interface PreferenceRow {
  key: PreferenceKey;
  /** A dotted i18n path for the label; the page resolves it. */
  labelKey: string;
  /**
   * Already-resolved value where it is a name or a symbol; a raw number where the page formats it.
   * `language: 'system'` and `theme` are themselves i18n keys (`profile.system`, `profile.dark`,
   * `profile.light`) rather than names — the page resolves them, so this stays free of a translator.
   */
  value: string;
  /** Where the row goes: the same page with its panel open. */
  href: string;
}

/**
 * Profilo's preferences (§6.28): the same five rows as the phone, reading the same synced `settings`,
 * so a change made on the phone is what the web shows on its next request. The period's row shows
 * the kind; the page adds the start day when the kind is the cycle, which is the only kind that has one.
 */
export function preferenceRows(settings: Settings, locale: AppLocale): PreferenceRow[] {
  const zone = canonicalTimeZone(settings.timeZone ?? 'UTC');
  const values: Record<PreferenceKey, { labelKey: string; value: string }> = {
    period: { labelKey: 'period.title', value: settings.periodKind },
    currency: {
      labelKey: 'profile.currency',
      value: `${getCurrency(settings.currency).symbol} ${settings.currency}`,
    },
    language: {
      labelKey: 'profile.language',
      value: settings.language === 'system' ? '' : LANGUAGE_NAMES[settings.language],
    },
    theme: { labelKey: 'profile.theme', value: settings.theme },
    timeZone: { labelKey: 'profile.timeZone', value: timeZoneCity(zone, locale) },
  };
  return PREFERENCE_KEYS.map((key) => ({
    key,
    ...values[key],
    href: `${PREFERENCES_PATH}?edit=${key}`,
  }));
}
