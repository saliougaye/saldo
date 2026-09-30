import type { BudgetView } from '@saldo/core';
import type { Translate } from '@saldo/i18n/translate';

/** What the budget rows say, from `@saldo/core`'s `BudgetView` — Home and `/budgets` both call these. */
export interface BudgetTextDeps {
  t: Translate;
  money: (minor: number) => string;
}

/** The colour of a budget that has none of its own: its first category's, or the neutral 9. */
export const NEUTRAL_COLOUR_INDEX = 9;

/** The pace tick is drawn only while the period is open. */
export function budgetPace(item: BudgetView): number | null {
  return item.open ? item.pace : null;
}

export function budgetTone(item: BudgetView): 'normal' | 'over' {
  return item.overPace || item.overLimit ? 'over' : 'normal';
}

export function budgetColour(
  item: BudgetView,
  categories: readonly { id: string; colorIndex: number }[],
): number {
  return (
    categories.find((category) => category.id === item.budget.categoryIds[0])?.colorIndex ??
    NEUTRAL_COLOUR_INDEX
  );
}

export function budgetMeta(item: BudgetView, { t, money }: BudgetTextDeps): string {
  if (item.overLimit) return t('targets.overLimitMeta');
  if (item.open) return t('targets.left', { amount: money(item.limit - item.spent) });
  return t('targets.closedMeta');
}

export function budgetStatus(item: BudgetView, { t, money }: BudgetTextDeps): string {
  if (item.overLimit) {
    return t('targets.overLimitBy', { amount: money(item.spent - item.limit) });
  }
  if (item.overPace) {
    return t('targets.overPaceBy', {
      amount: money(Math.round(item.spent - item.limit * item.pace)),
    });
  }
  return t('targets.inLine');
}

/** The row as one sentence for a screen reader. */
export function budgetLabel(item: BudgetView, deps: BudgetTextDeps): string {
  return deps.t('targets.itemLabel', {
    name: item.budget.name,
    amount: deps.money(item.spent),
    limit: deps.money(item.limit),
    status: budgetStatus(item, deps),
  });
}
