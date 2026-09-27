import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMajor } from '@saldo/i18n';
import { CASHFLOW_HATCH_PATH, cashflowChart, cashflowColumns } from '@saldo/ui';
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

const {
  barWidth: BAR_WIDTH,
  halfHeight: HALF_HEIGHT,
  barRadius: BAR_RADIUS,
  columnGap: COLUMN_GAP,
  hatchPeriod: HATCH_PERIOD,
  hatchInk: HATCH_INK,
  forecastOpacity: FORECAST_OPACITY,
  bandWidth: BAND_WIDTH,
  bandOpacity: BAND_OPACITY,
  dividerDash: DIVIDER_DASH,
} = cashflowChart;

function Hatch({ id, colour }: { id: string; colour: string }) {
  return (
    <Defs>
      <Pattern id={id} width={HATCH_PERIOD} height={HATCH_PERIOD} patternUnits="userSpaceOnUse">
        <Path d={CASHFLOW_HATCH_PATH} stroke={colour} strokeWidth={HATCH_INK} />
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
 * on top and the cycle start underneath. Heights come from `cashflowColumns`, shared with the web.
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
  const columns = cashflowColumns(bars, hidden);
  const hasForecast = bars.some((bar) => bar.forecast !== undefined);

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
        {columns.map(({ bar, income, expenses, band, divider }) => {
          const net = bar.income - bar.expenses;
          const forecast = bar.forecast;
          const hatched = bar.current || forecast !== undefined;
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
                {divider ? (
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
                    height={income}
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
                  {band === null ? null : (
                    <View
                      style={{
                        position: 'absolute',
                        // Centred on the bar explicitly, not left to how the parent aligns its children.
                        left: '50%',
                        marginLeft: -BAND_WIDTH / 2,
                        top: band.top,
                        height: band.height,
                        width: BAND_WIDTH,
                        borderRadius: BAR_RADIUS,
                        backgroundColor: theme.palette.accent,
                        opacity: BAND_OPACITY,
                      }}
                    />
                  )}
                  <Bar
                    height={expenses}
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
