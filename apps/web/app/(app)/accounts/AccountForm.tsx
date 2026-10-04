'use client';

import { type AccountFormValues, accountMissingForSave, type CurrencyCode } from '@saldo/core';
import type { AppLocale } from '@saldo/i18n/format';
import { makeTranslator } from '@saldo/i18n/translate';
import { accountIconOptions, accountTypeIcons } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type KeyboardEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { type AccountFormView, balanceToSend } from '../../../src/features/accounts/formView';
import type { AccountMessages } from '../../../src/i18n/accountMessages';
import { Alert } from '../../../src/ui/Alert';
import { AmountField } from '../../../src/ui/AmountField';
import { AppearancePicker } from '../../../src/ui/AppearancePicker';
import { FormFoot } from '../../../src/ui/FormFoot';
import { Select, type SelectOption } from '../../../src/ui/Select';
import { Switch } from '../../../src/ui/Switch';
import { TextField } from '../../../src/ui/TextField';
import styles from './accountForms.module.css';
import { saveAccountAction } from './actions';

interface Props {
  view: AccountFormView;
  locale: AppLocale;
  currency: CurrencyCode;
  decimalSeparator: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  messages: AccountMessages;
  closeHref: string;
  /** `/accounts?a=__ID__`: where a save lands. */
  afterSave: string;
}

/** What stands above the foot: the gap the form found, or the answer the server gave. */
type Problem = { missing: 'name' } | { error: string } | null;

const NONE = '';
const DAYS: readonly number[] = Array.from({ length: 28 }, (_, index) => index + 1);

/** The server's answers this form has a sentence for; `closedGoal` cannot come from an account. */
const KNOWN_ERRORS = ['invalid', 'notFound', 'conflict', 'holdsGoals', 'parentArchived'];

/**
 * «Nuovo conto» and «Modifica conto» on the web (§6.22): the phone's fields, in its order, in the
 * trailing panel. Every rule is `@saldo/core`'s; this component wires the fields to them and the
 * save button to `saveAccountAction`.
 */
