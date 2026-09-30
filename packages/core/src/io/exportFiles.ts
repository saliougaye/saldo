import type { DateRange } from '../cycle';
import type { LocalDate } from '../dates';
import type { Transaction } from '../entities';
import type { UserData } from '../userData';
import { buildBackup } from './backup';
import { csvRows, toCsv } from './csv';

/** What an export produced: a file name and its contents, ready to be written, shared or sent. */
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

/**
 * §11.1. `data` holds live rows only — the phone's `list()` and the server's projection both leave
 * tombstones out, and a restore is a replacement, so a deleted row has nothing to say. The
 * attachments are their rows, not their bytes.
 */
export function backupFile(
  data: UserData,
  options: { today: LocalDate; exportedAt: string; appVersion: string },
): ExportFile {
  const { settings } = data;
  if (settings === null) throw new NothingToExportError();
  const backup = buildBackup({
    exportedAt: options.exportedAt,
    appVersion: options.appVersion,
    data: { ...data, settings },
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
 * order the transaction list shows them in, and by id within a day so the same data always writes
 * the same file.
 */
export function csvFile(
  data: Pick<UserData, 'settings' | 'accounts' | 'categories' | 'tags' | 'transactions'>,
  options: { today: LocalDate; range: DateRange | null },
): ExportFile {
  const { settings } = data;
  if (settings === null) throw new NothingToExportError();
  const transactions = data.transactions
    .filter((tx) => inRange(tx, options.range))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));
  const rows = csvRows(transactions, {
    currency: settings.currency,
    accounts: data.accounts,
    categories: data.categories,
    tags: data.tags,
  });
  return {
    name: `saldo-transactions-${options.today}.csv`,
    contents: toCsv(rows),
    mimeType: 'text/csv',
  };
}
