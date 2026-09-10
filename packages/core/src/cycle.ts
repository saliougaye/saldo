import {
  addDays,
  addMonths,
  daysInMonth,
  diffDays,
  type LocalDate,
  makeLocalDate,
  parseLocalDate,
  type YearMonth,
} from './dates';

/** Inclusive date range. */
export interface DateRange {
  start: LocalDate;
  end: LocalDate;
}

/** A budgeting "month" that starts on the configured cycle start day. */
export type Cycle = DateRange;

export function assertCycleStartDay(startDay: number): void {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    throw new RangeError(`cycleStartDay must be an integer 1-31, got ${startDay}`);
  }
}

/** Effective start date in a month: the start day clamped to the month length. */
function cycleStartIn(ym: YearMonth, startDay: number): LocalDate {
  return makeLocalDate(ym.year, ym.month, Math.min(startDay, daysInMonth(ym.year, ym.month)));
}

export function cycleContaining(date: LocalDate, startDay: number): Cycle {
  assertCycleStartDay(startDay);
  const { year, month } = parseLocalDate(date);
  const thisMonth: YearMonth = { year, month };
  const startMonth =
    date >= cycleStartIn(thisMonth, startDay) ? thisMonth : addMonths(thisMonth, -1);
  const nextStart = cycleStartIn(addMonths(startMonth, 1), startDay);
  return { start: cycleStartIn(startMonth, startDay), end: addDays(nextStart, -1) };
}

/** Move `delta` cycles forward (positive) or back (negative). */
export function shiftCycle(cycle: Cycle, startDay: number, delta: number): Cycle {
  const { year, month } = parseLocalDate(cycle.start);
  const target = cycleStartIn(addMonths({ year, month }, delta), startDay);
  return cycleContaining(target, startDay);
}

/** The `count` cycles before `cycle`, most recent first. */
export function previousCycles(cycle: Cycle, startDay: number, count: number): Cycle[] {
  const out: Cycle[] = [];
  for (let i = 1; i <= count; i += 1) out.push(shiftCycle(cycle, startDay, -i));
  return out;
}

export function cycleLength(range: DateRange): number {
  return diffDays(range.start, range.end) + 1;
}

/** Days elapsed including today: 0 before the range, full length after it. */
export function elapsedDays(range: DateRange, today: LocalDate): number {
  if (today < range.start) return 0;
  if (today > range.end) return cycleLength(range);
  return diffDays(range.start, today) + 1;
}

export function isWithin(range: DateRange, date: LocalDate): boolean {
  return date >= range.start && date <= range.end;
}
