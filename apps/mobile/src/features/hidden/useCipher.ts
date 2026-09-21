import { motion } from '@saldo/ui';
import { useEffect, useRef, useState } from 'react';
import {
  type AnimatedStyle,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { EASE, useMotion } from '../../theme/motion';
import { CIPHER, digitCount, scrambleDigits, settleDigits } from './cipher';

export interface Cipher {
  /** The integer part to draw right now: real, or mid-scramble. */
  integer: string;
  /** True while the digits are noise, so the caller can dim them. */
  scrambling: boolean;
  realStyle: AnimatedStyle;
  maskStyle: AnimatedStyle;
}

/**
 * The per-figure half of the Cipher motion (see `cipher.ts` for the timings and the mockup).
 *
 * Hide: `stagger × staggerMs` later the digits turn to noise for `steps × stepMs`, then the real
 * layer fades out as the dots fade in over `fadeMs`. Reveal: the dots fade at once, the digits
 * arrive as noise and settle to the real value right to left, one every `settleMs`.
 *
 * The text swaps run on the JS thread (a formatted string cannot be a worklet); the two opacities
 * run on the UI thread. Reduce Motion drops the text swaps and crossfades in `reducedMs`.
 */
export function useCipher(integer: string, hidden: boolean, stagger = 0): Cipher {
  const { reduced } = useMotion();
  const [drawn, setDrawn] = useState(integer);
  const [scrambling, setScrambling] = useState(false);
  const real = useSharedValue(hidden ? 0 : 1);
  const mask = useSharedValue(hidden ? 1 : 0);
  const previous = useRef(hidden);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animating = useRef(false);

  // A new amount while nothing is animating is drawn as it is.
  useEffect(() => {
    if (!animating.current) setDrawn(integer);
  }, [integer]);

  useEffect(() => {
    if (previous.current === hidden) return;
    previous.current = hidden;
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];

    if (reduced) {
      real.value = withTiming(hidden ? 0 : 1, { duration: CIPHER.reducedMs });
      mask.value = withTiming(hidden ? 1 : 0, { duration: CIPHER.reducedMs });
      setDrawn(integer);
      setScrambling(false);
      return;
    }

    const base = stagger * motion.staggerMs;
    const scrambleMs = CIPHER.steps * CIPHER.stepMs;
    const at = (ms: number, run: () => void) => {
      timers.current.push(setTimeout(run, base + ms));
    };
    const fade = (to: number, delay: number) =>
      withDelay(delay, withTiming(to, { duration: CIPHER.fadeMs, easing: EASE }));

    animating.current = true;
    for (let step = 0; step < CIPHER.steps; step++) {
      at(step * CIPHER.stepMs, () => {
        setScrambling(true);
        setDrawn(scrambleDigits(integer));
      });
    }
    if (hidden) {
      real.value = fade(0, base + scrambleMs);
      mask.value = fade(1, base + scrambleMs);
      // The real layer is invisible by now; put the true digits back under the dots.
      at(scrambleMs + CIPHER.fadeMs, () => {
        setDrawn(integer);
        setScrambling(false);
        animating.current = false;
      });
    } else {
      real.value = fade(1, base);
      mask.value = fade(0, base);
      const digits = digitCount(integer);
      for (let settled = 1; settled <= digits; settled++) {
        at(scrambleMs + (settled - 1) * CIPHER.settleMs, () => {
          setDrawn(settleDigits(integer, settled));
          if (settled === digits) {
            setScrambling(false);
            animating.current = false;
          }
        });
      }
      if (digits === 0) {
        at(scrambleMs, () => {
          setScrambling(false);
          animating.current = false;
        });
      }
    }
  }, [hidden, integer, reduced, stagger, real, mask]);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );

  const realStyle = useAnimatedStyle(() => ({ opacity: real.value }));
  const maskStyle = useAnimatedStyle(() => ({ opacity: mask.value }));
  return { integer: drawn, scrambling, realStyle, maskStyle };
}
