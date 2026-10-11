'use client';

import type { Settings } from '@saldo/core';
import { Alert } from '../../../../src/ui/Alert';
import { OptionList } from '../../../../src/ui/OptionList';
import styles from './preferences.module.css';
import { useSaveSetting } from './useSaveSetting';

type Language = Settings['language'];

interface Props {
  value: Language;
  /** Sistema, then each language in its own tongue, in the phone's order. */
  options: readonly { value: Language; label: string }[];
  strings: { title: string; note: string };
}

/** §6.8 Lingua: saved as it is chosen; the refresh then renders the whole shell in it. */
export function LanguagePanel({ value, options, strings }: Props) {
  const { shown, error, save } = useSaveSetting(value);
  return (
    <>
      <p className={styles.note}>{strings.note}</p>
      {error === null ? null : <Alert body={error} />}
      <OptionList
        label={strings.title}
        groups={[{ options }]}
        selected={shown}
        onSelect={(next) => {
          if (next !== shown) save({ key: 'language', value: next }, next);
        }}
      />
    </>
  );
}
