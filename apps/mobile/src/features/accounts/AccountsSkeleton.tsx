import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../components/Card';
import { SkeletonHero } from '../../components/DetailSkeleton';
import { Skeleton, SkeletonRow } from '../../components/Skeleton';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

const ACCOUNT_ROWS = 3;

/**
 * Conti, while the accounts and their whole history are still being read (§5.3: a balance sums
 * every transaction, so this is the slowest query a tab runs). Same rule as Home: the labels are
 * real, the figures and the account rows are blocks.
 */
export function AccountsSkeleton() {
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
          {t('accounts.netWorth')}
        </Text>
        <SkeletonHero />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.palette.border,
          }}
        >
          <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
            {t('accounts.spendable')}
          </Text>
          <Skeleton width={80} />
        </View>
        <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
          {t('accounts.spendableNote')}
        </Text>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {Array.from({ length: ACCOUNT_ROWS }, (_, index) => `account-${index + 1}`).map((key) => (
            <SkeletonRow key={key} />
          ))}
        </View>
      </Card>
    </View>
  );
}
