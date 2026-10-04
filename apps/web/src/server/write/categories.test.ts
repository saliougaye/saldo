import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { archiveCategory, reorderCategory, restoreCategory, saveCategory } from './categories';
import { bumpRow, FIXTURE_NOW, seedOnboarded, stampOf } from './fixtures';
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
  name: 'Ristoranti',
  direction: 'expense',
  parentId: null,
  icon: 'utensils',
  colorIndex: 3,
  budgetEnabled: false,
  budgetBuffer: '',
};
const GROCERIES = 'seed-category-groceries';
const later = new Date('2026-09-30T09:00:00.000Z');
const meta = { createdAt: FIXTURE_NOW.toISOString(), deletedAt: null };
const data = () => readUserData(harness.db, userId);
const find = async (id: string) => (await data()).categories.find((c) => c.id === id);

async function put(entity: string, id: string, fields: Record<string, unknown>) {
  await writeChanges(
    harness.db,
    userId,
    [{ entity, id, data: { id, ...fields, ...meta } }] as never,
    FIXTURE_NOW,
  );
}
const category = (id: string, patch: Record<string, unknown> = {}) =>
  put('category', id, {
    name: id,
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    colorIndex: 1,
    archivedAt: null,
    sortOrder: 50,
    ...patch,
  });
const transaction = (id: string, categoryId: string) =>
  put('transaction', id, {
    kind: 'expense',
    amount: 1000,
    date: '2026-09-28',
    accountId: 'acc-main',
    toAccountId: null,
    categoryId,
    description: '',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  });
const recurrence = (id: string, categoryId: string) =>
  put('recurrence', id, {
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-09-01',
    endDate: null,
    template: {
      kind: 'expense',
      amount: 500,
      accountId: 'acc-main',
      toAccountId: null,
      categoryId,
      description: '',
      tagIds: [],
      excludeFromTotals: false,
    },
  });
const budget = (id: string, categoryIds: string[]) =>
  put('budget', id, {
    name: id,
    categoryIds,
    amount: 10000,
    period: 'period',
    alertThreshold: 90,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
  });

