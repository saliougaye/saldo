import {
  type Account,
  type CurrencyCode,
  compareHlc,
  SETTINGS_ID,
  type Settings,
  type Transaction,
} from '@saldo/core';
import { eq } from 'drizzle-orm';
import { settings, transactions } from '../schema';
import { createTestDatabase } from '../testing';
import { createRepositories } from './index';
import { PENDING } from './support';

const CREATED_AT = '2026-04-18T10:00:00.000Z';

function setup() {
  const db = createTestDatabase();
  return { db, repos: createRepositories(db, () => CREATED_AT) };
}

const SETTINGS_INPUT = {
  periodKind: 'cycle',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'system',
  theme: 'dark',
  onboardingCompletedAt: null,
} satisfies Omit<Settings, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

const ACCOUNT_INPUT = {
  name: 'Conto corrente',
  type: 'checking',
  institution: null,
  openingBalance: 500000,
  includeInSpendable: true,
  colorIndex: 0,
  icon: 'landmark',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
} satisfies Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

describe('settings repository', () => {
  it('creates the singleton with the fixed id and marks it pending', () => {
    const { db, repos } = setup();
    const created = repos.settings.create(SETTINGS_INPUT);
    expect(created.id).toBe(SETTINGS_ID);
    expect(created.createdAt).toBe(CREATED_AT);
    const [row] = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).all();
    expect(row?.syncState).toBe(PENDING);
  });

  it('reads back what it wrote, without the device-only sync state', () => {
    const { repos } = setup();
    repos.settings.create(SETTINGS_INPUT);
    const loaded = repos.settings.get();
    expect(loaded).not.toBeNull();
    expect(loaded && 'syncState' in loaded).toBe(false);
    expect(loaded?.cycleStartDay).toBe(27);
  });

  it('moves the HLC forward on every update but keeps createdAt', () => {
    const { repos } = setup();
    const created = repos.settings.create(SETTINGS_INPUT);
    const updated = repos.settings.update({ cycleStartDay: 1 });
    expect(updated.cycleStartDay).toBe(1);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(compareHlc(updated.updatedAt, created.updatedAt)).toBe(1);
  });

  it('refuses to update before onboarding created the row', () => {
    const { repos } = setup();
    expect(() => repos.settings.update({ cycleStartDay: 1 })).toThrow(/does not exist/);
  });

  it('rejects values the core schema forbids', () => {
    const { repos } = setup();
    expect(() => repos.settings.create({ ...SETTINGS_INPUT, cycleStartDay: 32 })).toThrow();
    // Cast deliberately: the point is that an unknown code coming from a restored backup or a
    // newer peer is rejected at runtime, not just at compile time.
    expect(() =>
      repos.settings.create({ ...SETTINGS_INPUT, currency: 'XYZ' as CurrencyCode }),
    ).toThrow();
  });
});

describe('accounts repository', () => {
  it('generates a UUIDv7 id when none is given', () => {
    const { repos } = setup();
    const account = repos.accounts.create(ACCOUNT_INPUT);
    expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it('lists live accounts in sort order and hides tombstones', () => {
    const { repos } = setup();
    repos.accounts.create({ ...ACCOUNT_INPUT, id: 'b', name: 'B', sortOrder: 1 });
    repos.accounts.create({ ...ACCOUNT_INPUT, id: 'a', name: 'A', sortOrder: 0 });
    const gone = repos.accounts.create({ ...ACCOUNT_INPUT, id: 'c', name: 'C', sortOrder: 2 });
    repos.accounts.remove(gone.id);
    expect(repos.accounts.list().map((account) => account.id)).toEqual(['a', 'b']);
  });

  it('keeps a tombstoned row readable so sync can push it', () => {
    const { repos } = setup();
    const account = repos.accounts.create({ ...ACCOUNT_INPUT, id: 'x' });
    repos.accounts.remove(account.id);
    expect(repos.accounts.byId('x')?.deletedAt).toBe(CREATED_AT);
  });

  it('validates patches through the core schema', () => {
    const { repos } = setup();
    repos.accounts.create({ ...ACCOUNT_INPUT, id: 'x' });
    expect(() => repos.accounts.update('x', { colorIndex: 99 })).toThrow();
    expect(() => repos.accounts.update('missing', { name: 'Nope' })).toThrow(/No account/);
  });
});

describe('transactions repository', () => {
  const expense = {
    kind: 'expense',
    amount: 4500,
    date: '2026-04-18',
    accountId: 'acc-1',
    toAccountId: null,
    categoryId: 'cat-1',
    description: 'Benzina',
    note: null,
    tagIds: ['tag-a'],
    excludeFromTotals: false,
    recurrenceId: null,
  } satisfies Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

  it('stores json arrays and booleans round-trip', () => {
    const { repos } = setup();
    const created = repos.transactions.create(expense);
    expect(repos.transactions.byId(created.id)?.tagIds).toEqual(['tag-a']);
    expect(repos.transactions.byId(created.id)?.excludeFromTotals).toBe(false);
  });

  it('loads only the requested date range', () => {
    const { repos } = setup();
    repos.transactions.create({ ...expense, id: 'in', date: '2026-04-18' });
    repos.transactions.create({ ...expense, id: 'before', date: '2026-03-26' });
    repos.transactions.create({ ...expense, id: 'after', date: '2026-04-27' });
    const rows = repos.transactions.inRange('2026-03-27', '2026-04-26');
    expect(rows.map((row) => row.id)).toEqual(['in']);
  });

  it('puts the last transaction entered on top of its day', () => {
    // The date alone cannot order a day: everything typed today shares it. What tells two of them
    // apart is when they were entered, and the one just saved is the one being looked for.
    const db = createTestDatabase();
    let now = '2026-04-18T08:00:00.000Z';
    const repos = createRepositories(db, () => now);
    repos.transactions.create({ ...expense, id: 'morning', date: '2026-04-18' });
    now = '2026-04-18T19:30:00.000Z';
    repos.transactions.create({ ...expense, id: 'evening', date: '2026-04-18' });
    now = '2026-04-18T20:00:00.000Z';
    repos.transactions.create({ ...expense, id: 'yesterday', date: '2026-04-17' });
    expect(repos.transactions.inRange('2026-04-01', '2026-04-30').map((row) => row.id)).toEqual([
      'evening',
      'morning',
      'yesterday',
    ]);
    expect(repos.transactions.list().map((row) => row.id)).toEqual([
      'evening',
      'morning',
      'yesterday',
    ]);
  });

  it('undoes a delete by clearing the tombstone', () => {
    const { repos } = setup();
    const created = repos.transactions.create({ ...expense, id: 'undo-me' });
    repos.transactions.remove(created.id);
    expect(repos.transactions.inRange('2026-04-01', '2026-04-30')).toHaveLength(0);
    repos.transactions.restore(created.id);
    expect(repos.transactions.inRange('2026-04-01', '2026-04-30')).toHaveLength(1);
  });

  it('marks every write pending so the scheduler picks it up', () => {
    const { db, repos } = setup();
    const created = repos.transactions.create({ ...expense, id: 'p' });
    db.update(transactions).set({ syncState: 0 }).where(eq(transactions.id, created.id)).run();
    repos.transactions.update(created.id, { amount: 5000 });
    const [row] = db.select().from(transactions).where(eq(transactions.id, 'p')).all();
    expect(row?.syncState).toBe(PENDING);
  });

  it('enforces the transfer invariant of the core schema', () => {
    const { repos } = setup();
    expect(() =>
      repos.transactions.create({ ...expense, kind: 'transfer', toAccountId: 'acc-1' }),
    ).toThrow();
  });
});
