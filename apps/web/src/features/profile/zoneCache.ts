import type { AppLocale } from '@saldo/i18n/format';
import { timeZoneRows, type ZoneRow, zoneTimes } from './timeZoneRows';

/**
 * The browser's copy of the time zone list and of its hours, kept between renders. `Intl` makes
 * them slowly — 418 formatters, then 418 wall clocks — and the Preferences page makes them in idle
 * time (`warmTimeZones`), so a click on «Fuso orario» finds them ready.
 */

let rows: { key: string; value: ZoneRow[] } | null = null;

/** `timeZoneRows`, made once for a language and a saved zone. */
export function cachedTimeZoneRows(locale: AppLocale, saved: string | null): ZoneRow[] {
  const key = `${locale} ${saved ?? ''}`;
  if (rows?.key !== key) rows = { key, value: timeZoneRows(locale, saved) };
  return rows.value;
}

/** The hours of one minute, zone by zone; null for a zone that `Intl` does not know. */
let hours: { minute: number; byZone: Map<string, string | null> } = {
  minute: -1,
  byZone: new Map(),
};

/** `zoneTimes` at the first instant of `minute`, with the hours of that minute that are known. */
export function cachedZoneTimes(zones: readonly string[], minute: number): Map<string, string> {
  if (hours.minute !== minute) hours = { minute, byZone: new Map() };
  const missing = zones.filter((zone) => !hours.byZone.has(zone));
  const found = zoneTimes(missing, new Date(minute * 60_000));
  for (const zone of missing) hours.byZone.set(zone, found.get(zone) ?? null);
  const out = new Map<string, string>();
  for (const zone of zones) {
    const time = hours.byZone.get(zone);
    if (time !== undefined && time !== null) out.set(zone, time);
  }
  return out;
}
