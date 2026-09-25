import { mascot } from '@saldo/ui';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useEffect, useRef } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../theme/motion';
import { type MascotState, mascotPlayback } from './mascotPlayback';

export type { MascotState } from './mascotPlayback';

// The mascot kit's Lottie states (§13 *Mascot*), typed here so nothing downstream sees `any`.
const SOURCES: Record<MascotState, AnimationObject> = {
  idle: require('../../assets/mascot/idle.json'),
  success: require('../../assets/mascot/success.json'),
  error: require('../../assets/mascot/error.json'),
  wave: require('../../assets/mascot/wave.json'),
  loading: require('../../assets/mascot/loading.json'),
  sleep: require('../../assets/mascot/sleep.json'),
};

const frames = (source: AnimationObject) => source.op - source.ip;

const OVERSHOOT = Easing.bezier(...mascot.overshootEasing);

/** Decoration (D26): whatever Rocky stands next to already says the same thing. */
const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  pointerEvents: 'none',
} as const;

export interface MascotProps {
  state: MascotState;
  /** Rocky's width and height: the kit's square canvas. */
  size: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One of the kit's states: `loading` and `sleep` loop, the others play once and stop on their pose,
 * and Reduce Motion holds the pose without playing (`mascotPlayback`).
 */
export function Mascot({ state, size, style }: MascotProps) {
  const { reduced } = useMotion();
  const ref = useRef<LottieView>(null);
  const source = SOURCES[state];
  const playback = mascotPlayback(state, frames(source), reduced);

  useEffect(() => {
    const next = mascotPlayback(state, frames(SOURCES[state]), reduced);
    if (next.kind === 'loop') ref.current?.play();
    if (next.kind === 'once') ref.current?.play(0, next.endFrame);
  }, [state, reduced]);

  return (
    <View testID={`mascot-${state}`} {...HIDDEN} style={[{ width: size, height: size }, style]}>
      <LottieView
        ref={ref}
        source={source}
        autoPlay={false}
        loop={playback.kind === 'loop'}
        progress={playback.kind === 'still' ? playback.progress : undefined}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}

export interface MascotPeekProps {
  state: MascotState;
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
export function MascotPeek({ state, size, window, delayMs = 0, style }: MascotPeekProps) {
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
      {/* The canvas's empty margin above his coin would waste the top of the window. */}
      <Animated.View style={[{ marginTop: -size * mascot.trimTop }, rising]}>
        <Mascot state={state} size={size} />
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
      <Mascot state="success" size={size} />
    </Animated.View>
  );
}
