'use client';

import type { Settings } from '@saldo/core';
import { Alert } from '../../../../src/ui/Alert';
import { OptionList } from './OptionList';
import styles from './preferences.module.css';
import { type SettingErrors, useSaveSetting } from './useSaveSetting';

type Theme = Settings['theme'];

interface Props {
  value: Theme;
  options: readonly { value: Theme; label: string }[];
  strings: { title: string; note: string };
  errors: SettingErrors;
}

/** §6.8 Tema: Sistema / Scuro / Chiaro. The refresh puts the choice on `<html data-theme>`. */
export function ThemePanel({ value, options, strings, errors }: Props) {
  const { shown, error, save } = useSaveSetting(value, errors);
  return (
    <>
      <p className={styles.note}>{strings.note}</p>
      {error === null ? null : <Alert body={error} />}
      <OptionList
        label={strings.title}
        groups={[{ options }]}
        selected={shown}
        onSelect={(next) => {
          if (next !== shown) save({ key: 'theme', value: next }, next);
        }}
      />
    </>
  );
}
