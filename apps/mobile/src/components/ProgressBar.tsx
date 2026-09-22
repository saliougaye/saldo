import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useHiddenAmounts } from '../features/hidden/hiddenAmounts';
import { EASE, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';

export interface ProgressBarProps {
  /** 0..1; values above 1 are clamped, the caller decides how to signal "over". */
  ratio: number;
  /** Where the cycle pace sits, drawn as a tick (§5.8). */
  pace?: number;
  overPace?: boolean;
  /** Whether hidden mode empties this bar. The Home budget card opts out. */
  hideable?: boolean;
}

export function ProgressBar({ ratio, pace, overPace = false, hideable = true }: ProgressBarProps) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const hidden = useHiddenAmounts().hidden && hideable;
  // A bar full to the brim beside a masked figure still says "over budget", so it empties too.
  const clamped = hidden ? 0 : Math.min(1, Math.max(0, ratio));
  // `scaleX` rather than `width`: a width animation re-runs layout on every frame, a transform
  // does not. The bar is drawn at full width and squeezed from its left edge.
  const fill = useSharedValue(clamped);
  useEffect(() => {
    fill.value = reduced
      ? clamped
      : withTiming(clamped, { duration: motion.progressMs, easing: EASE });
  }, [clamped, reduced, fill]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={hidden ? undefined : { min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{
        height: theme.layout.progressHeight,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.track,
        overflow: 'visible',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            width: '100%',
            height: theme.layout.progressHeight,
            borderRadius: theme.radii.pill,
            transformOrigin: 'left',
            backgroundColor: overPace ? theme.palette.accent : theme.palette.barGrey,
          },
          fillStyle,
        ]}
      />
      {pace === undefined || hidden ? null : (
        <View
          style={{
            position: 'absolute',
            left: `${Math.min(1, Math.max(0, pace)) * 100}%`,
            top: -theme.layout.paceTickOverhang,
            width: 1,
            height: theme.layout.progressHeight + theme.layout.paceTickOverhang * 2,
            backgroundColor: theme.palette.textFaint,
          }}
        />
      )}
    </View>
  );
}
