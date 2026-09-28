import type { BudgetCardStatus, GoalCardStatus } from '@saldo/core';
import type { AppLocale } from './format';
import { plural, type Translate } from './translate';

/**
 * The status beside «Budget» in a target card's header (§5.13). With no budget at all the card has
 * no state to report, so it says so — `budgetCardStatus([])` is `withinLimits`, which would claim
 * one.
 */
export function budgetCardStatusText(
  count: number,
  status: BudgetCardStatus,
  t: Translate,
  locale: AppLocale,
): string {
  if (count === 0) return t('budgets.empty');
  if (status.kind === 'overLimit') return plural(t, locale, 'targets.overLimit', status.count);
  if (status.kind === 'overPace') return plural(t, locale, 'budgets.overPace', status.count);
  return t('budgets.withinLimits');
}

/** The status beside «Obiettivi»: none, on time, or the first two of expired, behind, reached. */
export function goalCardStatusText(
  count: number,
  status: GoalCardStatus,
  t: Translate,
  locale: AppLocale,
): string {
  if (count === 0) return t('goals.empty');
  const parts = [
    status.expired > 0 ? plural(t, locale, 'goals.expired', status.expired) : null,
    status.behind > 0 ? plural(t, locale, 'goals.behind', status.behind) : null,
    status.reached > 0 ? plural(t, locale, 'goals.reached', status.reached) : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? t('goals.onTime') : parts.slice(0, 2).join(' · ');
}
