import { isPocket } from '@saldo/core';
import { useMemo } from 'react';
import { useAccountsQuery, useTransactionsOfAccountsQuery } from '../../db/hooks';
import { usePeriod } from '../period/PeriodProvider';
import { goalViews } from './goalViews';

/**
 * Open goals with their progress. Only the pockets' own rows are read: a goal's balance covers its
 * whole history, and reading the whole ledger here made Home re-reduce it on every write.
 */
export function useGoalViews() {
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const { today, def } = usePeriod();
  const pocketIds = useMemo(
    () => accounts.filter((account) => isPocket(account)).map((account) => account.id),
    [accounts],
  );
  const { rows, loaded: rowsLoaded } = useTransactionsOfAccountsQuery(pocketIds);
  const views = useMemo(() => goalViews(accounts, rows, today, def), [accounts, rows, today, def]);
  return { views, accounts, rows, loaded: accountsLoaded && rowsLoaded };
}