describe('saveCategory', () => {
  it('creates a top-level category at the end', async () => {
    await onboarded();
    const before = (await data()).categories.length;
    const result = await saveCategory(harness.db, userId, input, FIXTURE_NOW);
    if (!result.ok) throw new Error('not created');
    expect(await find(result.id)).toMatchObject({
      name: 'Ristoranti',
      direction: 'expense',
      parentId: null,
      icon: 'utensils',
      colorIndex: 3,
      archivedAt: null,
      sortOrder: before,
    });
  });

  it('trims the name and creates a child under a top-level category', async () => {
    await onboarded();
    const result = await saveCategory(
      harness.db,
      userId,
      { ...input, name: '  Bar  ', parentId: GROCERIES },
      FIXTURE_NOW,
    );
    if (!result.ok) throw new Error('not created');
    expect(await find(result.id)).toMatchObject({ name: 'Bar', parentId: GROCERIES });
  });

  it('edits name, icon, colour and parent, keeping the direction', async () => {
    await onboarded();
    await category('home');
    const created = await saveCategory(harness.db, userId, input, FIXTURE_NOW);
    if (!created.ok) throw new Error('not created');
    const edited = await saveCategory(
      harness.db,
      userId,
      {
        ...input,
        id: created.id,
        name: 'Cene',
        icon: 'pizza',
        colorIndex: 5,
        parentId: 'home',
        direction: 'income',
      },
      later,
    );
    expect(edited).toEqual({ ok: true, id: created.id });
    expect(await find(created.id)).toMatchObject({
      name: 'Cene',
      icon: 'pizza',
      colorIndex: 5,
      parentId: 'home',
      direction: 'expense',
    });
  });

  it('refuses a child of a child', async () => {
    await onboarded();
    await category('kid', { parentId: GROCERIES });
    expect(
      await saveCategory(harness.db, userId, { ...input, parentId: 'kid' }, FIXTURE_NOW),
    ).toEqual({ ok: false, error: 'parentInvalid' });
  });

  it('refuses a parent of the other direction, an archived one, a missing one', async () => {
    await onboarded();
    await category('pay', { direction: 'income' });
    await category('old', { archivedAt: FIXTURE_NOW.toISOString() });
    for (const parentId of ['pay', 'old', 'nope']) {
      expect(await saveCategory(harness.db, userId, { ...input, parentId }, FIXTURE_NOW)).toEqual({
        ok: false,
        error: 'parentInvalid',
      });
    }
  });

  it('refuses itself as its parent', async () => {
    await onboarded();
    expect(
      await saveCategory(
        harness.db,
        userId,
        { ...input, id: GROCERIES, parentId: GROCERIES },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'parentInvalid' });
  });

  it('refuses a parent for a category that has children', async () => {
    await onboarded();
    await category('home');
    await category('kid', { parentId: GROCERIES });
    expect(
      await saveCategory(
        harness.db,
        userId,
        { ...input, id: GROCERIES, name: 'Spesa', parentId: 'home' },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'parentInvalid' });
  });

  it('refuses an unknown id and out-of-bounds input', async () => {
    await onboarded();
    expect(await saveCategory(harness.db, userId, { ...input, id: 'nope' }, FIXTURE_NOW)).toEqual({
      ok: false,
      error: 'notFound',
    });
    for (const bad of [
      { ...input, name: '   ' },
      { ...input, name: 'x'.repeat(41) },
      { ...input, colorIndex: 99 },
      { ...input, colorIndex: -1 },
      { ...input, icon: '' },
      { ...input, direction: 'transfer' },
      { ...input, budgetBuffer: 'abc' },
    ]) {
      expect(await saveCategory(harness.db, userId, bad, FIXTURE_NOW)).toEqual({
        ok: false,
        error: 'invalid',
      });
    }
  });

  describe('Budget mensile', () => {
    it('creates a single-category period budget named after the category', async () => {
      await onboarded();
      await budget('existing', ['other']);
      const result = await saveCategory(
        harness.db,
        userId,
        { ...input, budgetEnabled: true, budgetBuffer: '200' },
        FIXTURE_NOW,
      );
      if (!result.ok) throw new Error('not created');
      const created = (await data()).budgets.find((b) => b.categoryIds[0] === result.id);
      expect(created).toMatchObject({
        name: 'Ristoranti',
        categoryIds: [result.id],
        amount: 20000,
        period: 'period',
        alertThreshold: 90,
        rollover: false,
        icon: 'utensils',
        sortOrder: 1,
      });
    });

    it('updates the amount of the budget the category already has', async () => {
      await onboarded();
      await budget('mine', [GROCERIES]);
      await saveCategory(
        harness.db,
        userId,
        { ...input, id: GROCERIES, name: 'Spesa', budgetEnabled: true, budgetBuffer: '250' },
        later,
      );
      const budgets = (await data()).budgets;
      expect(budgets).toHaveLength(1);
      expect(budgets[0]).toMatchObject({ id: 'mine', amount: 25000, name: 'mine' });
    });

    it('deletes that budget when the switch goes off, as the phone does', async () => {
      await onboarded();
      await budget('mine', [GROCERIES]);
      await saveCategory(
        harness.db,
        userId,
        { ...input, id: GROCERIES, name: 'Spesa', budgetEnabled: false },
        later,
      );
      expect((await data()).budgets).toHaveLength(0);
    });

    it('creates no budget for a zero amount or an income category', async () => {
      await onboarded();
      await saveCategory(
        harness.db,
        userId,
        { ...input, budgetEnabled: true, budgetBuffer: '0' },
        FIXTURE_NOW,
      );
      await saveCategory(
        harness.db,
        userId,
        { ...input, name: 'Bonus', direction: 'income', budgetEnabled: true, budgetBuffer: '9' },
        FIXTURE_NOW,
      );
      expect((await data()).budgets).toHaveLength(0);
    });
  });
});

