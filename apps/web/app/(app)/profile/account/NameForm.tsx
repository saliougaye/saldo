'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useState, useTransition } from 'react';
import { Alert } from '../../../../src/ui/Alert';
import { actionApplied } from '../../../../src/ui/actionApplied';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { TextField } from '../../../../src/ui/TextField';
import styles from './account.module.css';
import { renameAccountAction } from './actions';

interface Props {
  value: string;
  maxLength: number;
  /** The section with no panel open: where «Annulla» and a save go. */
  closeHref: string;
  strings: {
    field: string;
    hint: string;
    cancel: string;
    save: string;
    busy: string;
    keyboardHint: string;
    empty: string;
    tooLong: string;
    failed: string;
  };
}

/** Profilo → «Modifica» on the name: one field, saved by `renameAccountAction`. */
export function NameForm({ value, maxLength, closeHref, strings }: Props) {
  const router = useRouter();
  const [name, setName] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (pending) return;
    if (name.trim() === '') {
      setProblem(strings.empty);
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof renameAccountAction>>;
      try {
        result = await renameAccountAction(name);
      } catch {
        setProblem(strings.failed);
        return;
      }
      if (result.ok) {
        await actionApplied();
        router.push(closeHref);
        return;
      }
      setProblem(
        result.reason === 'empty'
          ? strings.empty
          : result.reason === 'tooLong'
            ? strings.tooLong
            : strings.failed,
      );
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape' && event.target instanceof HTMLInputElement) event.target.blur();
  };

  return (
    <form
      className={styles.form}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      data-owns-keys=""
    >
      <TextField
        label={strings.field}
        hint={strings.hint}
        value={name}
        maxLength={maxLength}
        autoComplete="name"
        autoFocus
        invalid={problem !== null}
        onChange={(event) => {
          setName(event.target.value);
          setProblem(null);
        }}
      />
      {problem === null ? null : <Alert body={problem} />}
      <FormFoot
        hint={strings.keyboardHint}
        cancelHref={closeHref}
        cancelLabel={strings.cancel}
        submitLabel={strings.save}
        busyLabel={strings.busy}
        pending={pending}
      />
    </form>
  );
}
