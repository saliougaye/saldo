import {
  type Backup,
  buildBackup,
  csvRows,
  type DateRange,
  type LocalDate,
  type Transaction,
  toCsv,
} from '@saldo/core';
import type { Repositories } from '../db/repositories';

/** What an export produced: a file name and its contents, ready to be written and shared. */
export interface ExportFile {
  name: string;
  contents: string;
  mimeType: string;
}

/**
 * Nothing can be exported before onboarding has written settings — a backup without them could
 * not be restored, since the restore replaces settings too.
 */
export class NothingToExportError extends Error {
  constructor() {
    super('There are no settings to export yet');
    this.name = 'NothingToExportError';
  }
}

function collect(repos: Repositories) {
  const settings = repos.settings.get();
  if (settings === null) throw new NothingToExportError();
  return {
    settings,
    accounts: repos.accounts.list(),
    categories: repos.categories.list(),
    tags: repos.tags.list(),
    transactions: repos.transactions.list(),
    recurrences: repos.recurrences.list(),
    budgets: repos.budgets.list(),
    // 09b fills this in; the field exists from the start so adding files is not a format change.
    attachments: [],
  };
}

/**
 * §11.1. Every live row, as `@saldo/core` sees it — `list()` already leaves tombstones out, and a
 * restore is a replacement, so a deleted row has nothing to say.
 */
export function buildBackupFile(
  repos: Repositories,
  options: { today: LocalDate; exportedAt: string; appVersion: string },
): ExportFile {
  const backup: Backup = buildBackup({
    exportedAt: options.exportedAt,
    appVersion: options.appVersion,
    data: collect(repos),
  });
  return {
    name: `saldo-backup-${options.today}.json`,
    contents: JSON.stringify(backup),
    mimeType: 'application/json',
  };
}

function inRange(tx: Transaction, range: DateRange | null): boolean {
  return range === null || (tx.date >= range.start && tx.date <= range.end);
}

/**
 * §11.2. `range` is the selected period, or null for everything. Rows come out newest first, the
 * order the transaction list shows them in.
 */
export function buildCsvFile(
  repos: Repositories,
  options: { today: LocalDate; range: DateRange | null },
): ExportFile {
  const settings = repos.settings.get();
  if (settings === null) throw new NothingToExportError();
  const transactions = repos.transactions
    .list()
    .filter((tx) => inRange(tx, options.range))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
  const rows = csvRows(transactions, {
    currency: settings.currency,
    accounts: repos.accounts.list(),
    categories: repos.categories.list(),
    tags: repos.tags.list(),
  });
  return {
    name: `saldo-transactions-${options.today}.csv`,
    contents: toCsv(rows),
    mimeType: 'text/csv',
  };
}
