import {
  type Backup,
  buildBackup,
  csvRows,
  type DateRange,
  type LocalDate,
  type Transaction,
  toCsv,
} from '@saldo/core';
import { zipSync } from 'fflate';
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
    attachments: repos.transactions
      .list()
      .flatMap((tx) => repos.attachments.listFor(tx.id))
      .map(({ localUri: _uri, blobState: _state, ...entity }) => entity),
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

/** What a ZIP backup needs from the device: the bytes of each attachment it can still find. */
export interface AttachmentBytes {
  id: string;
  extension: string;
  bytes: Uint8Array;
}

export interface ZipExportFile extends Omit<ExportFile, 'contents'> {
  contents: Uint8Array;
  /** Attachments whose local file was gone; the backup is complete apart from these. */
  missing: string[];
}

/**
 * §11.1: `backup.json` plus `attachments/{id}.{ext}`, zipped. Attachments this device does not
 * hold are **listed rather than skipped silently** — a backup that quietly loses a receipt is
 * worse than one that says which it could not include.
 */
export function buildZipBackup(
  repos: Repositories,
  options: { today: LocalDate; exportedAt: string; appVersion: string },
  read: (id: string) => AttachmentBytes | null,
): ZipExportFile {
  const backup = buildBackupFile(repos, options);
  const files: Record<string, Uint8Array> = {
    'backup.json': new TextEncoder().encode(backup.contents),
  };
  const missing: string[] = [];
  for (const attachment of collect(repos).attachments) {
    const found = read(attachment.id);
    if (found === null) {
      missing.push(attachment.id);
      continue;
    }
    files[`attachments/${found.id}.${found.extension}`] = found.bytes;
  }
  return {
    name: `saldo-backup-${options.today}.zip`,
    contents: zipSync(files, { level: 6 }),
    mimeType: 'application/zip',
    missing,
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
