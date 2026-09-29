'use client';

import { type KeyboardEvent, useRef } from 'react';
import styles from './Segmented.module.css';

interface Props<V extends string> {
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}

/** The phone's segmented control (§6.16) as a radio group: one tab stop, arrows move within it. */
export function Segmented<V extends string>({ label, value, options, onChange }: Props<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (option === undefined) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: a segment is drawn as a button; the radio role keeps the group's one tab stop and arrow keys.
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          className={styles.option}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
