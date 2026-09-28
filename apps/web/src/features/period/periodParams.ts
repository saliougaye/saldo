import {
  canShiftPeriod,
  type DateRange,
  describePeriod,
  isLocalDate,
  type LocalDate,
  type PeriodDef,
  type PeriodView,
  periodContaining,
  shiftPeriod,
} from '@saldo/core';

/** The query parameter that carries the period, on every screen that has one. */
export const PERIOD_PARAM = 'p';

/**
 * The period a request is reading. `?p=` holds a **date inside** the range rather than an offset: an
 * offset means «three periods before now», which changes meaning at midnight and cannot be shared,
 * while a date is the same period whenever it is opened.
 *
 * Anything unreadable, and anything after the current period (the phone's `MAX_PERIODS_AHEAD`),
 * falls back to the period containing `today` — a hand-typed URL must not be able to show a page a
 * tap could not reach.
 */
export function periodFromParam(
  def: PeriodDef,
  today: LocalDate,
  param: string | undefined,
): PeriodView {
  const current = periodContaining(def, today);
  if (param === undefined || !isLocalDate(param)) return describePeriod(current, today);
  const range = periodContaining(def, param);
  if (range.start > current.start) return describePeriod(current, today);
  return describePeriod(range, today);
}

/** `?p=` for a range, or the bare path when it is the period containing `today`. */
export function periodHref(
  path: string,
  range: DateRange,
  def: PeriodDef,
  today: LocalDate,
  others: Record<string, string> = {},
): string {
  const params = new URLSearchParams(others);
  if (range.start !== periodContaining(def, today).start) params.set(PERIOD_PARAM, range.start);
  const query = params.toString();
  return query === '' ? path : `${path}?${query}`;
}

export interface PeriodSteps {
  previous: string;
  /** `null` while the current period is on screen: there is nothing after it (§6.15). */
  next: string | null;
}

/** The ‹ › of the period header, as links — so they work with no JavaScript and can be opened in a tab. */
export function periodSteps(
  def: PeriodDef,
  range: DateRange,
  today: LocalDate,
  path: string,
  others: Record<string, string> = {},
): PeriodSteps {
  return {
    previous: periodHref(path, shiftPeriod(def, range, -1), def, today, others),
    next: canShiftPeriod(def, range, 1, today)
      ? periodHref(path, shiftPeriod(def, range, 1), def, today, others)
      : null,
  };
}
