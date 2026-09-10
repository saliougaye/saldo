import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMajor } from '@saldo/i18n';
import { View } from 'react-native';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface SpendHistoryBar {
  key: string;
  label: string;
  amount: number;
  /** The running cycle, drawn in the accent colour with a solid label. */
  current: boolean;
}

/** Design geometry (`docs/design/Spese.dc.html` lines 878-887). */
const COLUMN_HEIGHT = 88;
const COLUMN_RADIUS = 3;

/**
 * One column per cycle over a track, as on the category detail screen (§6.10): a single
 * (expense) series, so no axis and no legend — the cashflow chart covers the two-sided case.
 */
export function SpendHistoryChart({
  bars,
  currency,
  locale,
}: {
  bars: readonly SpendHistoryBar[];
  currency: CurrencyCode;
  locale: AppLocale;
}) {
  const theme = useTheme();
  const max = Math.max(1, ...bars.map((bar) => bar.amount));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {bars.map((bar) => (
        <View key={bar.key} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 6 }}>
          <Text size="caption" color={bar.current ? 'text' : 'textMuted'} tabular numberOfLines={1}>
            {formatMajor(bar.amount, currency, locale, 'never')}
          </Text>
          <View
            style={{
              width: '100%',
              height: COLUMN_HEIGHT,
              justifyContent: 'flex-end',
              backgroundColor: theme.palette.track,
              borderTopLeftRadius: COLUMN_RADIUS,
              borderTopRightRadius: COLUMN_RADIUS,
            }}
          >
            <View
              style={{
                height: Math.max(1, Math.round((bar.amount / max) * COLUMN_HEIGHT)),
                backgroundColor: bar.current ? theme.palette.accent : theme.palette.barGrey,
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
  );
}
