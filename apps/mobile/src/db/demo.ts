import {
  addDays,
  type Category,
  diffDays,
  type LocalDate,
  occurrenceId,
  type PeriodDef,
  periodContaining,
} from '@saldo/core';
import type { IconName } from '@saldo/ui';
import {
  DEMO_ACCOUNTS,
  DEMO_BUDGETS,
  DEMO_REFERENCE_CYCLE,
  DEMO_TAGS,
  DEMO_TRANSACTIONS,
  type DemoTransaction,
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
 * Recurring transactions carry a real `recurrenceId`, not just a label: every description that
 * repeats across months becomes one `recurrences` row, so the committed share of §5.7 is not flat
 * *and* `EditTransaction`'s scope sheet finds a recurrence to look up instead of the `null`
 * `RecurrenceScopeSheet` returns for a dangling id (§8.1 only requires the UI to tolerate that
 * case, not that this fixture create it).
 *
 * Each row is anchored on its group's most recent occurrence (`startDate === endDate`, the day
 * that occurrence carries the deterministic `occurrenceId`), because the app runs the materialiser
 * right after seeding and again on every open: with the window pinned to a single day that already
 * has its expected row, there is nothing left to generate. A wider window would let the
 * materialiser regenerate real bill dates, which — unlike the app's fixed day-of-month recurrences
 * — jump around from month to month in the prototype's data (Vodafone lands on the 13th one month
 * and the 15th the next), so it would invent extra, wrongly-dated transactions instead of
 * recognising the ones already here.
 */
export function seedDemoData(repos: Repositories, input: DemoSeedInput): void {
  // Idempotent twice over, because the row that calls it is an ordinary list row in Profile and
  // nothing stops a second tap. It used to create the whole §4.2 catalogue unconditionally, so a
  // second tap meant a second "Spesa", "Supermercato" and "Panetteria" — with every transaction
  // hanging off the first set and each later copy reading "0 voci". The categories admin then
  // looked broken, and it was not.
  //
  //  - Nothing at all happens once the demo transactions are in.
  //  - The categories are matched to the ones onboarding already wrote, rather than added beside
  //    them, so loading the demo on a real (if empty) install stays a no-op for the tree.
  if (repos.transactions.list().length > 0) return;

  const shift = dateShift(input.today, input.def);

  const existing = repos.categories.list();
  const match = (name: string, direction: Category['direction'], parentId: string | null) =>
    existing.find(
      (category) =>
        category.name === name &&
        category.direction === direction &&
        category.parentId === parentId &&
        category.archivedAt === null,
    );

  const categoryIdByKey = new Map<string, string>();
  let sortOrder = existing.length;
  for (const category of SEED_CATEGORIES) {
    const parentName = input.translate(category.nameKey);
    const parent =
      match(parentName, category.direction, null) ??
      repos.categories.create({
        name: parentName,
        direction: category.direction,
        parentId: null,
        icon: category.icon,
        colorIndex: category.colorIndex,
        archivedAt: null,
        sortOrder: sortOrder++,
      });
    categoryIdByKey.set(category.nameKey, parent.id);
    for (const child of category.children ?? []) {
      const childName = input.translate(child.nameKey);
      const created =
        match(childName, category.direction, parent.id) ??
        repos.categories.create({
          name: childName,
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

  // One recurrence per repeated description (the label the prototype gives the same bill in
  // consecutive months), anchored on the group's latest occurrence — see the note above for why
  // the window is exactly that one day.
  const recurringGroups = new Map<string, DemoTransaction[]>();
  for (const tx of DEMO_TRANSACTIONS) {
    if (!tx.recurring) continue;
    const group = recurringGroups.get(tx.description) ?? [];
    group.push(tx);
    recurringGroups.set(tx.description, group);
  }

  const recurrenceIdByDescription = new Map<string, string>();
  const anchorDateByDescription = new Map<string, LocalDate>();
  for (const [description, group] of recurringGroups) {
    const anchor = [...group]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .at(-1);
    const accountId = anchor === undefined ? undefined : accountIdByName.get(anchor.account);
    const categoryId = anchor === undefined ? undefined : categoryIdByKey.get(anchor.categoryKey);
    if (anchor === undefined || accountId === undefined || categoryId === undefined) continue;
    const anchorDate = addDays(anchor.date, shift);
    const recurrence = repos.recurrences.create({
      frequency: 'monthly',
      startDate: anchorDate,
      endDate: anchorDate,
      template: {
        kind: anchor.kind,
        amount: anchor.amount,
        accountId,
        toAccountId: null,
        categoryId,
        description: anchor.description,
        tagIds: anchor.tags.flatMap((name) => {
          const id = tagIdByName.get(name);
          return id === undefined ? [] : [id];
        }),
        excludeFromTotals: anchor.excluded,
      },
    });
    recurrenceIdByDescription.set(description, recurrence.id);
    anchorDateByDescription.set(description, anchorDate);
  }

  for (const tx of DEMO_TRANSACTIONS) {
    const accountId = accountIdByName.get(tx.account);
    const categoryId = categoryIdByKey.get(tx.categoryKey);
    if (accountId === undefined || categoryId === undefined) continue;
    const recurrenceId = tx.recurring
      ? (recurrenceIdByDescription.get(tx.description) ?? null)
      : null;
    const date = addDays(tx.date, shift);
    // The anchor occurrence must carry the id the materialiser expects for it, or the very first
    // run after seeding creates a second row on the same date instead of recognising this one.
    const isAnchorOccurrence =
      recurrenceId !== null && date === anchorDateByDescription.get(tx.description);
    repos.transactions.create({
      id:
        isAnchorOccurrence && recurrenceId !== null ? occurrenceId(recurrenceId, date) : undefined,
      kind: tx.kind,
      amount: tx.amount,
      date,
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
      recurrenceId,
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
