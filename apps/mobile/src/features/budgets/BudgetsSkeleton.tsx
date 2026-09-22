import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { Skeleton, SkeletonRow } from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeProvider';

const CARDS = 3;

/** The Budgets list while it loads: one card per budget, its row and its bar. */
export function BudgetsSkeleton() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={{ gap: theme.layout.cardGap }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      {Array.from({ length: CARDS }, (_, index) => `budget-${index + 1}`).map((key) => (
        <Card key={key}>
          <SkeletonRow />
          <View style={{ marginTop: 8 }}>
            <Skeleton width="100%" height={theme.layout.progressHeight * 2} />
          </View>
        </Card>
      ))}
    </View>
  );
}
