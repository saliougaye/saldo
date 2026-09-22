import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE, useMotion } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';

export interface StepSegmentsProps {
  /** 1-based step number. */
  current: number;
  total: number;
  /** The "Passo n di m" copy: the segments are the visible progress, this is the spoken one. */
  label: string;
}

/**
 * §6.29 progress: one 2px segment per step, the done ones and the current one filled. A separate
 * segment per step rather than one bar so the eye counts steps left without reading a number.
 */
export function StepSegments({ current, total, label }: StepSegmentsProps) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: current }}
      style={{ flexDirection: 'row', gap: theme.layout.stepSegmentGap }}
    >
      {Array.from({ length: total }, (_, index) => (
        // Segments never reorder; the index is the identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
        <Segment key={index} filled={index < current} />
      ))}
    </View>
  );
}

function Segment({ filled }: { filled: boolean }) {
  const theme = useTheme();
  const { reduced } = useMotion();
  // `scaleX` from the left edge, as in `ProgressBar`: a transform, not a width, so no layout per frame.
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    const target = filled ? 1 : 0;
    fill.value = reduced
      ? target
      : withTiming(target, { duration: motion.progressMs, easing: EASE });
  }, [filled, reduced, fill]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View
      testID="step-segment"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        flex: 1,
        height: theme.layout.stepSegmentHeight,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.track,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            transformOrigin: 'left',
            backgroundColor: theme.palette.accent,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
