'use client';

import { emptyForm, missingForSave } from '@saldo/core';
import { makeTranslator } from '@saldo/i18n/translate';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState, useTransition } from 'react';
import type { FormView } from '../../../src/features/transactions/formView';
import type { FormMessages } from '../../../src/i18n/formMessages';
import { Alert } from '../../../src/ui/Alert';
import { AmountField } from '../../../src/ui/AmountField';
import { AppLink as Link } from '../../../src/ui/AppLink';
import { actionApplied } from '../../../src/ui/actionApplied';
import { Button } from '../../../src/ui/Button';
import { MoreRow, MoreRowLabel, moreRowLinkClassName } from '../../../src/ui/MoreRow';
import { Select } from '../../../src/ui/Select';
import { saveTransactionAction } from './actions';
import styles from './transactions.module.css';

interface Props {
  view: FormView;
  /** The first spendable account: the form's own default. */
  accountId: string;
  decimalSeparator: string;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  messages: FormMessages;
}

/**
 * W11, Transactions · none at all: the first expense without the panel — an amount and a category,
 * saved on `accountId` today. It sends what `TransactionForm` sends for the same fields, so the
 * server reads the amount from the same `buffer` and applies the same rules.
 */
export function QuickAdd({
  view,
  accountId,
  decimalSeparator,
  symbol,
  symbolPosition,
  messages,
}: Props) {
  const t = useMemo(() => makeTranslator(messages), [messages]);
  const router = useRouter();
  const { minorDigits, today } = view;
  const categories = view.categories.filter(
    (category) => category.direction === 'expense' && !category.child,
  );
  const [buffer, setBuffer] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const placeholder = minorDigits === 0 ? '0' : `0${decimalSeparator}${'0'.repeat(minorDigits)}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const gap = missingForSave({ ...emptyForm(today, accountId), buffer, categoryId }, minorDigits);
    if (gap !== null) {
      setProblem(t(`txForm.missing_${gap}`));
      return;
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveTransactionAction>>;
      try {
        result = await saveTransactionAction({
          id: null,
          expectedUpdatedAt: undefined,
          kind: 'expense',
          buffer,
          date: today,
          accountId,
          toAccountId: null,
          categoryId,
          description: '',
          tagIds: [],
          excludeFromTotals: false,
          closeGoalId: null,
        });
      } catch {
        setProblem(t('web.form.error_unexpected'));
        return;
      }
      if (result.ok) {
        await actionApplied();
        router.refresh();
        return;
      }
      setProblem(
        'missing' in result
          ? t(`txForm.missing_${result.missing}`)
          : t(`web.form.error_${result.error}`),
      );
    });
  };

  return (
    <form className={styles.quickAdd} onSubmit={submit} noValidate>
      <div className={styles.quickHead}>
        <h2 className={styles.quickTitle}>{t('transactions.quickAddTitle')}</h2>
        <p className={styles.quickBody}>{t('transactions.quickAddBody')}</p>
      </div>
      <div className={styles.quickRow}>
        <AmountField
          size="body"
          label={t('txForm.amount')}
          buffer={buffer}
          onChange={(next) => {
            setBuffer(next);
            setProblem(null);
          }}
          minorDigits={minorDigits}
          decimalSeparator={decimalSeparator}
          sign=""
          symbol={symbol}
          symbolPosition={symbolPosition}
          placeholder={placeholder}
        />
        <Select
          label={t('txForm.category')}
          value={categoryId}
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
            icon: category.icon as IconName,
            colorIndex: category.colorIndex,
          }))}
          onChange={(next) => {
            setCategoryId(next);
            setProblem(null);
          }}
          placeholder={t('txForm.category')}
        />
        <Button type="submit" busy={pending} busyLabel={t('common.loading')}>
          {t('txForm.create')}
        </Button>
      </div>
      {problem === null ? null : <Alert body={problem} />}
      {/* The web has no CSV import yet: Profile → Data says where it is (R7 plan, decisions). */}
      <MoreRow prompt={t('transactions.importCsvPrompt')}>
        <Link className={moreRowLinkClassName} href="/profile/data">
          <MoreRowLabel label={t('transactions.importCsv')} />
        </Link>
      </MoreRow>
    </form>
  );
}
