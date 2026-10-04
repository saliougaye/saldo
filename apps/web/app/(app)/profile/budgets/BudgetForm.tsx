'use client';

import {
  autoBudgetName,
  BUDGET_ALERT_THRESHOLDS,
  type BudgetFormValues,
  type BudgetMissing,
  budgetStepMissing,
  type CurrencyCode,
  minorToAmountBuffer,
  suggestBudgetAmount,
} from '@saldo/core';
import { type AppLocale, formatMoney } from '@saldo/i18n/format';
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
import type { BudgetFormView } from '../../../../src/features/budgets/formView';
import { resolveBudgetName } from '../../../../src/features/budgets/name';
import { budgetWriteErrors } from '../../../../src/features/budgets/writeErrors';
import type { BudgetMessages } from '../../../../src/i18n/budgetMessages';
import { Alert } from '../../../../src/ui/Alert';
import { AmountField } from '../../../../src/ui/AmountField';
import { AppearancePicker } from '../../../../src/ui/AppearancePicker';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { IconBox } from '../../../../src/ui/IconBox';
import { Segmented } from '../../../../src/ui/Segmented';
import { Switch } from '../../../../src/ui/Switch';
import { TextField } from '../../../../src/ui/TextField';
import { saveBudgetAction } from './actions';
import styles from './budgets.module.css';
import { DeleteBudget } from './DeleteBudget';

interface Props {
  view: BudgetFormView;
  locale: AppLocale;
  currency: CurrencyCode;
  decimalSeparator: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  messages: BudgetMessages;
  closeHref: string;
  /** `/budgets`: where a save lands. */
  afterSave: string;
  /** The delete dialog's title needs the saved name; null for a new budget. */
  savedName: string | null;
}

/** What stands above the foot: a gap, a category another budget already has, or the server's answer. */
type Problem = { missing: BudgetMissing } | { taken: string } | { error: string } | null;

/** §6.18 footnote: the suggestion is the median plus this much headroom (the phone's constant). */
const SUGGESTION_HEADROOM = 0.12;

/** The budget's icon offers the category icons, as the phone's sheet does (`categoryIconGroups`). */
const BUDGET_ICONS = categoryIconGroups.flatMap((group) => [...group.icons]);

const KNOWN_ERRORS = ['invalid', 'notFound', 'conflict'];

/**
 * «Nuovo budget» and «Modifica budget» (§6.18): the phone's three steps as one panel. Categories,
 * then the amount with the median of the last six periods beside it, then name, repeat, alert,
 * rollover and icon. The checks are `budgetStepMissing('details', …)`: both gaps at once.
 */
