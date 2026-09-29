import {
  accountBalances,
  type DateRange,
  type ForecastPeriod,
  forecastPeriods,
  type LocalDate,
  netWorth,
  type PeriodDef,
  periodContaining,
  shiftPeriod,
  summarizePeriod,
  type UserData,
} from '@saldo/core';
import type { CashflowValues } from '@saldo/ui';

/**
 * §17.1.7: six closed periods on the web, where the phone shows three beside its forecast — D29 kept
 * six columns in all because of 320px, and the desktop has the room for ten. It is the one sanctioned
 * difference: it changes how many columns there are, not how any of them is computed.
 */
export const WEB_CLOSED_COLUMNS = 6;

export interface NavigatorColumn {
  range: DateRange;
  kind: 'closed' | 'current' | 'forecast';
  selected: boolean;
  /**
   * Hatched: «still running». The phone hatches the column that is the selected period **and** is
   * current; a closed period the user walked back to is final. Here the columns are anchored on
   * today, so the running one is always the `current` column.
   */
  running: boolean;
  /** What `cashflowColumns` needs; a forecast column's carries its min–max band. */
  values: CashflowValues;
  /**
   * Income less expenses: the label over the column, and a forecast period's «Netto circa». The
   * phone subtracts in its chart and in its forecast sheet; here it is done once, for both.
   */
  net: number;
  /**
   * A forecast column's own period from `forecastPeriods` (its balance, for the key figures);
   * `null` exactly on the real columns — a forecast column only exists when there is a forecast.
   */
  forecast: ForecastPeriod | null;
}

export interface NavigatorView {
  columns: NavigatorColumn[];
  selected: NavigatorColumn | null;
  /** `forecastPeriods` as the phone calls it — `null` under three used periods. */
  forecast: ForecastPeriod[] | null;
}

/**
 * The periods the navigator shows ahead (§5.17), on their own.
 *
 * A page needs them **before** it knows which period it is reading: how far `?p=` may reach is how
 * many forecast periods there are, and the selection is what `navigatorView` is then asked about.
 * Calling this first and handing the answer back in keeps the forecast computed once.
 */
export function navigatorForecast(input: {
  data: UserData;
  def: PeriodDef;
  today: LocalDate;
}): ForecastPeriod[] | null {
  const { data, def, today } = input;
  const txs = data.transactions;
  return forecastPeriods({
    txs,
    recurrences: data.recurrences,
    def,
    period: periodContaining(def, today),
    today,
    balance: netWorth(data.accounts, accountBalances(data.accounts, txs, today)),
  });
}

/**
 * The chart that is also the period picker (§17.1.7). Every column carries the values
 * `cashflowColumns` needs, so the renderer stays geometry-only.
 *
 * The columns are anchored on the period containing `today`, never on the selection: selecting a
 * closed period moves the highlight, not the chart. The forecast is therefore always the phone's
 * `forecastOn` call — `period` is the current period — even when a closed one is selected, where
 * the phone would not forecast at all; a forecast anchored on a closed period would chain today's
 * balance from the wrong place.
 */
export function navigatorView(input: {
  data: UserData;
  def: PeriodDef;
  today: LocalDate;
  selected: DateRange;
  /** The page's own `navigatorForecast` call, when it has already made one; computed here otherwise. */
  forecast?: ForecastPeriod[] | null;
}): NavigatorView {
  const { data, def, today, selected } = input;
  const txs = data.transactions;
  const current = periodContaining(def, today);
  const forecast =
    input.forecast === undefined ? navigatorForecast({ data, def, today }) : input.forecast;

  const isSelected = (range: DateRange) => range.start === selected.start;

  // As the phone's `bars`: each closed column is `shiftPeriod(current, -back)`, oldest first.
  const real: DateRange[] = [current];
  for (let back = 1; back <= WEB_CLOSED_COLUMNS; back += 1) {
    real.push(shiftPeriod(def, current, -back));
  }
  const columns: NavigatorColumn[] = real.reverse().map((range) => {
    const summary = summarizePeriod(txs, range, today);
    const running = range.start === current.start;
    return {
      range,
      kind: running ? 'current' : 'closed',
      selected: isSelected(range),
      running,
      values: { income: summary.income, expenses: summary.spent },
      net: summary.remaining,
      forecast: null,
    };
  });

  // §5.17: with too little history (`forecastPeriods` answers null) nothing of the forecast
  // renders — the phone's `if (forecast === null) return past` — so there are seven columns and none
  // ahead to select. `forecastPeriods` already walks `FORECAST_PERIODS` ahead of `current`.
  for (const period of forecast ?? []) {
    columns.push({
      range: period.range,
      kind: 'forecast',
      selected: isSelected(period.range),
      running: false,
      values: {
        income: period.income,
        expenses: period.expenses,
        forecast: { min: period.expensesMin, max: period.expensesMax },
      },
      net: period.income - period.expenses,
      forecast: period,
    });
  }

  return { columns, selected: columns.find((column) => column.selected) ?? null, forecast };
}
