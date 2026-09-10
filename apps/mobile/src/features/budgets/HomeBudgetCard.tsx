import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { ProgressBar } from '../../components/ProgressBar';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { BudgetView } from './useBudgetProgress';

/** §6.1: the top three budgets by ratio, plus a link to the full list. */
const TOP = 3;

export function HomeBudgetCard({ views }: { views: readonly BudgetView[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const currency = settings?.currency ?? 'EUR';

  if (views.length === 0) return null;

  const top = [...views].sort((a, b) => b.ratio - a.ratio).slice(0, TOP);
  const overPace = views.filter((view) => view.overPace).length;

  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Text weight="medium" tracking="tight">
          {t('home.budget')}
        </Text>
        <Text size="footnote" color={overPace > 0 ? 'accent' : 'textMuted'}>
          {overPace > 0 ? t('budgets.overPace', { count: overPace }) : t('budgets.withinLimits')}
        </Text>
      </View>

      <View style={{ gap: 12, marginTop: 12 }}>
        {top.map((view) => {
          const category = categories.find((row) => row.id === view.budget.categoryIds[0]);
          return (
            <View key={view.budget.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconBox
                  name={view.budget.icon as IconName}
                  colour={theme.categoryColor(category?.colorIndex ?? 9)}
                  small
                />
                <Text size="footnote" style={{ flex: 1 }} numberOfLines={1}>
                  {view.budget.name}
                </Text>
                <Text size="footnote" color="textMuted" tabular>
                  {`${formatMoney(view.spent, currency, locale)} · ${t('budgets.ofLimit', {
                    amount: formatMoney(view.limitWithCarry, currency, locale),
                  })}`}
                </Text>
              </View>
              <ProgressBar ratio={view.ratio} overPace={view.overPace} />
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/budgets')}
        style={{ marginTop: 12 }}
      >
        <Text size="footnote" color="accent">
          {t('home.allBudgets')}
        </Text>
      </Pressable>
    </Card>
  );
}
