'use client';

import { useState, useTransition } from 'react';
import type { CategoryWriteError } from '../../../../src/server/write/categories';
import { Icon } from '../../../../src/ui/Icon';
import { reorderCategoryAction } from './actions';
import styles from './categories.module.css';

interface Props {
  id: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  upLabel: string;
  downLabel: string;
  errors: Record<CategoryWriteError | 'unexpected', string>;
}

/**
 * The up and down arrows of a row (§5.11; drag is the phone's): one place inside the sibling group,
 * disabled at either end. The write renumbers the group; the page refreshes to show the new order.
 */
export function ReorderButtons({ id, canMoveUp, canMoveDown, upLabel, downLabel, errors }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const move = (direction: -1 | 1) => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof reorderCategoryAction>>;
      try {
        result = await reorderCategoryAction({ id, direction });
      } catch {
        setError(errors.unexpected);
        return;
      }
      // The action renders the page again (`refreshAfterWrite`): nothing to refresh here.
      if (result.ok) return;
      setError(errors[result.error]);
    });
  };

  return (
    <>
      <div className={styles.reorder}>
        <button
          type="button"
          className={`${styles.arrow} ${styles.up}`}
          aria-label={upLabel}
          disabled={!canMoveUp || pending}
          onClick={() => move(-1)}
        >
          <Icon name="chevD" size={14} />
        </button>
        <button
          type="button"
          className={styles.arrow}
          aria-label={downLabel}
          disabled={!canMoveDown || pending}
          onClick={() => move(1)}
        >
          <Icon name="chevD" size={14} />
        </button>
      </div>
      {error === null ? null : (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </>
  );
}
