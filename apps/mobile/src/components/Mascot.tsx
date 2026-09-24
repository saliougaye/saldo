import { mascot } from '@saldo/ui';
import { useEffect } from 'react';
import {
  Image,
  type ImageSourcePropType,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../theme/motion';

// Metro resolves these to asset ids; typed here so nothing downstream sees `any`.
const idle: ImageSourcePropType = require('../../assets/mascot/idle.png');
const success: ImageSourcePropType = require('../../assets/mascot/success.png');
const POSES = { idle, success } as const;

export type MascotPose = keyof typeof POSES;

const OVERSHOOT = Easing.bezier(...mascot.overshootEasing);

/** Decoration (D26): whatever Rocky stands next to already says the same thing. */
const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  pointerEvents: 'none',
} as const;

export interface MascotPeekProps {
  pose: MascotPose;
  /** Rocky's width and height. */
  size: number;
  /** How much of him shows: the window's height, cut at its bottom edge. */
  window: number;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Rocky rising from behind an edge. Place it **before** what he peeks over: React Native paints
 * later siblings on top, and the window cuts him where that sibling begins.
 */
export function MascotPeek({ pose, size, window, delayMs = 0, style }: MascotPeekProps) {
  const { reduced } = useMotion();
  // 1 = still below the edge, 0 = in place.
  const below = useSharedValue(reduced ? 0 : 1);

  useEffect(() => {
    if (reduced) {
      below.set(0);
      return;
    }
    below.set(withDelay(delayMs, withTiming(0, { duration: mascot.peekMs, easing: EASE })));
  }, [reduced, delayMs, below]);

  const rising = useAnimatedStyle(() => ({
    transform: [{ translateY: below.get() * size * mascot.peekFromRatio }],
  }));

  return (
    <View
      testID="mascot"
      {...HIDDEN}
      style={[{ width: size, height: window, overflow: 'hidden' }, style]}
    >
      {/* The PNG's empty margin above his ears would waste the top of the window. */}
      <Animated.View style={[{ marginTop: -size * mascot.trimTop }, rising]}>
        <Image source={POSES[pose]} style={{ width: size, height: size }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

/** Rocky whole, with the app's only overshoot: the close sheet of a reached goal (§6.38). */
export function MascotCelebrate({ size }: { size: number }) {
  const { reduced } = useMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(withTiming(1, { duration: mascot.celebrateMs, easing: OVERSHOOT }));
  }, [reduced, progress]);

  const arriving = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      // The curve goes past 1; opacity must not.
      opacity: Math.min(1, p),
      transform: [
        { translateY: interpolate(p, [0, 1], [mascot.celebrateFromY, 0]) },
        { scale: interpolate(p, [0, 1], [mascot.celebrateFromScale, 1]) },
      ],
    };
  });

  return (
    <Animated.View testID="mascot" {...HIDDEN} style={[{ alignSelf: 'center' }, arriving]}>
      <Image source={success} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}
