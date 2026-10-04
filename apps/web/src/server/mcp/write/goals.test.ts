import { accountBalances } from '@saldo/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../test/harness';
import { createTestSession } from '../../test/session';
import { readUserData } from '../../userData/read';
import { bumpRow, seedOnboarded, stampOf } from '../../write/fixtures';
import { goalHandlers } from './goals';
import { FIXTURE_CTX, fixtureClock, messageOf, run, valueFrom } from './testKit';

let harness: TestDatabase;
let userId: string;
const { saveGoal, moveGoalMoney, closeGoal } = goalHandlers(fixtureClock);
const vacanza = { name: 'Vacanza', targetMinor: 100000, parentAccountId: 'acc-main' };

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

async function balanceOf(id: string): Promise<number> {
  const current = await data();
  return accountBalances(current.accounts, current.transactions, FIXTURE_CTX.today).get(id) ?? 0;
}

describe('save_goal', () => {
  it('creates a goal and moves what is already saved into it', async () => {
    await onboarded();
    const goal = valueFrom(
      await run(saveGoal, userId, { ...vacanza, alreadySavedMinor: 20000, deadline: '2027-06-30' }),
    );
    expect(goal.created).toBe(true);
    expect((await data()).accounts.find((row) => row.id === goal.id)).toMatchObject({
      type: 'pocket',
      parentAccountId: 'acc-main',
      goalTarget: 100000,
      goalDeadline: '2027-06-30',
    });
    expect(await balanceOf(goal.id)).toBe(20000);
    expect(await balanceOf('acc-main')).toBe(80000);
  });

  it('changes the target, and refuses new savings on an edit', async () => {
    await onboarded();
    const goal = valueFrom(await run(saveGoal, userId, vacanza));
    const edited = valueFrom(
      await run(saveGoal, userId, { id: goal.id, updatedAt: goal.updatedAt, targetMinor: 150000 }),
    );
    expect((await data()).accounts.find((row) => row.id === goal.id)).toMatchObject({
      goalTarget: 150000,
    });
    expect(
      messageOf(
        await run(saveGoal, userId, {
          id: goal.id,
          updatedAt: edited.updatedAt,
          alreadySavedMinor: 500,
        }),
      ),
    ).toMatch(/move_goal_money/);
  });
});

describe('move_goal_money', () => {
  it('sets aside and withdraws through transfers named after the goal', async () => {
    await onboarded();
    const goal = valueFrom(await run(saveGoal, userId, vacanza));
    const setAside = valueFrom(
      await run(moveGoalMoney, userId, {
        goalId: goal.id,
        direction: 'set_aside',
        amountMinor: 5000,
      }),
    );
    valueFrom(
      await run(moveGoalMoney, userId, {
        goalId: goal.id,
        direction: 'withdraw',
        amountMinor: 3000,
      }),
    );
    expect(await balanceOf(goal.id)).toBe(2000);
    expect(
      (await data()).transactions.find((row) => row.id === setAside.transactionId),
    ).toMatchObject({
      kind: 'transfer',
      accountId: 'acc-main',
      toAccountId: goal.id,
      amount: 5000,
      description: 'Vacanza',
      updatedAt: setAside.updatedAt,
    });
  });

  it('refuses to withdraw more than the goal holds', async () => {
    await onboarded();
    const goal = valueFrom(await run(saveGoal, userId, vacanza));
    valueFrom(
      await run(moveGoalMoney, userId, {
        goalId: goal.id,
        direction: 'set_aside',
        amountMinor: 1000,
      }),
    );
    expect(
      messageOf(
        await run(moveGoalMoney, userId, {
          goalId: goal.id,
          direction: 'withdraw',
          amountMinor: 5000,
        }),
      ),
    ).toMatch(/below zero/);
  });
});

describe('close_goal', () => {
  it('closes the version read: the money goes back and the goal is archived', async () => {
    await onboarded();
    const goal = valueFrom(await run(saveGoal, userId, { ...vacanza, alreadySavedMinor: 20000 }));
    const phone = await bumpRow(harness.db, userId, 'account', goal.id, { name: 'Viaggio' });
    expect(
      messageOf(await run(closeGoal, userId, { id: goal.id, updatedAt: goal.updatedAt })),
    ).toMatch(/changed after you read it/);
    expect(valueFrom(await run(closeGoal, userId, { id: goal.id, updatedAt: phone }))).toEqual({
      id: goal.id,
    });
    expect(await balanceOf(goal.id)).toBe(0);
    expect((await data()).accounts.find((row) => row.id === goal.id)?.archivedAt).not.toBeNull();
    expect(
      messageOf(
        await run(moveGoalMoney, userId, {
          goalId: goal.id,
          direction: 'set_aside',
          amountMinor: 100,
        }),
      ),
    ).toMatch(/closed goal cannot be changed/);
  });
});

describe('an id that is not an open goal', () => {
  it('is no live goal for save_goal, move_goal_money and close_goal', async () => {
    await onboarded();
    const main = await stampOf(harness.db, userId, 'account', 'acc-main');
    const messages = [
      messageOf(
        await run(saveGoal, userId, { id: 'acc-main', updatedAt: main, targetMinor: 1000 }),
      ),
      messageOf(
        await run(saveGoal, userId, {
          id: 'acc-main',
          updatedAt: main,
          parentAccountId: 'acc-savings',
        }),
      ),
      messageOf(
        await run(moveGoalMoney, userId, {
          goalId: 'acc-main',
          direction: 'set_aside',
          amountMinor: 100,
        }),
      ),
      messageOf(await run(closeGoal, userId, { id: 'acc-main', updatedAt: 'stale' })),
    ];
    for (const message of messages) expect(message).toMatch(/no live goal/);
  });

  it('is no live goal once closed', async () => {
    await onboarded();
    const goal = valueFrom(await run(saveGoal, userId, vacanza));
    valueFrom(await run(closeGoal, userId, { id: goal.id, updatedAt: goal.updatedAt }));
    const closed = await stampOf(harness.db, userId, 'account', goal.id);
    expect(messageOf(await run(closeGoal, userId, { id: goal.id, updatedAt: closed }))).toMatch(
      /no live goal/,
    );
    expect(
      messageOf(await run(saveGoal, userId, { id: goal.id, updatedAt: closed, name: 'X' })),
    ).toMatch(/no live goal/);
  });
});
