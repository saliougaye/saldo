'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { TagWriteError } from '../../../../src/server/write/tags';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { Icon } from '../../../../src/ui/Icon';
import { deleteTagAction } from './actions';
import styles from './tags.module.css';

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** Where the page goes once the tag is gone: `/profile/tags`. */
  afterHref: string;
  strings: {
    /** The button in the form's foot, «Elimina tag». */
    action: string;
    /** `tags.deleteTitle`, with the tag's name. */
    title: string;
    /** `tags.deleteNote` with the count, or `deleteNoteUnused`: the transactions stay. */
    body: string;
    confirm: string;
    cancel: string;
    busy: string;
    errors: Record<TagWriteError | 'unexpected', string>;
  };
}

/**
 * «Elimina tag» and its question (§5.10): the tag goes, its transactions stay without it. As on the
 * phone it asks first and offers no undo.
 */
export function DeleteTag({ id, updatedAt, afterHref, strings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (pending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteTagAction>>;
      try {
        result = await deleteTagAction(id, updatedAt);
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
        className={styles.deleteButton}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="trash" size={14} />
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
        confirmLabel={strings.confirm}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={confirm}
      />
    </>
  );
}
