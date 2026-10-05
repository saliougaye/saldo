import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { saveBudget } from './budgets';
import { FIXTURE_NOW, seedOnboarded } from './fixtures';
import { writeChanges } from './writeChanges';

let harness: TestDatabase;
let userId: string;

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

const input = {
  id: null,
  name: 'Spesa',
  categoryIds: ['seed-category-groceries'],
  buffer: '300',
  period: 'period',
  alertThreshold: 90,
  rollover: true,
  icon: 'cart',
};
const budgets = async () => (await readUserData(harness.db, userId)).budgets;

/** Another device's category, written straight through the write path. */
async function addCategory(id: string, patch: Record<string, unknown>) {
  await writeChanges(
    harness.db,
    userId,
    [
      {
        entity: 'category',
        id,
        data: {
          id,
          name: id,
          direction: 'expense',
          parentId: null,
          icon: 'cart',
          colorIndex: 1,
          archivedAt: null,
          sortOrder: 90,
          createdAt: FIXTURE_NOW.toISOString(),
          deletedAt: null,
          ...patch,
        },
      },
    ],
    FIXTURE_NOW,
  );
}

describe('saveBudget', () => {
  it('refuses a category another budget already covers (§5.8)', async () => {
    await onboarded();
    await saveBudget(harness.db, userId, input, FIXTURE_NOW);
    expect(await saveBudget(harness.db, userId, { ...input, name: 'Altro' }, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'taken',
    });
  });

  it('lets a budget keep its own categories when it is edited', async () => {
    await onboarded();
    const created = await saveBudget(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    expect(
      await saveBudget(
        harness.db,
        userId,
        { ...input, id: created.id, buffer: '350' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true, id: created.id });
    expect((await budgets())[0]?.amount).toBe(35000);
  });

  it('lets a budget keep a category archived since, but not take another archived one', async () => {
    await onboarded();
    await addCategory('cat-old', {});
    await addCategory('cat-other', { archivedAt: FIXTURE_NOW.toISOString() });
    const created = await saveBudget(
      harness.db,
      userId,
      { ...input, categoryIds: ['cat-old'] },
      FIXTURE_NOW,
    );
    if (!created.ok) throw new Error('not created');
    await addCategory('cat-old', { archivedAt: FIXTURE_NOW.toISOString() });
    expect(
      await saveBudget(
        harness.db,
        userId,
        { ...input, id: created.id, categoryIds: ['cat-old'], buffer: '350' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true, id: created.id });
    expect((await budgets())[0]?.amount).toBe(35000);
    expect(
      await saveBudget(
        harness.db,
        userId,
        { ...input, id: created.id, categoryIds: ['cat-old', 'cat-other'] },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'invalid' });
  });
});
