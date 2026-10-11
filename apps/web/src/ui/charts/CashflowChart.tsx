import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMajor } from '@saldo/i18n';
import {
  CASHFLOW_HATCH_PATH,
  type CashflowValues,
  cashflowChart,
  cashflowColumns,
} from '@saldo/ui';
import type { NavigatorColumn } from '../../features/stats/navigatorView';
import { AppLink as Link } from '../AppLink';
import styles from './CashflowChart.module.css';

const {
  barWidth: BAR_WIDTH,
  barRadius: BAR_RADIUS,
  columnGap: COLUMN_GAP,
  hatchPeriod: HATCH_PERIOD,
  hatchInk: HATCH_INK,
  forecastOpacity: FORECAST_OPACITY,
  bandWidth: BAND_WIDTH,
  bandOpacity: BAND_OPACITY,
  dividerDash: DIVIDER_DASH,
} = cashflowChart;

/**
 * §17.1.7: the half height is a parameter of `cashflowColumns` — the phone passes its 54, the web
 * 64, because Flussi spans the page here and is read as the period picker.
 */
export const WEB_HALF_HEIGHT = 64;
/** Both halves and the 1px axis between them. */
const BARS_HEIGHT = WEB_HALF_HEIGHT * 2 + 1;
/** The legend's swatches, as the phone draws them. */
const SWATCH = 8;
const BAND_SWATCH_WIDTH = 12;
/** The phone draws the band's swatch a little stronger than the band, or it vanishes at 8px. */
const BAND_SWATCH_BOOST = 1.6;

type Ink = 'income' | 'expenses';

function Hatch({ id, ink }: { id: string; ink: Ink }) {
  return (
    <pattern id={id} width={HATCH_PERIOD} height={HATCH_PERIOD} patternUnits="userSpaceOnUse">
      <path
        d={CASHFLOW_HATCH_PATH}
        className={ink === 'income' ? styles.inkIncome : styles.inkExpenses}
        strokeWidth={HATCH_INK}
      />
    </pattern>
  );
}

/**
 * One bar, solid or hatched. The rounded corners face away from the axis (the design's
 * `border-radius: 2px 2px 0 0` above it, `0 0 2px 2px` below): a full `rx` is drawn inside a
 * nested `<svg>`, which clips, and the axis-side half of it is pushed outside.
 */
function Bar({
  y,
  height,
  side,
  ink,
  pattern,
  dimmed,
}: {
  y: number;
  height: number;
  side: 'top' | 'bottom';
  ink: Ink;
  /** The hatch's id when the bar is hatched. */
  pattern: string | null;
  dimmed: boolean;
}) {
  if (height === 0) return null;
  return (
    <svg
      x={-BAR_WIDTH / 2}
      y={y}
      width={BAR_WIDTH}
      height={height}
      opacity={dimmed ? FORECAST_OPACITY : undefined}
      aria-hidden="true"
    >
      <rect
        x={0}
        y={side === 'top' ? 0 : -BAR_RADIUS}
        width={BAR_WIDTH}
        height={height + BAR_RADIUS}
        rx={BAR_RADIUS}
        className={pattern === null ? (ink === 'income' ? styles.income : styles.expenses) : ''}
        fill={pattern === null ? undefined : `url(#${pattern})`}
      />
    </svg>
  );
}

type Swatch = 'solid' | 'hatched' | 'forecast' | 'band';

function LegendSwatch({ id, ink, kind }: { id: string; ink: Ink; kind: Swatch }) {
  const width = kind === 'band' ? BAND_SWATCH_WIDTH : SWATCH;
  const pattern = `cashflow-legend-${id}`;
  const hatched = kind === 'hatched' || kind === 'forecast';
  return (
    <svg
      width={width}
      height={SWATCH}
      aria-hidden="true"
      opacity={
        kind === 'forecast'
          ? FORECAST_OPACITY
          : kind === 'band'
            ? BAND_OPACITY * BAND_SWATCH_BOOST
            : undefined
      }
    >
      {hatched ? (
        <defs>
          <Hatch id={pattern} ink={ink} />
        </defs>
      ) : null}
      <rect
        width={width}
        height={SWATCH}
        rx={BAR_RADIUS}
        className={hatched ? '' : ink === 'income' ? styles.income : styles.expenses}
        fill={hatched ? `url(#${pattern})` : undefined}
      />
    </svg>
  );
}

export interface CashflowLegend {
  income: string;
  expenses: string;
  current: string;
  forecast: string;
  range: string;
}

interface Props {
  columns: readonly NavigatorColumn[];
  currency: CurrencyCode;
  locale: AppLocale;
  /** Each column's destination: the same page with that period selected. */
  href: (column: NavigatorColumn) => string;
  /** The label under the column (`formatPeriodTick`). */
  tick: (column: NavigatorColumn) => string;
  /** The column as one sentence for a screen reader: its period and its net. */
  label: (column: NavigatorColumn) => string;
  legend: CashflowLegend;
}

