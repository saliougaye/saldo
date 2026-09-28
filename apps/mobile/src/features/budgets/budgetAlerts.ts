import type { BudgetView } from '@saldo/core';
import type { KvStore } from '../../db/kv';

/** kv key holding the period a budget was last alerted for (§5.8). */
export function alertKey(budgetId: string): string {
  return `lastAlertPeriodStart:${budgetId}`;
}

export interface BudgetAlert {
  budgetId: string;
  name: string;
  /** Rounded percentage of the limit, for the notification body. */
  percent: number;
}

/**
 * Budgets whose threshold has just been crossed (§5.8). Notify **once per budget per period**, so
 * the decision needs the period the budget was last alerted for — kept device-locally in `kv`,
 * never synced: a notification is a property of this device, not of the data.
 *
 * Pure: it reads the store but does not write it, so the caller can send first and only then mark
 * the period as alerted.
 */
export function pendingBudgetAlerts(
  views: readonly BudgetView[],
  store: Pick<KvStore, 'get'>,
): BudgetAlert[] {
  return views
    .filter((view) => view.alertReached && view.open)
    .filter((view) => store.get(alertKey(view.budget.id)) !== view.range.start)
    .map((view) => ({
      budgetId: view.budget.id,
      name: view.budget.name,
      percent: Math.round(view.ratio * 100),
    }));
}
