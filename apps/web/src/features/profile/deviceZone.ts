/**
 * The id the time-zone list holds for a zone the browser reports, or null when it holds none: a
 * browser says Asia/Kolkata where CLDR lists Asia/Calcutta. The aliases come from the server, which
 * is where the zone tables are.
 */
export function listedZone(
  zone: string | undefined,
  aliases: Readonly<Record<string, string>>,
  known: ReadonlySet<string>,
): string | null {
  if (zone === undefined || zone === '') return null;
  const id = Object.hasOwn(aliases, zone) ? (aliases[zone] ?? zone) : zone;
  return known.has(id) ? id : null;
}
