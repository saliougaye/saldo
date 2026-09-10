import { type DateRange, elapsedDays, isWithin } from './cycle';
import { addDays, type LocalDate } from './dates';
import { countsInTotals, type LedgerTx } from './ledger';

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Rounded arithmetic mean in minor units; null on an empty series. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/** Rounded percentage change vs a baseline; null when there is no usable baseline. */
export function deltaPercent(value: number, baseline: number | null): number | null {
  if (baseline === null || baseline === 0) return null;
  return Math.round(((value - baseline) / baseline) * 100);
}

/** Cumulative counted expenses per elapsed day of the range (index 0 = start day). */
export function dailyCumulative(
  txs: readonly LedgerTx[],
  range: DateRange,
  today: LocalDate,
): number[] {
  const byDay = new Map<LocalDate, number>();
  for (const tx of txs) {
    if (tx.kind !== 'expense' || !isWithin(range, tx.date) || !countsInTotals(tx, today)) continue;
    byDay.set(tx.date, (byDay.get(tx.date) ?? 0) + tx.amount);
  }
  const series: number[] = [];
  let total = 0;
  const elapsed = elapsedDays(range, today);
  for (let i = 0; i < elapsed; i += 1) {
    total += byDay.get(addDays(range.start, i)) ?? 0;
    series.push(total);
  }
  return series;
}

/** Stretches or shrinks a series to `length` points by nearest index. */
export function resampleSeries(series: readonly number[], length: number): number[] {
  if (length <= 0) return [];
  if (series.length === 0) return new Array<number>(length).fill(0);
  if (length === 1) return [series[series.length - 1] ?? 0];
  const last = series.length - 1;
  return Array.from(
    { length },
    (_, i) => series[Math.min(last, Math.round((i * last) / (length - 1)))] ?? 0,
  );
}

/** Point-wise rounded average of several series, each resampled to `length`. */
export function averageSeries(
  seriesList: readonly (readonly number[])[],
  length: number,
): number[] {
  if (seriesList.length === 0) return new Array<number>(Math.max(0, length)).fill(0);
  const resampled = seriesList.map((series) => resampleSeries(series, length));
  return Array.from({ length }, (_, i) =>
    Math.round(resampled.reduce((sum, series) => sum + (series[i] ?? 0), 0) / resampled.length),
  );
}

/** Counted expenses that come from recurring transactions. */
export function committedSpend(
  txs: readonly LedgerTx[],
  range: DateRange,
  today: LocalDate,
): number {
  let total = 0;
  for (const tx of txs) {
    if (tx.kind !== 'expense' || tx.recurrenceId === null) continue;
    if (!isWithin(range, tx.date) || !countsInTotals(tx, today)) continue;
    total += tx.amount;
  }
  return total;
}

/** Scheduled (future dated) expenses in the range that are not excluded. */
export function upcomingExpenses(
  txs: readonly LedgerTx[],
  range: DateRange,
  today: LocalDate,
): number {
  let total = 0;
  for (const tx of txs) {
    if (tx.kind !== 'expense' || tx.excludeFromTotals) continue;
    if (!isWithin(range, tx.date) || tx.date <= today) continue;
    total += tx.amount;
  }
  return total;
}

export interface ProjectionInput {
  spent: number;
  committed: number;
  elapsed: number;
  length: number;
  upcoming: number;
}

/** End-of-cycle projection: discretionary daily rate extended to the remaining days. */
export function projectEndOfCycle(input: ProjectionInput): number {
  const discretionary = Math.max(0, input.spent - input.committed);
  const daysLeft = Math.max(0, input.length - input.elapsed);
  const dailyRate = input.elapsed > 0 ? discretionary / input.elapsed : 0;
  return Math.round(input.spent + dailyRate * daysLeft + input.upcoming);
}
