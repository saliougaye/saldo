import { motion } from '@saldo/ui';
import { useEffect, useRef, useState } from 'react';
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from 'react-native-reanimated';
import { countUpValue } from './countUp';

/**
 * The app's motion, in one place (§13 says nothing about timing, so this is the scale).
 *
 * Three rules hold everywhere:
 *  - **Only `transform` and `opacity`.** Everything else costs layout on every frame.
 *  - **Enter and exit are asymmetric.** Something arriving is worth watching; something leaving is
 *    in the way, so it goes at `pressMs`.
 *  - **Motion is never the only cue.** Every animation here decorates a change that is already
 *    visible in a number, a colour or a label, so a device with Reduce Motion on loses nothing.
 *
 * Reduce Motion is honoured by construction: `ReduceMotion.System` makes Reanimated skip to the
 * end state instead of animating, and `useMotion().reduced` covers the hand-written ones.
 */
export const EASE = Easing.bezier(...motion.easing);

/** Whether this device wants motion at all, plus the durations to use when it does. */
export function useMotion(): { reduced: boolean; duration: (ms: number) => number } {
  const reduced = useReducedMotion();
  return { reduced, duration: (ms: number) => (reduced ? 0 : ms) };
}

/** A card or a row arriving on a screen the user just opened. `index` staggers siblings. */
export function entering(index = 0) {
  return FadeInDown.duration(motion.fadeMs)
    .delay(index * motion.staggerMs)
    .easing(EASE)
    .reduceMotion(ReduceMotion.System);
}

/** A row appearing in a list that is already on screen — a filter clearing, a sync arriving. */
export const appearing = FadeIn.duration(motion.fadeMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/** Leaving is faster than arriving: it is already out of the way. */
export const leaving = FadeOut.duration(motion.pressMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/**
 * The toast, which comes up from the edge it lives on. Same direction out as in (`leaving` fades
 * in place), so a swipe-to-dismiss would agree with it.
 */
export const toastEntering = FadeInUp.duration(motion.fadeMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/** Rows closing the gap left by a deleted or filtered-out sibling. */
export const reflowing = LinearTransition.duration(motion.fadeMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/**
 * Counts from the previous value to `value`.
 *
 * On the JS thread on purpose: the money formatter lives in `@saldo/i18n` and is not a worklet, so
 * the alternative is duplicating currency formatting inside the UI thread. One text node for
 * {@link motion.countMs} is a cost the main thread can carry; a list of them would not be.
 */
export function useCountUp(value: number, enabled = true): number {
  const { reduced } = useMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (!enabled || reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = Date.now();
    const origin = from.current;
    const step = () => {
      const t = (Date.now() - start) / motion.countMs;
      setShown(countUpValue(origin, value, t));
      if (t < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, enabled, reduced]);

  return shown;
}
