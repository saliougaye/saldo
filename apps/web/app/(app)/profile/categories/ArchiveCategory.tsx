'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { CategoryWriteError } from '../../../../src/server/write/categories';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { Icon } from '../../../../src/ui/Icon';
import { Select, type SelectOption } from '../../../../src/ui/Select';
import { archiveCategoryAction } from './actions';
import styles from './categories.module.css';

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** Where the page goes once the category is archived: `/profile/categories`. */
  afterHref: string;
  /** Targets for «Sposta le transazioni in»; offered only when something uses the category. */
  targets: readonly SelectOption[];
  strings: {
    /** The button in the form's foot, «Archivia». */
    action: string;
    title: string;
    /** `categories.archiveBody` with the count. */
    body: string;
    moveTo: string;
    /** The first option of the select: no move. */
    noMove: string;
    confirm: string;
    confirmMove: string;
    cancel: string;
    busy: string;
    errors: Record<CategoryWriteError | 'unexpected', string>;
  };
}

/**
 * «Archivia» and its question (§5.11, §6.20). A category is never deleted; the transactions that
 * use it can move to another category of the same direction in the same write.
 */
export function ArchiveCategory({ id, updatedAt, afterHref, targets, strings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof archiveCategoryAction>>;
      try {
        result = await archiveCategoryAction({
          id,
          moveToId: target === '' ? null : target,
          expectedUpdatedAt: updatedAt,
        });
      } catch {
        setError(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        setOpen(false);
        router.push(afterHref);
        router.refresh();
        return;
      }
      setError(strings.errors[result.error]);
    });
  };

  return (
    <>
      <button
        type="button"
        className={styles.archiveButton}
        onClick={() => {
          setError(null);
          setTarget('');
          setOpen(true);
        }}
      >
        <Icon name="archive" size={14} />
        {strings.action}
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
        title={strings.title}
        body={strings.body}
        error={error ?? undefined}
        confirmLabel={target === '' ? strings.confirm : strings.confirmMove}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={confirm}
      >
        {targets.length === 0 ? null : (
          <Select
            label={strings.moveTo}
            value={target}
            options={[{ value: '', label: strings.noMove }, ...targets]}
            placeholder={strings.noMove}
            onChange={setTarget}
          />
        )}
      </ConfirmDialog>
    </>
  );
}
