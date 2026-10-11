'use client';

import { type Category, type CategoryFormValues, categoryMissingForSave } from '@saldo/core';
import { makeTranslator } from '@saldo/i18n/translate';
import { categoryIconGroups, type IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  type CategoryFormView,
  categoryParentOptions,
} from '../../../../src/features/categories/formView';
import { categoryWriteErrors } from '../../../../src/features/categories/writeErrors';
import type { CategoryMessages } from '../../../../src/i18n/categoryMessages';
import { Alert } from '../../../../src/ui/Alert';
import { AmountField } from '../../../../src/ui/AmountField';
import { AppearancePicker } from '../../../../src/ui/AppearancePicker';
import { FormFoot } from '../../../../src/ui/FormFoot';
import { Segmented } from '../../../../src/ui/Segmented';
import { Select } from '../../../../src/ui/Select';
import { Switch } from '../../../../src/ui/Switch';
import { sharedProps } from '../../../../src/ui/sharedProps';
import { TextField } from '../../../../src/ui/TextField';
import type { ArchiveStrings } from './ArchiveCategory';
import { saveCategoryAction } from './actions';
import styles from './categories.module.css';

/** What every category form of the page shares, given once (`CategoryFormShared`). */
export interface CategoryFormSharedValue {
  /** The page's categories: the parents and the archive's targets are core's choice among them. */
  categories: readonly Category[];
  decimalSeparator: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  messages: CategoryMessages;
  /** The archive dialog's copy that does not depend on the category. */
  archive: ArchiveStrings;
}

const shared = sharedProps<CategoryFormSharedValue>('CategoryForm');

/** Gives every `CategoryForm` (and `ArchiveCategory`) below it the props they share. */
export const CategoryFormShared = shared.Provider;
export const useCategoryFormShared = shared.useShared;

interface Props {
  view: CategoryFormView;
  closeHref: string;
  /** Where a save lands. */
  afterSave: string;
  /** The foot's leading corner: «Archivia» and its dialog, built by the page for an edit. */
  archive?: ReactNode;
}

type Problem = { missing: 'name' } | { error: string } | null;

/** The phone's icon sheet offers these groups; the web flattens them into one radio group. */
const CATEGORY_ICONS = categoryIconGroups.flatMap((group) => [...group.icons]);

/**
 * «Nuova categoria» and «Modifica categoria» (§5.11, §6.19): name, direction (a new category's
 * only), parent, appearance and — for an expense — «Budget mensile». The rules are core's
 * (`categoryMissingForSave`, the parent candidates in the view); the server re-checks them.
 */
export function CategoryForm({ view, closeHref, afterSave, archive }: Props) {
  const { categories, decimalSeparator, symbol, symbolPosition, messages } =
    useCategoryFormShared();
  const t = useMemo(() => makeTranslator(messages), [messages]);
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<CategoryFormValues>(view.initial);
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, startTransition] = useTransition();
  const creating = view.mode === 'new';
  const { minorDigits } = view;

  const set = (patch: Partial<CategoryFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblem(null);
  };

  const errors = categoryWriteErrors(messages.web.categories, 'save');

  const save = () => {
    if (pending) return;
    if (categoryMissingForSave(values) !== null) {
      setProblem({ missing: 'name' });
      form.current?.querySelector<HTMLElement>('[data-field="name"] input')?.focus();
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveCategoryAction>>;
      try {
        result = await saveCategoryAction({
          id: view.id,
          expectedUpdatedAt: view.updatedAt ?? undefined,
          name: values.name,
          direction: values.direction,
          parentId: values.parentId,
          icon: values.icon,
          colorIndex: values.colorIndex,
          budgetEnabled: values.direction === 'expense' && values.budgetEnabled,
          budgetBuffer: values.budgetBuffer,
        });
      } catch {
        // A thrown action (the network, the server) keeps the draft and says so.
        setProblem({ error: errors.unexpected });
        return;
      }
      if (result.ok) {
        router.replace(afterSave);
        router.refresh();
        return;
      }
      setProblem({ error: errors[result.error] });
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

  const parents = categoryParentOptions(categories, values.direction, view.id);
  const parentOptions = [
    { value: '', label: t('categories.noParent') },
    ...parents.map((parent) => ({
      value: parent.id,
      label: parent.name,
      icon: parent.icon as IconName,
      colorIndex: parent.colorIndex,
    })),
  ];
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
      <div className={styles.field} data-field="name">
        <TextField
          label={t('categories.name')}
          value={values.name}
          maxLength={40}
          autoComplete="off"
          autoFocus={creating}
          invalid={problem !== null && 'missing' in problem}
          onChange={(event) => set({ name: event.target.value })}
        />
      </div>

      {creating ? (
        <Segmented
          label={t('categories.title')}
          value={values.direction}
          options={[
            { value: 'expense', label: t('categories.expenses') },
            { value: 'income', label: t('categories.income') },
          ]}
          // A parent belongs to one direction: switching drops it, as the phone does.
          onChange={(direction) => set({ direction, parentId: null })}
        />
      ) : null}

      {view.hasChildren ? null : (
        <Select
          label={t('categories.parent')}
          value={values.parentId ?? ''}
          options={parentOptions}
          placeholder={t('categories.noParent')}
          onChange={(next) => set({ parentId: next === '' ? null : next })}
        />
      )}

      <div className={styles.field}>
        <AppearancePicker
          colorLabel={t('categories.colour')}
          iconLabel={t('categories.icon')}
          optionLabel={(label, index, total) => t('web.form.pickerOption', { label, index, total })}
          colorIndex={values.colorIndex}
          icon={values.icon}
          icons={CATEGORY_ICONS}
          onChange={(next) => set(next)}
        />
      </div>

      {values.direction === 'income' ? null : (
        <div className={styles.field}>
          <Switch
            label={t('categories.monthlyBudget')}
            checked={values.budgetEnabled}
            onChange={(budgetEnabled) => set({ budgetEnabled })}
          />
          {values.budgetEnabled ? (
            <AmountField
              size="body"
              label={t('categories.monthlyBudget')}
              buffer={values.budgetBuffer}
              onChange={(budgetBuffer) => set({ budgetBuffer })}
              minorDigits={minorDigits}
              decimalSeparator={decimalSeparator}
              sign=""
              symbol={symbol}
              symbolPosition={symbolPosition}
              placeholder={placeholder}
            />
          ) : null}
        </div>
      )}

      {problem === null ? null : (
        <Alert body={'missing' in problem ? t('categories.missing_name') : problem.error} />
      )}

      <FormFoot
        hint={t('web.form.keyboardHint')}
        cancelHref={closeHref}
        cancelLabel={t('common.cancel')}
        submitLabel={t('common.save')}
        busyLabel={t('common.loading')}
        pending={pending}
        leading={archive}
      />
    </form>
  );
}
