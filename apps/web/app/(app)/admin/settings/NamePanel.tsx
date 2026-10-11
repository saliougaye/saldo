'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useState, useTransition } from 'react';
import type { SettingsErrorStrings } from '../../../../src/features/admin/errorStrings';
import { Alert } from '../../../../src/ui/Alert';
import { actionApplied } from '../../../../src/ui/actionApplied';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { TextField } from '../../../../src/ui/TextField';
import styles from '../admin.module.css';
import { saveInstanceNameAction } from './actions';

interface Props {
  /** The name stored here; empty when none is, and then the default shows as the placeholder. */
  value: string;
  placeholder?: string;
  /** `INSTANCE_NAME` sets it: the field shows the value and nothing saves. */
  locked: boolean;
  closeHref: string;
  maxLength: number;
  strings: {
    field: string;
    hint: string;
    cancel: string;
    save: string;
    busy: string;
    keyboardHint: string;
    errors: SettingsErrorStrings;
  };
}

/** «Nome dell'istanza»: one field. Empty saves as «back to the default name». */
export function NamePanel({ value, placeholder, locked, closeHref, maxLength, strings }: Props) {
  const router = useRouter();
  const [name, setName] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (pending || locked) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveInstanceNameAction>>;
      try {
        result = await saveInstanceNameAction(name);
      } catch {
        setProblem(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        await actionApplied();
        router.push(closeHref);
        return;
      }
      setProblem(strings.errors[result.error]);
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
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        disabled={locked}
        autoFocus={!locked}
        onChange={(event) => {
          setName(event.target.value);
          setProblem(null);
        }}
      />
      {problem === null ? null : <Alert body={problem} />}
      {locked ? null : (
        <FormFoot
          hint={strings.keyboardHint}
          cancelHref={closeHref}
          cancelLabel={strings.cancel}
          submitLabel={strings.save}
          busyLabel={strings.busy}
          pending={pending}
        />
      )}
    </form>
  );
}
