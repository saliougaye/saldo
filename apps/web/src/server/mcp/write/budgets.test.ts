import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../test/harness';
import { createTestSession } from '../../test/session';
import { readUserData } from '../../userData/read';
import { bumpRow, seedOnboarded } from '../../write/fixtures';
import { budgetHandlers } from './budgets';
import { fixtureClock, messageOf, run, valueFrom } from './testKit';

let harness: TestDatabase;
let userId: string;
const { saveBudget, deleteBudget } = budgetHandlers(fixtureClock);
const GROCERIES = 'seed-category-groceries';
const spesa = { name: 'Spesa', categoryIds: [GROCERIES], amountMinor: 30000 };

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

describe('save_budget', () => {
  it("creates a budget with the form's defaults and its first category's icon", async () => {
    await onboarded();
    const saved = valueFrom(await run(saveBudget, userId, spesa));
    const after = await data();
    const icon = after.categories.find((row) => row.id === GROCERIES)?.icon;
    expect(after.budgets).toEqual([
      expect.objectContaining({
        id: saved.id,
        amount: 30000,
        period: 'period',
        alertThreshold: 90,
        rollover: false,
        icon,
      }),
    ]);
  });

  it('changes the amount only', async () => {
    await onboarded();
    const saved = valueFrom(await run(saveBudget, userId, spesa));
    valueFrom(
      await run(saveBudget, userId, {
        id: saved.id,
        updatedAt: saved.updatedAt,
        amountMinor: 35000,
      }),
    );
    expect((await data()).budgets).toEqual([
      expect.objectContaining({ name: 'Spesa', amount: 35000, categoryIds: [GROCERIES] }),
    ]);
  });

  it('refuses a category already in a budget, and a create without a name', async () => {
    await onboarded();
    valueFrom(await run(saveBudget, userId, spesa));
    expect(messageOf(await run(saveBudget, userId, { ...spesa, name: 'Altro' }))).toMatch(
      /another budget/,
    );
    expect(
      messageOf(await run(saveBudget, userId, { categoryIds: [GROCERIES], amountMinor: 100 })),
    ).toMatch(/pass name/);
  });
});

describe('delete_budget', () => {
  it('deletes the version read only', async () => {
    await onboarded();
    const saved = valueFrom(await run(saveBudget, userId, spesa));
    const phone = await bumpRow(harness.db, userId, 'budget', saved.id, { amount: 40000 });
    expect(
      messageOf(await run(deleteBudget, userId, { id: saved.id, updatedAt: saved.updatedAt })),
    ).toMatch(/changed after you read it/);
    expect(valueFrom(await run(deleteBudget, userId, { id: saved.id, updatedAt: phone }))).toEqual({
      id: saved.id,
    });
    expect((await data()).budgets).toEqual([]);
  });
});
