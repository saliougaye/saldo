import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { CardHeader } from '../../components/CardHeader';
import { SkeletonHero } from '../../components/DetailSkeleton';
import { Skeleton, SkeletonBudgetRow, SkeletonRow } from '../../components/Skeleton';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

const BUDGET_ROWS = 3;
const RECENT_ROWS = 5;

/**
 * Home, while the cycle and the six before it are still being read.
 *
 * The labels are real and only the figures are blocks: whoever opens the app every day knows
 * where to look before the numbers land. The headers carry no action yet — a tap on "Budget"
 * before the budgets exist would lead nowhere worth going.
 */
export function HomeSkeleton({ heroLabel }: { heroLabel: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={{ gap: theme.layout.cardGap }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      <Card>
        <Text size="footnote" color="textMuted">
          {heroLabel}
        </Text>
        <View style={{ marginTop: 2 }}>
          <SkeletonHero />
        </View>
        <View style={{ marginTop: 14 }}>
          <Skeleton width="100%" height={theme.layout.progressHeight * 2} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('home.income')}
            </Text>
            <Skeleton width={60} height={10} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('home.expenses')}
            </Text>
            <Skeleton width={60} height={10} />
          </View>
        </View>
      </Card>

      <Card>
        <CardHeader title={t('home.budget')} />
        <View style={{ gap: 12, marginTop: 12 }}>
          {Array.from({ length: BUDGET_ROWS }, (_, index) => `budget-${index + 1}`).map((key) => (
            <SkeletonBudgetRow key={key} />
          ))}
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
          <CardHeader title={t('home.recent')} status={t('home.allTransactions')} />
        </View>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
          {Array.from({ length: RECENT_ROWS }, (_, index) => `recent-${index + 1}`).map((key) => (
            <SkeletonRow key={key} />
          ))}
        </View>
      </Card>
    </View>
  );
}
