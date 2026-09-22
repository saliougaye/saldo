import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';
import { useDatabase } from '../../db/DatabaseProvider';
import { type HiddenAmounts, HiddenAmountsContext } from './hiddenAmounts';

/** Device-local (§7): a phone hidden in public must not blank the tablet at home. */
export const AMOUNTS_HIDDEN_KEY = 'amountsHidden';

/**
 * One boolean over `kv.amountsHidden`. Deliberately nothing else: every consumer re-renders when
 * the value changes, so the value must change exactly once per toggle. The motion is each
 * `AmountText`'s own business (`useCipher`).
 */
export function HiddenAmountsProvider({ children }: { children: ReactNode }) {
  const { kv } = useDatabase();
  const { t } = useTranslation();
  const [hidden, setHiddenState] = useState(() => kv.get(AMOUNTS_HIDDEN_KEY) === 'true');
  // The latest value, so the write to `kv` and the announcement run exactly once per change.
  const current = useRef(hidden);
  current.current = hidden;

  const setHidden = useCallback(
    (next: boolean) => {
      if (current.current === next) return;
      current.current = next;
      kv.set(AMOUNTS_HIDDEN_KEY, next ? 'true' : 'false');
      AccessibilityInfo.announceForAccessibility(
        t(next ? 'common.amountsHidden' : 'common.amountsShown'),
      );
      setHiddenState(next);
    },
    [kv, t],
  );

  const value = useMemo<HiddenAmounts>(
    () => ({ hidden, setHidden, toggle: () => setHidden(!hidden) }),
    [hidden, setHidden],
  );

  return <HiddenAmountsContext.Provider value={value}>{children}</HiddenAmountsContext.Provider>;
}
