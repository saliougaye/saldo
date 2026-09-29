'use client';

import { useEffect } from 'react';
import styles from './Toast.module.css';

interface Props {
  message: string;
  action: { label: string; onClick: () => void; busy?: boolean };
  durationMs: number;
  /** Called once `durationMs` has passed. Keep it stable (`useCallback`): a new one restarts the timer. */
  onDismiss: () => void;
}

/**
 * The mockup's `.toast`: one status line with one action. Base UI's `Toast` manages a queue of
 * many; a single toast driven by the URL needs none of that, so this is a plain component.
 */
export function Toast({ message, action, durationMs, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);
  return (
    <div className={styles.toast} role="status">
      <span className={styles.message}>{message}</span>
      <button
        type="button"
        className={styles.action}
        onClick={action.onClick}
        disabled={action.busy === true}
        aria-busy={action.busy === true}
      >
        {action.label}
      </button>
    </div>
  );
}
