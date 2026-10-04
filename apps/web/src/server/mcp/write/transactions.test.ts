import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../test/harness';
import { createTestSession } from '../../test/session';
import { readUserData } from '../../userData/read';
import { bumpRow, FIXTURE_NOW, seedOnboarded } from '../../write/fixtures';
import { fixtureClock, messageOf, run, valueOf } from './testKit';
import { transactionHandlers } from './transactions';

let harness: TestDatabase;
let userId: string;
const { saveTransaction, deleteTransaction } = transactionHandlers(fixtureClock);

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

const transactions = async () => (await readUserData(harness.db, userId)).transactions;

const groceries = {
  kind: 'expense',
  amountMinor: 4820,
  accountId: 'acc-main',
  categoryId: 'seed-category-groceries',
  description: 'Esselunga',
};

describe('save_transaction', () => {
  it("creates an expense dated the user's today and answers its version", async () => {
    await onboarded();
    const saved = valueOf(await run(saveTransaction, userId, groceries));
    expect(saved.created).toBe(true);
    expect(await transactions()).toEqual([
      expect.objectContaining({
        id: saved.id,
        amount: 4820,
        date: '2026-09-29',
        description: 'Esselunga',
        updatedAt: saved.updatedAt,
      }),
    ]);
  });

  it('changes only the fields given', async () => {
    await onboarded();
    const created = valueOf(await run(saveTransaction, userId, groceries));
    const edited = valueOf(
      await run(saveTransaction, userId, {
        id: created.id,
        updatedAt: created.updatedAt,
        amountMinor: 5000,
      }),
    );
    expect(edited).toMatchObject({ id: created.id, created: false });
    expect(edited.updatedAt > created.updatedAt).toBe(true);
    expect(await transactions()).toEqual([
      expect.objectContaining({ amount: 5000, description: 'Esselunga', date: '2026-09-29' }),
    ]);
  });

  it('refuses to overwrite an edit the phone made after the read', async () => {
    await onboarded();
    const created = valueOf(await run(saveTransaction, userId, groceries));
    await bumpRow(harness.db, userId, 'transaction', created.id, { description: 'Dal telefono' });
    const message = messageOf(
      await run(saveTransaction, userId, {
        id: created.id,
        updatedAt: created.updatedAt,
        amountMinor: 9900,
      }),
    );
    expect(message).toMatch(/changed after you read it/);
    expect(await transactions()).toEqual([
      expect.objectContaining({ amount: 4820, description: 'Dal telefono' }),
    ]);
  });

  it('names the read tool for an unknown category, and refuses an archived account', async () => {
    await onboarded();
    expect(
      messageOf(await run(saveTransaction, userId, { ...groceries, categoryId: 'nope' })),
    ).toMatch(/list_categories/);
    await bumpRow(harness.db, userId, 'account', 'acc-savings', {
      archivedAt: FIXTURE_NOW.toISOString(),
    });
    expect(
      messageOf(await run(saveTransaction, userId, { ...groceries, accountId: 'acc-savings' })),
    ).toMatch(/list_accounts/);
    expect(await transactions()).toEqual([]);
  });

  it('answers an unknown id, and asks for updatedAt with an id', async () => {
    await onboarded();
    expect(
      messageOf(await run(saveTransaction, userId, { id: 'nope', updatedAt: 'x', amountMinor: 1 })),
    ).toMatch(/no live transaction/);
    const created = valueOf(await run(saveTransaction, userId, groceries));
    expect(messageOf(await run(saveTransaction, userId, { id: created.id, amountMinor: 1 }))).toMatch(
      /updatedAt/,
    );
  });
});

describe('delete_transaction', () => {
  it('deletes the version read and refuses a stale one', async () => {
    await onboarded();
    const created = valueOf(await run(saveTransaction, userId, groceries));
    const phone = await bumpRow(harness.db, userId, 'transaction', created.id, {
      description: 'Dal telefono',
    });
    expect(
      messageOf(
        await run(deleteTransaction, userId, { id: created.id, updatedAt: created.updatedAt }),
      ),
    ).toMatch(/changed after you read it/);
    expect(
      valueOf(await run(deleteTransaction, userId, { id: created.id, updatedAt: phone })),
    ).toEqual({ id: created.id });
    expect(await transactions()).toEqual([]);
  });
});
