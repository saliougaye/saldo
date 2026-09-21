import { recurringMonthlyTotals } from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { useCategories, useRecurrences, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenMoney } from '../hidden/hiddenAmounts';
import { usePeriod } from '../period/PeriodProvider';
import { byNext, recurrenceViews } from './recurrenceViews';

/**
 * §6.2: one row under "In arrivo" that leads to the recurrences (§6.33). Rendered only when there
 * is at least one, because the form is where a recurrence is born and an empty card would only
 * point at an empty screen.
 */
export function RecurrencesCard() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const recurrences = useRecurrences();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const views = useMemo(
    () =>
      recurrenceViews(
        recurrences,
        today,
        (id) => categories.find((row) => row.id === id)?.name ?? '',
        t('kinds.transfer'),
      )
        .filter((view) => view.next !== null)
        .sort(byNext),
    [recurrences, today, categories, t],
  );
  const totals = useMemo(
    () => recurringMonthlyTotals(views.map((view) => view.recurrence)),
    [views],
  );
  const first = views[0];
  if (first === undefined || first.next === null) return null;

  return (
    <Card padded={false}>
      <Pressable
        testID="transactions-recurrences"
        accessibilityRole="button"
        accessibilityLabel={t('recurrence.title')}
        onPress={() => router.push('/recurrences')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: theme.layout.cardPadding,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <IconBox name="repeat" colour={theme.palette.textMuted} small />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" tracking="tight">
            {t('recurrence.title')}
          </Text>
          <Text size="caption" color="textMuted" numberOfLines={1}>
            {t('recurrence.cardSubtitle', {
              count: views.length,
              name: first.title,
              date: formatDayMonth(first.next, locale),
            })}
          </Text>
        </View>
        <Text size="footnote" color="textMuted" tabular>
          {t('recurrence.perMonth', { amount: money(-totals.expense, currency, locale) })}
        </Text>
        <Icon name="chevR" size={16} color={theme.palette.textFaint} />
      </Pressable>
    </Card>
  );
}
