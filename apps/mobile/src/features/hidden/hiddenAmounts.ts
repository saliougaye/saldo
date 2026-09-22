import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoney, type SignDisplay } from '@saldo/i18n';
import { createContext, useContext } from 'react';
import { maskedMoney, scrambleDigits } from './cipher';

/**
 * Where the figures are, visually. `hidden` flips at once; `phase` walks through `scrambling` for
 * the length of the cipher so that amounts embedded in a sentence can follow the same motion as
 * `AmountText`, which runs its own per-figure copy of it.
 *
 * Split from `HiddenAmountsProvider` so that a component reading the flag does not drag the
 * SQLite-backed `DatabaseProvider` into every test that renders an amount.
 */
export type HiddenPhase = 'visible' | 'scrambling' | 'hidden';

export interface HiddenAmounts {
  hidden: boolean;
  phase: HiddenPhase;
  /** Increments on every scramble step, so a consumer re-randomises its digits. */
  tick: number;
  setHidden(next: boolean): void;
  toggle(): void;
  /** Whether the eye button sits in the tab headers. Off by default; a Profile row turns it on. */
  buttonShown: boolean;
  setButtonShown(next: boolean): void;
}

/** Without a provider (tests, previews) the figures are simply visible. */
export const VISIBLE: HiddenAmounts = {
  hidden: false,
  phase: 'visible',
  tick: 0,
  setHidden: () => {},
  toggle: () => {},
  buttonShown: false,
  setButtonShown: () => {},
};

export const HiddenAmountsContext = createContext<HiddenAmounts>(VISIBLE);

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
