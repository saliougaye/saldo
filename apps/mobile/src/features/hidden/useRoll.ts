import { motion } from '@saldo/ui';
import { useEffect, useRef } from 'react';
import type { ViewStyle } from 'react-native';
import {
  type AnimatedStyle,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../../theme/motion';

/**
 * Timing of the "Roll" motion chosen from the 2026-09-22 mockup (variant 2): the figure ticks up
 * and out like an odometer while the dots tick in from below; on reveal the dots leave upward and
 * the digits arrive from below, so the drum only ever turns one way.
 */
export const ROLL = {
  /** One layer travelling. */
  durationMs: 200,
  /** The incoming layer starts this much after the outgoing one. */
  handoverMs: 60,
  /** How far a layer travels, as a share of the font size. */
  travel: 0.6,
  /** Reduce Motion: opacity only. */
  reducedMs: 120,
} as const;

export interface Roll {
  realStyle: AnimatedStyle<ViewStyle>;
  maskStyle: AnimatedStyle<ViewStyle>;
}

/**
 * The whole figure rolls as one block. The mockup rolled digit by digit; on device that is one
 * `Text` per glyph and a JS re-render per step, which is what made the first cut lag. Two shared
 * values per layer, driven on the UI thread, cost nothing the JS thread can feel.
 *
 * `fontSize` sets the travel. `stagger` is the figure's place in the Home cascade (0 = the hero).
 */
export function useRoll(hidden: boolean, fontSize: number, stagger = 0): Roll {
  const { reduced } = useMotion();
  const travel = fontSize * ROLL.travel;
  const realY = useSharedValue(hidden ? -travel : 0);
  const realOpacity = useSharedValue(hidden ? 0 : 1);
  const maskY = useSharedValue(hidden ? 0 : travel);
  const maskOpacity = useSharedValue(hidden ? 1 : 0);
  const previous = useRef(hidden);

  useEffect(() => {
    if (previous.current === hidden) return;
    previous.current = hidden;

    if (reduced) {
      realY.value = 0;
      maskY.value = 0;
      realOpacity.value = withTiming(hidden ? 0 : 1, { duration: ROLL.reducedMs });
      maskOpacity.value = withTiming(hidden ? 1 : 0, { duration: ROLL.reducedMs });
      return;
    }

    const base = stagger * motion.staggerMs;
    const go = (to: number, delay: number) =>
      withDelay(delay, withTiming(to, { duration: ROLL.durationMs, easing: EASE }));

    if (hidden) {
      // Digits up and out; dots up from below, a beat later.
      realY.value = go(-travel, base);
      realOpacity.value = go(0, base);
      maskY.value = travel;
      maskY.value = go(0, base + ROLL.handoverMs);
      maskOpacity.value = go(1, base + ROLL.handoverMs);
    } else {
      // Dots up and out; digits up from below, a beat later. Same direction: the drum turns forward.
      maskY.value = go(-travel, base);
      maskOpacity.value = go(0, base);
      realY.value = travel;
      realY.value = go(0, base + ROLL.handoverMs);
      realOpacity.value = go(1, base + ROLL.handoverMs);
    }
  }, [hidden, reduced, stagger, travel, realY, realOpacity, maskY, maskOpacity]);

  const realStyle = useAnimatedStyle(() => ({
    opacity: realOpacity.value,
    transform: [{ translateY: realY.value }],
  }));
  const maskStyle = useAnimatedStyle(() => ({
    opacity: maskOpacity.value,
    transform: [{ translateY: maskY.value }],
  }));
  return { realStyle, maskStyle };
}