describe('archiveCategory', () => {
  it('archives the category and its children', async () => {
    await onboarded();
    await category('kid', { parentId: GROCERIES });
    await category('other');
    expect(
      await archiveCategory(harness.db, userId, { id: GROCERIES, moveToId: null }, later),
    ).toEqual({ ok: true });
    expect((await find(GROCERIES))?.archivedAt).toBe(later.toISOString());
    expect((await find('kid'))?.archivedAt).toBe(later.toISOString());
    expect((await find('other'))?.archivedAt).toBeNull();
  });

  it('leaves transactions, recurrences and budgets alone without a move', async () => {
    await onboarded();
    await transaction('t1', GROCERIES);
    await budget('b1', [GROCERIES]);
    await archiveCategory(harness.db, userId, { id: GROCERIES, moveToId: null }, later);
    const d = await data();
    expect(d.transactions[0]?.categoryId).toBe(GROCERIES);
    expect(d.budgets[0]?.categoryIds).toEqual([GROCERIES]);
  });

  it('moves transactions, recurrence templates and budgets in one batch', async () => {
    await onboarded();
    await category('target');
    await transaction('t1', GROCERIES);
    await transaction('t2', GROCERIES);
    await transaction('t3', 'target');
    await recurrence('r1', GROCERIES);
    await budget('b1', [GROCERIES, 'target', 'third']);
    await budget('b2', ['third']);
    const b2Stamp = (await data()).budgets.find((b) => b.id === 'b2')?.updatedAt;
    const result = await archiveCategory(
      harness.db,
      userId,
      { id: GROCERIES, moveToId: 'target' },
      later,
    );
    expect(result).toEqual({ ok: true });
    const d = await data();
    expect(d.transactions.map((t) => t.categoryId)).toEqual(['target', 'target', 'target']);
    expect(d.recurrences[0]?.template.categoryId).toBe('target');
    expect(d.budgets.find((b) => b.id === 'b1')?.categoryIds).toEqual(['target', 'third']);
    expect(d.budgets.find((b) => b.id === 'b2')?.updatedAt).toBe(b2Stamp);
    expect((await find(GROCERIES))?.archivedAt).toBe(later.toISOString());
  });

  it('refuses a move target that is invalid', async () => {
    await onboarded();
    await category('kid', { parentId: GROCERIES });
    await category('pay', { direction: 'income' });
    await category('old', { archivedAt: FIXTURE_NOW.toISOString() });
    await transaction('t1', GROCERIES);
    for (const moveToId of [GROCERIES, 'kid', 'pay', 'old', 'nope']) {
      expect(await archiveCategory(harness.db, userId, { id: GROCERIES, moveToId }, later)).toEqual(
        {
          ok: false,
          error: 'moveInvalid',
        },
      );
    }
    expect((await find(GROCERIES))?.archivedAt).toBeNull();
    expect((await data()).transactions[0]?.categoryId).toBe(GROCERIES);
  });

  it('is ok and writes nothing when already archived; notFound for an unknown id', async () => {
    await onboarded();
    await archiveCategory(harness.db, userId, { id: GROCERIES, moveToId: null }, later);
    const stamp = (await find(GROCERIES))?.updatedAt;
    expect(
      await archiveCategory(
        harness.db,
        userId,
        { id: GROCERIES, moveToId: null },
        new Date('2026-10-01T09:00:00.000Z'),
      ),
    ).toEqual({ ok: true });
    expect((await find(GROCERIES))?.updatedAt).toBe(stamp);
    expect(
      await archiveCategory(harness.db, userId, { id: 'nope', moveToId: null }, later),
    ).toEqual({ ok: false, error: 'notFound' });
  });
});

describe('restoreCategory', () => {
  it('restores a category', async () => {
    await onboarded();
    await archiveCategory(harness.db, userId, { id: GROCERIES, moveToId: null }, later);
    expect(await restoreCategory(harness.db, userId, GROCERIES, later)).toEqual({ ok: true });
    expect((await find(GROCERIES))?.archivedAt).toBeNull();
  });

  it('refuses a child whose parent is still archived', async () => {
    await onboarded();
    await category('kid', { parentId: GROCERIES });
    await archiveCategory(harness.db, userId, { id: GROCERIES, moveToId: null }, later);
    expect(await restoreCategory(harness.db, userId, 'kid', later)).toEqual({
      ok: false,
      error: 'parentInvalid',
    });
    expect((await find('kid'))?.archivedAt).not.toBeNull();
  });

  it('is ok and writes nothing for a live category; notFound for an unknown id', async () => {
    await onboarded();
    const stamp = (await find(GROCERIES))?.updatedAt;
    expect(await restoreCategory(harness.db, userId, GROCERIES, later)).toEqual({ ok: true });
    expect((await find(GROCERIES))?.updatedAt).toBe(stamp);
    expect(await restoreCategory(harness.db, userId, 'nope', later)).toEqual({
      ok: false,
      error: 'notFound',
    });
  });
});

