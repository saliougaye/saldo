'use client';

import {
  addDays,
  type CurrencyCode,
  type GoalFormValues,
  type GoalMissing,
  goalStepMissing,
} from '@saldo/core';
import type { AppLocale } from '@saldo/i18n/format';
import { makeTranslator } from '@saldo/i18n/translate';
import { categoryIconGroups, type IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type KeyboardEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import type { GoalFormView } from '../../../src/features/accounts/formView';
import type { AccountMessages } from '../../../src/i18n/accountMessages';
import { Alert } from '../../../src/ui/Alert';
import { AmountField } from '../../../src/ui/AmountField';
import { AppearancePicker } from '../../../src/ui/AppearancePicker';
import { FormFoot } from '../../../src/ui/FormFoot';
import { Select, type SelectOption } from '../../../src/ui/Select';
import { TextField } from '../../../src/ui/TextField';
import styles from './accountForms.module.css';
import { saveGoalAction } from './actions';

interface Props {
  view: GoalFormView;
  locale: AppLocale;
  currency: CurrencyCode;
  decimalSeparator: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  messages: AccountMessages;
  /** An edit shows the parent's name and never changes it (§5.14). */
  parentName: string | null;
  closeHref: string;
  /** `/accounts?g=__ID__`: where a save lands. */
  afterSave: string;
}

/** What stands above the foot: the gap the form found, or the answer the server gave. */
type Problem = { missing: GoalMissing } | { error: string } | null;

/** The field that takes the focus for each gap (`data-field` on the wrappers below). */
const FIELD_OF: Record<GoalMissing, string> = {
  name: 'name',
  target: 'target',
  deadline: 'deadline',
  parent: 'parent',
};

const KNOWN_ERRORS = ['invalid', 'notFound', 'conflict', 'holdsGoals', 'parentArchived'];

/** The goal's look offers the category icons, as the phone's sheet does (`categoryIconGroups`). */
const GOAL_ICONS = categoryIconGroups.flatMap((group) => [...group.icons]);

/**
 * «Nuovo obiettivo» and «Modifica obiettivo» (§6.37): the phone's four steps as one panel. The
 * checks are `goalStepMissing`'s (all four for a new goal, name and target for an edit).
 */
export function GoalForm({
  view,
  decimalSeparator,
  symbol,
  symbolPosition,
  messages,
  parentName,
  closeHref,
  afterSave,
}: Props) {
  const t = useMemo(() => makeTranslator(messages), [messages]);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<GoalFormValues>(view.initial);
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, startTransition] = useTransition();
  const { minorDigits } = view;
  const creating = view.mode === 'new';

  const set = (patch: Partial<GoalFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblem(null);
  };

  const focusField = (field: string) => {
    form.current
      ?.querySelector<HTMLElement>(`[data-field="${field}"] input, [data-field="${field}"] button`)
      ?.focus();
  };

  const save = () => {
    if (pending) return;
    const gap = goalStepMissing(creating ? 'account' : 'edit', values, view.today, minorDigits);
    if (gap !== null) {
      setProblem({ missing: gap });
      focusField(FIELD_OF[gap]);
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveGoalAction>>;
      try {
        result = await saveGoalAction({ id: view.id, ...values });
      } catch {
        // A thrown action (the network, the server) keeps the draft and says so.
        setProblem({ error: 'unexpected' });
        return;
      }
      if (result.ok) {
        router.replace(afterSave.replace('__ID__', encodeURIComponent(result.id)));
        router.refresh();
        return;
      }
      if ('missing' in result) {
        setProblem({ missing: result.missing });
        focusField(FIELD_OF[result.missing]);
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
      ? t(`goals.missing_${current.missing}`)
      : t(
          `web.accounts.error_${KNOWN_ERRORS.includes(current.error) ? current.error : 'unexpected'}`,
        );

  const parentOptions: SelectOption[] = view.parents.map((parent) => ({
    value: parent.id,
    label: parent.name,
    icon: parent.icon as IconName,
    colorIndex: parent.colorIndex,
  }));
  const placeholder = minorDigits === 0 ? '0' : `0${decimalSeparator}${'0'.repeat(minorDigits)}`;
  const gap = problem !== null && 'missing' in problem ? problem.missing : null;

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
      <div data-field="name">
        <TextField
          label={t('goals.name')}
          placeholder={t('goals.namePlaceholder')}
          value={values.name}
          maxLength={60}
          autoComplete="off"
          autoFocus={creating}
          invalid={gap === 'name'}
          onChange={(event) => set({ name: event.target.value })}
        />
      </div>

      <div className={styles.field}>
        <AppearancePicker
          colorLabel={t('accounts.colour')}
          iconLabel={t('accounts.icon')}
          colorIndex={values.colorIndex}
          icon={values.icon}
          icons={GOAL_ICONS}
          onChange={(next) => set(next)}
        />
      </div>

      <div data-field="target">
        <AmountField
          size="body"
          label={t('goals.target')}
          buffer={values.buffer}
          onChange={(buffer) => set({ buffer })}
          minorDigits={minorDigits}
          decimalSeparator={decimalSeparator}
          sign=""
          symbol={symbol}
          symbolPosition={symbolPosition}
          placeholder={placeholder}
          invalid={gap === 'target'}
        />
      </div>

      <div data-field="deadline">
        <TextField
          type="date"
          label={t('goals.deadline')}
          hint={t('web.accounts.deadlineHint')}
          // «After today»: `goalStepMissing` refuses today itself.
          min={addDays(view.today, 1)}
          value={values.deadline ?? ''}
          invalid={gap === 'deadline'}
          onChange={(event) =>
            set({ deadline: event.target.value === '' ? null : event.target.value })
          }
        />
      </div>

      {creating ? (
        <>
          <div data-field="parent">
            <Select
              label={t('goals.parent')}
              value={values.parentAccountId}
              options={parentOptions}
              placeholder={t('goals.parent')}
              invalid={gap === 'parent'}
              onChange={(parentAccountId) => set({ parentAccountId })}
            />
          </div>
          <div data-field="saved">
            <AmountField
              size="body"
              label={t('goals.alreadySaved')}
              buffer={values.savedBuffer}
              onChange={(savedBuffer) => set({ savedBuffer })}
              minorDigits={minorDigits}
              decimalSeparator={decimalSeparator}
              sign=""
              symbol={symbol}
              symbolPosition={symbolPosition}
              placeholder={placeholder}
            />
            <span className={styles.note}>{t('web.accounts.alreadySavedHint')}</span>
          </div>
        </>
      ) : (
        <div className={styles.readonly}>
          <span className={styles.label}>{t('goals.parent')}</span>
          <span className={styles.readonlyValue}>{parentName ?? '—'}</span>
        </div>
      )}

      {problem === null ? null : <Alert body={message(problem)} />}

      <FormFoot
        hint={t('web.form.keyboardHint')}
        cancelHref={closeHref}
        cancelLabel={t('common.cancel')}
        submitLabel={creating ? t('goals.create') : t('common.save')}
        busyLabel={t('common.loading')}
        pending={pending}
      />
    </form>
  );
}
