import { describe, expect, it } from 'vitest';
import { type Transaction, transactionSchema } from '../entities';
import { emptyUserData, type UserData } from '../userData';
import { readBackup } from './backup';
import { csvRows, toCsv } from './csv';
import { backupFile, csvFile } from './exportFiles';

const CREATED = '2026-09-01T10:00:00.000Z';
const HLC = '000000000000001-0000-dev';

const settings = {
  id: 'settings' as const,
  createdAt: CREATED,
  updatedAt: HLC,
  deletedAt: null,
  periodKind: 'cycle' as const,
  cycleStartDay: 27,
  currency: 'EUR' as const,
  language: 'it' as const,
  theme: 'system' as const,
  onboardingCompletedAt: CREATED,
};

const account = {
  id: 'acc-1',
  createdAt: CREATED,
  updatedAt: HLC,
  deletedAt: null,
  name: 'Carta',
  type: 'checking' as const,
  institution: null,
  openingBalance: 10_000,
  includeInSpendable: true,
  colorIndex: 3,
  icon: 'card',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
};

const tx = (id: string, date: string): Transaction =>
  transactionSchema.parse({
    id,
    createdAt: CREATED,
    updatedAt: HLC,
    deletedAt: null,
    date,
    kind: 'expense',
    amount: 4500,
    accountId: account.id,
    toAccountId: null,
    categoryId: 'cat-1',
    description: `Spesa ${id}`,
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  });

const data = (over: Partial<UserData> = {}): UserData => ({
  ...emptyUserData(),
  settings,
  accounts: [account],
  ...over,
});

const STAMP = { today: '2026-09-11' as const, exportedAt: CREATED, appVersion: '0.1.0' };

describe('backupFile', () => {
  it('is named after today and holds a backup its own reader accepts', () => {
    const file = backupFile(data({ transactions: [tx('t1', '2026-09-05')] }), STAMP);
    expect(file.name).toBe('saldo-backup-2026-09-11.json');
    expect(file.mimeType).toBe('application/json');
    const result = readBackup(file.contents);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.backup.exportedAt).toBe(CREATED);
      expect(result.backup.app.version).toBe('0.1.0');
      expect(result.backup.data.accounts).toEqual([account]);
      expect(result.backup.data.transactions).toHaveLength(1);
    }
  });
});

describe('csvFile', () => {
  const rows = [
    tx('b', '2026-09-05'),
    tx('z', '2026-07-01'),
    tx('a', '2026-09-05'),
    tx('c', '2026-09-10'),
  ];

  it('writes every transaction, newest first and by id within a day', () => {
    const file = csvFile(data({ transactions: rows }), { today: '2026-09-11', range: null });
    expect(file.name).toBe('saldo-transactions-2026-09-11.csv');
    expect(file.mimeType).toBe('text/csv');
    const ordered = [rows[3], rows[2], rows[0], rows[1]].filter((row) => row !== undefined);
    expect(file.contents).toBe(
      toCsv(csvRows(ordered, { currency: 'EUR', accounts: [account], categories: [], tags: [] })),
    );
  });

  it('keeps only the rows inside the range, ends included', () => {
    const file = csvFile(data({ transactions: rows }), {
      today: '2026-09-11',
      range: { start: '2026-09-05', end: '2026-09-10' },
    });
    const lines = file.contents.trimEnd().split('\r\n');
    expect(lines.map((line) => line.split(',').at(-1))).toEqual(['id', 'c', 'a', 'b']);
  });
});
