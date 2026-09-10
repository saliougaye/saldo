import type { Cycle, DateRange } from './cycle';
import { isWithin } from './cycle';
import type { LocalDate } from './dates';
import type { Budget } from './entities';
import { isoWeekRange, monthRangeOf, yearRange } from './period';

/**
 * The window a budget is measured over (§5.8): the app's own period, or the week, month or year
 * around a reference day.
 *
 * `'period'` follows whatever kind the user tracks by, so a budget keeps meaning the same thing
 * when they switch from a pay cycle to a month. The other three are **absolute** windows and are
 * deliberately not clipped to the period: an annual budget browsed from a past month still measures
 * that whole year, and a monthly budget inside a pay cycle still measures the calendar month.
 *
 * The one exception is the week of a closed period, where "this week" has no meaning: it becomes
 * that period's last week, clipped to it.
 */
export function budgetRange(period: Budget['period'], range: Cycle, today: LocalDate): DateRange {
  if (period === 'period') return range;
  const isCurrent = isWithin(range, today);
  const reference = isCurrent ? today : range.end;
  if (period === 'year') return yearRange(reference);
  if (period === 'month') return monthRangeOf(monthOf(reference));
  if (isCurrent) return isoWeekRange(reference);
  const lastWeek = isoWeekRange(range.end);
  return {
    start: lastWeek.start < range.start ? range.start : lastWeek.start,
    end: lastWeek.end > range.end ? range.end : lastWeek.end,
  };
}

function monthOf(date: LocalDate): { year: number; month: number } {
  const [year, month] = date.split('-');
  return { year: Number(year), month: Number(month) };
}
