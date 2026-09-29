'use client';

import { useId } from 'react';
import styles from './Switch.module.css';

interface Props {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** The mockup's `.toggle-row`: the label and its note are the switch's name and description. */
export function Switch({ label, note, checked, onChange }: Props) {
  const id = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span id={`${id}-label`}>{label}</span>
        {note === undefined ? null : (
          <span className={styles.note} id={`${id}-note`}>
            {note}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={note === undefined ? undefined : `${id}-note`}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
