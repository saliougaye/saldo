// apps/web/src/features/profile/profileRows.ts
import { getCurrency, type Settings } from '@saldo/core';
import { type AppLocale, canonicalTimeZone, LANGUAGE_NAMES, timeZoneCity } from '@saldo/i18n';

export interface PreferenceRow {
  key: 'cycle' | 'currency' | 'language' | 'theme' | 'timeZone';
  /** A dotted i18n path for the label; the page resolves it. */
  labelKey: string;
  /**
   * Already-resolved value where it is a name or a symbol; a raw number where the page formats it.
   * `language: 'system'` and `theme` are themselves i18n keys (`profile.system`, `profile.dark`,
   * `profile.light`) rather than names — the page resolves them, so this stays free of a translator.
   */
  value: string;
  /** False in 0.3d: the settings form is 0.3e. The row still shows what is set. */
  editable: false;
}

/**
 * Profilo's preferences (§6.28): the same five rows as the phone, reading the same synced `settings`,
 * so a change made on the phone is what the web shows on its next request.
 */
export function preferenceRows(settings: Settings, locale: AppLocale): PreferenceRow[] {
  const zone = canonicalTimeZone(settings.timeZone ?? 'UTC');
  return [
    {
      key: 'cycle',
      labelKey: 'profile.cycleStart',
      value: String(settings.cycleStartDay),
      editable: false,
    },
    {
      key: 'currency',
      labelKey: 'profile.currency',
      value: `${getCurrency(settings.currency).symbol} ${settings.currency}`,
      editable: false,
    },
    {
      key: 'language',
      labelKey: 'profile.language',
      value: settings.language === 'system' ? '' : LANGUAGE_NAMES[settings.language],
      editable: false,
    },
    { key: 'theme', labelKey: 'profile.theme', value: settings.theme, editable: false },
    {
      key: 'timeZone',
      labelKey: 'profile.timeZone',
      value: timeZoneCity(zone, locale),
      editable: false,
    },
  ];
}
