import {
  IMPORTED_CATEGORY_COLOR,
  IMPORTED_CATEGORY_ICON,
  type ImportPlan,
  type MinorUnits,
  normalizeText,
  transactionFingerprint,
} from '@saldo/core';
import type { Repositories } from '../db/repositories';
import type { RepositoryDatabase } from '../db/repositories/support';

export interface ImportOutcome {
  imported: number;
  /** Rows the plan had already decided were duplicates. */
  skipped: number;
}

/**
 * Every live transaction's fingerprint, so the preview knows what a second run of the same file
 * would skip (§11.3). Account names are resolved here because the fingerprint is built from names,
 * not ids: the file being imported has no ids of ours.
 */
export function existingFingerprints(repos: Repositories): Set<string> {
  const accountName = new Map(repos.accounts.list().map((account) => [account.id, account.name]));
  const fingerprints = new Set<string>();
  for (const tx of repos.transactions.list()) {
    // A transfer has no importable equivalent: the importer only ever produces expense and income.
    if (tx.kind === 'transfer') continue;
    fingerprints.add(
      transactionFingerprint({
        date: tx.date,
        amount: tx.amount,
        kind: tx.kind,
        description: tx.description,
        accountName: accountName.get(tx.accountId) ?? '',
      }),
    );
  }
  return fingerprints;
}

export interface ImportWriteOptions {
  /** Opening balance per new account name; 0 for any name it does not list (§11.3). */
  openingBalances?: ReadonlyMap<string, MinorUnits>;
}

/**
 * Writes what `planImport` decided, in one transaction (§11.3): a half-finished import would leave
 * accounts and categories nobody asked for.
 */
export function applyImport(
  db: RepositoryDatabase,
  repos: Repositories,
  plan: ImportPlan,
  options: ImportWriteOptions = {},
): ImportOutcome {
  return db.transaction(() => writeImport(repos, plan, options));
}

/**
 * `applyImport` without a transaction of its own, for a caller that writes more in the same one
 * (onboarding, §6.29). Names are created first so every transaction can point at an id, and only
 * when they are still missing: rows written after the plan was made — the hidden seed categories,
 * or a sync — must not gain a twin.
 */
export function writeImport(
  repos: Repositories,
  plan: ImportPlan,
  options: ImportWriteOptions = {},
): ImportOutcome {
  const accounts = new Map(
    repos.accounts.list().map((account) => [normalizeText(account.name), account.id]),
  );
  const tags = new Map(repos.tags.list().map((tag) => [normalizeText(tag.name), tag.id]));
  const categories = new Map(
    repos.categories
      .list()
      .map((category) => [`${category.direction}:${normalizeText(category.name)}`, category.id]),
  );

  for (const name of plan.newAccounts) {
    if (accounts.has(normalizeText(name))) continue;
    const created = repos.accounts.create({
      name,
      type: 'checking',
      institution: null,
      openingBalance: options.openingBalances?.get(name) ?? 0,
      includeInSpendable: true,
      colorIndex: 0,
      icon: 'landmark',
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: accounts.size,
    });
    accounts.set(normalizeText(name), created.id);
  }

  for (const { name, direction } of plan.newCategories) {
    if (categories.has(`${direction}:${normalizeText(name)}`)) continue;
    const created = repos.categories.create({
      name,
      direction,
      parentId: null,
      colorIndex: IMPORTED_CATEGORY_COLOR,
      icon: IMPORTED_CATEGORY_ICON,
      archivedAt: null,
      sortOrder: categories.size,
    });
    categories.set(`${direction}:${normalizeText(name)}`, created.id);
  }

  for (const name of plan.newTags) {
    if (tags.has(normalizeText(name))) continue;
    const created = repos.tags.create({ name });
    tags.set(normalizeText(name), created.id);
  }

  let imported = 0;
  for (const planned of plan.transactions) {
    const accountId = accounts.get(normalizeText(planned.accountName));
    // Unreachable: the planner registered every name it used. Skipping beats writing a row that
    // points nowhere.
    if (accountId === undefined) continue;
    const categoryId = categories.get(`${planned.kind}:${normalizeText(planned.categoryName)}`);
    // Unreachable for the same reason as the account above.
    if (categoryId === undefined) continue;
    repos.transactions.create({
      date: planned.date,
      kind: planned.kind,
      amount: planned.amount,
      accountId,
      toAccountId: null,
      categoryId,
      description: planned.description,
      note: planned.note,
      tagIds: planned.tagNames
        .map((name) => tags.get(normalizeText(name)))
        .filter((id): id is string => id !== undefined),
      excludeFromTotals: false,
      recurrenceId: null,
    });
    imported += 1;
  }

  return { imported, skipped: plan.duplicates };
}
