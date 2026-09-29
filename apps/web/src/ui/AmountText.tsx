import type { AmountSign, CurrencyCode } from '@saldo/core';
import { type AppLocale, formatMoneyParts } from '@saldo/i18n';
import styles from './AmountText.module.css';

/**
 * Which of the three colours an amount takes. Only a **signed** amount is ever coloured: an expense
 * list is all expenses, and painting every row red says nothing (the phone's rule, §5.3).
 */
export function amountClass(minor: number, sign: AmountSign): 'positive' | 'negative' | 'neutral' {
  if (sign !== 'always') return 'neutral';
  if (minor > 0) return 'positive';
  if (minor < 0) return 'negative';
  return 'neutral';
}

interface Props {
  minor: number;
  currency: CurrencyCode;
  locale: AppLocale;
  sign?: AmountSign;
  /** `hero` is the 56px figure of a band, `body` a row's trailing amount. */
  size?: 'hero' | 'large' | 'title' | 'headline' | 'body' | 'footnote';
  muted?: boolean;
  /** Green without a `+`: Home's «Entrate», which is income by its label and needs no sign. */
  positive?: boolean;
}

/**
 * The design's amount: the fraction and the symbol at 50% opacity, the integer at full. Hidden mode
 * is a phone-only, device-local state (§17.1.6), so there is nothing to mask here.
 */
export function AmountText({
  minor,
  currency,
  locale,
  sign = 'negative',
  size = 'body',
  muted = false,
  positive = false,
}: Props) {
  const parts = formatMoneyParts(minor, currency, locale, sign);
  const symbol = <span className={styles.dim}>{parts.symbol}</span>;
  return (
    <span
      className={`${styles.amount} ${styles[size]} ${positive ? styles.positive : styles[amountClass(minor, sign)]} ${
        muted ? styles.muted : ''
      }`}
    >
      {parts.sign}
      {parts.symbolPosition === 'prefix' ? symbol : null}
      {parts.integer}
      {parts.fraction === '' ? null : (
        <span className={styles.dim}>
          {parts.decimalSeparator}
          {parts.fraction}
        </span>
      )}
      {parts.symbolPosition === 'suffix' ? <> {symbol}</> : null}
    </span>
  );
}
