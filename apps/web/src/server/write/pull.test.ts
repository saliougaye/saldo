import {
  accountSchema,
  budgetSchema,
  entitySchemas,
  formatHlc,
  parseHlc,
  SYNC_SCHEMA_VERSION,
  type SyncChangeEnvelope,
  transactionSchema,
} from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readPull } from '../sync/pull';
import { applyPush } from '../sync/push';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { saveAccount } from './accounts';
import { saveBudget } from './budgets';
import { FIXTURE_NOW, seedOnboarded } from './fixtures';
import { closeGoal, saveGoal } from './goals';
import { saveTransaction } from './transactions';

let harness: TestDatabase;

const expense = {
  id: null,
  kind: 'expense',
  buffer: '48.2',
  date: '2026-09-28',
  accountId: 'acc-main',
  toAccountId: null,
  categoryId: 'seed-category-groceries',
  description: 'Esselunga',
  tagIds: [],
  excludeFromTotals: false,
};

/** A phone whose clock runs 12h ahead of the server: within the 24h §8.2 allows. */
const PHONE_AHEAD_MS = 12 * 3600 * 1000;

beforeAll(async () => {
  harness = await createTestDatabase();
});
afterEach(async () => {
  await harness.reset();
});
afterAll(async () => {
  await harness.close();
});

