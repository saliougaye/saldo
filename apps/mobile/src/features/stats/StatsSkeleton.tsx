import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { Skeleton, SkeletonRow } from '../../components/Skeleton';
import { useTheme } from '../../theme/ThemeProvider';

/** The cashflow chart's own height (`HALF_HEIGHT` × 2 plus its axis), so nothing moves later. */
const CHART_HEIGHT = 109;

/**
 * Statistics, while the six cycles behind them are still being read (§5.7).
 *
 * Shaped like the cards it stands in for, to the pixel where that is cheap: this screen reads six
 * periods of transactions, long enough that laying it out twice — once empty, once with data — is
 * visible as a jump.
 */
export function StatsSkeleton() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={{ gap: theme.layout.cardGap }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width={80} />
          <Skeleton width={70} height={10} />
        </View>
        <View style={{ marginTop: 18 }}>
          <Skeleton width="100%" height={CHART_HEIGHT} radius={theme.radii.input} />
        </View>
      </Card>

      <Card>
        <Skeleton width="100%" height={theme.layout.headerButton} radius={theme.radii.input} />
        <View style={{ marginTop: 12 }}>
          <Skeleton width={140} height={20} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Skeleton width="100%" height={theme.layout.progressHeight * 2} />
        </View>
        <View style={{ marginTop: 6 }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Card>

      <Card>
        <Skeleton width={110} />
        <View style={{ marginTop: 12 }}>
          <Skeleton width="100%" height={theme.layout.progressHeight * 2} />
        </View>
        <View style={{ marginTop: 10, gap: 6 }}>
          <Skeleton width="90%" height={10} />
          <Skeleton width="60%" height={10} />
        </View>
      </Card>
    </View>
  );
}
