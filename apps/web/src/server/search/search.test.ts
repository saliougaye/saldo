import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { syncRows } from '../db/schema';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { searchFor } from './search';

let harness: TestDatabase;
let seq = 0;
let userA = '';
let userB = '';

const HLC = '000000000000001-0000-dev';
const CREATED = '2026-09-10T09:00:00.000Z';
const REQUEST = {
  now: new Date('2026-10-23T10:00:00.000Z'),
  fallbackTimeZone: 'Europe/Rome',
  acceptLanguage: null,
};
const meta = { createdAt: CREATED, updatedAt: HLC, deletedAt: null };

const settings = {
  id: 'settings',
  ...meta,
  periodKind: 'month',
  cycleStartDay: 1,
  currency: 'EUR',
  language: 'en',
  theme: 'system',
  onboardingCompletedAt: CREATED,
  timeZone: 'Europe/Rome',
};

function account(id: string, name: string, archivedAt: string | null = null) {
  return {
    id,
    ...meta,
    name,
    type: 'checking',
    institution: null,
    openingBalance: 10000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'wallet',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt,
    sortOrder: 0,
  };
}

const groceries = {
  id: 'cat-groceries',
  ...meta,
  name: 'Groceries',
  direction: 'expense',
  parentId: null,
  icon: 'cart',
  colorIndex: 1,
  archivedAt: null,
  sortOrder: 0,
};

function expense(id: string, description: string, amount: number, date: string) {
  return {
    id,
    ...meta,
    kind: 'expense',
    amount,
    date,
    accountId: 'acc-main',
    toAccountId: null,
    categoryId: 'cat-groceries',
    description,
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  };
}

async function seed(userId: string, entity: string, row: { id: string }): Promise<void> {
  seq += 1;
  await harness.db
    .insert(syncRows)
    .values({ userId, entity, id: row.id, updatedAt: HLC, deletedAt: null, data: row, seq });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  userA = (await createTestSession(harness.db, 'Ada')).userId;
  userB = (await createTestSession(harness.db, 'Bea')).userId;
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('searchFor', () => {
  it('finds only the rows of the user it searches for', async () => {
    await seed(userA, 'settings', settings);
    await seed(userA, 'account', account('acc-main', 'Coop card'));
    await seed(userB, 'settings', settings);
    await seed(userB, 'account', account('acc-other', 'Coop savings'));

    const result = await searchFor(userA, 'coop', REQUEST);

    const ids = result.groups.flatMap((group) => group.hits.map((hit) => hit.href));
    expect(ids).toEqual(['/accounts?a=acc-main']);
  });

  it('leaves archived accounts out and links a transaction to its period', async () => {
    await seed(userA, 'settings', settings);
    await seed(userA, 'account', account('acc-main', 'Main account'));
    await seed(userA, 'account', account('acc-old', 'Main account old', CREATED));
    await seed(userA, 'category', groceries);
    await seed(userA, 'transaction', expense('tx-now', 'Grocery run', 4210, '2026-10-21'));
    await seed(userA, 'transaction', expense('tx-then', 'Grocery run', 1860, '2026-09-14'));

    const accounts = await searchFor(userA, 'main', REQUEST);
    expect(accounts.groups.map((group) => group.key)).toEqual(['account']);
    expect(accounts.groups[0]?.hits.map((hit) => hit.title)).toEqual(['Main account']);

    const groceriesResult = await searchFor(userA, 'grocery', REQUEST);
    const txs = groceriesResult.groups.find((group) => group.key === 'transaction');
    expect(txs?.hits.map((hit) => hit.href)).toEqual([
      '/transactions?t=tx-now',
      '/transactions?t=tx-then&p=2026-09-01',
    ]);
    expect(groceriesResult.seeAll.href).toBe('/transactions?q=grocery');
  });

  it('finds a transaction by its amount', async () => {
    await seed(userA, 'settings', settings);
    await seed(userA, 'account', account('acc-main', 'Main account'));
    await seed(userA, 'category', groceries);
    await seed(userA, 'transaction', expense('tx-now', 'Grocery run', 4210, '2026-10-21'));

    const result = await searchFor(userA, '42,10', REQUEST);
    const txs = result.groups.find((group) => group.key === 'transaction');
    expect(txs?.hits.map((hit) => hit.title)).toEqual(['Grocery run']);
  });
});
