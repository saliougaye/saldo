import { normalizeText } from './filters';

/** The two runs of the time-zone screen (§6.8 Fuso orario). */
export interface TimeZoneGroups {
  /** The saved zone, then the phone's when it differs. */
  top: string[];
  /** Every other zone that matches, in the order given. */
  all: string[];
}

/**
 * What the time-zone screen lists for a search (§6.8). The saved zone is always on top, and the
 * phone's zone under it when they differ: travelling must not bury the check under «R». A zone in
 * `top` is not repeated in `all`, as «Comuni» is not repeated in the currency picker.
 *
 * A zone matches on its IANA id or any label the caller gives it (city, zone name), ignoring case
 * and accents. The caller sorts `zones`, because only it knows the city names it shows.
 */
export function groupTimeZones(input: {
  query: string;
  saved: string | null;
  device: string;
  zones: readonly string[];
  labelsOf: (zone: string) => readonly string[];
}): TimeZoneGroups {
  const needle = normalizeText(input.query);
  const matches = (zone: string) =>
    needle === '' ||
    [zone, ...input.labelsOf(zone)].some((value) => normalizeText(value).includes(needle));
  const top = [...new Set([input.saved ?? input.device, input.device])].filter(matches);
  return { top, all: input.zones.filter((zone) => !top.includes(zone) && matches(zone)) };
}