describe('reorderCategory', () => {
  async function order(parentId: string | null) {
    return (await data()).categories
      .filter((c) => c.parentId === parentId && c.direction === 'expense')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.id);
  }

  it('moves a category one place inside its sibling group and renumbers it', async () => {
    await onboarded();
    await category('a', { sortOrder: 1 });
    await category('b', { sortOrder: 1 });
    await category('c', { sortOrder: 1 });
    const start = await order(null);
    expect(start).toHaveLength(4);
    const first = start[0] ?? '';
    const second = start[1] ?? '';
    expect(await reorderCategory(harness.db, userId, { id: first, direction: 1 }, later)).toEqual({
      ok: true,
    });
    const now = await order(null);
    expect(now[0]).toBe(second);
    expect(now[1]).toBe(first);
  });

  it('reorders children among their own siblings', async () => {
    await onboarded();
    await category('k1', { parentId: GROCERIES, sortOrder: 0 });
    await category('k2', { parentId: GROCERIES, sortOrder: 1 });
    const before = await order(GROCERIES);
    expect(before.indexOf('k1')).toBeLessThan(before.indexOf('k2'));
    await reorderCategory(harness.db, userId, { id: 'k2', direction: -1 }, later);
    const after = await order(GROCERIES);
    expect(after.indexOf('k2')).toBeLessThan(after.indexOf('k1'));
    expect(after).toHaveLength(before.length);
  });

  it('writes nothing at an end', async () => {
    await onboarded();
    await category('k1', { parentId: GROCERIES, sortOrder: 0 });
    await category('k2', { parentId: GROCERIES, sortOrder: 1 });
    const stamp = (await find('k1'))?.updatedAt;
    expect(await reorderCategory(harness.db, userId, { id: 'k1', direction: -1 }, later)).toEqual({
      ok: true,
    });
    expect((await find('k1'))?.updatedAt).toBe(stamp);
  });

  it('refuses an unknown or archived category and a bad direction', async () => {
    await onboarded();
    await archiveCategory(harness.db, userId, { id: GROCERIES, moveToId: null }, later);
    for (const id of ['nope', GROCERIES]) {
      expect(await reorderCategory(harness.db, userId, { id, direction: 1 }, later)).toEqual({
        ok: false,
        error: 'notFound',
      });
    }
    expect(
      await reorderCategory(harness.db, userId, { id: GROCERIES, direction: 2 }, later),
    ).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('categories — expectedUpdatedAt (§17.4.2)', () => {
  it('saves, archives and restores only the version read', async () => {
    await onboarded();
    const read = await stampOf(harness.db, userId, 'category', GROCERIES);
    const phone = await bumpRow(harness.db, userId, 'category', GROCERIES, { name: 'Alimentari' });

    expect(
      await saveCategory(
        harness.db,
        userId,
        { ...input, id: GROCERIES, name: 'Spesa', expectedUpdatedAt: read },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'conflict' });
    expect(
      await archiveCategory(
        harness.db,
        userId,
        { id: GROCERIES, moveToId: null, expectedUpdatedAt: read },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: false, error: 'conflict' });
    expect(
      await archiveCategory(
        harness.db,
        userId,
        { id: GROCERIES, moveToId: null, expectedUpdatedAt: phone },
        FIXTURE_NOW,
      ),
    ).toEqual({ ok: true });
    const archived = await stampOf(harness.db, userId, 'category', GROCERIES);
    expect(await restoreCategory(harness.db, userId, GROCERIES, FIXTURE_NOW, phone)).toEqual({
      ok: false,
      error: 'conflict',
    });
    expect(await restoreCategory(harness.db, userId, GROCERIES, FIXTURE_NOW, archived)).toEqual({
      ok: true,
    });
  });
});
