import {
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
 * A period as the web reads it, plus how far past the current one it is. The phone has no equivalent
 * of `ahead`: it never navigates past the current period (`MAX_PERIODS_AHEAD` in `@saldo/core` is 0),
 * because a period ahead was an empty card there. The web's cashflow chart is different (§17.1.7): its
 * three forecast columns are real destinations the user can click into, not a sheet, so the picker
 * needs to know it is looking at the second forecast column rather than the first.
 */
export interface WebPeriodView extends PeriodView {
  /** 0 for the current period and any closed one; 1..`reach` for a period that many steps ahead. */
  ahead: number;
}

/**
 * The period a request is reading. `?p=` holds a **date inside** the range rather than an offset: an
 * offset means «three periods before now», which changes meaning at midnight and cannot be shared,
 * while a date is the same period whenever it is opened.
 *
 * `reach` is how many periods after the current one this screen may show (0 by default, matching the
 * phone). Anything unreadable, and anything further ahead than `reach`, falls back to the period
 * containing `today` — a hand-typed URL must not be able to show a page a click could not reach.
 */
export function periodFromParam(
  def: PeriodDef,
  today: LocalDate,
  param: string | undefined,
  reach = 0,
): WebPeriodView {
  const current = periodContaining(def, today);
  if (param === undefined || !isLocalDate(param)) {
    return { ...describePeriod(current, today), ahead: 0 };
  }
  const range = periodContaining(def, param);
  if (range.start <= current.start) return { ...describePeriod(range, today), ahead: 0 };
  for (let ahead = 1; ahead <= reach; ahead += 1) {
    if (shiftPeriod(def, current, ahead).start === range.start) {
      return { ...describePeriod(range, today), ahead };
    }
  }
  return { ...describePeriod(current, today), ahead: 0 };
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

/**
 * The ‹ › of the period header, as links — so they can be opened in a tab, and Back does what the
 * person means. `reach` mirrors `periodFromParam`'s: `next` stays non-null up to that many periods
 * after the current one. It is computed here rather than with `@saldo/core`'s `canShiftPeriod`, which hard-codes
 * the phone's `MAX_PERIODS_AHEAD` (0) — the web's forecast columns give some screens a `reach` above
 * zero without changing what the phone allows. Backwards has no such limit: history always exists.
 */
export function periodSteps(
  def: PeriodDef,
  range: DateRange,
  today: LocalDate,
  path: string,
  others: Record<string, string> = {},
  reach = 0,
): PeriodSteps {
  const limit = shiftPeriod(def, periodContaining(def, today), reach);
  const forward = shiftPeriod(def, range, 1);
  return {
    previous: periodHref(path, shiftPeriod(def, range, -1), def, today, others),
    next: forward.start <= limit.start ? periodHref(path, forward, def, today, others) : null,
  };
}
