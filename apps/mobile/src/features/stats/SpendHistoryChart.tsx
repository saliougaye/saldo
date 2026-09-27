import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMajor } from '@saldo/i18n';
import { spendHistoryChart, spendHistoryColumns } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';
import { MASK } from '../hidden/mask';

export interface SpendHistoryBar {
  key: string;
  label: string;
  amount: number;
  /** The running cycle, drawn at full strength with a solid label. */
  current: boolean;
}

const {
  columnHeight: COLUMN_HEIGHT,
  columnRadius: COLUMN_RADIUS,
  pastAlpha: PAST_ALPHA,
  trackAlpha: TRACK_ALPHA,
  legendSwatch: LEGEND_SWATCH,
} = spendHistoryChart;

/**
 * One column per cycle over a track, as on the category detail screen (§6.10): a single
 * (expense) series, so no axis and no value legend — the cashflow chart covers the two-sided case.
 * `colour` is the category's own colour; importance is carried by opacity, not by hue, and the
 * legend says what the two strengths mean.
 */
export function SpendHistoryChart({
  bars,
  currency,
  locale,
  colour,
}: {
  bars: readonly SpendHistoryBar[];
  currency: CurrencyCode;
  locale: AppLocale;
  /** `#RRGGBB`; defaults to the neutral accent for callers without a category. */
  colour?: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { hidden } = useHiddenAmounts();

  const base = colour ?? theme.palette.accent;
  const past = theme.tint(base, PAST_ALPHA);
  const track = theme.tint(base, TRACK_ALPHA);

  const legend = [
    { key: 'current', label: t('stats.legendCurrent'), colour: base },
    { key: 'past', label: t('stats.legendPast'), colour: past },
  ] as const;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {spendHistoryColumns(bars, hidden).map(({ bar, height }) => (
          <View key={bar.key} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 6 }}>
            <Text
              size="caption"
              color={bar.current ? 'text' : 'textMuted'}
              tabular
              numberOfLines={1}
            >
              {hidden ? MASK : formatMajor(bar.amount, currency, locale, 'never')}
            </Text>
            <View
              style={{
                width: '100%',
                height: COLUMN_HEIGHT,
                justifyContent: 'flex-end',
                backgroundColor: track,
                borderTopLeftRadius: COLUMN_RADIUS,
                borderTopRightRadius: COLUMN_RADIUS,
              }}
            >
              <View
                style={{
                  height,
                  backgroundColor: bar.current ? base : past,
                  borderTopLeftRadius: COLUMN_RADIUS,
                  borderTopRightRadius: COLUMN_RADIUS,
                }}
              />
            </View>
            <Text size="caption" color={bar.current ? 'text' : 'textFaint'} numberOfLines={1}>
              {bar.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, columnGap: 14 }}>
        {legend.map((entry) => (
          <View key={entry.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: LEGEND_SWATCH,
                height: LEGEND_SWATCH,
                borderRadius: 2,
                backgroundColor: entry.colour,
              }}
            />
            <Text size="caption" color="textFaint">
              {entry.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
