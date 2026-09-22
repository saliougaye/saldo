import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMajor } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Defs, Path, Pattern, Rect, Svg } from 'react-native-svg';
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
}

/** Design geometry (`docs/design/Spese.dc.html` lines 265-289): fixed-width bars in 54px halves. */
const BAR_WIDTH = 16;
const HALF_HEIGHT = 54;
/** Height of every bar while the figures are hidden. */
const HIDDEN_STUB = Math.round(HALF_HEIGHT * 0.35);
const BAR_RADIUS = 2;
/** 45° stripes, 2px of ink every 5px, as in the prototype's `repeating-linear-gradient`. */
const HATCH_PERIOD = 5;
const HATCH_INK = 2;
/**
 * The three diagonals of one 5x5 tile: the middle one plus the two that continue the stripes of
 * the neighbouring tiles, so the pattern is seamless. Drawn as lines rather than a rotated
 * rectangle because `patternTransform` is unreliable in react-native-svg and renders as dots.
 */
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
}: {
  height: number;
  colour: string;
  hatched: boolean;
  patternId: string;
  side: 'top' | 'bottom';
}) {
  // The rounded corners face away from the axis, so a full `rx` is drawn and the axis-side half is
  // pushed outside the viewport.
  if (height === 0) return null;
  const offset = side === 'top' ? -BAR_RADIUS : 0;
  return (
    <Svg width={BAR_WIDTH} height={height}>
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

function LegendSwatch({ colour, hatched }: { colour: string; hatched: boolean }) {
  if (!hatched) {
    return <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colour }} />;
  }
  return (
    <Svg width={8} height={8}>
      <Hatch id="cashflow-legend-hatch" colour={colour} />
      <Rect x={0} y={0} width={8} height={8} rx={2} fill="url(#cashflow-legend-hatch)" />
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
}: {
  bars: readonly CashflowBar[];
  currency: CurrencyCode;
  locale: AppLocale;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { hidden } = useHiddenAmounts();
  const max = Math.max(1, ...bars.flatMap((bar) => [bar.income, bar.expenses]));
  // A cycle with nothing in it gets no bar at all rather than a 1px stub, so "no data" reads as
  // empty instead of as a very small amount. In hidden mode every column is the same stub: with the
  // labels masked the shape of the year would still say which months were heavy.
  const barHeight = (value: number) => {
    if (hidden) return HIDDEN_STUB;
    return value === 0 ? 0 : Math.max(1, Math.round((value / max) * HALF_HEIGHT));
  };

  const legend: readonly { key: string; label: string; colour: string; hatched: boolean }[] = [
    {
      key: 'income',
      label: t('stats.legendIncome'),
      colour: theme.palette.positive,
      hatched: false,
    },
    {
      key: 'expenses',
      label: t('stats.legendExpenses'),
      colour: theme.palette.accent,
      hatched: false,
    },
    {
      key: 'current',
      label: t('stats.legendCurrent'),
      colour: theme.palette.accent,
      hatched: true,
    },
  ];

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {bars.map((bar) => {
          const net = bar.income - bar.expenses;
          return (
            <View key={bar.key} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 7 }}>
              <Text
                size="caption"
                color={!hidden && net < 0 ? 'accent' : 'textMuted'}
                tabular
                numberOfLines={1}
              >
                {hidden ? MASK : formatMajor(net, currency, locale)}
              </Text>
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
                  hatched={bar.current}
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
                <Bar
                  height={barHeight(bar.expenses)}
                  colour={theme.palette.accent}
                  hatched={bar.current}
                  patternId={`cashflow-expenses-${bar.key}`}
                  side="bottom"
                />
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, columnGap: 14 }}>
        {legend.map((entry) => (
          <View key={entry.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <LegendSwatch colour={entry.colour} hatched={entry.hatched} />
            <Text size="caption" color="textFaint">
              {entry.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
