import {
  archiveCategory,
  categoryUsage,
  deleteTag,
  mergeTags,
  reorderCategories,
  restoreCategory,
  tagUsage,
} from './adminService';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

const NOW = '2026-04-18T10:00:00.000Z';

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => NOW);
  const food = repos.categories.create({
    id: 'cat-food',
    name: 'Spesa',
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    colorIndex: 0,
    archivedAt: null,
    sortOrder: 0,
  });
  const market = repos.categories.create({
    id: 'cat-market',
    name: 'Supermercato',
    direction: 'expense',
    parentId: 'cat-food',
    icon: 'cart',
    colorIndex: 0,
    archivedAt: null,
    sortOrder: 1,
  });
  const other = repos.categories.create({
    id: 'cat-other',
    name: 'Altro',
    direction: 'expense',
    parentId: null,
    icon: 'tag',
    colorIndex: 1,
    archivedAt: null,
    sortOrder: 2,
  });
  return { db, repos, food, market, other };
}

function expense(
  repos: ReturnType<typeof createRepositories>,
  id: string,
  categoryId: string,
  tagIds: string[] = [],
) {
  return repos.transactions.create({
    id,
    kind: 'expense',
    amount: 1000,
    date: '2026-04-10',
    accountId: 'acc-1',
    toAccountId: null,
    categoryId,
    description: id,
    note: null,
    tagIds,
    excludeFromTotals: false,
    recurrenceId: null,
  });
}

describe('archiveCategory', () => {
  it('archives the category and its children', () => {
    const { db, repos } = setup();
    archiveCategory(db, repos, { categoryId: 'cat-food', nowIso: NOW });
    expect(repos.categories.byId('cat-food')?.archivedAt).toBe(NOW);
    expect(repos.categories.byId('cat-market')?.archivedAt).toBe(NOW);
    expect(repos.categories.byId('cat-other')?.archivedAt).toBeNull();
  });

  it('moves the transactions when a target is given', () => {
    const { db, repos } = setup();
    expense(repos, 't1', 'cat-food');
    expense(repos, 't2', 'cat-food');
    archiveCategory(db, repos, {
      categoryId: 'cat-food',
      moveToCategoryId: 'cat-other',
      nowIso: NOW,
    });
    expect(repos.transactions.byId('t1')?.categoryId).toBe('cat-other');
    expect(repos.transactions.byId('t2')?.categoryId).toBe('cat-other');
  });

  it('leaves the transactions alone when no target is given', () => {
    const { db, repos } = setup();
    expense(repos, 't1', 'cat-food');
    archiveCategory(db, repos, { categoryId: 'cat-food', nowIso: NOW });
    expect(repos.transactions.byId('t1')?.categoryId).toBe('cat-food');
  });

  it('rewrites budgets so they do not end up measuring nothing', () => {
    const { db, repos } = setup();
    repos.budgets.create({
      id: 'b1',
      name: 'Spesa',
      categoryIds: ['cat-food'],
      amount: 40000,
      period: 'period',
      alertThreshold: 90,
      rollover: false,
      icon: 'cart',
      sortOrder: 0,
    });
    archiveCategory(db, repos, {
      categoryId: 'cat-food',
      moveToCategoryId: 'cat-other',
      nowIso: NOW,
    });
    expect(repos.budgets.byId('b1')?.categoryIds).toEqual(['cat-other']);
  });

  it('de-duplicates when a budget already holds the target', () => {
    const { db, repos } = setup();
    repos.budgets.create({
      id: 'b1',
      name: 'Due',
      categoryIds: ['cat-food', 'cat-other'],
      amount: 40000,
      period: 'period',
      alertThreshold: null,
      rollover: false,
      icon: 'cart',
      sortOrder: 0,
    });
    archiveCategory(db, repos, {
      categoryId: 'cat-food',
      moveToCategoryId: 'cat-other',
      nowIso: NOW,
    });
    expect(repos.budgets.byId('b1')?.categoryIds).toEqual(['cat-other']);
  });

  it('restores a category', () => {
    const { db, repos } = setup();
    archiveCategory(db, repos, { categoryId: 'cat-other', nowIso: NOW });
    restoreCategory(repos, 'cat-other');
    expect(repos.categories.byId('cat-other')?.archivedAt).toBeNull();
  });
});

