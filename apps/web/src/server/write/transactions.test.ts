import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { FIXTURE_NOW, seedOnboarded } from './fixtures';
import { createTag, deleteTransaction, restoreTransaction, saveTransaction } from './transactions';
import { writeChanges } from './writeChanges';

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

type Collection = 'accounts' | 'categories' | 'transactions';
const ENTITY = {
  accounts: 'account',
  categories: 'category',
  transactions: 'transaction',
} as const;

/** Changes a stored row as another device would: straight through the write path, no form rules. */
async function rewrite(collection: Collection, id: string, patch: Record<string, unknown>) {
  const rows: readonly { id: string; updatedAt: string }[] = (
    await readUserData(harness.db, userId)
  )[collection];
  const found = rows.find((row) => row.id === id);
  if (found === undefined) throw new Error(`no ${collection}/${id}`);
  const { updatedAt: _stamp, ...row } = found;
  await writeChanges(
    harness.db,
    userId,
    [{ entity: ENTITY[collection], id, data: { ...row, deletedAt: null, ...patch } }],
    FIXTURE_NOW,
  );
}

const ARCHIVED_AT = { archivedAt: FIXTURE_NOW.toISOString() };

/** The phone's «Chiudi obiettivo» expense (§5.14): the only non-transfer that sits on a pocket. */
async function closeGoalExpense(): Promise<string> {
  const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
  if (!created.ok) throw new Error('not created');
  await rewrite('transactions', created.id, { accountId: 'acc-goal' });
  return created.id;
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

  it('refuses a date that is not a real LocalDate', async () => {
    await onboarded();
    expect(
      await saveTransaction(harness.db, userId, { ...expense, date: '2026-02-30' }, FIXTURE_NOW),
    ).toEqual({ ok: false, error: 'invalid' });
    expect(
      await saveTransaction(harness.db, userId, { ...expense, date: 'yesterday' }, FIXTURE_NOW),
    ).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuses a buffer that is not a real amount, as opposed to an empty one', async () => {
    await onboarded();
    // Only what the keypad can type: at most the currency's decimals, 6 integer digits for a
    // 2-decimal currency, no leading zeros, no bare separator in front.
    for (const buffer of ['abc', '1e30', '12.345', '007', '1234567', '.5', '9999999999999']) {
      expect(
        await saveTransaction(harness.db, userId, { ...expense, buffer }, FIXTURE_NOW),
      ).toEqual({ ok: false, error: 'invalid' });
    }
    // Empty is a legitimate "missing amount", not malformed input.
    expect(
      await saveTransaction(harness.db, userId, { ...expense, buffer: '' }, FIXTURE_NOW),
    ).toEqual({ ok: false, missing: 'amount' });
  });

  it('refuses a category whose direction does not match the transaction', async () => {
    await onboarded();
    await writeChanges(
      harness.db,
      userId,
      [
        {
          entity: 'category',
          id: 'seed-category-salary',
          data: {
            id: 'seed-category-salary',
            name: 'Salary',
            direction: 'income',
            parentId: null,
            icon: 'landmark',
            colorIndex: 5,
            archivedAt: null,
            sortOrder: 99,
            createdAt: FIXTURE_NOW.toISOString(),
            deletedAt: null,
          },
        },
      ],
      FIXTURE_NOW,
    );
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, kind: 'expense', categoryId: 'seed-category-salary' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, missing: 'category' });
  });
});

/** A pocket account (§5.14) other tests archive to simulate a closed goal. */
function pocketAccount(archived: boolean) {
  return {
    entity: 'account' as const,
    id: 'acc-goal',
    data: {
      id: 'acc-goal',
      name: 'Sofa',
      type: 'pocket' as const,
      institution: null,
      openingBalance: 0,
      includeInSpendable: false,
      colorIndex: 0,
      icon: 'piggy-bank',
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: archived ? FIXTURE_NOW.toISOString() : null,
      sortOrder: 2,
      parentAccountId: 'acc-main',
      goalTarget: 10000,
      goalDeadline: null,
      goalStartDate: '2026-01-01',
      createdAt: FIXTURE_NOW.toISOString(),
      deletedAt: null,
    },
  };
}

describe('closed goals (§5.14) are read-only', () => {
  it('refuses to edit or delete a transaction that touches a closed goal', async () => {
    await onboarded();
    await writeChanges(harness.db, userId, [pocketAccount(false)], FIXTURE_NOW);
    const id = await closeGoalExpense();
    await writeChanges(harness.db, userId, [pocketAccount(true)], FIXTURE_NOW);
    expect(await saveTransaction(harness.db, userId, { ...expense, id }, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'closedGoal',
    });
    expect(await deleteTransaction(harness.db, userId, id, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'closedGoal',
    });
  });
});

