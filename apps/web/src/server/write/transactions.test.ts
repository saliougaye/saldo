import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { FIXTURE_NOW, seedOnboarded } from './fixtures';
import { createTag, deleteTransaction, restoreTransaction, saveTransaction } from './transactions';

let harness: TestDatabase;
let userId: string;

const expense = {
  id: null,
  kind: 'expense',
  buffer: '48.2',
  date: '2026-09-28',
  accountId: 'acc-main',
  toAccountId: null,
  categoryId: 'seed-category-groceries',
  description: ' Esselunga ',
  tagIds: [],
  excludeFromTotals: false,
};

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

describe('saveTransaction', () => {
  it('creates an expense in minor units, trimmed, with no recurrence', async () => {
    await onboarded();
    const result = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    expect(result.ok).toBe(true);
    const [row] = (await readUserData(harness.db, userId)).transactions;
    expect(row).toMatchObject({
      amount: 4820,
      description: 'Esselunga',
      recurrenceId: null,
      note: null,
    });
    if (result.ok) expect(row?.id).toBe(result.id);
  });

  it('names the first thing missing, as the phone does', async () => {
    await onboarded();
    expect(
      await saveTransaction(harness.db, userId, { ...expense, buffer: '' }, FIXTURE_NOW),
    ).toEqual({
      ok: false,
      missing: 'amount',
    });
    expect(
      await saveTransaction(harness.db, userId, { ...expense, categoryId: null }, FIXTURE_NOW),
    ).toEqual({ ok: false, missing: 'category' });
  });

  it('refuses a transfer that would overdraw its source', async () => {
    await onboarded();
    const transfer = {
      ...expense,
      kind: 'transfer',
      buffer: '5000',
      categoryId: null,
      toAccountId: 'acc-savings',
    };
    expect(await saveTransaction(harness.db, userId, transfer, FIXTURE_NOW)).toEqual({
      ok: false,
      missing: 'insufficientFunds',
    });
    expect(
      (await saveTransaction(harness.db, userId, { ...transfer, buffer: '500' }, FIXTURE_NOW)).ok,
    ).toBe(true);
  });

  it('refuses an account or a category the user does not have', async () => {
    await onboarded();
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, accountId: 'someone-else' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, missing: 'account' });
    expect(
      await saveTransaction(harness.db, userId, { ...expense, categoryId: 'nope' }, FIXTURE_NOW),
    ).toEqual({ ok: false, missing: 'category' });
  });

  it('edits in place and keeps what the form does not show', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    const before = (await readUserData(harness.db, userId)).transactions[0];
    const edited = await saveTransaction(
      harness.db,
      userId,
      { ...expense, id: created.id, buffer: '50' },
      FIXTURE_NOW,
    );
    expect(edited).toEqual({ ok: true, id: created.id });
    const [after] = (await readUserData(harness.db, userId)).transactions;
    expect(after).toMatchObject({ amount: 5000, createdAt: before?.createdAt, note: before?.note });
  });

  it('answers notFound for an id that is not the user’s', async () => {
    await onboarded();
    expect(
      await saveTransaction(harness.db, userId, { ...expense, id: 'ghost' }, FIXTURE_NOW),
    ).toEqual({
      ok: false,
      error: 'notFound',
    });
  });

  it('refuses input that is not a form at all', async () => {
    await onboarded();
    expect(await saveTransaction(harness.db, userId, { kind: 'loan' }, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });
});

describe('deleteTransaction and restoreTransaction', () => {
  it('tombstones, then brings back the same row', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    expect(await deleteTransaction(harness.db, userId, created.id, FIXTURE_NOW)).toEqual({
      ok: true,
    });
    expect((await readUserData(harness.db, userId)).transactions).toEqual([]);
    expect(await restoreTransaction(harness.db, userId, created.id, FIXTURE_NOW)).toEqual({
      ok: true,
    });
    expect((await readUserData(harness.db, userId)).transactions[0]).toMatchObject({
      id: created.id,
      amount: 4820,
    });
  });

  it('answers notFound for an id that is not there', async () => {
    await onboarded();
    expect(await deleteTransaction(harness.db, userId, 'ghost', FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
    expect(await restoreTransaction(harness.db, userId, 'ghost', FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});

describe('createTag', () => {
  it('creates a tag, and returns the existing one for the same name', async () => {
    await onboarded();
    const first = await createTag(harness.db, userId, ' Casa ', FIXTURE_NOW);
    const second = await createTag(harness.db, userId, 'casa', FIXTURE_NOW);
    expect(first).toMatchObject({ ok: true, tag: { name: 'Casa' } });
    expect(second).toEqual(first);
    expect((await readUserData(harness.db, userId)).tags).toHaveLength(1);
  });

  it('refuses an empty name', async () => {
    await onboarded();
    expect(await createTag(harness.db, userId, '  ', FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });
});
