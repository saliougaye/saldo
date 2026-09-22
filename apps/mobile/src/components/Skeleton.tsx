import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { Card } from './Card';

/**
 * A block standing in for content that is on its way.
 *
 * It pulses rather than shimmers: a sweep is a second animation to keep in sync with the rest, and
 * at this size it reads as decoration. With Reduce Motion on it is a still block, which says the
 * same thing.
 */
export function Skeleton({
  width,
  height = 12,
  radius,
}: {
  width: number | `${number}%`;
  height?: number;
  radius?: number;
}) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const pulse = useSharedValue(reduced ? 0.7 : 0.45);

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withTiming(0.9, { duration: motion.progressMs * 2, easing: EASE }),
      -1,
      true,
    );
  }, [reduced, pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      // Nothing to announce: the screen that owns the skeleton says it is loading.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radii.chipSmall,
          backgroundColor: theme.palette.track,
        },
        style,
      ]}
    />
  );
}

/** The shape of a `ListRow`: icon box, title, subtitle, amount. */
export function SkeletonRow() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: theme.layout.minHitTarget,
        paddingVertical: 8,
      }}
    >
      <Skeleton
        width={theme.layout.iconBox}
        height={theme.layout.iconBox}
        radius={theme.radii.iconBox}
      />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="55%" />
        <Skeleton width="30%" height={10} />
      </View>
      <Skeleton width={60} />
    </View>
  );
}

/** A card of rows, for a list that has not arrived yet. */
export function SkeletonList({ rows = 4, label }: { rows?: number; label: string }) {
  const theme = useTheme();
  return (
    <Card padded={false} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
        {Array.from({ length: rows }, (_, index) => `row-${index + 1}`).map((key) => (
          <SkeletonRow key={key} />
        ))}
      </View>
    </Card>
  );
}

/** The shape of a budget line: name and spent on one row, its progress bar below. */
export function SkeletonBudgetRow() {
  const theme = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Skeleton width="40%" />
        <Skeleton width={70} />
      </View>
      <Skeleton width="100%" height={theme.layout.progressHeight} />
    </View>
  );
}