describe('pockets (§5.14): money enters or leaves a goal by transfer only', () => {
  it('refuses an expense or an income on a pocket', async () => {
    await onboarded();
    await writeChanges(harness.db, userId, [pocketAccount(false)], FIXTURE_NOW);
    expect(
      await saveTransaction(harness.db, userId, { ...expense, accountId: 'acc-goal' }, FIXTURE_NOW),
    ).toEqual({ ok: false, missing: 'account' });
  });

  it('refuses moving an existing expense onto a pocket', async () => {
    await onboarded();
    await writeChanges(harness.db, userId, [pocketAccount(false)], FIXTURE_NOW);
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, id: created.id, accountId: 'acc-goal' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, missing: 'account' });
  });

  it('takes a transfer into a pocket', async () => {
    await onboarded();
    await writeChanges(harness.db, userId, [pocketAccount(false)], FIXTURE_NOW);
    const transfer = {
      ...expense,
      kind: 'transfer',
      buffer: '50',
      categoryId: null,
      toAccountId: 'acc-goal',
    };
    expect((await saveTransaction(harness.db, userId, transfer, FIXTURE_NOW)).ok).toBe(true);
  });

  it('still edits the phone’s close-goal expense, which sits on the pocket', async () => {
    await onboarded();
    await writeChanges(harness.db, userId, [pocketAccount(false)], FIXTURE_NOW);
    const id = await closeGoalExpense();
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, id, accountId: 'acc-goal', description: 'Divano' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true, id });
  });
});

describe('editing a row whose account or category was archived since (§5.4)', () => {
  it('keeps the archived account the row already uses', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await rewrite('accounts', 'acc-main', ARCHIVED_AT);
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, id: created.id, buffer: '50' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true, id: created.id });
  });

  it('keeps the archived category the row already uses', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await rewrite('categories', 'seed-category-groceries', ARCHIVED_AT);
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, id: created.id, buffer: '50' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true, id: created.id });
  });

  it('keeps the archived destination the transfer already uses', async () => {
    await onboarded();
    const transfer = {
      ...expense,
      kind: 'transfer',
      buffer: '50',
      categoryId: null,
      toAccountId: 'acc-savings',
    };
    const created = await saveTransaction(harness.db, userId, transfer, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await rewrite('accounts', 'acc-savings', ARCHIVED_AT);
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...transfer, id: created.id, buffer: '60' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true, id: created.id });
  });

  it('refuses an archived account or category the row did not use', async () => {
    await onboarded();
    await rewrite('accounts', 'acc-savings', ARCHIVED_AT);
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, id: created.id, accountId: 'acc-savings' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, missing: 'account' });
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, accountId: 'acc-savings' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, missing: 'account' });
  });
});

describe('amounts the keypad cannot type', () => {
  it('still edits a stored amount larger than the keypad types, left as it was', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await rewrite('transactions', created.id, { amount: 123456789 });
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, id: created.id, buffer: '1234567.89', description: 'Casa' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true, id: created.id });
    expect(
      await saveTransaction(
        harness.db,
        userId,
        { ...expense, id: created.id, buffer: '1234568' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('rows that belong to someone else', () => {
  it('answers notFound for a real transaction id that is not the caller’s', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    const other = (await createTestSession(harness.db, 'Bea')).userId;
    await seedOnboarded(harness.db, other);
    expect(
      await saveTransaction(harness.db, other, { ...expense, id: created.id }, FIXTURE_NOW),
    ).toEqual({ ok: false, error: 'notFound' });
    expect(await deleteTransaction(harness.db, other, created.id, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
    expect(await restoreTransaction(harness.db, other, created.id, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
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

  it('refuses to restore a tombstone older than the undo window', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await deleteTransaction(harness.db, userId, created.id, FIXTURE_NOW);
    const later = new Date(FIXTURE_NOW.getTime() + 11 * 60 * 1000);
    expect(await restoreTransaction(harness.db, userId, created.id, later)).toEqual({
      ok: false,
      error: 'notFound',
    });
  });

  it('refuses to restore a tombstone that now touches a closed goal', async () => {
    await onboarded();
    await writeChanges(harness.db, userId, [pocketAccount(false)], FIXTURE_NOW);
    const id = await closeGoalExpense();
    await deleteTransaction(harness.db, userId, id, FIXTURE_NOW);
    await writeChanges(harness.db, userId, [pocketAccount(true)], FIXTURE_NOW);
    expect(await restoreTransaction(harness.db, userId, id, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'closedGoal',
    });
  });

  it('refuses to restore a tombstone whose account is no longer live', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await deleteTransaction(harness.db, userId, created.id, FIXTURE_NOW);
    const data = await readUserData(harness.db, userId);
    const account = data.accounts.find((row) => row.id === 'acc-main');
    if (account === undefined) throw new Error('account missing');
    const { updatedAt: _stamp, ...row } = account;
    await writeChanges(
      harness.db,
      userId,
      [
        {
          entity: 'account',
          id: account.id,
          data: { ...row, archivedAt: FIXTURE_NOW.toISOString() },
        },
      ],
      FIXTURE_NOW,
    );
    expect(await restoreTransaction(harness.db, userId, created.id, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('refuses to restore a tombstone whose category is no longer live', async () => {
    await onboarded();
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await deleteTransaction(harness.db, userId, created.id, FIXTURE_NOW);
    const data = await readUserData(harness.db, userId);
    const category = data.categories.find((row) => row.id === 'seed-category-groceries');
    if (category === undefined) throw new Error('category missing');
    const { updatedAt: _stamp, ...row } = category;
    await writeChanges(
      harness.db,
      userId,
      [
        {
          entity: 'category',
          id: category.id,
          data: { ...row, archivedAt: FIXTURE_NOW.toISOString() },
        },
      ],
      FIXTURE_NOW,
    );
    expect(await restoreTransaction(harness.db, userId, created.id, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'invalid',
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
