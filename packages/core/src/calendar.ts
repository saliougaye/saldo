import { addDays, daysInMonth, type LocalDate, makeLocalDate, type YearMonth } from './dates';

/** Which column a calendar starts in. Display only: the ISO week (§5.2) is always Monday-based. */
export type FirstWeekday = 'monday' | 'sunday';

export interface CalendarDay {
  date: LocalDate;
  /** False for the leading and trailing days that belong to the neighbouring months. */
  inMonth: boolean;
}

/** Day of week, Monday as 0, without going through a time zone. */
export function weekdayOf(date: LocalDate): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  // getUTCDay is Sunday-based; shift so Monday is 0.
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** Which column `date` falls in, given where the week starts. */
export function columnOf(date: LocalDate, firstWeekday: FirstWeekday): number {
  const monday = weekdayOf(date);
  return firstWeekday === 'monday' ? monday : (monday + 1) % 7;
}

/**
 * The grid a month calendar draws: **always six rows of seven**, padded with the neighbouring
 * months' days. Six rows because a grid that changes height between months makes the sheet jump
 * and moves every control under it; the padding days are marked so they can be drawn faintly.
 */
export function monthGrid(ym: YearMonth, firstWeekday: FirstWeekday): CalendarDay[][] {
  const first = makeLocalDate(ym.year, ym.month, 1);
  const last = daysInMonth(ym.year, ym.month);
  const start = addDays(first, -columnOf(first, firstWeekday));
  const rows: CalendarDay[][] = [];
  for (let row = 0; row < 6; row += 1) {
    const week: CalendarDay[] = [];
    for (let column = 0; column < 7; column += 1) {
      const date = addDays(start, row * 7 + column);
      week.push({ date, inMonth: date >= first && date <= makeLocalDate(ym.year, ym.month, last) });
    }
    rows.push(week);
  }
  return rows;
}
