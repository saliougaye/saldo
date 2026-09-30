'use client';

import { type KeyboardEvent, useRef } from 'react';
import { Icon } from './Icon';
import styles from './OptionList.module.css';
import { rovingTabStop, rovingTarget } from './rovingRadios';

export interface ListOption<V extends string> {
  value: V;
  label: string;
  /** A second line under the label: a currency's name under its code. */
  subtitle?: string;
  /** On the trailing side, muted: the hour in a zone, zero in a currency. */
  detail?: string;
}

export interface ListGroup<V extends string> {
  /** «Comuni», «Tutte le valute»; a list of one group has none. */
  label?: string;
  options: readonly ListOption<V>[];
}

/**
 * One tab stop for a group of `count` radios; the arrows move the **focus** and Space or Enter
 * chooses. Unlike a form's radios the selection does not follow the arrows: here a choice is saved
 * as it is made, and walking past five languages must not write five times.
 */
export function useRovingFocus(count: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = rovingTarget(event.key, index, count);
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
  };
  const ref = (index: number) => (node: HTMLButtonElement | null) => {
    refs.current[index] = node;
  };
  return { onKeyDown, ref };
}

interface Props<V extends string> {
  /** The name of the radio group: the setting's. */
  label: string;
  groups: readonly ListGroup<V>[];
  selected: V | null;
  onSelect: (value: V) => void;
  /** The choices are shown and cannot be changed (a setting the environment locks). */
  disabled?: boolean;
}

/** The phone's `OptionRow`s: the selected one is a check, not a colour the user has to compare. */
export function OptionList<V extends string>({
  label,
  groups,
  selected,
  onSelect,
  disabled = false,
}: Props<V>) {
  const flat = groups.flatMap((group) => group.options);
  const roving = useRovingFocus(flat.length);
  const stop = rovingTabStop(
    flat.findIndex((option) => option.value === selected),
    flat.length,
  );
  let index = -1;
  return (
    <div className={styles.list} role="radiogroup" aria-label={label}>
      {groups.map((group) =>
        group.options.length === 0 ? null : (
          <div key={group.label ?? ''} className={styles.group}>
            {group.label === undefined ? null : <p className={styles.groupLabel}>{group.label}</p>}
            {group.options.map((option) => {
              index += 1;
              const at = index;
              const checked = option.value === selected;
              return (
                // biome-ignore lint/a11y/useSemanticElements: a row is drawn as a button; the radio role keeps the group's one tab stop.
                <button
                  key={option.value}
                  ref={roving.ref(at)}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={disabled}
                  tabIndex={at === stop ? 0 : -1}
                  className={styles.option}
                  onClick={() => onSelect(option.value)}
                  onKeyDown={(event) => roving.onKeyDown(event, at)}
                >
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.subtitle === undefined ? null : (
                      <span className={styles.optionSubtitle}>{option.subtitle}</span>
                    )}
                  </span>
                  {option.detail === undefined ? null : (
                    <span className={styles.optionDetail}>{option.detail}</span>
                  )}
                  <Icon name="check" size={16} className={styles.optionCheck} />
                </button>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}
