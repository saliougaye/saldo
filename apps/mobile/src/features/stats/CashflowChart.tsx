import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMajor } from '@saldo/i18n';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Defs, Line, Path, Pattern, Rect, Svg } from 'react-native-svg';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';
import { MASK } from '../hidden/mask';

export interface CashflowBar {
  key: string;
  label: string;
  income: number;
  expenses: number;
  /** The running cycle: its bars are hatched because the totals are still incomplete. */
  current: boolean;
  /**
   * A forecast period (§5.17): `income` and `expenses` are estimates, and the expenses could end
   * anywhere between `min` and `max`. Drawn dimmed and hatched, with that range as a band.
   */
  forecast?: { min: number; max: number };
}

/** Design geometry (`docs/design/Spese.dc.html` lines 265-289): fixed-width bars in 54px halves. */
const BAR_WIDTH = 16;
const HALF_HEIGHT = 54;
/** Height of every bar while the figures are hidden. */
const HIDDEN_STUB = Math.round(HALF_HEIGHT * 0.35);
const BAR_RADIUS = 2;
const COLUMN_GAP = 5;
/** 45° stripes, 2px of ink every 5px, as in the prototype's `repeating-linear-gradient`. */
const HATCH_PERIOD = 5;
const HATCH_INK = 2;
/**
 * The three diagonals of one 5x5 tile: the middle one plus the two that continue the stripes of
 * the neighbouring tiles, so the pattern is seamless. Drawn as lines rather than a rotated
 * rectangle because `patternTransform` is unreliable in react-native-svg and renders as dots.
 */
/** Forecast bars sit one step behind the running period's (§5.7). */
const FORECAST_OPACITY = 0.5;
/** The min–max band: a little wider than the bar it sits behind, and faint. */
const BAND_WIDTH = 22;
const BAND_OPACITY = 0.2;
/** Dashes of the divider between what happened and what is expected. */
const DIVIDER_DASH = '3 4';
const HATCH_PATH = `M0,${HATCH_PERIOD} L${HATCH_PERIOD},0 M-1,1 L1,-1 M${HATCH_PERIOD - 1},${
  HATCH_PERIOD + 1
} L${HATCH_PERIOD + 1},${HATCH_PERIOD - 1}`;

function Hatch({ id, colour }: { id: string; colour: string }) {
  return (
    <Defs>
      <Pattern id={id} width={HATCH_PERIOD} height={HATCH_PERIOD} patternUnits="userSpaceOnUse">
        <Path d={HATCH_PATH} stroke={colour} strokeWidth={HATCH_INK} />
      </Pattern>
    </Defs>
  );
}

/**
 * A bar drawn either solid or hatched. The hatch needs SVG (React Native has no repeating
 * gradients), so both variants render as SVG to keep the geometry identical.
 */
function Bar({
  height,
  colour,
  hatched,
  patternId,
  side,
  dimmed = false,
}: {
  height: number;
  colour: string;
  hatched: boolean;
  patternId: string;
  side: 'top' | 'bottom';
  dimmed?: boolean;
}) {
  // The rounded corners face away from the axis, so a full `rx` is drawn and the axis-side half is
  // pushed outside the viewport.
  if (height === 0) return null;
  const offset = side === 'top' ? -BAR_RADIUS : 0;
  return (
    <Svg width={BAR_WIDTH} height={height} opacity={dimmed ? FORECAST_OPACITY : 1}>
      {hatched ? <Hatch id={patternId} colour={colour} /> : null}
      <Rect
        x={0}
        y={offset}
        width={BAR_WIDTH}
        height={height + BAR_RADIUS}
        rx={BAR_RADIUS}
        fill={hatched ? `url(#${patternId})` : colour}
      />
    </Svg>
  );
}

type Swatch = 'solid' | 'hatched' | 'forecast' | 'band';

function LegendSwatch({ id, colour, kind }: { id: string; colour: string; kind: Swatch }) {
  if (kind === 'solid' || kind === 'band') {
    return (
      <View
        style={{
          width: kind === 'band' ? 12 : 8,
          height: 8,
          borderRadius: BAR_RADIUS,
          backgroundColor: colour,
          opacity: kind === 'band' ? BAND_OPACITY * 1.6 : 1,
        }}
      />
    );
  }
  const patternId = `cashflow-legend-${id}`;
  return (
    <Svg width={8} height={8} opacity={kind === 'forecast' ? FORECAST_OPACITY : 1}>
      <Hatch id={patternId} colour={colour} />
      <Rect x={0} y={0} width={8} height={8} rx={2} fill={`url(#${patternId})`} />
    </Svg>
  );
}

/**
 * Cashflow of §5.7: income above the axis, expenses below it, one column per cycle, with the net
 * on top and the cycle start underneath. Both halves share one scale so the columns are comparable.
 */
