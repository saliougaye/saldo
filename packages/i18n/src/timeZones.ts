import { type LocalDate, makeLocalDate } from '@saldo/core';
import type { AppLocale } from './format';
import { CITY_NAMES } from './timeZoneCities';
import { TIME_ZONE_GENERIC_NAMES, TIME_ZONES } from './timeZones.generated';

export { TIME_ZONES };

const POSITION = new Map(TIME_ZONES.map((zone, index) => [zone, index]));

/** «Roma», «Zürich», «Los Angeles»: the city a zone is named after, in the app's language. */
export function timeZoneCity(zone: string, locale: AppLocale): string {
  const translated = CITY_NAMES[locale][zone];
  if (translated !== undefined) return translated;
  return (zone.split('/').at(-1) ?? zone).replaceAll('_', ' ');
}

/** «Ora dell’Europa centrale»; undefined for an id CLDR does not list. */
export function timeZoneName(zone: string, locale: AppLocale): string | undefined {
  const position = POSITION.get(zone);
  if (position === undefined) return undefined;
  const table = TIME_ZONE_GENERIC_NAMES[locale];
  const index = table.of[position];
  return index === undefined ? undefined : table.names[index];
}

/** The date and time a clock on the wall shows in a zone. */
export interface WallClock {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  /** 0-23 */
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();

/**
 * One formatter per zone, built once: building them is the expensive part, and the time-zone
 * screen asks for every zone at once. `null` remembers a name `Intl` refused.
 */
function formatterFor(zone: string): Intl.DateTimeFormat | null {
  const cached = formatters.get(zone);
  if (cached !== undefined) return cached;
  let formatter: Intl.DateTimeFormat | null;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  } catch {
    formatter = null;
  }
  formatters.set(zone, formatter);
  return formatter;
}

export function isTimeZone(zone: string): boolean {
  return zone.length > 0 && formatterFor(zone) !== null;
}

/**
 * The wall clock in `zone` at `now`, or null if `Intl` does not know the zone (§17.1.5). This is
 * where an instant becomes a day: the server's «today» and the phone's time-zone screen both read it.
 */
export function wallClock(zone: string, now: Date): WallClock | null {
  const formatter = zone.length > 0 ? formatterFor(zone) : null;
  if (formatter === null) return null;
  const parts = formatter.formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const clock = {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
  return Object.values(clock).every(Number.isInteger) ? clock : null;
}

export function localDateOf(clock: WallClock): LocalDate {
  return makeLocalDate(clock.year, clock.month, clock.day);
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/** `07:04`, 24-hour in every language: the app shows no other clock time to be consistent with. */
export function formatWallTime(clock: WallClock): string {
  return `${pad2(clock.hour)}:${pad2(clock.minute)}`;
}

/** The zone this device or browser runs in, or UTC if it reports nothing usable. */
export function systemTimeZone(): string {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof zone === 'string' && isTimeZone(zone) ? zone : 'UTC';
}
