import { MAX_COLOR_INDEX } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { archiveAccount, saveAccount } from './accounts';
import { bumpRow, FIXTURE_NOW, seedOnboarded, stampOf } from './fixtures';
import { closeGoal, restoreGoal, saveGoal } from './goals';
import { saveTransaction } from './transactions';
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
const accounts = async () => (await readUserData(harness.db, userId)).accounts;

const cardInput = {
  id: null,
  name: 'Carta',
  institution: '',
  type: 'credit_card',
  buffer: '0',
  includeInSpendable: true,
  colorIndex: 1,
  icon: 'card',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
};

const input = {
  id: null,
  name: ' Vacanza ',
  icon: 'target',
  colorIndex: 5,
  buffer: '1000',
  deadline: '2027-06-01',
  parentAccountId: 'acc-main',
  savedBuffer: '',
};

describe('saveGoal — new', () => {
  it('creates an empty pocket in its parent', async () => {
    await onboarded();
    const result = await saveGoal(harness.db, userId, input, FIXTURE_NOW);
    expect(result.ok).toBe(true);
    const pocket = (await accounts()).find((a) => a.type === 'pocket');
    expect(pocket).toMatchObject({
      name: 'Vacanza',
      parentAccountId: 'acc-main',
      goalTarget: 100000,
      goalDeadline: '2027-06-01',
      goalStartDate: '2026-09-29',
      openingBalance: 0,
      includeInSpendable: false,
    });
  });

  it('moves «Già da parte» by a transfer in the same write', async () => {
    await onboarded();
    const result = await saveGoal(
      harness.db,
      userId,
      { ...input, savedBuffer: '250' },
      FIXTURE_NOW,
    );
    if (!result.ok) throw new Error('not created');
    const data = await readUserData(harness.db, userId);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({
      kind: 'transfer',
      amount: 25000,
      accountId: 'acc-main',
      toAccountId: result.id,
    });
  });

  it('names the earliest gap', async () => {
    await onboarded();
    expect(await saveGoal(harness.db, userId, { ...input, name: ' ' }, FIXTURE_NOW)).toEqual({
      ok: false,
      missing: 'name',
    });
    expect(await saveGoal(harness.db, userId, { ...input, buffer: '' }, FIXTURE_NOW)).toEqual({
      ok: false,
      missing: 'target',
    });
    expect(
      await saveGoal(harness.db, userId, { ...input, deadline: '2026-01-01' }, FIXTURE_NOW),
    ).toEqual({
      ok: false,
      missing: 'deadline',
    });
    expect(
      await saveGoal(harness.db, userId, { ...input, parentAccountId: null }, FIXTURE_NOW),
    ).toEqual({
      ok: false,
      missing: 'parent',
    });
  });

  it('refuses a parent that cannot hold a goal', async () => {
    await onboarded();
    // acc-savings is a savings account (allowed); a card and an unknown id are not.
    const card = await saveAccount(harness.db, userId, { ...cardInput }, FIXTURE_NOW);
    if (!card.ok) throw new Error('card not created');
    for (const parentAccountId of [card.id, 'nope']) {
      expect(
        await saveGoal(harness.db, userId, { ...input, parentAccountId }, FIXTURE_NOW),
      ).toEqual({
        ok: false,
        error: 'invalid',
      });
    }
  });
});