export function CashflowChart({
  bars,
  currency,
  locale,
  footer,
}: {
  bars: readonly CashflowBar[];
  currency: CurrencyCode;
  locale: AppLocale;
  /** Between the columns and the legend: the forecast's «Al … circa …» row (§5.7). */
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { hidden } = useHiddenAmounts();
  const max = Math.max(
    1,
    ...bars.flatMap((bar) => [bar.income, bar.expenses, bar.forecast?.max ?? 0]),
  );
  const hasForecast = bars.some((bar) => bar.forecast !== undefined);
  // A cycle with nothing in it gets no bar at all rather than a 1px stub, so "no data" reads as
  // empty instead of as a very small amount. In hidden mode every column is the same stub: with the
  // labels masked the shape of the year would still say which months were heavy.
  const barHeight = (value: number) => {
    if (hidden) return HIDDEN_STUB;
    return value === 0 ? 0 : Math.max(1, Math.round((value / max) * HALF_HEIGHT));
  };

  const legend: { key: string; label: string; colour: string; kind: Swatch }[] = [
    {
      key: 'income',
      label: t('stats.legendIncome'),
      colour: theme.palette.positive,
      kind: 'solid',
    },
    {
      key: 'expenses',
      label: t('stats.legendExpenses'),
      colour: theme.palette.accent,
      kind: 'solid',
    },
    {
      key: 'current',
      label: t('stats.legendCurrent'),
      colour: theme.palette.accent,
      kind: 'hatched',
    },
  ];
  if (hasForecast) {
    legend.push(
      {
        key: 'forecast',
        label: t('stats.legendForecast'),
        colour: theme.palette.accent,
        kind: 'forecast',
      },
      { key: 'range', label: t('stats.legendRange'), colour: theme.palette.accent, kind: 'band' },
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: COLUMN_GAP }}>
        {bars.map((bar, index) => {
          const net = bar.income - bar.expenses;
          const forecast = bar.forecast;
          const hatched = bar.current || forecast !== undefined;
          const firstForecast = forecast !== undefined && bars[index - 1]?.forecast === undefined;
          return (
            <View key={bar.key} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 7 }}>
              <Text
                size="caption"
                color={
                  !hidden && net < 0 ? 'accent' : forecast === undefined ? 'textMuted' : 'textFaint'
                }
                tabular
                numberOfLines={1}
              >
                {hidden ? MASK : formatMajor(net, currency, locale)}
              </Text>
              <View style={{ width: '100%' }}>
                {firstForecast ? (
                  // Half the column gap to the left: the seam between what happened and what is expected.
                  <Svg
                    width={1}
                    height={HALF_HEIGHT * 2 + 1}
                    style={{ position: 'absolute', left: -COLUMN_GAP / 2 - 0.5, top: 0 }}
                  >
                    <Line
                      x1={0.5}
                      y1={0}
                      x2={0.5}
                      y2={HALF_HEIGHT * 2 + 1}
                      stroke={theme.palette.borderStrong}
                      strokeWidth={1}
                      strokeDasharray={DIVIDER_DASH}
                    />
                  </Svg>
                ) : null}
                <View
                  style={{
                    width: '100%',
                    height: HALF_HEIGHT,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Bar
                    height={barHeight(bar.income)}
                    colour={theme.palette.positive}
                    hatched={hatched}
                    patternId={`cashflow-income-${bar.key}`}
                    side="top"
                  />
                </View>
                <View
                  style={{ width: '100%', height: 1, backgroundColor: theme.palette.borderStrong }}
                />
                <View
                  style={{
                    width: '100%',
                    height: HALF_HEIGHT,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                  }}
                >
                  {forecast === undefined || hidden ? null : (
                    <View
                      style={{
                        position: 'absolute',
                        top: barHeight(forecast.min),
                        height: Math.max(1, barHeight(forecast.max) - barHeight(forecast.min)),
                        width: BAND_WIDTH,
                        borderRadius: BAR_RADIUS,
                        backgroundColor: theme.palette.accent,
                        opacity: BAND_OPACITY,
                      }}
                    />
                  )}
                  <Bar
                    height={barHeight(bar.expenses)}
                    colour={theme.palette.accent}
                    hatched={hatched}
                    patternId={`cashflow-expenses-${bar.key}`}
                    side="bottom"
                  />
                </View>
              </View>
              <Text
                size="caption"
                color={bar.current ? 'text' : 'textFaint'}
                tabular
                numberOfLines={1}
              >
                {bar.label}
              </Text>
            </View>
          );
        })}
      </View>

      {footer}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, columnGap: 14 }}>
        {legend.map((entry) => (
          <View key={entry.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LegendSwatch id={entry.key} colour={entry.colour} kind={entry.kind} />
            <Text size="caption" color="textFaint">
              {entry.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
