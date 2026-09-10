import {
  type MinorDigits,
  planRecurrenceEdit,
  type RecurrenceEditScope,
  type Transaction,
} from '@saldo/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/client';
import { useDatabase } from '../../db/DatabaseProvider';
import { applyRecurrenceEdit } from '../../db/recurrenceService';
import { Text } from '../../theme/Text';
import { type TransactionFormValues, toTransactionInput } from './useTransactionForm';

export interface RecurrenceScopeSheetProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction;
  values: TransactionFormValues;
  minorDigits: MinorDigits;
  today: string;
  cycleStartDay: number;
  onDone: () => void;
}

const SCOPES: readonly RecurrenceEditScope[] = ['only-this', 'this-and-following', 'all'];

const KEYS: Record<RecurrenceEditScope, { title: string; note: string }> = {
  'only-this': { title: 'recurrenceScope.onlyThis', note: 'recurrenceScope.onlyThisNote' },
  'this-and-following': {
    title: 'recurrenceScope.thisAndFollowing',
    note: 'recurrenceScope.thisAndFollowingNote',
  },
  all: { title: 'recurrenceScope.all', note: 'recurrenceScope.allNote' },
};

/** §6.21 / §5.9. The counts in the notes are real, computed by the core planner. */
export function RecurrenceScopeSheet({
  visible,
  onClose,
  transaction,
  values,
  minorDigits,
  today,
  cycleStartDay,
  onDone,
}: RecurrenceScopeSheetProps) {
  const { t } = useTranslation();
  const { repos } = useDatabase();

  const recurrence =
    transaction.recurrenceId === null ? null : repos.recurrences.byId(transaction.recurrenceId);

  const counts = useMemo(() => {
    if (recurrence === null) return null;
    const occurrences = repos.transactions
      .list()
      .filter((row) => row.recurrenceId === recurrence.id)
      .map((row) => ({ id: row.id, date: row.date }));
    return Object.fromEntries(
      SCOPES.map((scope) => [
        scope,
        planRecurrenceEdit(scope, {
          recurrence,
          occurrenceDate: transaction.date,
          occurrences,
          today,
        }),
      ]),
    ) as Record<RecurrenceEditScope, ReturnType<typeof planRecurrenceEdit>>;
  }, [recurrence, repos, transaction.date, today]);

  if (recurrence === null || counts === null) return null;

  const apply = (scope: RecurrenceEditScope) => {
    const input = toTransactionInput(values, minorDigits);
    applyRecurrenceEdit(db, repos, scope, {
      recurrence,
      occurrence: transaction,
      values: {
        kind: input.kind,
        amount: input.amount,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        categoryId: input.categoryId,
        description: input.description,
        tagIds: input.tagIds,
        excludeFromTotals: input.excludeFromTotals,
      },
      date: input.date,
      today,
      cycleStartDay,
    });
    onDone();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('recurrenceScope.title')}>
      <View>
        {SCOPES.map((scope) => {
          const plan = counts[scope];
          const count =
            scope === 'this-and-following'
              ? plan.tombstoneOccurrenceIds.length
              : scope === 'all'
                ? plan.updateOccurrenceIds.length
                : plan.unchangedCount;
          return (
            <ListRow
              key={scope}
              title={t(KEYS[scope].title)}
              subtitle={t(KEYS[scope].note, { count })}
              onPress={() => apply(scope)}
              chevron
            />
          );
        })}
        <Text size="caption" color="textFaint" style={{ paddingTop: 6 }}>
          {t('transactions.recurringEveryMonth')}
        </Text>
      </View>
    </Sheet>
  );
}
