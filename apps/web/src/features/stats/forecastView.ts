import type { ForecastPeriod, ForecastRecurrence, MinorUnits } from '@saldo/core';
import { occurrenceDates } from '@saldo/core';

/**
 * One recurrence's contribution to `selected`'s table (§17.1.7): the web's forecast column shows
 * the recurrences behind the numbers the chart already drew, so the phone's forecast sheet gets a
 * web counterpart even though it has no sheet of its own here.
 */
export interface ForecastRecurrenceRow {
  recurrenceId: string;
  /** The template's description; the page resolves the category name itself. */
  description: string;
  categoryId: string | null;
  kind: 'expense' | 'income';
  /** One occurrence's amount. */
  amount: MinorUnits;
  /** How many times it fires inside the period. */
  count: number;
  /** `amount * count`: what the forecast counted for it. */
  total: MinorUnits;
}

export interface ForecastView {
  /** The forecast period the user selected. */
  selected: ForecastPeriod;
  /** `selected`'s income less its expenses: «Netto circa». */
  net: MinorUnits;
  /** All three, oldest first: the table under the chart. */
  periods: readonly ForecastPeriod[];
  /** What repeats inside `selected`, heaviest first; expenses before income on a tie. */
  recurrences: readonly ForecastRecurrenceRow[];
}

/**
 * The forecast column's lower half (§17.1.7): how the forecast is made, the three periods, and
 * what repeats inside the one the user selected. `periods` and `selected` are `forecastPeriods`'s
 * own output — this function never recomputes a total, it only explains one.
 */
export function forecastView(input: {
  recurrences: readonly ForecastRecurrence[];
  periods: readonly ForecastPeriod[];
  selected: ForecastPeriod;
}): ForecastView {
  const { recurrences, periods, selected } = input;

  const rows: ForecastRecurrenceRow[] = [];
  for (const recurrence of recurrences) {
    const { template } = recurrence;
    // Mirrors `countable` in `forecast.ts`'s `scheduledFlows`: a transfer moves money between the
    // user's own accounts and an excluded template was flagged out on purpose, so neither counts
    // here either — the table would otherwise disagree with the totals the chart drew.
    if (
      recurrence.deletedAt !== null ||
      template.kind === 'transfer' ||
      template.excludeFromTotals
    ) {
      continue;
    }
    // Unlike `scheduledFlows`, there is no `horizon` filter here: this table answers «what
    // repeats in this period», and an occurrence the materialiser already wrote as a transaction
    // is still a recurrence the user expects to see. This is the one place this view deliberately
    // differs from the chart's own totals.
    const count = occurrenceDates(recurrence, selected.range.end).filter(
      (date) => date >= selected.range.start,
    ).length;
    if (count === 0) continue;
    rows.push({
      recurrenceId: recurrence.id,
      description: template.description,
      categoryId: template.categoryId,
      kind: template.kind,
      amount: template.amount,
      count,
      total: template.amount * count,
    });
  }

  rows.sort((a, b) => {
    if (a.total !== b.total) return b.total - a.total;
    if (a.kind !== b.kind) return a.kind === 'expense' ? -1 : 1;
    return a.recurrenceId < b.recurrenceId ? -1 : a.recurrenceId > b.recurrenceId ? 1 : 0;
  });

  return { selected, net: selected.income - selected.expenses, periods, recurrences: rows };
}
