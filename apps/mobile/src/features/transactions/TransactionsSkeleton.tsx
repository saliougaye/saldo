import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { Skeleton, SkeletonRow } from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeProvider';

/** Rows per day card: a plausible week, not a uniform block. */
const DAYS = [3, 2, 2] as const;

/** The transactions list while the cycle is read: day cards, each a date, a total and its rows. */
export function TransactionsSkeleton() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={{ gap: theme.layout.cardGap }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      {DAYS.map((rows, day) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed placeholder list that never reorders.
        <Card key={day} padded={false}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              padding: theme.layout.cardPadding,
              paddingBottom: 4,
            }}
          >
            <Skeleton width={70} height={10} />
            <Skeleton width={50} height={10} />
          </View>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
            {Array.from({ length: rows }, (_, index) => `row-${index + 1}`).map((key) => (
              <SkeletonRow key={key} />
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
}
