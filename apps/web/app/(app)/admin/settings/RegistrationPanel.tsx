'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useState, useTransition } from 'react';
import type { SettingsErrorStrings } from '../../../../src/features/admin/errorStrings';
import type { RegistrationMode } from '../../../../src/server/env';
import { Alert } from '../../../../src/ui/Alert';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { type ListOption, OptionList } from '../../../../src/ui/OptionList';
import styles from '../admin.module.css';
import { saveRegistrationAction } from './actions';

interface Props {
  value: RegistrationMode;
  options: readonly ListOption<RegistrationMode>[];
  /** `REGISTRATION` sets it: the choices show, disabled, and nothing saves. */
  locked: boolean;
  closeHref: string;
  strings: {
    title: string;
    cancel: string;
    save: string;
    busy: string;
    keyboardHint: string;
    errors: SettingsErrorStrings;
  };
}

/**
 * «Registrazione»: four modes. Unlike Profilo's preferences a choice is **not** saved as it is
 * made — opening registration by a mis-click is not a mistake to make easy. «Salva» writes.
 */
export function RegistrationPanel({ value, options, locked, closeHref, strings }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (pending || locked) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveRegistrationAction>>;
      try {
        result = await saveRegistrationAction(mode);
      } catch {
        setProblem(strings.errors.unexpected);
        return;
      }
      if (result.ok) {
        router.push(closeHref);
        router.refresh();
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
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      data-owns-keys=""
    >
      <OptionList
        label={strings.title}
        groups={[{ options }]}
        selected={mode}
        disabled={locked}
        onSelect={(next) => {
          setMode(next);
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
