import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoney, type SignDisplay } from '@saldo/i18n';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo } from 'react-native';
import { useDatabase } from '../../db/DatabaseProvider';
import { useMotion } from '../../theme/motion';
import { CIPHER, maskedMoney, scrambleDigits } from './cipher';

/** Device-local (§7): a phone hidden in public must not blank the tablet at home. */
export const AMOUNTS_HIDDEN_KEY = 'amountsHidden';

/**
 * Where the figures are, visually. `hidden` flips at once; `phase` walks through `scrambling` for
 * the length of the cipher so that amounts embedded in a sentence can follow the same motion as
 * `AmountText`, which runs its own per-figure copy of it.
 */
export type HiddenPhase = 'visible' | 'scrambling' | 'hidden';

export interface HiddenAmounts {
  hidden: boolean;
  phase: HiddenPhase;
  /** Increments on every scramble step, so a consumer re-randomises its digits. */
  tick: number;
  setHidden(next: boolean): void;
  toggle(): void;
}

const NONE: HiddenAmounts = {
  hidden: false,
  phase: 'visible',
  tick: 0,
  setHidden: () => {},
  toggle: () => {},
};

const HiddenAmountsContext = createContext<HiddenAmounts>(NONE);

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

export function useHiddenAmounts(): HiddenAmounts {
  return useContext(HiddenAmountsContext);
}

export type MoneyFormatter = (
  minor: number,
  currency: CurrencyCode,
  locale: AppLocale,
  signDisplay?: SignDisplay,
) => string;

/**
 * `formatMoney` that follows hidden mode, for the amounts a sentence embeds through
 * `t(key, { amount })`. Prefer `AmountText` wherever the figure stands on its own: it also holds
 * the width and animates the crossfade. A sentence cannot, so it steps digits → noise → dots.
 */
export function useHiddenMoney(): { hidden: boolean; format: MoneyFormatter } {
  const { hidden, phase } = useHiddenAmounts();
  // Not memoised on purpose: the provider re-renders its consumers on every scramble step (`tick`),
  // and each render must draw new random digits.
  const format: MoneyFormatter = (minor, currency, locale, signDisplay = 'negative') => {
    if (phase === 'hidden') return maskedMoney(currency, locale);
    const real = formatMoney(minor, currency, locale, signDisplay);
    return phase === 'scrambling' ? scrambleDigits(real) : real;
  };
  return { hidden, format };
}
