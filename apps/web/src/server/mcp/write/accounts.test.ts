import { accountBalances } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../test/harness';
import { createTestSession } from '../../test/session';
import { readUserData } from '../../userData/read';
import { bumpRow, FIXTURE_NOW, seedOnboarded, stampOf } from '../../write/fixtures';
import { saveGoal as saveGoalWrite } from '../../write/goals';
import { accountHandlers } from './accounts';
import { FIXTURE_CTX, fixtureClock, messageOf, run, valueFrom } from './testKit';
import { transactionHandlers } from './transactions';

let harness: TestDatabase;
let userId: string;
const { saveAccount, archiveAccount } = accountHandlers(fixtureClock);
const { saveTransaction } = transactionHandlers(fixtureClock);

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

const account = async (id: string) =>
  (await readUserData(harness.db, userId)).accounts.find((row) => row.id === id);

async function spend(amountMinor: number) {
  valueFrom(
    await run(saveTransaction, userId, {
      kind: 'expense',
      amountMinor,
      accountId: 'acc-main',
      categoryId: 'seed-category-groceries',
    }),
  );
}

async function createGoal(): Promise<string> {
  const result = await saveGoalWrite(
    harness.db,
    userId,
    {
      id: null,
      name: 'Vacanza',
      icon: 'target',
      colorIndex: 5,
      buffer: '1000',
      deadline: null,
      parentAccountId: 'acc-main',
      savedBuffer: '',
    },
    FIXTURE_NOW,
  );
  if (!result.ok) throw new Error('goal not created');
  return result.id;
}

describe('save_account', () => {
  it('creates a credit card in debt', async () => {
    await onboarded();
    const saved = valueFrom(
      await run(saveAccount, userId, {
        name: 'Visa',
        type: 'credit_card',
        balanceMinor: -12000,
        creditCloseDay: 20,
        creditChargeDay: 5,
        creditPaymentAccountId: 'acc-main',
      }),
    );
    expect(saved.created).toBe(true);
    expect(await account(saved.id)).toMatchObject({
      name: 'Visa',
      type: 'credit_card',
      openingBalance: -12000,
      creditCloseDay: 20,
      creditPaymentAccountId: 'acc-main',
    });
  });

  it('renames without moving the balance, even after new transactions', async () => {
    await onboarded();
    await spend(4820);
    const read = await stampOf(harness.db, userId, 'account', 'acc-main');
    valueFrom(
      await run(saveAccount, userId, { id: 'acc-main', updatedAt: read, name: 'Principale' }),
    );
    expect(await account('acc-main')).toMatchObject({ name: 'Principale', openingBalance: 100000 });
  });

  it("corrects today's balance through the opening balance", async () => {
    await onboarded();
    await spend(4820);
    const read = await stampOf(harness.db, userId, 'account', 'acc-main');
    valueFrom(
      await run(saveAccount, userId, { id: 'acc-main', updatedAt: read, balanceMinor: 90000 }),
    );
    const data = await readUserData(harness.db, userId);
    expect(
      accountBalances(data.accounts, data.transactions, FIXTURE_CTX.today).get('acc-main'),
    ).toBe(90000);
  });

  it('refuses a stale version, and sends a goal to save_goal', async () => {
    await onboarded();
    const read = await stampOf(harness.db, userId, 'account', 'acc-main');
    await bumpRow(harness.db, userId, 'account', 'acc-main', { name: 'Dal telefono' });
    expect(
      messageOf(await run(saveAccount, userId, { id: 'acc-main', updatedAt: read, name: 'X' })),
    ).toMatch(/changed after you read it/);
    const goal = await createGoal();
    const goalStamp = await stampOf(harness.db, userId, 'account', goal);
    expect(
      messageOf(await run(saveAccount, userId, { id: goal, updatedAt: goalStamp, name: 'X' })),
    ).toMatch(/save_goal/);
  });
});

describe('archive_account', () => {
  it('archives and restores, answering the new state and version', async () => {
    await onboarded();
    const read = await stampOf(harness.db, userId, 'account', 'acc-savings');
    const archived = valueFrom(
      await run(archiveAccount, userId, { id: 'acc-savings', updatedAt: read, action: 'archive' }),
    );
    expect(archived).toMatchObject({ id: 'acc-savings', archived: true });
    const restored = valueFrom(
      await run(archiveAccount, userId, {
        id: 'acc-savings',
        updatedAt: archived.updatedAt,
        action: 'restore',
      }),
    );
    expect(restored.archived).toBe(false);
  });

  it('refuses an account that holds open goals', async () => {
    await onboarded();
    await createGoal();
    const read = await stampOf(harness.db, userId, 'account', 'acc-main');
    expect(
      messageOf(
        await run(archiveAccount, userId, { id: 'acc-main', updatedAt: read, action: 'archive' }),
      ),
    ).toMatch(/close_goal/);
  });
});