/**
 * Flussi (§5.7) as the phone's `CashflowChart` draws it — income above the axis, expenses below,
 * the net on top and the period underneath, the running period hatched, the forecast dimmed and
 * hatched with its min–max band behind the expenses and a dashed seam before it — and, on the web,
 * the period picker (§17.1.7): every column is a link to its own period.
 *
 * Hidden mode is device-local on the phone and has no web counterpart (§17.1.6): never hidden.
 */
export function CashflowChart({ columns, currency, locale, href, tick, label, legend }: Props) {
  // `cashflowColumns` hands each input back as `bar`, so the column travels with its heights.
  const shaped = cashflowColumns(
    columns.map((column): CashflowValues & { column: NavigatorColumn } => ({
      ...column.values,
      column,
    })),
    false,
    WEB_HALF_HEIGHT,
  );
  const hasForecast = columns.some((column) => column.kind === 'forecast');

  const legendEntries: { key: string; label: string; ink: Ink; kind: Swatch }[] = [
    { key: 'income', label: legend.income, ink: 'income', kind: 'solid' },
    { key: 'expenses', label: legend.expenses, ink: 'expenses', kind: 'solid' },
    { key: 'current', label: legend.current, ink: 'expenses', kind: 'hatched' },
  ];
  if (hasForecast) {
    legendEntries.push(
      { key: 'forecast', label: legend.forecast, ink: 'expenses', kind: 'forecast' },
      { key: 'range', label: legend.range, ink: 'expenses', kind: 'band' },
    );
  }

  return (
    <div className={styles.chart}>
      <div
        className={styles.columns}
        style={{
          gridTemplateColumns: `repeat(${shaped.length}, minmax(0, 1fr))`,
          columnGap: `${COLUMN_GAP}px`,
        }}
      >
        {shaped.map(({ bar: { column }, income, expenses, band, divider }) => {
          const forecast = column.kind === 'forecast';
          // As on the phone: the running period is hatched because its totals are incomplete, a
          // forecast one because it has not happened at all.
          const hatched = column.running || forecast;
          const id = `cashflow-${column.range.start}`;
          const netClass =
            column.net < 0 ? styles.negative : forecast ? styles.netForecast : styles.netPlain;
          return (
            <Link
              key={column.range.start}
              href={href(column)}
              className={`${styles.column} ${column.selected ? styles.selected : ''}`}
              aria-current={column.selected ? 'true' : undefined}
              aria-label={label(column)}
            >
              <span className={`${styles.net} ${netClass}`} aria-hidden="true">
                {formatMajor(column.net, currency, locale)}
              </span>
              <span className={styles.bars} style={{ blockSize: `${BARS_HEIGHT}px` }}>
                {divider ? (
                  // Half the column gap before the first forecast column: what happened, then
                  // what is expected.
                  <svg
                    className={styles.divider}
                    width={1}
                    height={BARS_HEIGHT}
                    style={{ insetInlineStart: `${-COLUMN_GAP / 2 - 0.5}px` }}
                    aria-hidden="true"
                  >
                    <line
                      x1={0.5}
                      y1={0}
                      x2={0.5}
                      y2={BARS_HEIGHT}
                      className={styles.dividerLine}
                      strokeDasharray={DIVIDER_DASH}
                    />
                  </svg>
                ) : null}
                <span className={styles.axis} style={{ insetBlockStart: `${WEB_HALF_HEIGHT}px` }} />
                <svg
                  className={styles.svg}
                  width={BAND_WIDTH}
                  height={BARS_HEIGHT}
                  viewBox={`${-BAND_WIDTH / 2} 0 ${BAND_WIDTH} ${BARS_HEIGHT}`}
                  aria-hidden="true"
                >
                  {hatched ? (
                    <defs>
                      <Hatch id={`${id}-income`} ink="income" />
                      <Hatch id={`${id}-expenses`} ink="expenses" />
                    </defs>
                  ) : null}
                  <Bar
                    y={WEB_HALF_HEIGHT - income}
                    height={income}
                    side="top"
                    ink="income"
                    pattern={hatched ? `${id}-income` : null}
                    dimmed={forecast}
                  />
                  {band === null ? null : (
                    <rect
                      x={-BAND_WIDTH / 2}
                      y={WEB_HALF_HEIGHT + 1 + band.top}
                      width={BAND_WIDTH}
                      height={band.height}
                      rx={BAR_RADIUS}
                      className={styles.band}
                      opacity={BAND_OPACITY}
                    />
                  )}
                  <Bar
                    y={WEB_HALF_HEIGHT + 1}
                    height={expenses}
                    side="bottom"
                    ink="expenses"
                    pattern={hatched ? `${id}-expenses` : null}
                    dimmed={forecast}
                  />
                </svg>
              </span>
              <span
                className={`${styles.tick} ${column.running ? styles.tickRunning : ''}`}
                aria-hidden="true"
              >
                {tick(column)}
              </span>
            </Link>
          );
        })}
      </div>

      <div className={styles.legend}>
        {legendEntries.map((entry) => (
          <span key={entry.key} className={styles.legendEntry}>
            <LegendSwatch id={entry.key} ink={entry.ink} kind={entry.kind} />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
