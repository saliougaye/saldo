'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { CategoryWriteError } from '../../../../src/server/write/categories';
import { Button } from '../../../../src/ui/Button';
import { restoreCategoryAction } from './actions';
import styles from './categories.module.css';

interface Props {
  id: string;
  label: string;
  busyLabel: string;
  /** `web.categories.error_<error>` for each error, and a throw. */
  errors: Record<CategoryWriteError | 'unexpected', string>;
}

/** «Ripristina» for an archived category; the page refreshes in place. */
export function RestoreCategory({ id, label, busyLabel, errors }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const restore = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof restoreCategoryAction>>;
      try {
        result = await restoreCategoryAction(id);
      } catch {
        setError(errors.unexpected);
        return;
      }
      if (result.ok) {
        router.refresh();
        return;
      }
      setError(errors[result.error]);
    });
  };

  return (
    <div className={styles.restore}>
      <Button variant="secondary" busy={pending} busyLabel={busyLabel} onClick={restore}>
        {label}
      </Button>
      {error === null ? null : (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
