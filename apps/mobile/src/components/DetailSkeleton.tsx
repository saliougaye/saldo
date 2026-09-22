import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';
import { Screen } from './Screen';
import { BackButton } from './ScreenHeader';
import { Skeleton, SkeletonList } from './Skeleton';

/** A 44pt hero figure renders about 52pt tall; the block sits inside that line. */
export const HERO_LINE = 52;

/** The hero figure of a card, as a block of the height the number will take. */
export function SkeletonHero() {
  const theme = useTheme();
  return (
    <View style={{ height: HERO_LINE, justifyContent: 'center' }}>
      <Skeleton width={180} height={36} radius={theme.radii.input} />
    </View>
  );
}

/**
 * A detail screen whose entity is on its way: its header, a card with a hero figure, a list.
 *
 * The back button is real and drawn at once, `show` or not: the way out never waits on the loading
 * grace. The blocks appear only once `show` (a `useDelayed`) says the wait is worth mentioning.
 */
export function DetailSkeleton({ show }: { show: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <BackButton />
        {show ? (
          <>
            <Skeleton
              width={theme.layout.iconBox}
              height={theme.layout.iconBox}
              radius={theme.radii.iconBox}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={14} />
              <Skeleton width="30%" height={10} />
            </View>
          </>
        ) : null}
      </View>
      {show ? (
        // The list announces the wait; the blocks above it are hidden from the reader.
        <View style={{ gap: theme.layout.cardGap }}>
          <Card>
            <Skeleton width={90} height={10} />
            <SkeletonHero />
            <View style={{ marginTop: 12 }}>
              <Skeleton width="100%" height={theme.layout.progressHeight * 2} />
            </View>
          </Card>
          <SkeletonList rows={4} label={t('common.loading')} />
        </View>
      ) : null}
    </Screen>
  );
}
