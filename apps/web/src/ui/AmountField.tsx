'use client';

import { type MinorDigits, sanitizeAmountInput } from '@saldo/core';
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
}

/**
 * §17.1.7: the amount is typed with the computer's keyboard (D23's keypad is the phone's). The field
 * accepts a comma or a point and keeps the same buffer the phone's keypad builds, so
 * `amountBufferToMinor` reads both the same way.
 */
export function AmountField(props: Props) {
  const shown = props.buffer.replace('.', props.decimalSeparator);
  const symbol = <span className={styles.faint}>{props.symbol}</span>;
  return (
    <label className={styles.field}>
      <VisuallyHidden>{props.label}</VisuallyHidden>
      {props.sign === '' ? null : <span className={styles.faint}>{props.sign}</span>}
      {props.symbolPosition === 'prefix' ? symbol : null}
      <input
        className={styles.input}
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        placeholder={props.placeholder}
        // biome-ignore lint/a11y/noAutofocus: the form opens on the amount, as the phone's keypad does.
        autoFocus={props.autoFocus}
        aria-invalid={props.invalid === true}
        onChange={(event) =>
          props.onChange(sanitizeAmountInput(event.target.value, props.minorDigits))
        }
      />
      {props.symbolPosition === 'suffix' ? symbol : null}
    </label>
  );
}
