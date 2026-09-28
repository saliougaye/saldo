'use client';

import { type InputHTMLAttributes, useId } from 'react';
import styles from './TextField.module.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  label: string;
  hint?: string;
  invalid?: boolean;
  /** An invite code is read in groups, so it is set in a monospaced face. */
  mono?: boolean;
}

export function TextField({ label, hint, invalid = false, mono = false, ...rest }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={`${styles.input} ${invalid ? styles.invalid : ''} ${mono ? styles.mono : ''}`}
        aria-invalid={invalid}
        aria-describedby={hint === undefined ? undefined : hintId}
      />
      {hint === undefined ? null : (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}
    </div>
  );
}
