import {
  backupFile,
  csvFile,
  type DateRange,
  type ExportFile,
  type LocalDate,
  NothingToExportError,
  type UserData,
} from '@saldo/core';
import { zipSync } from 'fflate';
import type { Repositories } from '../db/repositories';

// What goes inside a file is `@saldo/core`'s (`io/exportFiles`), shared with the web's export
// routes; this module only collects the rows from the repositories, and zips.
export { type ExportFile, NothingToExportError };

/** Every live row, as `@saldo/core` sees it: an attachment without what only this device knows. */
function collect(repos: Repositories): UserData {
  const transactions = repos.transactions.list();
  return {
    settings: repos.settings.get(),
    accounts: repos.accounts.list(),
    categories: repos.categories.list(),
    tags: repos.tags.list(),
    transactions,
    recurrences: repos.recurrences.list(),
    budgets: repos.budgets.list(),
    attachments: transactions
      .flatMap((tx) => repos.attachments.listFor(tx.id))
      .map(({ localUri: _uri, blobState: _state, ...entity }) => entity),
  };
}

/**
 * §11.1. Every live row — `list()` already leaves tombstones out, and a restore is a replacement,
 * so a deleted row has nothing to say. Throws `NothingToExportError` before onboarding.
 */
export function buildBackupFile(
  repos: Repositories,
  options: { today: LocalDate; exportedAt: string; appVersion: string },
): ExportFile {
  return backupFile(collect(repos), options);
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

/**
 * §11.2. `range` is the selected period, or null for everything. Rows come out newest first, the
 * order the transaction list shows them in.
 */
export function buildCsvFile(
  repos: Repositories,
  options: { today: LocalDate; range: DateRange | null },
): ExportFile {
  return csvFile(
    {
      settings: repos.settings.get(),
      accounts: repos.accounts.list(),
      categories: repos.categories.list(),
      tags: repos.tags.list(),
      transactions: repos.transactions.list(),
    },
    options,
  );
}
