import type { CurrencyCode, ForecastPeriod, LocalDate } from '@saldo/core';
import { type AppLocale, formatCycleRange, formatLongDate, formatMajor } from '@saldo/i18n';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { AmountText } from '../../components/AmountText';
import { Sheet } from '../../components/Sheet';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { InfoButton } from '../guide/InfoButton';
import { useHiddenMoney } from '../hidden/hiddenAmounts';
import { MASK } from '../hidden/mask';

/** The track is a little longer than the heaviest estimate, so its band never touches the end. */
const TRACK_HEADROOM = 1.08;
const TRACK_HEIGHT = 4;
const TICK_WIDTH = 2;
/** The tick overhangs the track by this much above and below. */
const TICK_OVERHANG = 3;
const BAND_OPACITY = 0.35;

const percent = (value: number, of: number) => `${(value / of) * 100}%` as const;

/**
 * One forecast period (§5.17): its range, the net, the balance at its end, and where its expenses
 * could land — a band from the lightest to the heaviest period of the window, a tick at the estimate.
 */
function ForecastRow({
  period,
  scale,
  currency,
  locale,
  today,
}: {
  period: ForecastPeriod;
  scale: number;
  currency: CurrencyCode;
  locale: AppLocale;
  today: LocalDate;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { hidden, format: money } = useHiddenMoney();
  const net = period.income - period.expenses;
  const unsigned = (value: number) => formatMajor(value, currency, locale, 'never');
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.palette.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text tracking="tight" numberOfLines={1} style={{ flex: 1 }}>
          {formatCycleRange(period.range, locale, today)}
        </Text>
        <Text size="footnote" color={!hidden && net < 0 ? 'accent' : 'textMuted'} tabular>
          {hidden ? MASK : formatMajor(net, currency, locale)}
        </Text>
        <Text tabular numberOfLines={1}>
          {hidden
            ? money(period.balance, currency, locale)
            : `~${money(period.balance, currency, locale)}`}
        </Text>
      </View>
      {hidden ? null : (
        <View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: theme.palette.track,
            marginTop: 10,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: percent(period.expensesMin, scale),
              width: percent(period.expensesMax - period.expensesMin, scale),
              borderRadius: TRACK_HEIGHT / 2,
              backgroundColor: theme.palette.accent,
              opacity: BAND_OPACITY,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -TICK_OVERHANG,
              bottom: -TICK_OVERHANG,
              left: percent(period.expenses, scale),
              width: TICK_WIDTH,
              marginLeft: -TICK_WIDTH / 2,
              borderRadius: TICK_WIDTH / 2,
              backgroundColor: theme.palette.text,
            }}
          />
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
        <Text size="caption" color="textFaint" tabular numberOfLines={1}>
          {t('stats.forecastSpend', { amount: money(period.expenses, currency, locale) })}
        </Text>
        <Text size="caption" color="textFaint" tabular numberOfLines={1}>
          {hidden
            ? MASK
            : t('stats.forecastRange', {
                min: unsigned(period.expensesMin),
                max: unsigned(period.expensesMax),
              })}
        </Text>
      </View>
    </View>
  );
}

/** The detail behind «Al … circa …» under Flussi (§5.7, §5.17). */
export function ForecastSheet({
  visible,
  onClose,
  periods,
  currency,
  locale,
  today,
}: {
  visible: boolean;
  onClose: () => void;
  periods: readonly ForecastPeriod[];
  currency: CurrencyCode;
  locale: AppLocale;
  today: LocalDate;
}) {
  const { t } = useTranslation();
  const last = periods.at(-1);
  const scale = Math.max(1, ...periods.map((period) => period.expensesMax)) * TRACK_HEADROOM;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('stats.forecast')}
      titleAccessory={<InfoButton concept="forecast" />}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {last === undefined ? null : (
          <View style={{ marginBottom: 14 }}>
            <Text size="footnote" color="textMuted">
              {t('stats.forecastEndLabel', { date: formatLongDate(last.range.end, locale) })}
            </Text>
            <AmountText
              minor={last.balance}
              currency={currency}
              locale={locale}
              size="amountMd"
              weight="semibold"
              tracking="tighter"
              style={{ marginTop: 2 }}
            />
          </View>
        )}
        {periods.map((period) => (
          <ForecastRow
            key={period.range.start}
            period={period}
            scale={scale}
            currency={currency}
            locale={locale}
            today={today}
          />
        ))}
        <Text size="footnote" color="textMuted" style={{ marginTop: 6 }}>
          {t('stats.forecastHow')}
        </Text>
      </ScrollView>
    </Sheet>
  );
}
