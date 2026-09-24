import { useMemo } from 'react';
import { useAccountsQuery, useTransactionsInRangeQuery } from '../../db/hooks';
import { usePeriod } from '../period/PeriodProvider';
import { goalViews } from './goalViews';

/**
 * Open goals with their progress. A goal's balance covers its whole history, so the range is
 * unbounded (§5.3), as on the Accounts tab.
 */
export function useGoalViews() {
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const { today, def } = usePeriod();
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery('1970-01-01', today);
  const views = useMemo(() => goalViews(accounts, rows, today, def), [accounts, rows, today, def]);
  return { views, accounts, rows, loaded: accountsLoaded && rowsLoaded };
}
