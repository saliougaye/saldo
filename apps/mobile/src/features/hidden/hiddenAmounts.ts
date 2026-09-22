import type { CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoney, type SignDisplay } from '@saldo/i18n';
import { createContext, useCallback, useContext } from 'react';
import { maskedMoney } from './mask';

/**
 * Split from `HiddenAmountsProvider` so that a component reading the flag does not drag the
 * SQLite-backed `DatabaseProvider` into every test that renders an amount.
 */
export interface HiddenAmounts {
  hidden: boolean;
  setHidden(next: boolean): void;
  toggle(): void;
}

/** Without a provider (tests, previews) the figures are simply visible. */
export const VISIBLE: HiddenAmounts = {
  hidden: false,
  setHidden: () => {},
  toggle: () => {},
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
 * the width and animates the cipher.
 *
 * A sentence swaps to the dots at once, with no motion. The hook is called at screen level, so
 * anything it re-rendered on would re-render the whole screen: an earlier version followed the
 * scramble step by step and cost five full renders of Home per toggle.
 */
export function useHiddenMoney(): { hidden: boolean; format: MoneyFormatter } {
  const { hidden } = useHiddenAmounts();
  const format = useCallback<MoneyFormatter>(
    (minor, currency, locale, signDisplay = 'negative') =>
      hidden ? maskedMoney(currency, locale) : formatMoney(minor, currency, locale, signDisplay),
    [hidden],
  );
  return { hidden, format };
}
