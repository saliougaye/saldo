import type { AppLocale } from '@saldo/i18n/format';
import {
  canonicalTimeZone,
  formatWallTime,
  TIME_ZONES,
  timeZoneCity,
  timeZoneName,
  wallClock,
} from '@saldo/i18n/timeZones';

/** One row of the time zone list (§6.8): the zone, its city and its name in the app's language. */
export interface ZoneRow {
  zone: string;
  city: string;
  /** «Ora dell’Europa centrale»; absent for an id CLDR does not list. */
  name?: string;
}

/**
 * Every zone of the list, sorted by city in the app's language, plus the saved one if the list does
 * not hold it (a zone `Intl` knows and CLDR does not name), so the panel can always show what is
 * selected. Static data: the browser makes it from the tables, and the server sends no list.
 */
export function timeZoneRows(locale: AppLocale, saved: string | null): ZoneRow[] {
  const ids: string[] = [...TIME_ZONES];
  const current = saved === null ? null : canonicalTimeZone(saved);
  if (current !== null && !ids.includes(current)) ids.push(current);
  // The comparison `localeCompare(b, locale)` makes, with one collator for the whole sort.
  const collator = new Intl.Collator(locale);
  return ids
    .map(
      (zone): ZoneRow => ({
        zone,
        city: timeZoneCity(zone, locale),
        name: timeZoneName(zone, locale),
      }),
    )
    .sort((a, b) => collator.compare(a.city, b.city));
}

/** The wall time in each zone at `now`, `07:04`. A zone that `Intl` does not know has no entry. */
export function zoneTimes(zones: readonly string[], now: Date): Map<string, string> {
  const times = new Map<string, string>();
  for (const zone of zones) {
    const clock = wallClock(zone, now);
    if (clock !== null) times.set(zone, formatWallTime(clock));
  }
  return times;
}

/**
 * The minute of `date`, as a whole number: what `useMinute` reads. Every zone's offset is a whole
 * number of minutes, so the first instant of a minute shows the same hours as the rest of it.
 */
export function minuteOf(date: Date): number {
  return Math.floor(date.getTime() / 60_000);
}
