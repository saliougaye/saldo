'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { TagWriteError } from '../../../../src/server/write/tags';
import { actionApplied } from '../../../../src/ui/actionApplied';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { Select } from '../../../../src/ui/Select';
import { mergeTagsAction } from './actions';

interface Props {
  id: string;
  /** The row's version as the page loaded it: a phone's edit since then is a `conflict` (§17.4.2). */
  updatedAt: string;
  /** The other tags, by name. */
  targets: readonly { id: string; name: string }[];
  /** Where the page goes once the tag has been merged away: `/profile/tags`. */
  afterHref: string;
  strings: {
    /** `tags.mergeInto`, «Unisci a un altro tag»: the field's label and the question's title. */
    label: string;
    /** `tags.mergeTitle`, «Unisci «X» a…»: the field's prompt. */
    prompt: string;
    /** `tags.mergeNote` for the chosen target: what moves, and that it cannot be undone. */
    note: (targetName: string) => string;
    confirm: string;
    cancel: string;
    busy: string;
    errors: Record<TagWriteError | 'unexpected', string>;
  };
}

/**
 * «Unisci a un altro tag» (§5.10). Merging rewrites every transaction the tag carries and cannot be
 * undone, so choosing a target only asks: the dialog says what will happen and «Unisci» does it —
 * the phone's `MergeTagSheet`.
 */
export function MergeTag({ id, updatedAt, targets, afterHref, strings }: Props) {
  const router = useRouter();
  // The last target picked. It outlives «Annulla» so the question keeps its words while it closes;
  // the field itself never holds a pick, which would read as a merge that happened.
  const [targetId, setTargetId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const target = targets.find((candidate) => candidate.id === targetId);

  const confirm = () => {
    if (pending || target === undefined) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof mergeTagsAction>>;
      try {
        result = await mergeTagsAction({
          sourceId: id,
          targetId: target.id,
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
      <Select
        label={strings.label}
        value={null}
        options={targets.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
        placeholder={strings.prompt}
        onChange={(next) => {
          setError(null);
          setTargetId(next);
          setOpen(true);
        }}
      />
      <ConfirmDialog
        open={open && target !== undefined}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
        }}
        title={strings.label}
        body={target === undefined ? '' : strings.note(target.name)}
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
