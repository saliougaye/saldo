/** A calendar date without time zone, formatted `YYYY-MM-DD`. */
export type LocalDate = string;

export interface YearMonth {
  year: number;
  /** 1-12 */
  month: number;
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isLocalDate(value: string): boolean {
  const match = LOCAL_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  if (!isLocalDate(value)) throw new RangeError(`Invalid LocalDate: ${value}`);
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function makeLocalDate(year: number, month: number, day: number): LocalDate {
  const value = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  if (!isLocalDate(value)) throw new RangeError(`Invalid date parts: ${year}-${month}-${day}`);
  return value;
}

function toEpochDay(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function fromEpochDay(epochDay: number): LocalDate {
  const d = new Date(epochDay * MS_PER_DAY);
  return makeLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Number of days from `from` to `to` (negative if `to` is earlier). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export function compareLocalDate(a: LocalDate, b: LocalDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Today's calendar date in the device's local time zone. */
export function todayLocal(now: Date = new Date()): LocalDate {
  return makeLocalDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
