import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';

/**
 * §13: toggles expose `accessibilityRole="switch"` with their state.
 *
 * The knob travels on `translateX`, not on a margin: a margin animation lays the row out again on
 * every frame. The track and the knob change colour along with it, so the state is still legible
 * from colour alone when Reduce Motion skips the travel.
 */
export function Toggle({
  value,
  onChange,
  accessibilityLabel,
  testID,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  /** For the end-to-end flows in `apps/mobile/maestro`, whose labels are translated. */
  testID?: string;
}) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const inset = (theme.layout.toggleHeight - theme.layout.toggleKnob) / 2;
  const travel = theme.layout.toggleWidth - theme.layout.toggleKnob - inset * 2;
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const next = value ? 1 : 0;
    on.value = reduced ? next : withTiming(next, { duration: motion.toggleMs, easing: EASE });
  }, [value, reduced, on]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      [theme.palette.track, theme.palette.accent],
    ),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * travel }],
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      [theme.palette.textFaint, theme.palette.onAccent],
    ),
  }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      // The track is 22pt tall: 11 each side is what carries it to the 44pt floor.
      hitSlop={11}
      onPress={() => onChange(!value)}
    >
      <Animated.View
        style={[
          {
            width: theme.layout.toggleWidth,
            height: theme.layout.toggleHeight,
            borderRadius: theme.radii.toggle,
            justifyContent: 'center',
            paddingHorizontal: inset,
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: theme.layout.toggleKnob,
              height: theme.layout.toggleKnob,
              borderRadius: theme.radii.pill,
            },
            knobStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
