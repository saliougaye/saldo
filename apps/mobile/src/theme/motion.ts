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
  withDelay,
  withTiming,
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

/** When the `chunk`-th block of an onboarding step — or its `word`-th word — starts arriving. */
export function stepDelay(chunk: number, word?: number): number {
  return chunk * motion.stepChunkStaggerMs + (word ?? 0) * motion.stepWordStaggerMs;
}

/**
 * A block of an onboarding step arriving (§6.29): rises `stepEnterOffset` while fading in, later
 * blocks later. Reduce Motion skips to the end state, and the fade transition of the Stack is the
 * only exit, so nothing here has a leaving counterpart.
 */
export function stepEntering(chunk: number, word?: number) {
  return FadeInUp.duration(motion.stepEnterMs)
    .delay(stepDelay(chunk, word))
    .easing(EASE)
    .withInitialValues({ opacity: 0, transform: [{ translateY: motion.stepEnterOffset }] })
    .reduceMotion(ReduceMotion.System);
}

export const SWAP_EASE = Easing.bezier(...motion.swapEasing);

/** A row of the permissions list growing or shrinking as it opens and closes. */
export const expanding = LinearTransition.duration(motion.expandMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/** The body of the row that just opened, once the row has started to make room for it. */
export const revealing = FadeIn.duration(motion.fadeMs)
  .delay(motion.revealDelayMs)
  .easing(EASE)
  .reduceMotion(ReduceMotion.System);

/**
 * A status taking the place of the controls that produced it (better-ui swap): opacity from 0 and
 * scale from `fromScale`, never from nothing. A custom entering because Reanimated's `FadeIn`
 * animates opacity only and `ZoomIn` starts at scale 0.
 */
export function swapIn(fromScale: number, delay = 0) {
  return () => {
    'worklet';
    const config = {
      duration: motion.fadeMs,
      easing: SWAP_EASE,
      reduceMotion: ReduceMotion.System,
    };
    return {
      initialValues: { opacity: 0, transform: [{ scale: fromScale }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, config), ReduceMotion.System),
        transform: [{ scale: withDelay(delay, withTiming(1, config), ReduceMotion.System) }],
      },
    };
  };
}
