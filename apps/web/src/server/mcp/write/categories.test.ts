import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../test/harness';
import { createTestSession } from '../../test/session';
import { readUserData } from '../../userData/read';
import { bumpRow, seedOnboarded, stampOf } from '../../write/fixtures';
import { categoryHandlers } from './categories';
import { fixtureClock, messageOf, run, valueFrom } from './testKit';
import { transactionHandlers } from './transactions';

let harness: TestDatabase;
let userId: string;
const { saveCategory, archiveCategory } = categoryHandlers(fixtureClock);
const { saveTransaction } = transactionHandlers(fixtureClock);
const GROCERIES = 'seed-category-groceries';

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

async function onboarded() {
  userId = (await createTestSession(harness.db)).userId;
  await seedOnboarded(harness.db, userId);
}

const data = () => readUserData(harness.db, userId);

describe('save_category', () => {
  it('creates a category with its own budget, keeps it on a rename, removes it with null', async () => {
    await onboarded();
    const created = valueFrom(
      await run(saveCategory, userId, { name: 'Casa', monthlyBudgetMinor: 30000 }),
    );
    expect((await data()).budgets).toEqual([
      expect.objectContaining({ categoryIds: [created.id], amount: 30000, period: 'period' }),
    ]);

    const renamed = valueFrom(
      await run(saveCategory, userId, {
        id: created.id,
        updatedAt: created.updatedAt,
        name: 'Casa e affitto',
      }),
    );
    const after = await data();
    expect(after.categories.find((row) => row.id === created.id)).toMatchObject({
      name: 'Casa e affitto',
    });
    expect(after.budgets).toEqual([expect.objectContaining({ amount: 30000 })]);

    valueFrom(
      await run(saveCategory, userId, {
        id: created.id,
        updatedAt: renamed.updatedAt,
        monthlyBudgetMinor: null,
      }),
    );
    expect((await data()).budgets).toEqual([]);
  });

  it('refuses a parent that is a subcategory, and a change of direction', async () => {
    await onboarded();
    const child = valueFrom(
      await run(saveCategory, userId, { name: 'Frutta', parentId: GROCERIES }),
    );
    expect(
      messageOf(await run(saveCategory, userId, { name: 'Mele', parentId: child.id })),
    ).toMatch(/top-level/);
    const read = await stampOf(harness.db, userId, 'category', GROCERIES);
    expect(
      messageOf(
        await run(saveCategory, userId, { id: GROCERIES, updatedAt: read, direction: 'income' }),
      ),
    ).toMatch(/never changes/);
  });
});

describe('archive_category', () => {
  it('archives with a move of its transactions, then restores', async () => {
    await onboarded();
    const tx = valueFrom(
      await run(saveTransaction, userId, {
        kind: 'expense',
        amountMinor: 1500,
        accountId: 'acc-main',
        categoryId: GROCERIES,
      }),
    );
    const target = valueFrom(await run(saveCategory, userId, { name: 'Supermercato' }));
    const read = await stampOf(harness.db, userId, 'category', GROCERIES);
    const archived = valueFrom(
      await run(archiveCategory, userId, {
        id: GROCERIES,
        updatedAt: read,
        action: 'archive',
        moveToId: target.id,
      }),
    );
    expect(archived.archived).toBe(true);
    expect((await data()).transactions.find((row) => row.id === tx.id)).toMatchObject({
      categoryId: target.id,
    });
    const restored = valueFrom(
      await run(archiveCategory, userId, {
        id: GROCERIES,
        updatedAt: archived.updatedAt,
        action: 'restore',
      }),
    );
    expect(restored.archived).toBe(false);
  });

  it('refuses a stale version and a move on restore', async () => {
    await onboarded();
    const read = await stampOf(harness.db, userId, 'category', GROCERIES);
    await bumpRow(harness.db, userId, 'category', GROCERIES, { name: 'Alimentari' });
    expect(
      messageOf(
        await run(archiveCategory, userId, { id: GROCERIES, updatedAt: read, action: 'archive' }),
      ),
    ).toMatch(/changed after you read it/);
    expect(
      messageOf(
        await run(archiveCategory, userId, {
          id: GROCERIES,
          updatedAt: read,
          action: 'restore',
          moveToId: 'x',
        }),
      ),
    ).toMatch(/moveToId/);
  });
});