export function BudgetForm({
  view,
  locale,
  currency,
  decimalSeparator,
  symbol,
  symbolPosition,
  messages,
  closeHref,
  afterSave,
  savedName,
}: Props) {
  const t = useMemo(() => makeTranslator(messages), [messages]);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<BudgetFormValues>(view.initial);
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, startTransition] = useTransition();
  const { minorDigits } = view;
  const creating = view.mode === 'new';

  const set = (patch: Partial<BudgetFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblem(null);
  };

  const chosen = values.categoryIds.flatMap((id) => {
    const category = view.categories.find((row) => row.id === id);
    return category === undefined ? [] : [category];
  });
  const autoName = autoBudgetName(
    chosen.map((category) => category.name),
    t('common.and'),
  );
  const firstCategory = chosen[0];
  const icon = values.icon ?? firstCategory?.icon ?? 'target';
  const iconColorIndex = firstCategory?.colorIndex ?? 9;

  // The median of the six periods before this one, plus the headroom (§5.5): computed here, on
  // the numbers the server handed over, so it follows every category picked.
  const suggestion = useMemo(() => {
    const history = view.history.map((record) => new Map(Object.entries(record)));
    const value = suggestBudgetAmount(history, values.categoryIds, view.categoryRefs);
    return value === null ? null : Math.round(value * (1 + SUGGESTION_HEADROOM));
  }, [view.history, view.categoryRefs, values.categoryIds]);

  const focusField = (field: string) => {
    form.current
      ?.querySelector<HTMLElement>(`[data-field="${field}"] input, [data-field="${field}"] button`)
      ?.focus();
  };

  const toggle = (id: string, name: string, taken: boolean) => {
    const selected = values.categoryIds.includes(id);
    if (taken && !selected) {
      setProblem({ taken: name });
      return;
    }
    set({
      categoryIds: selected
        ? values.categoryIds.filter((current) => current !== id)
        : [...values.categoryIds, id],
    });
  };

  const save = () => {
    if (pending) return;
    const gap = budgetStepMissing('details', values, minorDigits);
    if (gap !== null) {
      setProblem({ missing: gap });
      focusField(gap === 'categories' ? 'categories' : 'amount');
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveBudgetAction>>;
      try {
        // The phone's `onSubmit(name)`: the typed name, or the one built from the categories.
        result = await saveBudgetAction({
          id: view.id,
          expectedUpdatedAt: view.updatedAt ?? undefined,
          name: resolveBudgetName(values.name, autoName),
          categoryIds: values.categoryIds,
          buffer: values.buffer,
          period: values.period,
          alertThreshold: values.alertThreshold,
          rollover: values.period === 'period' ? values.rollover : false,
          icon,
        });
      } catch {
        // A thrown action (the network, the server) keeps the draft and says so.
        setProblem({ error: 'unexpected' });
        return;
      }
      if (result.ok) {
        router.replace(afterSave);
        router.refresh();
        return;
      }
      if ('missing' in result) {
        setProblem({ missing: result.missing });
        focusField(result.missing === 'categories' ? 'categories' : 'amount');
      } else if (result.error === 'taken') {
        setProblem({ taken: chosen[0]?.name ?? '' });
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

  const message = (current: NonNullable<Problem>) => {
    if ('missing' in current) return t(`budgets.missing_${current.missing}`);
    if ('taken' in current) return t('web.budgets.error_taken', { name: current.taken });
    return t(
      `web.budgets.error_${KNOWN_ERRORS.includes(current.error) ? current.error : 'unexpected'}`,
    );
  };

  const placeholder = minorDigits === 0 ? '0' : `0${decimalSeparator}${'0'.repeat(minorDigits)}`;
  const gap = problem !== null && 'missing' in problem ? problem.missing : null;
  const alertValue = values.alertThreshold === null ? 'never' : String(values.alertThreshold);
  const errors = budgetWriteErrors(
    messages.web.budgets,
    t('web.budgets.error_taken', { name: chosen[0]?.name ?? '' }),
  );

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
      <fieldset className={styles.field} data-field="categories">
        <legend className={styles.label}>{t('budgets.categories')}</legend>
        <div className={styles.tiles}>
          {view.categories.map((category) => {
            const selected = values.categoryIds.includes(category.id);
            const taken = category.taken && !selected;
            return (
              <button
                key={category.id}
                type="button"
                className={styles.tile}
                aria-pressed={selected}
                aria-disabled={taken}
                onClick={() => toggle(category.id, category.name, category.taken)}
              >
                <IconBox name={category.icon as IconName} colorIndex={category.colorIndex} />
                <span className={styles.tileName}>
                  {category.archived
                    ? `${category.name} · ${t('categories.archivedBadge')}`
                    : category.name}
                </span>
                {taken ? <span className={styles.takenDot} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className={styles.field} data-field="amount">
        <AmountField
          size="body"
          label={t('budgets.amount')}
          buffer={values.buffer}
          onChange={(buffer) => set({ buffer })}
          minorDigits={minorDigits}
          decimalSeparator={decimalSeparator}
          sign=""
          symbol={symbol}
          symbolPosition={symbolPosition}
          placeholder={placeholder}
          autoFocus={creating}
          invalid={gap === 'amount'}
        />
        {suggestion === null ? null : (
          <div className={styles.suggestion}>
            <span className={styles.note}>
              {t('budgets.medianHint', { amount: formatMoney(suggestion, currency, locale) })}
            </span>
            <button
              type="button"
              className={styles.useIt}
              onClick={() => set({ buffer: minorToAmountBuffer(suggestion, minorDigits) })}
            >
              {t('budgets.useMedian')}
            </button>
          </div>
        )}
        <span className={styles.note}>{t('budgets.footnote')}</span>
      </div>

      <TextField
        label={t('budgets.name')}
        placeholder={autoName}
        value={values.name}
        maxLength={40}
        autoComplete="off"
        onChange={(event) => set({ name: event.target.value })}
      />

      <div className={styles.field}>
        <Segmented
          label={t('budgets.repeats')}
          value={values.period}
          options={[
            { value: 'period', label: t('budgets.periodCycle') },
            { value: 'week', label: t('budgets.periodWeek') },
            { value: 'year', label: t('budgets.periodYear') },
          ]}
          onChange={(period) => set({ period })}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>{t('budgets.alertAt')}</span>
        <Segmented
          label={t('budgets.alertAt')}
          value={alertValue}
          options={[
            { value: 'never', label: t('budgets.alertNever') },
            ...BUDGET_ALERT_THRESHOLDS.map((value) => ({
              value: String(value),
              label: `${value}%`,
            })),
          ]}
          onChange={(next) => set({ alertThreshold: next === 'never' ? null : Number(next) })}
        />
        <span className={styles.note}>{t('budgets.alertNote')}</span>
      </div>

      {values.period === 'period' ? (
        <Switch
          label={t('budgets.rollover')}
          checked={values.rollover}
          onChange={(rollover) => set({ rollover })}
        />
      ) : null}

      <div className={styles.field}>
        <AppearancePicker
          showColors={false}
          colorLabel={t('categories.colour')}
          iconLabel={t('categories.icon')}
          optionLabel={(label, index, total) => t('web.form.pickerOption', { label, index, total })}
          colorIndex={iconColorIndex}
          icon={icon}
          icons={BUDGET_ICONS}
          onChange={(next) => set({ icon: next.icon })}
        />
      </div>

      {problem === null ? null : <Alert body={message(problem)} />}

      <FormFoot
        hint={t('web.form.keyboardHint')}
        cancelHref={closeHref}
        cancelLabel={t('common.cancel')}
        submitLabel={creating ? t('budgets.create') : t('common.save')}
        busyLabel={t('common.loading')}
        pending={pending}
        leading={
          view.id === null || view.updatedAt === null ? undefined : (
            <DeleteBudget
              id={view.id}
              updatedAt={view.updatedAt}
              afterHref={afterSave}
              strings={{
                action: t('budgets.deleteBudget'),
                title: t('budgets.deleteTitle', { name: savedName ?? '' }),
                body: t('budgets.deleteBody'),
                confirm: t('common.delete'),
                cancel: t('common.cancel'),
                busy: t('common.loading'),
                errors,
              }}
            />
          )
        }
      />
    </form>
  );
}
