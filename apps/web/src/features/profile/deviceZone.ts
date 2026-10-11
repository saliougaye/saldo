import { TIME_ZONE_ALIASES } from '@saldo/i18n/timeZones';

/**
 * The id the time-zone list holds for a zone the browser reports, or null when it holds none: a
 * browser says Asia/Kolkata where CLDR lists Asia/Calcutta.
 */
export function listedZone(zone: string | undefined, known: ReadonlySet<string>): string | null {
  if (zone === undefined || zone === '') return null;
  const id = Object.hasOwn(TIME_ZONE_ALIASES, zone) ? (TIME_ZONE_ALIASES[zone] ?? zone) : zone;
  return known.has(id) ? id : null;
}
