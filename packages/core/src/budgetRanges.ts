import type { Cycle, DateRange } from './cycle';
import { isWithin } from './cycle';
import { addDays, type LocalDate, makeLocalDate, parseLocalDate } from './dates';
import type { Budget } from './entities';

/** Day of week with Monday as 0, from a `LocalDate` without going through a time zone. */
function isoWeekday(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  // getUTCDay is Sunday-based; shift so Monday is 0.
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** The ISO week (Monday–Sunday) containing `date` (§5.8). */
export function isoWeekRange(date: LocalDate): DateRange {
  const start = addDays(date, -isoWeekday(date));
  return { start, end: addDays(start, 6) };
}

/** The calendar year containing `date`. */
export function yearRange(date: LocalDate): DateRange {
  const { year } = parseLocalDate(date);
  return { start: makeLocalDate(year, 1, 1), end: makeLocalDate(year, 12, 31) };
}

/**
 * The range a budget measures (§5.8): the selected cycle, the ISO week containing today, or the
 * calendar year of the cycle's end.
 *
 * For a past cycle the week budget shows *that cycle's last week*, clipped to the cycle, since
 * "this week" is meaningless once the cycle is closed.
 */
export function budgetRange(period: Budget['period'], cycle: Cycle, today: LocalDate): DateRange {
  if (period === 'cycle') return cycle;
  if (period === 'year') return yearRange(cycle.end);
  if (isWithin(cycle, today)) return isoWeekRange(today);
  const lastWeek = isoWeekRange(cycle.end);
  return {
    start: lastWeek.start < cycle.start ? cycle.start : lastWeek.start,
    end: lastWeek.end > cycle.end ? cycle.end : lastWeek.end,
  };
}
