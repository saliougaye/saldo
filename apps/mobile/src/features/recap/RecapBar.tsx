import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SWAP_EASE, useMotion } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';

export interface RecapBarProps {
  /** 0..1, clamped. */
  ratio: number;
  /** The tagged category, or a budget over its limit (§6.39). */
  accent?: boolean;
  /** True once the bar's section has scrolled into view; the bar grows the first time. */
  seen: boolean;
  /** Position in its list, for the stagger. */
  index: number;
}

/**
 * A 4pt bar of the recap (§6.39). It grows from empty once, `staggerMs` after the bar above it,
 * when told it is in view; with Reduce Motion it is drawn full at once. Decorative: every figure
 * it draws is also written next to it, so screen readers skip it. Empty in hidden mode, like
 * `ProgressBar`: a full bar beside a masked figure would still tell the amount.
 */
export function RecapBar({ ratio, accent = false, seen, index }: RecapBarProps) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const { hidden } = useHiddenAmounts();
  const target = hidden ? 0 : Math.min(1, Math.max(0, ratio));
  const fill = useSharedValue(reduced ? target : 0);

  useEffect(() => {
    if (reduced) {
      fill.value = target;
      return;
    }
    if (!seen) return;
    fill.value = withDelay(
      index * motion.staggerMs,
      withTiming(target, { duration: motion.progressMs, easing: SWAP_EASE }),
    );
  }, [reduced, seen, target, index, fill]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        marginTop: 8,
        height: theme.layout.progressHeight,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.track,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            width: '100%',
            borderRadius: theme.radii.pill,
            backgroundColor: accent ? theme.palette.accent : theme.palette.barGrey,
            transformOrigin: 'left',
          },
          style,
        ]}
      />
    </View>
  );
}
