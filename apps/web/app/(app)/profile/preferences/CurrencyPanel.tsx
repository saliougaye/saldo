'use client';

import { type CurrencyCode, groupCurrencies } from '@saldo/core';
import type { AppLocale } from '@saldo/i18n/format';
import { useMemo, useState } from 'react';
import { currencyConfirmBody } from '../../../../src/features/profile/currencyConfirm';
import type { CurrencyOption } from '../../../../src/features/profile/preferenceOptions';
import { ConfirmDialog } from '../../../../src/ui/ConfirmDialog';
import { type ListOption, OptionList } from '../../../../src/ui/OptionList';
import { TextField } from '../../../../src/ui/TextField';
import styles from './preferences.module.css';
import { type SettingErrors, useSaveSetting } from './useSaveSetting';

interface Props {
  value: CurrencyCode;
  locale: AppLocale;
  options: readonly CurrencyOption[];
  strings: {
    title: string;
    search: string;
    common: string;
    all: string;
    noResults: string;
    confirmTitle: string;
    /** `profile.currencyConfirmBody`: the line under the title, and the dialog's plain body. */
    confirmBody: string;
    /** `profile.currencyConfirmScale`, with `{{before}}` and `{{after}}`. */
    confirmScale: string;
    save: string;
    cancel: string;
    busy: string;
  };
  errors: SettingErrors;
}

/**
 * §6.8 + §5.1 + §6.25 Valuta: every currency, «Comuni» first, searchable. The one preference that
 * asks before it saves: changing it reformats every amount and converts none.
 */
export function CurrencyPanel({ value, locale, options, strings, errors }: Props) {
  const { shown, error, pending, save, clearError } = useSaveSetting(value, errors);
  const [query, setQuery] = useState('');
  // The question stays as it was asked while the dialog closes — and while the refresh brings the
  // new currency in — so its body does not change on the way out.
  const [asking, setAsking] = useState<{ from: CurrencyCode; to: CurrencyCode } | null>(null);
  const [open, setOpen] = useState(false);

  const byCode = useMemo(() => new Map(options.map((option) => [option.code, option])), [options]);
  const groups = useMemo(() => {
    const found = groupCurrencies(query, (code) => byCode.get(code)?.name ?? code);
    const rows = (codes: readonly CurrencyCode[]): ListOption<CurrencyCode>[] =>
      codes.map((code) => ({
        value: code,
        label: code,
        subtitle: byCode.get(code)?.name,
        detail: byCode.get(code)?.sample,
      }));
    return [
      { label: strings.common, options: rows(found.common) },
      { label: strings.all, options: rows(found.others) },
    ];
  }, [query, byCode, strings.common, strings.all]);
  const empty = groups.every((group) => group.options.length === 0);

  return (
    <>
      <p className={styles.note}>{strings.confirmBody}</p>
      <TextField
        label={strings.search}
        placeholder={strings.search}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {empty ? <p className={styles.note}>{strings.noResults}</p> : null}
      <OptionList
        label={strings.title}
        groups={groups}
        selected={shown}
        onSelect={(code) => {
          if (code === shown) return;
          clearError();
          setAsking({ from: shown, to: code });
          setOpen(true);
        }}
      />
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={strings.confirmTitle}
        body={currencyConfirmBody({
          current: asking?.from ?? value,
          pending: asking?.to ?? value,
          locale,
          strings: { body: strings.confirmBody, scale: strings.confirmScale },
        })}
        error={error ?? undefined}
        confirmLabel={strings.save}
        cancelLabel={strings.cancel}
        busy={pending}
        busyLabel={strings.busy}
        onConfirm={() => {
          if (asking === null) return;
          save({ key: 'currency', value: asking.to }, asking.to, () => setOpen(false));
        }}
      />
    </>
  );
}