describe('categoryUsage', () => {
  it('counts the transactions on a category', () => {
    const { db, repos } = setup();
    expense(repos, 't1', 'cat-food');
    expense(repos, 't2', 'cat-food');
    expense(repos, 't3', 'cat-other');
    expect(categoryUsage(db, 'cat-food')).toBe(2);
    expect(categoryUsage(db, 'cat-market')).toBe(0);
  });
});

describe('mergeTags', () => {
  it('replaces the source with the target and tombstones the source', () => {
    const { db, repos } = setup();
    const source = repos.tags.create({ id: 'tag-a', name: 'Vacanza' });
    const target = repos.tags.create({ id: 'tag-b', name: 'Viaggi' });
    expense(repos, 't1', 'cat-food', [source.id]);
    mergeTags(db, repos, source.id, target.id);
    expect(repos.transactions.byId('t1')?.tagIds).toEqual([target.id]);
    expect(repos.tags.byId(source.id)?.deletedAt).toBe(NOW);
    expect(repos.tags.list().map((tag) => tag.id)).toEqual([target.id]);
  });

  it('de-duplicates when a transaction already carries both', () => {
    const { db, repos } = setup();
    repos.tags.create({ id: 'tag-a', name: 'A' });
    repos.tags.create({ id: 'tag-b', name: 'B' });
    expense(repos, 't1', 'cat-food', ['tag-a', 'tag-b']);
    mergeTags(db, repos, 'tag-a', 'tag-b');
    expect(repos.transactions.byId('t1')?.tagIds).toEqual(['tag-b']);
  });

  it('does nothing when the source is the target', () => {
    const { db, repos } = setup();
    repos.tags.create({ id: 'tag-a', name: 'A' });
    expense(repos, 't1', 'cat-food', ['tag-a']);
    mergeTags(db, repos, 'tag-a', 'tag-a');
    expect(repos.tags.byId('tag-a')?.deletedAt).toBeNull();
  });
});

describe('deleteTag', () => {
  it('removes the tag from every transaction but keeps the transactions', () => {
    const { db, repos } = setup();
    repos.tags.create({ id: 'tag-a', name: 'A' });
    repos.tags.create({ id: 'tag-b', name: 'B' });
    expense(repos, 't1', 'cat-food', ['tag-a', 'tag-b']);
    deleteTag(db, repos, 'tag-a');
    expect(repos.transactions.byId('t1')?.tagIds).toEqual(['tag-b']);
    expect(repos.transactions.byId('t1')?.deletedAt).toBeNull();
    expect(repos.tags.byId('tag-a')?.deletedAt).toBe(NOW);
  });
});

describe('tagUsage', () => {
  it('counts how many transactions carry each tag', () => {
    const { repos } = setup();
    repos.tags.create({ id: 'tag-a', name: 'A' });
    repos.tags.create({ id: 'tag-b', name: 'B' });
    expense(repos, 't1', 'cat-food', ['tag-a']);
    expense(repos, 't2', 'cat-food', ['tag-a', 'tag-b']);
    const usage = tagUsage(repos);
    expect(usage.get('tag-a')).toBe(2);
    expect(usage.get('tag-b')).toBe(1);
  });
});

describe('reorderCategories', () => {
  it('renumbers sortOrder to match the given order', () => {
    const { db, repos } = setup();
    reorderCategories(db, repos, ['cat-other', 'cat-food']);
    expect(repos.categories.byId('cat-other')?.sortOrder).toBe(0);
    expect(repos.categories.byId('cat-food')?.sortOrder).toBe(1);
  });
});
