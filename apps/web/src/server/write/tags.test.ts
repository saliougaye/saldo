import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { readUserData } from '../userData/read';
import { FIXTURE_NOW, seedOnboarded } from './fixtures';
import { createTag, deleteTag, mergeTags, renameTag } from './tags';
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

const later = new Date('2026-09-30T09:00:00.000Z');
const meta = { createdAt: FIXTURE_NOW.toISOString(), deletedAt: null };
const data = () => readUserData(harness.db, userId);
const tagRow = async (id: string) => (await data()).tags.find((row) => row.id === id);
const txRow = async (id: string) => (await data()).transactions.find((row) => row.id === id);

async function put(entity: string, id: string, fields: Record<string, unknown>) {
  await writeChanges(
    harness.db,
    userId,
    [{ entity, id, data: { id, ...fields, ...meta } }] as never,
    FIXTURE_NOW,
  );
}
const tag = (id: string, name = id) => put('tag', id, { name });
const transaction = (id: string, tagIds: string[]) =>
  put('transaction', id, {
    kind: 'expense',
    amount: 1000,
    date: '2026-09-28',
    accountId: 'acc-main',
    toAccountId: null,
    categoryId: 'seed-category-groceries',
    description: '',
    note: null,
    tagIds,
    excludeFromTotals: false,
    recurrenceId: null,
  });
const recurrence = (id: string, tagIds: string[]) =>
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
      categoryId: 'seed-category-groceries',
      description: '',
      tagIds,
      excludeFromTotals: false,
    },
  });

/** The stamp of every live tag, transaction and recurrence, to tell which rows a write touched. */
async function stamps() {
  const d = await data();
  return new Map(
    [...d.tags, ...d.transactions, ...d.recurrences].map((row) => [row.id, row.updatedAt]),
  );
}

/** The live rows whose stamp moved since `before`. */
async function restamped(before: Map<string, string>) {
  return [...(await stamps())]
    .filter(([id, stamp]) => before.get(id) !== stamp)
    .map(([id]) => id)
    .sort();
}

describe('createTag', () => {
  it('creates a tag, and returns the existing one for the same name', async () => {
    await onboarded();
    const first = await createTag(harness.db, userId, ' Casa ', FIXTURE_NOW);
    const second = await createTag(harness.db, userId, 'casa', FIXTURE_NOW);
    expect(first).toMatchObject({ ok: true, tag: { name: 'Casa' }, created: true });
    expect(second).toEqual({ ...first, created: false });
    expect((await data()).tags).toHaveLength(1);
  });
});

describe('renameTag', () => {
  it('refuses a name another tag holds, in any case', async () => {
    await onboarded();
    await tag('t1', 'Casa');
    await tag('t2', 'Viaggio');
    expect(await renameTag(harness.db, userId, { id: 't2', name: 'CASA ' }, later)).toEqual({
      ok: false,
      error: 'taken',
    });
    expect((await tagRow('t2'))?.name).toBe('Viaggio');
  });

  it('lets a tag change only the case of its own name', async () => {
    await onboarded();
    await tag('t1', 'casa');
    expect(await renameTag(harness.db, userId, { id: 't1', name: 'Casa' }, later)).toEqual({
      ok: true,
    });
    expect((await tagRow('t1'))?.name).toBe('Casa');
  });

  it('cannot rename another user’s tag', async () => {
    await onboarded();
    await tag('t1', 'Casa');
    const other = (await createTestSession(harness.db)).userId;
    expect(await renameTag(harness.db, other, { id: 't1', name: 'Mia' }, later)).toEqual({
      ok: false,
      error: 'notFound',
    });
    expect((await tagRow('t1'))?.name).toBe('Casa');
  });
});

describe('mergeTags', () => {
  it('replaces the source with the target, once, and tombstones the source', async () => {
    await onboarded();
    await tag('src');
    await tag('dst');
    await tag('other');
    await transaction('both', ['src', 'other', 'dst']);
    await transaction('only', ['other', 'src']);
    await transaction('none', ['other']);
    const untouched = (await txRow('none'))?.updatedAt;
    expect(
      await mergeTags(harness.db, userId, { sourceId: 'src', targetId: 'dst' }, later),
    ).toEqual({ ok: true });
    expect((await txRow('both'))?.tagIds).toEqual(['dst', 'other']);
    expect((await txRow('only'))?.tagIds).toEqual(['other', 'dst']);
    expect((await txRow('none'))?.updatedAt).toBe(untouched);
    expect(await tagRow('src')).toBeUndefined();
    expect((await data()).tags.map((row) => row.id).sort()).toEqual(['dst', 'other']);
  });

  it('follows into recurrence templates', async () => {
    await onboarded();
    await tag('src');
    await tag('dst');
    await recurrence('r-both', ['dst', 'src']);
    await recurrence('r-only', ['src']);
    await recurrence('r-none', []);
    await mergeTags(harness.db, userId, { sourceId: 'src', targetId: 'dst' }, later);
    const d = await data();
    const template = (id: string) => d.recurrences.find((row) => row.id === id)?.template.tagIds;
    expect(template('r-both')).toEqual(['dst']);
    expect(template('r-only')).toEqual(['dst']);
    expect(template('r-none')).toEqual([]);
  });

  it('writes the source, its transactions and its templates in one batch, each once', async () => {
    await onboarded();
    await tag('src');
    await tag('dst');
    await transaction('x1', ['src']);
    await transaction('x2', ['src', 'dst']);
    await transaction('x3', ['dst']);
    await recurrence('r1', ['src']);
    const before = await stamps();
    await mergeTags(harness.db, userId, { sourceId: 'src', targetId: 'dst' }, later);
    // The target and the rows that never carried the source keep their stamp.
    expect(await restamped(before)).toEqual(['r1', 'x1', 'x2']);
  });
});

describe('deleteTag', () => {
  it('takes the tag off every transaction and template, then tombstones it', async () => {
    await onboarded();
    await tag('gone');
    await tag('kept');
    await transaction('x1', ['gone', 'kept']);
    await transaction('x2', ['gone']);
    await transaction('x3', ['kept']);
    await recurrence('r1', ['kept', 'gone']);
    const before = await stamps();
    expect(await deleteTag(harness.db, userId, 'gone', later)).toEqual({ ok: true });
    const d = await data();
    expect(d.transactions.map((row) => [row.id, row.tagIds])).toEqual([
      ['x1', ['kept']],
      ['x2', []],
      ['x3', ['kept']],
    ]);
    expect(d.recurrences[0]?.template.tagIds).toEqual(['kept']);
    expect(d.tags.map((row) => row.id)).toEqual(['kept']);
    expect(await restamped(before)).toEqual(['r1', 'x1', 'x2']);
  });
});
