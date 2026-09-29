'use client';

import { type MinorDigits, sanitizeAmountInput } from '@saldo/core';
import { useId } from 'react';
import styles from './AmountField.module.css';
import { VisuallyHidden } from './VisuallyHidden';

interface Props {
  label: string;
  buffer: string;
  onChange: (buffer: string) => void;
  minorDigits: MinorDigits;
  /** The locale's decimal separator, from `formatMoneyParts` on the server. */
  decimalSeparator: string;
  sign: '−' | '+' | '';
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  placeholder: string;
  autoFocus?: boolean;
  invalid?: boolean;
  /**
   * `hero` (the default) is the transaction form's headline figure, its label read by screen readers
   * only; `body` is an ordinary field with its label shown above it, as onboarding's balance.
   */
  size?: 'hero' | 'body';
  /** A balance may start below zero (a card in debt): `-` or `−` anywhere makes the buffer negative. */
  allowNegative?: boolean;
}

/**
 * §17.1.7: the amount is typed with the computer's keyboard (D23's keypad is the phone's). The field
 * accepts a comma or a point and keeps the same buffer the phone's keypad builds, so
 * `amountBufferToMinor` reads both the same way.
 */
export function AmountField(props: Props) {
  const body = props.size === 'body';
  const id = useId();
  // The buffer stores `-`; the field shows the typographic minus, which the sanitizer reads back.
  const shown = props.buffer.replace('-', '\u2212').replace('.', props.decimalSeparator);
  const symbol = <span className={styles.faint}>{props.symbol}</span>;
  const figure = (
    <>
      {props.sign === '' ? null : <span className={styles.faint}>{props.sign}</span>}
      {props.symbolPosition === 'prefix' ? symbol : null}
      <input
        id={id}
        className={styles.input}
        // A phone's decimal keypad has no minus key: a signed balance needs the full keyboard.
        inputMode={props.allowNegative === true ? 'text' : 'decimal'}
        autoComplete="off"
        value={shown}
        placeholder={props.placeholder}
        // biome-ignore lint/a11y/noAutofocus: the form opens on the amount, as the phone's keypad does.
        autoFocus={props.autoFocus}
        aria-invalid={props.invalid === true}
        onChange={(event) =>
          props.onChange(
            sanitizeAmountInput(event.target.value, props.minorDigits, {
              allowNegative: props.allowNegative === true,
            }),
          )
        }
      />
      {props.symbolPosition === 'suffix' ? symbol : null}
    </>
  );
  if (body) {
    return (
      <label className={styles.bodyField} htmlFor={id}>
        <span className={styles.bodyLabel}>{props.label}</span>
        <span className={styles.bodyBox}>{figure}</span>
      </label>
    );
  }
  return (
    <label className={styles.field} htmlFor={id}>
      <VisuallyHidden>{props.label}</VisuallyHidden>
      {figure}
    </label>
  );
}
