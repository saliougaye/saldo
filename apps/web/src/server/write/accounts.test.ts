import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { archiveAccount, restoreAccount, saveAccount } from './accounts';
import { bumpRow, FIXTURE_NOW, seedOnboarded, stampOf } from './fixtures';
import { saveGoal } from './goals';
import { saveTransaction } from './transactions';

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

const cash = {
  id: null,
  name: ' Cassa ',
  institution: '',
  type: 'cash',
  buffer: '25.5',
  includeInSpendable: true,
  colorIndex: 2,
  icon: 'banknote',
  creditCloseDay: 15,
  creditChargeDay: 3,
  creditPaymentAccountId: 'acc-main',
};

describe('saveAccount — new', () => {
  it('creates an account whose typed balance is its opening balance', async () => {
    await onboarded();
    const result = await saveAccount(harness.db, userId, cash, FIXTURE_NOW);
    expect(result.ok).toBe(true);
    const created = (await accounts()).find((account) => account.name === 'Cassa');
    expect(created).toMatchObject({
      type: 'cash',
      institution: null,
      openingBalance: 2550,
      sortOrder: 2,
      archivedAt: null,
      // Card fields belong to a card only.
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
    });
  });

  it('keeps a card’s days and payment account', async () => {
    await onboarded();
    const result = await saveAccount(
      harness.db,
      userId,
      { ...cash, type: 'credit_card', buffer: '-120.5' },
      FIXTURE_NOW,
    );
    expect(result.ok).toBe(true);
    expect((await accounts()).find((a) => a.type === 'credit_card')).toMatchObject({
      openingBalance: -12050,
      creditCloseDay: 15,
      creditChargeDay: 3,
      creditPaymentAccountId: 'acc-main',
    });
  });

  it('asks for a name', async () => {
    await onboarded();
    expect(await saveAccount(harness.db, userId, { ...cash, name: '   ' }, FIXTURE_NOW)).toEqual({
      ok: false,
      missing: 'name',
    });
  });

  it('refuses a pocket type, a bad buffer and a payment account that is not a candidate', async () => {
    await onboarded();
    for (const bad of [
      { ...cash, type: 'pocket' },
      { ...cash, buffer: '1.999' },
      { ...cash, type: 'credit_card', creditPaymentAccountId: 'nope' },
      { ...cash, creditCloseDay: 31, type: 'credit_card' },
    ]) {
      expect(await saveAccount(harness.db, userId, bad, FIXTURE_NOW)).toEqual({
        ok: false,
        error: 'invalid',
      });
    }
  });
});

