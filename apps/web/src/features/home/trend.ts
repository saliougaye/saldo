import {
  averageSeries,
  dailyCumulative,
  type LedgerTx,
  type LocalDate,
  type PeriodDef,
  type PeriodView,
  periodHistory,
} from '@saldo/core';

/** §5.6: «il solito» is the average of this many previous periods, as on Statistiche. */
const USUAL_PERIODS = 3;

export interface HomeTrend {
  /** Cumulative counted spend per elapsed day. */
  current: number[];
  /** The average of the previous periods, across the whole period. */
  usual: number[];
  /** `current` minus `usual` on the last elapsed day; `null` with no previous period. */
  delta: number | null;
}

/** Home's «Andamento del periodo» (G2): both lines, and how far today is from the usual. */
export function homeTrend(
  txs: readonly LedgerTx[],
  def: PeriodDef,
  period: PeriodView,
  today: LocalDate,
): HomeTrend {
  const current = dailyCumulative(txs, period.range, today);
  const history = periodHistory(txs, def, period.range, USUAL_PERIODS);
  const usual = averageSeries(
    history.map((entry) => dailyCumulative(entry.txs, entry.period, today)),
    Math.max(1, period.length),
  );
  const last = current.at(-1);
  const usualThen = usual.at(current.length - 1);
  return {
    current,
    usual,
    delta:
      history.length === 0 || last === undefined || usualThen === undefined
        ? null
        : last - usualThen,
  };
}
