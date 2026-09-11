import { weekdayOf } from './calendar';
import {
  assertCycleStartDay,
  cycleContaining,
  type DateRange,
  elapsedDays,
  shiftCycle,
} from './cycle';
import {
  addDays,
  addMonths,
  type LocalDate,
  makeLocalDate,
  parseLocalDate,
  type YearMonth,
} from './dates';

export const PERIOD_KINDS = ['month', 'week', 'cycle', 'year'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export function isPeriodKind(value: string): value is PeriodKind {
  return (PERIOD_KINDS as readonly string[]).includes(value);
}

/**
 * How the user tracks spending (§5.2). One object rather than a kind plus loose arguments, because
 * every function that used to take `cycleStartDay` would otherwise grow a second parameter.
 *
 * `startDay` is read only when `kind === 'cycle'`, and stays 1–28: a start day of 29–31 has no
 * meaning in February, which is why §5.2 clamps it.
 */
export interface PeriodDef {
  kind: PeriodKind;
  startDay: number;
}

/** The ISO week (Monday–Sunday) containing `date` (§5.8). */
export function isoWeekRange(date: LocalDate): DateRange {
  const start = addDays(date, -weekdayOf(date));
  return { start, end: addDays(start, 6) };
}

/** The calendar year containing `date`. */
export function yearRange(date: LocalDate): DateRange {
  const { year } = parseLocalDate(date);
  return { start: makeLocalDate(year, 1, 1), end: makeLocalDate(year, 12, 31) };
}

/** The calendar month of a year-month pair. */
export function monthRangeOf(ym: YearMonth): DateRange {
  const next = addMonths(ym, 1);
  return {
    start: makeLocalDate(ym.year, ym.month, 1),
    // The last day of a month is the day before the first of the next; no month-length table.
    end: addDays(makeLocalDate(next.year, next.month, 1), -1),
  };
}

function monthRange(date: LocalDate): DateRange {
  const { year, month } = parseLocalDate(date);
  return monthRangeOf({ year, month });
}

/** The period that contains `date`. */
export function periodContaining(def: PeriodDef, date: LocalDate): DateRange {
  switch (def.kind) {
    case 'month':
      return monthRange(date);
    case 'week':
      return isoWeekRange(date);
    case 'year':
      return yearRange(date);
    case 'cycle':
      assertCycleStartDay(def.startDay);
      return cycleContaining(date, def.startDay);
  }
}

/**
 * The period `delta` steps away. Stepping by definition, never by day arithmetic: a month is not
 * 30 days, and a cycle starting on the 28th starts earlier than "31 days back" in February.
 */
export function shiftPeriod(def: PeriodDef, range: DateRange, delta: number): DateRange {
  switch (def.kind) {
    case 'month': {
      const { year, month } = parseLocalDate(range.start);
      return monthRangeOf(addMonths({ year, month }, delta));
    }
    case 'week':
      return isoWeekRange(addDays(range.start, delta * 7));
    case 'year':
      return yearRange(makeLocalDate(parseLocalDate(range.start).year + delta, 1, 1));
    case 'cycle':
      assertCycleStartDay(def.startDay);
      return shiftCycle(range, def.startDay, delta);
  }
}

/** The `count` periods before `range`, newest first. */
export function previousPeriods(def: PeriodDef, range: DateRange, count: number): DateRange[] {
  const periods: DateRange[] = [];
  let cursor = range;
  for (let step = 0; step < count; step += 1) {
    cursor = shiftPeriod(def, cursor, -1);
    periods.push(cursor);
  }
  return periods;
}

/** Days the range covers, inclusive of both ends. */
export function periodLength(range: DateRange): number {
  return elapsedDays(range, range.end);
}

export interface PeriodView {
  range: DateRange;
  isCurrent: boolean;
  /** Days from the start through `today`, inclusive; the whole length for a closed period. */
  elapsed: number;
  length: number;
}

/** The period `today` falls in. */
export function currentPeriod(def: PeriodDef, today: LocalDate): PeriodView {
  return describePeriod(periodContaining(def, today), today);
}

/** The same description for a period the user navigated to, which may be closed or in the future. */
export function describePeriod(range: DateRange, today: LocalDate): PeriodView {
  const isCurrent = today >= range.start && today <= range.end;
  return {
    range,
    isCurrent,
    elapsed: isCurrent ? elapsedDays(range, today) : periodLength(range),
    length: periodLength(range),
  };
}

/**
 * How far forward the period navigation goes (§6.15).
 *
 * Not zero: recurrences are materialised to the end of the *next* period (§5.9), and a
 * transaction can be entered with a future date, so the period after this one holds rows the user
 * put there and expects to find. Everything beyond it is empty by construction — no spending has
 * happened, no budget has moved — and a screen that can scroll forever into nothing is a way to
 * get lost, not a feature.
 */
export const MAX_PERIODS_AHEAD = 1;

/**
 * Whether the navigation may move `delta` periods from `range`. Backwards is always allowed: that
 * is history, and it exists.
 */
export function canShiftPeriod(
  def: PeriodDef,
  range: DateRange,
  delta: number,
  today: LocalDate,
): boolean {
  if (delta <= 0) return true;
  const target = shiftPeriod(def, range, delta);
  const limit = shiftPeriod(def, periodContaining(def, today), MAX_PERIODS_AHEAD);
  return target.start <= limit.start;
}