describe('saveAccount — edit', () => {
  it('stores the opening balance that makes the typed current balance true', async () => {
    await onboarded();
    // acc-main: opening 1000.00; add a 10.00 expense so the current balance is 990.00.
    const spent = await saveTransaction(
      harness.db,
      userId,
      {
        id: null,
        kind: 'expense',
        buffer: '10',
        date: '2026-09-28',
        accountId: 'acc-main',
        toAccountId: null,
        categoryId: 'seed-category-groceries',
        description: '',
        tagIds: [],
        excludeFromTotals: false,
      },
      FIXTURE_NOW,
    );
    expect(spent.ok).toBe(true);
    const result = await saveAccount(
      harness.db,
      userId,
      { ...cash, id: 'acc-main', type: 'checking', name: 'Conto', buffer: '500' },
      FIXTURE_NOW,
    );
    expect(result).toEqual({ ok: true, id: 'acc-main' });
    // 500.00 current after a 10.00 expense → opening 510.00
    expect((await accounts()).find((a) => a.id === 'acc-main')?.openingBalance).toBe(51000);
  });

  it('answers notFound for an id that is not an open account', async () => {
    await onboarded();
    expect(await saveAccount(harness.db, userId, { ...cash, id: 'nope' }, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
  });

  it('never edits a pocket through the account form', async () => {
    await onboarded();
    const goal = await saveGoal(harness.db, userId, goalInput, FIXTURE_NOW);
    if (!goal.ok) throw new Error('goal not created');
    expect(await saveAccount(harness.db, userId, { ...cash, id: goal.id }, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
  });

  it('keeps an account that holds a goal a kind that can (§5.14)', async () => {
    await onboarded();
    const goal = await saveGoal(harness.db, userId, goalInput, FIXTURE_NOW);
    expect(goal.ok).toBe(true);
    const result = await saveAccount(
      harness.db,
      userId,
      { ...cash, id: 'acc-main', type: 'credit_card', name: 'Conto', buffer: '0' },
      FIXTURE_NOW,
    );
    expect(result).toEqual({ ok: false, error: 'invalid' });
  });
});

const goalInput = {
  id: null,
  name: 'Vacanza',
  icon: 'target',
  colorIndex: 5,
  buffer: '1000',
  deadline: null,
  parentAccountId: 'acc-main',
  savedBuffer: '',
};

describe('archive and restore', () => {
  it('archives an account and restores it', async () => {
    await onboarded();
    expect(await archiveAccount(harness.db, userId, 'acc-savings', FIXTURE_NOW)).toEqual({
      ok: true,
    });
    expect((await accounts()).find((a) => a.id === 'acc-savings')?.archivedAt).toBe(
      FIXTURE_NOW.toISOString(),
    );
    expect(await restoreAccount(harness.db, userId, 'acc-savings', FIXTURE_NOW)).toEqual({
      ok: true,
    });
    expect((await accounts()).find((a) => a.id === 'acc-savings')?.archivedAt).toBeNull();
  });

  it('writes nothing when the account already is in the asked state', async () => {
    await onboarded();
    const later = new Date(FIXTURE_NOW.getTime() + 60_000);
    expect(await restoreAccount(harness.db, userId, 'acc-savings', later)).toEqual({ ok: true });
    const before = (await accounts()).find((a) => a.id === 'acc-savings');
    expect(before?.updatedAt).not.toContain(later.toISOString());
    await archiveAccount(harness.db, userId, 'acc-savings', FIXTURE_NOW);
    const archived = (await accounts()).find((a) => a.id === 'acc-savings');
    expect(await archiveAccount(harness.db, userId, 'acc-savings', later)).toEqual({ ok: true });
    expect((await accounts()).find((a) => a.id === 'acc-savings')).toEqual(archived);
  });

  it('refuses to archive an account that holds an open goal (§5.14)', async () => {
    await onboarded();
    const goal = await saveGoal(harness.db, userId, goalInput, FIXTURE_NOW);
    expect(goal.ok).toBe(true);
    expect(await archiveAccount(harness.db, userId, 'acc-main', FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'holdsGoals',
    });
  });

  it('answers notFound for a pocket or an unknown id', async () => {
    await onboarded();
    expect(await archiveAccount(harness.db, userId, 'nope', FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});

describe('saveAccount — a null buffer keeps the opening balance (§17.4.2)', () => {
  const groceries = {
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

  it('renames an account without touching its opening balance', async () => {
    await onboarded();
    await saveTransaction(harness.db, userId, groceries, FIXTURE_NOW);
    const result = await saveAccount(
      harness.db,
      userId,
      { ...cash, id: 'acc-main', name: 'Principale', type: 'checking', buffer: null },
      FIXTURE_NOW,
    );
    expect(result).toEqual({ ok: true, id: 'acc-main' });
    expect((await accounts()).find((row) => row.id === 'acc-main')).toMatchObject({
      name: 'Principale',
      openingBalance: 100000,
    });
  });

  it('opens a new account at zero', async () => {
    await onboarded();
    const result = await saveAccount(harness.db, userId, { ...cash, buffer: null }, FIXTURE_NOW);
    if (!result.ok) throw new Error('not created');
    expect((await accounts()).find((row) => row.id === result.id)).toMatchObject({
      openingBalance: 0,
    });
  });
});

describe('accounts — expectedUpdatedAt (§17.4.2)', () => {
  it('saves, archives and restores only the version read', async () => {
    await onboarded();
    const read = await stampOf(harness.db, userId, 'account', 'acc-savings');
    const phone = await bumpRow(harness.db, userId, 'account', 'acc-savings', { name: 'Fondo' });

    expect(
      await saveAccount(
        harness.db,
        userId,
        { ...cash, id: 'acc-savings', type: 'savings', buffer: null, expectedUpdatedAt: read },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'conflict' });
    expect(await archiveAccount(harness.db, userId, 'acc-savings', FIXTURE_NOW, read)).toEqual({
      ok: false,
      error: 'conflict',
    });
    expect(await archiveAccount(harness.db, userId, 'acc-savings', FIXTURE_NOW, phone)).toEqual({
      ok: true,
    });
    const archived = await stampOf(harness.db, userId, 'account', 'acc-savings');
    expect(await restoreAccount(harness.db, userId, 'acc-savings', FIXTURE_NOW, phone)).toEqual({
      ok: false,
      error: 'conflict',
    });
    expect(
      await restoreAccount(harness.db, userId, 'acc-savings', FIXTURE_NOW, archived),
    ).toEqual({ ok: true });
  });
});
