import { readBackup } from '@saldo/core';
import { unzipSync } from 'fflate';
import { createRepositories, type Repositories } from '../db/repositories';
import { createTestDatabase } from '../db/testing';
import {
  type AttachmentBytes,
  buildBackupFile,
  buildCsvFile,
  buildZipBackup,
  NothingToExportError,
} from './exportService';

const CREATED_AT = '2026-04-18T10:00:00.000Z';
const STAMP = { today: '2026-09-11' as const, exportedAt: CREATED_AT, appVersion: '0.1.0' };

function setup(): Repositories {
  return createRepositories(createTestDatabase(), () => CREATED_AT);
}

function seed(repos: Repositories) {
  repos.settings.create({
    periodKind: 'cycle',
    cycleStartDay: 27,
    currency: 'EUR',
    language: 'system',
    theme: 'dark',
    onboardingCompletedAt: CREATED_AT,
  });
  const account = repos.accounts.create({
    name: 'Conto corrente',
    type: 'checking',
    institution: null,
    openingBalance: 500_000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  });
  const category = repos.categories.create({
    name: 'Trasporti',
    direction: 'expense',
    parentId: null,
    colorIndex: 1,
    icon: 'car',
    archivedAt: null,
    sortOrder: 0,
  });
  const tag = repos.tags.create({ name: 'Vacanza' });
  const tx = (date: string, amount: number) =>
    repos.transactions.create({
      date,
      kind: 'expense',
      amount,
      accountId: account.id,
      toAccountId: null,
      categoryId: category.id,
      description: 'Benzina Q8',
      note: null,
      tagIds: [tag.id],
      excludeFromTotals: false,
      recurrenceId: null,
    });
  return {
    account,
    category,
    tag,
    inside: tx('2026-09-05', 4500),
    outside: tx('2026-07-01', 1000),
  };
}

describe('buildBackupFile', () => {
  it('produces a backup its own reader accepts', () => {
    const repos = setup();
    seed(repos);
    const file = buildBackupFile(repos, STAMP);
    expect(file.name).toBe('saldo-backup-2026-09-11.json');
    const result = readBackup(file.contents);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.data.accounts).toHaveLength(1);
      expect(result.backup.data.transactions).toHaveLength(2);
      expect(result.backup.data.attachments).toEqual([]);
    }
  });

  it('leaves deleted rows out', () => {
    const repos = setup();
    const { outside } = seed(repos);
    repos.transactions.remove(outside.id);
    const result = readBackup(buildBackupFile(repos, STAMP).contents);
    if (result.ok) expect(result.backup.data.transactions).toHaveLength(1);
  });

  it('refuses to export before onboarding has written settings', () => {
    expect(() => buildBackupFile(setup(), STAMP)).toThrow(NothingToExportError);
  });
});

describe('buildCsvFile', () => {
  it('writes every transaction when no range is given', () => {
    const repos = setup();
    seed(repos);
    const file = buildCsvFile(repos, { today: '2026-09-11', range: null });
    expect(file.name).toBe('saldo-transactions-2026-09-11.csv');
    const lines = file.contents.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]?.startsWith('﻿date,type,amount')).toBe(true);
    // Newest first, the order the transaction list uses.
    expect(lines[1]).toContain('2026-09-05');
    expect(lines[2]).toContain('2026-07-01');
  });

  it('keeps only the rows inside the range', () => {
    const repos = setup();
    seed(repos);
    const file = buildCsvFile(repos, {
      today: '2026-09-11',
      range: { start: '2026-08-27', end: '2026-09-26' },
    });
    const lines = file.contents.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('2026-09-05');
  });

  it('writes the header alone when nothing falls in the range', () => {
    const repos = setup();
    seed(repos);
    const file = buildCsvFile(repos, {
      today: '2026-09-11',
      range: { start: '2026-01-01', end: '2026-01-31' },
    });
    expect(file.contents.trimEnd().split('\r\n')).toHaveLength(1);
  });
});

describe('buildZipBackup', () => {
  const attach = (repos: Repositories, transactionId: string, id: string) =>
    repos.attachments.create({
      id,
      transactionId,
      mimeType: 'image/jpeg',
      byteSize: 3,
      sha256: 'a'.repeat(64),
      width: 10,
      height: 10,
      localUri: `file:///${id}.jpg`,
    });

  const read = (id: string): AttachmentBytes => ({
    id,
    extension: 'jpg',
    bytes: new Uint8Array([1, 2, 3]),
  });

  it('carries backup.json and one file per attachment', () => {
    const repos = setup();
    const { inside } = seed(repos);
    attach(repos, inside.id, 'att-1');
    attach(repos, inside.id, 'att-2');

    const zip = buildZipBackup(repos, STAMP, read);
    expect(zip.name).toBe('saldo-backup-2026-09-11.zip');
    expect(zip.missing).toEqual([]);

    const entries = unzipSync(zip.contents);
    expect(Object.keys(entries).sort()).toEqual([
      'attachments/att-1.jpg',
      'attachments/att-2.jpg',
      'backup.json',
    ]);
    const parsed = readBackup(new TextDecoder().decode(entries['backup.json']));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.data.attachments).toHaveLength(2);
  });

  it('names the attachments it could not find instead of losing them quietly', () => {
    const repos = setup();
    const { inside } = seed(repos);
    attach(repos, inside.id, 'att-1');

    const zip = buildZipBackup(repos, STAMP, () => null);
    expect(zip.missing).toEqual(['att-1']);
    expect(Object.keys(unzipSync(zip.contents))).toEqual(['backup.json']);
  });

  it('is just backup.json when there are no attachments', () => {
    const repos = setup();
    seed(repos);
    expect(Object.keys(unzipSync(buildZipBackup(repos, STAMP, read).contents))).toEqual([
      'backup.json',
    ]);
  });
});