describe('saveGoal — colour', () => {
  it('refuses a colour beyond the palette before writing', async () => {
    await onboarded();
    const result = await saveGoal(
      harness.db,
      userId,
      { ...input, colorIndex: MAX_COLOR_INDEX + 1 },
      FIXTURE_NOW,
    );
    expect(result).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('saveGoal — edit', () => {
  it('changes name, look, target and deadline, and never the parent', async () => {
    await onboarded();
    const created = await saveGoal(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    const edited = await saveGoal(
      harness.db,
      userId,
      {
        ...input,
        id: created.id,
        name: 'Viaggio',
        buffer: '2000',
        deadline: null,
        parentAccountId: 'acc-savings',
      },
      FIXTURE_NOW,
    );
    expect(edited).toEqual({ ok: true, id: created.id });
    expect((await accounts()).find((a) => a.id === created.id)).toMatchObject({
      name: 'Viaggio',
      goalTarget: 200000,
      goalDeadline: null,
      parentAccountId: 'acc-main',
    });
  });

  it('lets an expired goal be renamed without a new deadline', async () => {
    await onboarded();
    const created = await saveGoal(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    // The deadline passes: today is now a year later.
    const later = new Date('2027-09-01T10:00:00.000Z');
    expect(
      await saveGoal(harness.db, userId, { ...input, id: created.id, name: 'Vacanza 2' }, later),
    ).toEqual({
      ok: true,
      id: created.id,
    });
  });
});

describe('closeGoal', () => {
  async function fundedGoal() {
    await onboarded();
    const created = await saveGoal(
      harness.db,
      userId,
      { ...input, savedBuffer: '250' },
      FIXTURE_NOW,
    );
    if (!created.ok) throw new Error('not created');
    return created.id;
  }

  it('returns the money to the parent and archives the pocket', async () => {
    const id = await fundedGoal();
    expect(await closeGoal(harness.db, userId, id, FIXTURE_NOW)).toEqual({ ok: true });
    const data = await readUserData(harness.db, userId);
    expect(data.accounts.find((a) => a.id === id)?.archivedAt).toBe(FIXTURE_NOW.toISOString());
    const back = data.transactions.find((t) => t.accountId === id);
    expect(back).toMatchObject({ kind: 'transfer', amount: 25000, toAccountId: 'acc-main' });
  });

  it('drops a future contribution instead of draining the parent later', async () => {
    const id = await fundedGoal();
    const future = await saveTransaction(
      harness.db,
      userId,
      {
        id: null,
        kind: 'transfer',
        buffer: '10',
        date: '2026-10-15',
        accountId: 'acc-main',
        toAccountId: id,
        categoryId: null,
        description: '',
        tagIds: [],
        excludeFromTotals: false,
      },
      FIXTURE_NOW,
    );
    expect(future.ok).toBe(true);
    await closeGoal(harness.db, userId, id, FIXTURE_NOW);
    const data = await readUserData(harness.db, userId);
    expect(data.transactions.some((t) => t.date === '2026-10-15')).toBe(false);
  });

  it('closes an empty goal without a settlement', async () => {
    await onboarded();
    const created = await saveGoal(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    expect(await closeGoal(harness.db, userId, created.id, FIXTURE_NOW)).toEqual({ ok: true });
    expect((await readUserData(harness.db, userId)).transactions).toHaveLength(0);
  });

  it('answers notFound for a closed goal or an ordinary account', async () => {
    await onboarded();
    expect(await closeGoal(harness.db, userId, 'acc-main', FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});

describe('restoreGoal', () => {
  it('reopens a closed goal empty, from today', async () => {
    await onboarded();
    const created = await saveGoal(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await closeGoal(harness.db, userId, created.id, FIXTURE_NOW);
    expect(await restoreGoal(harness.db, userId, created.id, FIXTURE_NOW)).toEqual({ ok: true });
    expect((await accounts()).find((a) => a.id === created.id)).toMatchObject({
      archivedAt: null,
      goalStartDate: '2026-09-29',
    });
  });

  it('stays closed while its account is archived', async () => {
    await onboarded();
    const created = await saveGoal(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    await closeGoal(harness.db, userId, created.id, FIXTURE_NOW);
    await archiveAccount(harness.db, userId, 'acc-main', FIXTURE_NOW);
    expect(await restoreGoal(harness.db, userId, created.id, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'parentArchived',
    });
  });
});

describe('closeGoal — parity with the phone’s closeGoalIn', () => {
  // saveTransaction refuses an expense on a pocket until «Registra la spesa» (Task 6), so the
  // expense the phone's scenario books is written straight to the store.
  async function bookExpense(accountId: string, amount: number) {
    await writeChanges(
      harness.db,
      userId,
      [
        {
          entity: 'transaction',
          id: 'expense-on-pocket',
          data: {
            kind: 'expense',
            amount,
            date: '2026-09-28',
            accountId,
            toAccountId: null,
            categoryId: 'seed-category-groceries',
            description: '',
            note: null,
            tagIds: [],
            excludeFromTotals: false,
            recurrenceId: null,
            createdAt: FIXTURE_NOW.toISOString(),
            deletedAt: null,
          },
        },
      ],
      FIXTURE_NOW,
    );
  }

  it('returns what is left after an expense: 250.00 aside, 30.00 spent, 220.00 back', async () => {
    await onboarded();
    const created = await saveGoal(
      harness.db,
      userId,
      { ...input, savedBuffer: '250' },
      FIXTURE_NOW,
    );
    if (!created.ok) throw new Error('not created');
    await bookExpense(created.id, 3000);
    await closeGoal(harness.db, userId, created.id, FIXTURE_NOW);
    const data = await readUserData(harness.db, userId);
    const settlement = data.transactions.find(
      (t) => t.kind === 'transfer' && t.accountId === created.id,
    );
    expect(settlement).toMatchObject({ amount: 22000, toAccountId: 'acc-main' });
  });

  it('tops up a pocket that spent more than it held, from the parent', async () => {
    await onboarded();
    const created = await saveGoal(
      harness.db,
      userId,
      { ...input, savedBuffer: '500' },
      FIXTURE_NOW,
    );
    if (!created.ok) throw new Error('not created');
    await bookExpense(created.id, 60000);
    await closeGoal(harness.db, userId, created.id, FIXTURE_NOW);
    const data = await readUserData(harness.db, userId);
    expect(
      data.transactions.find((t) => t.toAccountId === created.id && t.amount === 10000),
    ).toMatchObject({ kind: 'transfer', accountId: 'acc-main' });
  });
});

describe('goals — expectedUpdatedAt (§17.4.2)', () => {
  it('edits and closes only the version read', async () => {
    await onboarded();
    const created = await saveGoal(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    const read = await stampOf(harness.db, userId, 'account', created.id);
    const phone = await bumpRow(harness.db, userId, 'account', created.id, { name: 'Viaggio' });

    expect(
      await saveGoal(
        harness.db,
        userId,
        { ...input, id: created.id, buffer: '2000', expectedUpdatedAt: read },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'conflict' });
    expect(await closeGoal(harness.db, userId, created.id, FIXTURE_NOW, read)).toEqual({
      ok: false,
      error: 'conflict',
    });
    expect(await closeGoal(harness.db, userId, created.id, FIXTURE_NOW, phone)).toEqual({
      ok: true,
    });
  });
});
