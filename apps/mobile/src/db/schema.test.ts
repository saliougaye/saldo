import { eq } from 'drizzle-orm';
import { accounts, kv, settings, tags, transactions } from './schema';
import { createTestDatabase } from './testing';

const meta = {
  createdAt: '2026-04-18T10:00:00.000Z',
  updatedAt: '001775000000000-0000-dev',
  deletedAt: null,
  syncState: 1,
};

describe('schema', () => {
  it('round-trips a transaction, keeping json arrays and booleans typed', () => {
    const db = createTestDatabase();
    db.insert(settings)
      .values({
        ...meta,
        id: 'settings',
        cycleStartDay: 27,
        currency: 'EUR',
        language: 'system',
        theme: 'dark',
        onboardingCompletedAt: null,
      })
      .run();
    db.insert(accounts)
      .values({
        ...meta,
        id: 'acc-1',
        name: 'Carta',
        type: 'credit_card',
        institution: null,
        openingBalance: 0,
        includeInSpendable: false,
        colorIndex: 0,
        icon: 'card',
        creditCloseDay: 20,
        creditChargeDay: 5,
        creditPaymentAccountId: null,
        archivedAt: null,
        sortOrder: 0,
      })
      .run();
    db.insert(transactions)
      .values({
        ...meta,
        id: 'tx-1',
        kind: 'expense',
        amount: 4500,
        date: '2026-04-18',
        accountId: 'acc-1',
        toAccountId: null,
        categoryId: 'cat-1',
        description: 'Benzina',
        note: null,
        tagIds: ['tag-a', 'tag-b'],
        excludeFromTotals: false,
        recurrenceId: null,
      })
      .run();

    const [row] = db.select().from(transactions).where(eq(transactions.id, 'tx-1')).all();
    expect(row?.tagIds).toEqual(['tag-a', 'tag-b']);
    expect(row?.excludeFromTotals).toBe(false);
    expect(row?.amount).toBe(4500);
  });

  it('defaults sync_state to pending', () => {
    const db = createTestDatabase();
    db.insert(tags)
      .values({ id: 't1', createdAt: meta.createdAt, updatedAt: meta.updatedAt, name: 'Vacanza' })
      .run();
    const [row] = db.select().from(tags).all();
    expect(row?.syncState).toBe(1);
  });

  it('keeps kv rows free of sync metadata', () => {
    const db = createTestDatabase();
    db.insert(kv).values({ key: 'deviceId', value: 'abc' }).run();
    const [row] = db.select().from(kv).where(eq(kv.key, 'deviceId')).all();
    expect(row?.value).toBe('abc');
  });
});
