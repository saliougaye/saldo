'use client';

import type { IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveMoveTargets } from '../../../../src/features/categories/archiveView';
import type { CategoryWriteError } from '../../../../src/server/write/categories';
import { actionApplied } from '../../../../src/ui/actionApplied';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { Icon } from '../../../../src/ui/Icon';
import { Select } from '../../../../src/ui/Select';
import { archiveCategoryAction } from './actions';
import { useCategoryFormShared } from './CategoryForm';
import styles from './categories.module.css';

/** The dialog's copy that does not depend on the category: the page gives it once. */
export interface ArchiveStrings {
  /** The button in the form's foot, «Archivia». */
  action: string;
  title: string;
  moveTo: string;
  /** The first option of the select: no move. */
  noMove: string;
  confirm: string;
  confirmMove: string;
  cancel: string;
  busy: string;
  errors: Record<CategoryWriteError | 'unexpected', string>;
}

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** Where the page goes once the category is archived: `/profile/categories`. */
  afterHref: string;
  /**
   * How many transactions use it. «Sposta le transazioni in» is offered only when some do and
   * another category can take them (`archiveMoveTargets`).
   */
  uses: number;
  /** `categories.archiveBody` with the count. */
  body: string;
}

/**
 * «Archivia» and its question (§5.11, §6.20). A category is never deleted; the transactions that
 * use it can move to another category of the same direction in the same write.
 */
export function ArchiveCategory({ id, updatedAt, afterHref, uses, body }: Props) {
  const { categories, archive: strings } = useCategoryFormShared();
  const targets = archiveMoveTargets(categories, id, uses);
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
        await actionApplied();
        router.push(afterHref);
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
        body={body}
        error={error ?? undefined}
        confirmLabel={target === '' ? strings.confirm : strings.confirmMove}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={confirm}
      >
        {targets === null ? null : (
          <Select
            label={strings.moveTo}
            value={target}
            options={[
              { value: '', label: strings.noMove },
              ...targets.map((row) => ({
                value: row.id,
                label: row.name,
                icon: row.icon as IconName,
                colorIndex: row.colorIndex,
              })),
            ]}
            placeholder={strings.noMove}
            onChange={setTarget}
          />
        )}
      </ConfirmDialog>
    </>
  );
}