export function AccountForm({
  view,
  decimalSeparator,
  symbol,
  symbolPosition,
  messages,
  closeHref,
  afterSave,
}: Props) {
  const t = useMemo(() => makeTranslator(messages), [messages]);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<AccountFormValues>(view.initial);
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, startTransition] = useTransition();
  const { minorDigits } = view;

  const set = (patch: Partial<AccountFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblem(null);
  };

  const focusName = () => {
    form.current?.querySelector<HTMLElement>('[data-field="name"] input')?.focus();
  };

  const save = () => {
    if (pending) return;
    if (accountMissingForSave(values) !== null) {
      setProblem({ missing: 'name' });
      focusName();
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveAccountAction>>;
      try {
        result = await saveAccountAction({
          id: view.id,
          ...values,
          buffer: balanceToSend(view.initial.buffer, values.buffer),
          expectedUpdatedAt: view.updatedAt ?? undefined,
        });
      } catch {
        // A thrown action (the network, the server) keeps the draft and says so.
        setProblem({ error: 'unexpected' });
        return;
      }
      if (result.ok) {
        // `replace`: Back from the saved account goes where the form was opened from.
        router.replace(afterSave.replace('__ID__', encodeURIComponent(result.id)));
        router.refresh();
        return;
      }
      if ('missing' in result) {
        setProblem({ missing: result.missing });
        focusName();
      } else {
        setProblem({ error: result.error });
      }
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
      return;
    }
    // In a field Esc leaves the field; the next Esc closes the panel (`Panel` skips editable targets).
    if (
      event.key === 'Escape' &&
      (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    ) {
      event.target.blur();
    }
  };

  const message = (current: NonNullable<Problem>) =>
    'missing' in current
      ? t('accounts.missing_name')
      : t(
          `web.accounts.error_${KNOWN_ERRORS.includes(current.error) ? current.error : 'unexpected'}`,
        );

  const typeOptions: SelectOption[] = view.types.map((type) => ({
    value: type,
    label: t(`accountTypes.${type}`),
    icon: accountTypeIcons[type],
  }));
  const dayOptions: SelectOption[] = [
    { value: NONE, label: t('categories.noParent') },
    ...DAYS.map((day) => ({ value: String(day), label: String(day) })),
  ];
  const paymentOptions: SelectOption[] = [
    { value: NONE, label: t('accounts.noPaymentAccount') },
    ...view.paymentAccounts.map((account) => ({ value: account.id, label: account.name })),
  ];
  const day = (value: number | null) => (value === null ? NONE : String(value));
  const parseDay = (value: string) => (value === NONE ? null : Number(value));

  const card = values.type === 'credit_card';
  const placeholder = minorDigits === 0 ? '0' : `0${decimalSeparator}${'0'.repeat(minorDigits)}`;

  return (
    <form
      className={styles.form}
      ref={form}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      // N, E and ↑ ↓ do nothing while the form is open, even with the focus on the page (`ignoresShortcut`).
      data-owns-keys=""
    >
      <div data-field="balance">
        <AmountField
          size="body"
          allowNegative
          label={t('accounts.balance')}
          buffer={values.buffer}
          onChange={(buffer) => set({ buffer })}
          minorDigits={minorDigits}
          decimalSeparator={decimalSeparator}
          sign=""
          symbol={symbol}
          symbolPosition={symbolPosition}
          placeholder={placeholder}
          autoFocus={view.mode === 'new'}
        />
      </div>

      <div data-field="name">
        <TextField
          label={t('accounts.name')}
          value={values.name}
          maxLength={60}
          autoComplete="off"
          invalid={problem !== null && 'missing' in problem}
          onChange={(event) => set({ name: event.target.value })}
        />
      </div>

      <TextField
        label={t('accounts.institution')}
        value={values.institution}
        maxLength={60}
        autoComplete="off"
        onChange={(event) => set({ institution: event.target.value })}
      />

      <div data-field="type">
        <Select
          label={t('accounts.type')}
          value={values.type}
          options={typeOptions}
          placeholder={t('accounts.type')}
          onChange={(type) => {
            const next = view.types.find((entry) => entry === type);
            if (next !== undefined) set({ type: next });
          }}
        />
      </div>

      <div className={styles.field}>
        <AppearancePicker
          colorLabel={t('accounts.colour')}
          iconLabel={t('accounts.icon')}
          colorIndex={values.colorIndex}
          icon={values.icon}
          icons={accountIconOptions}
          optionLabel={(label, index, total) => t('web.form.pickerOption', { label, index, total })}
          onChange={(next) => set(next)}
        />
      </div>

      {card ? (
        <div className={styles.cardFields}>
          <div className={styles.row2}>
            <Select
              label={t('accounts.creditCloseDay')}
              hintInTrigger={false}
              value={day(values.creditCloseDay)}
              options={dayOptions}
              placeholder={t('categories.noParent')}
              onChange={(value) => set({ creditCloseDay: parseDay(value) })}
            />
            <Select
              label={t('accounts.creditChargeDay')}
              hintInTrigger={false}
              value={day(values.creditChargeDay)}
              options={dayOptions}
              placeholder={t('categories.noParent')}
              onChange={(value) => set({ creditChargeDay: parseDay(value) })}
            />
          </div>
          <Select
            label={t('accounts.creditPaymentAccount')}
            value={values.creditPaymentAccountId ?? NONE}
            options={paymentOptions}
            placeholder={t('accounts.noPaymentAccount')}
            onChange={(value) => set({ creditPaymentAccountId: value === NONE ? null : value })}
          />
        </div>
      ) : null}

      <Switch
        label={t('accounts.includeInSpendable')}
        note={t('accounts.includeNote')}
        checked={values.includeInSpendable}
        onChange={(includeInSpendable) => set({ includeInSpendable })}
      />

      {problem === null ? null : <Alert body={message(problem)} />}

      <FormFoot
        hint={t('web.form.keyboardHint')}
        cancelHref={closeHref}
        cancelLabel={t('common.cancel')}
        submitLabel={t('common.save')}
        busyLabel={t('common.loading')}
        pending={pending}
      />
    </form>
  );
}