describe('a web write, through the sync endpoints', () => {
  it('reaches the pull with the server stamp, and LWW holds both ways', async () => {
    const userId = (await createTestSession(harness.db)).userId;
    await seedOnboarded(harness.db, userId);

    // 1. The web creates a transaction; a phone pulling from 0 receives it with the server stamp.
    const created = await saveTransaction(harness.db, userId, expense, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    const first = await readPull(harness.db, userId, { since: 0, limit: 500 });
    const pulled = first.changes.find(
      (change) => change.entity === 'transaction' && change.id === created.id,
    );
    if (pulled === undefined) throw new Error('the pull did not return the transaction');
    const serverStamp = parseHlc(pulled.updatedAt);
    expect(serverStamp.deviceId).toMatch(/^server-/);
    expect(serverStamp.wallMs).toBe(FIXTURE_NOW.getTime());
    expect(pulled.deletedAt).toBeNull();
    const received = transactionSchema.parse(pulled.data);
    expect(received).toMatchObject({ id: created.id, amount: 4820, updatedAt: pulled.updatedAt });

    // 2. The phone edits the row with a clock ahead of the server's and pushes it: it wins.
    const phoneStamp = formatHlc({
      wallMs: FIXTURE_NOW.getTime() + PHONE_AHEAD_MS,
      counter: 0,
      deviceId: 'phone-a',
    });
    expect(phoneStamp > pulled.updatedAt).toBe(true);
    const phoneEdit: SyncChangeEnvelope = {
      entity: 'transaction',
      id: created.id,
      updatedAt: phoneStamp,
      deletedAt: null,
      data: transactionSchema.parse({
        ...received,
        amount: 1250,
        description: 'Dal telefono',
        updatedAt: phoneStamp,
      }),
    };
    const pushed = await applyPush(
      harness.db,
      userId,
      { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'phone-a', changes: [phoneEdit] },
      FIXTURE_NOW,
    );
    expect(pushed).toEqual([{ entity: 'transaction', id: created.id, status: 'applied' }]);
    expect((await readUserData(harness.db, userId)).transactions).toEqual([
      expect.objectContaining({ id: created.id, amount: 1250, description: 'Dal telefono' }),
    ]);

    // 3. The web edits again, its own wall clock still behind the phone's: the web's edit wins,
    //    because the clock received the phone's stamp before minting its own.
    const edited = await saveTransaction(
      harness.db,
      userId,
      { ...expense, id: created.id, buffer: '60', description: 'Dal web' },
      FIXTURE_NOW,
    );
    expect(edited).toEqual({ ok: true, id: created.id });
    expect((await readUserData(harness.db, userId)).transactions).toEqual([
      expect.objectContaining({ id: created.id, amount: 6000, description: 'Dal web' }),
    ]);

    // 4. The phone pulling from where it stopped receives the web's edit, stamped after its own.
    const second = await readPull(harness.db, userId, { since: first.nextSince, limit: 500 });
    const again = second.changes.find(
      (change) => change.entity === 'transaction' && change.id === created.id,
    );
    if (again === undefined) throw new Error('the pull did not return the web edit');
    expect(again.updatedAt > phoneStamp).toBe(true);
    expect(parseHlc(again.updatedAt).deviceId).toBe(serverStamp.deviceId);
    expect(transactionSchema.parse(again.data)).toMatchObject({
      amount: 6000,
      description: 'Dal web',
      updatedAt: again.updatedAt,
    });
  });
});

describe('the accounts, goals and budgets the web wrote, through the pull', () => {
  it('reach the phone with valid data, and the web edit after a phone edit wins', async () => {
    const userId = (await createTestSession(harness.db)).userId;
    await seedOnboarded(harness.db, userId);
    const past = { since: 0, limit: 500 };

    const account = await saveAccount(
      harness.db,
      userId,
      {
        id: null,
        name: 'Cassa',
        institution: '',
        type: 'cash',
        buffer: '25.5',
        includeInSpendable: true,
        colorIndex: 2,
        icon: 'banknote',
        creditCloseDay: null,
        creditChargeDay: null,
        creditPaymentAccountId: null,
      },
      FIXTURE_NOW,
    );
    if (!account.ok) throw new Error('account not created');
    const goal = await saveGoal(
      harness.db,
      userId,
      {
        id: null,
        name: 'Vacanza',
        icon: 'target',
        colorIndex: 5,
        buffer: '1000',
        deadline: '2027-06-01',
        parentAccountId: 'acc-main',
        savedBuffer: '250',
      },
      FIXTURE_NOW,
    );
    if (!goal.ok) throw new Error('goal not created');
    const budget = await saveBudget(
      harness.db,
      userId,
      {
        id: null,
        name: 'Spesa',
        categoryIds: ['seed-category-groceries'],
        buffer: '300',
        period: 'period',
        alertThreshold: 90,
        rollover: true,
        icon: 'cart',
      },
      FIXTURE_NOW,
    );
    if (!budget.ok) throw new Error('budget not created');

    const first = await readPull(harness.db, userId, past);
    for (const change of first.changes) {
      entitySchemas[change.entity].parse(change.data);
    }
    const find = (changes: typeof first.changes, entity: string, id: string) =>
      changes.find((change) => change.entity === entity && change.id === id);
    const pulledAccount = find(first.changes, 'account', account.id);
    const pulledBudget = find(first.changes, 'budget', budget.id);
    if (pulledAccount === undefined || pulledBudget === undefined) throw new Error('not pulled');
    expect(find(first.changes, 'account', goal.id)).toBeDefined();
    const seeded = first.changes.filter(
      (change) => change.entity === 'transaction' && change.deletedAt === null,
    );
    expect(seeded).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'transfer', amount: 25000, toAccountId: goal.id }),
      }),
    ]);

    // The phone edits the account and the budget with a stamp 12h ahead of the server's.
    const phoneStamp = formatHlc({
      wallMs: FIXTURE_NOW.getTime() + PHONE_AHEAD_MS,
      counter: 0,
      deviceId: 'phone-a',
    });
    const phoneEdits: SyncChangeEnvelope[] = [
      {
        entity: 'account',
        id: account.id,
        updatedAt: phoneStamp,
        deletedAt: null,
        data: accountSchema.parse({
          ...accountSchema.parse(pulledAccount.data),
          name: 'Dal telefono',
          updatedAt: phoneStamp,
        }),
      },
      {
        entity: 'budget',
        id: budget.id,
        updatedAt: phoneStamp,
        deletedAt: null,
        data: budgetSchema.parse({
          ...budgetSchema.parse(pulledBudget.data),
          name: 'Dal telefono',
          updatedAt: phoneStamp,
        }),
      },
    ];
    const pushed = await applyPush(
      harness.db,
      userId,
      { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'phone-a', changes: phoneEdits },
      FIXTURE_NOW,
    );
    expect(pushed.map((r) => r.status)).toEqual(['applied', 'applied']);

    // The web edits both, and closes the goal.
    const editedAccount = await saveAccount(
      harness.db,
      userId,
      {
        id: account.id,
        name: 'Dal web',
        institution: '',
        type: 'cash',
        buffer: '25.5',
        includeInSpendable: true,
        colorIndex: 2,
        icon: 'banknote',
        creditCloseDay: null,
        creditChargeDay: null,
        creditPaymentAccountId: null,
      },
      FIXTURE_NOW,
    );
    expect(editedAccount).toEqual({ ok: true, id: account.id });
    const editedBudget = await saveBudget(
      harness.db,
      userId,
      {
        id: budget.id,
        name: 'Dal web',
        categoryIds: ['seed-category-groceries'],
        buffer: '400',
        period: 'period',
        alertThreshold: 90,
        rollover: true,
        icon: 'cart',
      },
      FIXTURE_NOW,
    );
    expect(editedBudget).toEqual({ ok: true, id: budget.id });
    expect(await closeGoal(harness.db, userId, goal.id, FIXTURE_NOW)).toEqual({ ok: true });

    const second = await readPull(harness.db, userId, { since: first.nextSince, limit: 500 });
    for (const change of second.changes) {
      entitySchemas[change.entity].parse(change.data);
    }
    const webAccount = find(second.changes, 'account', account.id);
    const webBudget = find(second.changes, 'budget', budget.id);
    if (webAccount === undefined || webBudget === undefined) throw new Error('edits not pulled');
    expect(webAccount.updatedAt > phoneStamp).toBe(true);
    expect(webBudget.updatedAt > phoneStamp).toBe(true);
    expect(accountSchema.parse(webAccount.data).name).toBe('Dal web');
    expect(budgetSchema.parse(webBudget.data)).toMatchObject({ name: 'Dal web', amount: 40000 });

    // The closed goal is archived, its pocket back to zero by a transfer to the parent.
    const closed = find(second.changes, 'account', goal.id);
    if (closed === undefined) throw new Error('closed goal not pulled');
    expect(accountSchema.parse(closed.data).archivedAt).not.toBeNull();
    const settlement = second.changes.filter(
      (change) => change.entity === 'transaction' && change.deletedAt === null,
    );
    expect(settlement).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'transfer',
          amount: 25000,
          accountId: goal.id,
          toAccountId: 'acc-main',
        }),
      }),
    ]);
  });
});
