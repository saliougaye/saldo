import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { CardHeader } from '../../components/CardHeader';
import { IconBox } from '../../components/ListRow';
import { ProgressBar } from '../../components/ProgressBar';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenMoney } from '../hidden/HiddenAmountsProvider';
import type { BudgetView } from './useBudgetProgress';

/** §6.1: the top three budgets by ratio, plus a link to the full list. */
const TOP = 3;

export function HomeBudgetCard({ views }: { views: readonly BudgetView[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { format: money } = useHiddenMoney();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const currency = settings?.currency ?? 'EUR';

  // Without this the card rendered nothing, and since it is the only way into /budgets the
  // screen — and the wizard behind it — could not be reached on a fresh install. The header is
  // still the card's one action: it leads to the Budgets screen, whose own empty state carries
  // the dashed "Nuovo budget" (§6.4).
  if (views.length === 0) {
    return (
      <Card>
        <CardHeader
          title={t('home.budget')}
          status={t('budgets.empty')}
          onPress={() => router.push('/budgets')}
        />
      </Card>
    );
  }

  const top = [...views].sort((a, b) => b.ratio - a.ratio).slice(0, TOP);
  const overPace = views.filter((view) => view.overPace).length;

  return (
    <Card>
      <CardHeader
        title={t('home.budget')}
        status={
          overPace > 0 ? t('budgets.overPace', { count: overPace }) : t('budgets.withinLimits')
        }
        statusTone={overPace > 0 ? 'accent' : 'muted'}
        onPress={() => router.push('/budgets')}
      />

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
                  {`${money(view.spent, currency, locale)} ${t('budgets.ofLimit', {
                    amount: money(view.limitWithCarry, currency, locale),
                  })}`}
                </Text>
              </View>
              <ProgressBar ratio={view.ratio} overPace={view.overPace} />
            </View>
          );
        })}
      </View>
    </Card>
  );
}
