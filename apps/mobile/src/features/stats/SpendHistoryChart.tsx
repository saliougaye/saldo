import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMajor } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { MASK } from '../hidden/cipher';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';

export interface SpendHistoryBar {
  key: string;
  label: string;
  amount: number;
  /** The running cycle, drawn at full strength with a solid label. */
  current: boolean;
}

/** Design geometry (`docs/design/Spese.dc.html` lines 878-887). */
const COLUMN_HEIGHT = 88;
const COLUMN_RADIUS = 3;
/** Every column while the figures are hidden: the labels are masked, the shape must be too. */
const HIDDEN_STUB = Math.round(COLUMN_HEIGHT * 0.4);
/** Closed cycles keep the same hue as the running one, faded so the current cycle reads first. */
const PAST_ALPHA = 0.4;
/** The track is the same hue again, barely there, so the column well belongs to the category. */
const TRACK_ALPHA = 0.1;
const LEGEND_SWATCH = 8;

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
  const max = Math.max(1, ...bars.map((bar) => bar.amount));

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
        {bars.map((bar) => (
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
                  height: hidden
                    ? HIDDEN_STUB
                    : Math.max(1, Math.round((bar.amount / max) * COLUMN_HEIGHT)),
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
