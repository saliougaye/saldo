import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';
import { useDatabase } from '../../db/DatabaseProvider';
import { useMotion } from '../../theme/motion';
import { CIPHER } from './cipher';
import { type HiddenAmounts, HiddenAmountsContext, type HiddenPhase } from './hiddenAmounts';

/** Device-local (§7): a phone hidden in public must not blank the tablet at home. */
export const AMOUNTS_HIDDEN_KEY = 'amountsHidden';

export function HiddenAmountsProvider({ children }: { children: ReactNode }) {
  const { kv } = useDatabase();
  const { t } = useTranslation();
  const { reduced } = useMotion();
  const [hidden, setHiddenState] = useState(() => kv.get(AMOUNTS_HIDDEN_KEY) === 'true');
  const [phase, setPhase] = useState<HiddenPhase>(hidden ? 'hidden' : 'visible');
  const [tick, setTick] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The latest value, for `setHidden` to compare against without going through an updater: the
  // write to `kv`, the announcement and the timers are side effects and must run exactly once.
  const current = useRef(hidden);
  current.current = hidden;

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const setHidden = useCallback(
    (next: boolean) => {
      if (current.current === next) return;
      current.current = next;
      kv.set(AMOUNTS_HIDDEN_KEY, next ? 'true' : 'false');
      AccessibilityInfo.announceForAccessibility(
        t(next ? 'common.amountsHidden' : 'common.amountsShown'),
      );
      clearTimers();
      setHiddenState(next);
      const settled: HiddenPhase = next ? 'hidden' : 'visible';
      if (reduced) {
        setPhase(settled);
        return;
      }
      setPhase('scrambling');
      for (let step = 1; step < CIPHER.steps; step++) {
        timers.current.push(setTimeout(() => setTick((n) => n + 1), step * CIPHER.stepMs));
      }
      timers.current.push(setTimeout(() => setPhase(settled), CIPHER.steps * CIPHER.stepMs));
    },
    [kv, t, reduced, clearTimers],
  );

  const value = useMemo<HiddenAmounts>(
    () => ({
      hidden,
      phase,
      tick,
      setHidden,
      toggle: () => setHidden(!hidden),
    }),
    [hidden, phase, tick, setHidden],
  );

  return <HiddenAmountsContext.Provider value={value}>{children}</HiddenAmountsContext.Provider>;
}
