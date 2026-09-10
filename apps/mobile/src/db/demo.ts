import { addDays, diffDays, type LocalDate, type PeriodDef, periodContaining } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import {
  DEMO_ACCOUNTS,
  DEMO_BUDGETS,
  DEMO_REFERENCE_CYCLE,
  DEMO_TAGS,
  DEMO_TRANSACTIONS,
} from './demoData.generated';
import type { Repositories } from './repositories';
import { SEED_CATEGORIES } from './seed';

export interface DemoSeedInput {
  today: LocalDate;
  def: PeriodDef;
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
}

/**
 * Dev-only seeder (§7): the design prototype's mock data, shifted so the current cycle contains
 * today. The whole set moves by one offset, which keeps every relative distance — a transaction
 * three days after the cycle start stays three days after it.
 */
function dateShift(today: LocalDate, def: PeriodDef): number {
  const currentStart = periodContaining(def, today).start;
  return diffDays(DEMO_REFERENCE_CYCLE.start, currentStart);
}

/**
 * Loads the demo data. Categories come from the §4.2 catalogue so names follow the user's
 * language; accounts get an opening balance chosen so their computed balance matches the
 * prototype's.
 *
 * Recurring transactions carry a synthetic `recurrenceId` so the committed share of §5.7 is not
 * flat, but the `Recurrence` rows themselves arrive with phase 03, which owns that repository.
 * §8.1 already requires the UI to tolerate a dangling reference.
 */
export function seedDemoData(repos: Repositories, input: DemoSeedInput): void {
  const shift = dateShift(input.today, input.def);

  const categoryIdByKey = new Map<string, string>();
  let sortOrder = 0;
  for (const category of SEED_CATEGORIES) {
    const parent = repos.categories.create({
      name: input.translate(category.nameKey),
      direction: category.direction,
      parentId: null,
      icon: category.icon,
      colorIndex: category.colorIndex,
      archivedAt: null,
      sortOrder: sortOrder++,
    });
    categoryIdByKey.set(category.nameKey, parent.id);
    for (const child of category.children ?? []) {
      const created = repos.categories.create({
        name: input.translate(child.nameKey),
        direction: category.direction,
        parentId: parent.id,
        icon: child.icon,
        colorIndex: child.colorIndex,
        archivedAt: null,
        sortOrder: sortOrder++,
      });
      categoryIdByKey.set(child.nameKey, created.id);
    }
  }

  const tagIdByName = new Map<string, string>();
  for (const name of DEMO_TAGS) {
    tagIdByName.set(name, repos.tags.create({ name }).id);
  }

  // An account's opening balance is whatever makes its closing balance match the prototype.
  const netByAccount = new Map<string, number>();
  for (const tx of DEMO_TRANSACTIONS) {
    const signed = tx.kind === 'income' ? tx.amount : -tx.amount;
    netByAccount.set(tx.account, (netByAccount.get(tx.account) ?? 0) + signed);
  }

  const accountIdByName = new Map<string, string>();
  DEMO_ACCOUNTS.forEach((account, index) => {
    const created = repos.accounts.create({
      name: account.name,
      type: account.credit ? 'credit_card' : account.investment ? 'investment' : 'checking',
      institution: account.institution,
      openingBalance: account.balance - (netByAccount.get(account.name) ?? 0),
      includeInSpendable: !account.investment,
      colorIndex: index % 10,
      icon: account.icon as IconName,
      creditCloseDay: account.closeDay,
      creditChargeDay: account.chargeDay,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: index,
    });
    accountIdByName.set(account.name, created.id);
  });

  for (const tx of DEMO_TRANSACTIONS) {
    const accountId = accountIdByName.get(tx.account);
    const categoryId = categoryIdByKey.get(tx.categoryKey);
    if (accountId === undefined || categoryId === undefined) continue;
    repos.transactions.create({
      kind: tx.kind,
      amount: tx.amount,
      date: addDays(tx.date, shift),
      accountId,
      toAccountId: null,
      categoryId,
      description: tx.description,
      note: null,
      tagIds: tx.tags.flatMap((name) => {
        const id = tagIdByName.get(name);
        return id === undefined ? [] : [id];
      }),
      excludeFromTotals: tx.excluded,
      recurrenceId: tx.recurring ? `demo-recurrence:${tx.description}` : null,
    });
  }

  DEMO_BUDGETS.forEach((budget, index) => {
    const categoryId = categoryIdByKey.get(budget.categoryKey);
    if (categoryId === undefined) return;
    repos.budgets.create({
      name: input.translate(budget.categoryKey),
      categoryIds: [categoryId],
      amount: budget.amount,
      period: 'period',
      alertThreshold: 90,
      rollover: false,
      icon: SEED_CATEGORIES.find((c) => c.nameKey === budget.categoryKey)?.icon ?? 'target',
      sortOrder: index,
    });
  });
}
