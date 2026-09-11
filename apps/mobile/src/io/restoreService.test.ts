import { readBackup } from '@saldo/core';
import { eq } from 'drizzle-orm';
import { createClock } from '../db/clock';
import { createKvStore } from '../db/kv';
import { createRepositories, type Repositories } from '../db/repositories';
import type { RepositoryDatabase } from '../db/repositories/support';
import { PENDING, SYNCED } from '../db/repositories/support';
import { accounts, transactions } from '../db/schema';
import { createTestDatabase } from '../db/testing';
import { buildBackupFile } from './exportService';
import { applyRestore } from './restoreService';

const CREATED_AT = '2026-04-18T10:00:00.000Z';
const NOW = '2026-09-11T08:00:00.000Z';
const STAMP = { today: '2026-09-11' as const, exportedAt: NOW, appVersion: '0.1.0' };

function setup(): { db: RepositoryDatabase; repos: Repositories } {
  const db = createTestDatabase();
  return { db, repos: createRepositories(db, () => CREATED_AT) };
}

function seedSettings(repos: Repositories) {
  repos.settings.create({
    periodKind: 'cycle',
    cycleStartDay: 27,
    currency: 'EUR',
    language: 'system',
    theme: 'dark',
    onboardingCompletedAt: CREATED_AT,
  });
}

function seedAccount(repos: Repositories, name: string) {
  return repos.accounts.create({
    name,
    type: 'checking',
    institution: null,
    openingBalance: 0,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  });
}

function seedTransaction(repos: Repositories, accountId: string, date: string) {
  const category = repos.categories.create({
    name: 'Trasporti',
    direction: 'expense',
    parentId: null,
    colorIndex: 1,
    icon: 'car',
    archivedAt: null,
    sortOrder: 0,
  });
  return repos.transactions.create({
    date,
    kind: 'expense',
    amount: 4500,
    accountId,
    toAccountId: null,
    categoryId: category.id,
    description: 'Benzina',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  });
}

/** Exports one database, then restores that file into another. */
function backupOf(repos: Repositories) {
  const result = readBackup(buildBackupFile(repos, STAMP).contents);
  if (!result.ok) throw new Error(`the export is not a valid backup: ${result.reason}`);
  return result.backup;
}

describe('applyRestore', () => {
  it('brings a backup into an empty database', () => {
    const source = setup();
    seedSettings(source.repos);
    const account = seedAccount(source.repos, 'Conto corrente');
    seedTransaction(source.repos, account.id, '2026-09-05');

    const target = setup();
    const outcome = applyRestore({
      db: target.db,
      clock: createClock(createKvStore(target.db)),
      backup: backupOf(source.repos),
      now: NOW,
    });

    expect(outcome.restored).toBe(4); // settings, account, category, transaction
    expect(outcome.removed).toBe(0);
    expect(target.repos.accounts.list().map((row) => row.name)).toEqual(['Conto corrente']);
    expect(target.repos.transactions.list()).toHaveLength(1);
    expect(target.repos.settings.get()?.currency).toBe('EUR');
  });

  it('keeps the ids, so restoring onto the same account converges', () => {
    const source = setup();
    seedSettings(source.repos);
    const account = seedAccount(source.repos, 'Conto corrente');

    const target = setup();
    applyRestore({
      db: target.db,
      clock: createClock(createKvStore(target.db)),
      backup: backupOf(source.repos),
      now: NOW,
    });
    expect(target.repos.accounts.list()[0]?.id).toBe(account.id);
  });

  it('tombstones what the backup does not contain', () => {
    const source = setup();
    seedSettings(source.repos);
    seedAccount(source.repos, 'Solo questo');
    const backup = backupOf(source.repos);

    const target = setup();
    seedSettings(target.repos);
    const doomed = seedAccount(target.repos, 'Da sostituire');
    seedTransaction(target.repos, doomed.id, '2026-09-05');

    const outcome = applyRestore({
      db: target.db,
      clock: createClock(createKvStore(target.db)),
      backup,
      now: NOW,
    });

    expect(outcome.removed).toBe(3); // the account, its category and its transaction
    expect(target.repos.accounts.list().map((row) => row.name)).toEqual(['Solo questo']);
    expect(target.repos.transactions.list()).toEqual([]);
    const [gone] = target.db.select().from(accounts).where(eq(accounts.id, doomed.id)).all();
    expect(gone?.deletedAt).toBe(NOW);
    expect(gone?.syncState).toBe(PENDING);
  });

  it('marks every restored row pending, so the server is told', () => {
    const source = setup();
    seedSettings(source.repos);
    const account = seedAccount(source.repos, 'Conto corrente');
    const tx = seedTransaction(source.repos, account.id, '2026-09-05');
    const backup = backupOf(source.repos);

    const target = setup();
    // A row that is already here and already synced must still come out pending afterwards.
    seedSettings(target.repos);
    target.db.update(transactions).set({ syncState: SYNCED }).run();
    applyRestore({
      db: target.db,
      clock: createClock(createKvStore(target.db)),
      backup,
      now: NOW,
    });
    const [row] = target.db.select().from(transactions).where(eq(transactions.id, tx.id)).all();
    expect(row?.syncState).toBe(PENDING);
  });

  it('revives a row that had been deleted here', () => {
    const source = setup();
    seedSettings(source.repos);
    const account = seedAccount(source.repos, 'Conto corrente');
    const backup = backupOf(source.repos);

    const target = setup();
    seedSettings(target.repos);
    // Same id, deleted on this device: the backup says it is alive, and the backup wins.
    target.repos.accounts.create({ ...account, id: account.id });
    target.repos.accounts.remove(account.id);
    expect(target.repos.accounts.list()).toEqual([]);

    applyRestore({
      db: target.db,
      clock: createClock(createKvStore(target.db)),
      backup,
      now: NOW,
    });
    expect(target.repos.accounts.list().map((row) => row.id)).toEqual([account.id]);
  });

  it('gives every restored row an HLC later than what was there', () => {
    const source = setup();
    seedSettings(source.repos);
    const account = seedAccount(source.repos, 'Conto corrente');
    const backup = backupOf(source.repos);

    const target = setup();
    seedSettings(target.repos);
    applyRestore({
      db: target.db,
      clock: createClock(createKvStore(target.db)),
      backup,
      now: NOW,
    });
    const [row] = target.db.select().from(accounts).where(eq(accounts.id, account.id)).all();
    expect(row?.updatedAt).not.toBe(account.updatedAt);
    expect(row?.updatedAt.localeCompare(account.updatedAt)).toBeGreaterThan(0);
  });
});
