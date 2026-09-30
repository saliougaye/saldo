import { describe, expect, it } from 'vitest';
import { accountSchema, categorySchema, settingsSchema } from './entities';
import { onboardingSeed, PICKABLE_SEED_CATEGORIES, SEED_CATEGORIES, seedCategoryId } from './seed';

const INPUT = {
  periodKind: 'cycle',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'system',
  theme: 'system',
  completedAt: '2026-09-29T10:00:00.000Z',
  timeZone: 'Europe/Rome',
  account: { name: 'Conto corrente', type: 'checking', openingBalance: 150000, icon: 'landmark' },
  selectedCategoryKeys: ['groceries', 'restaurants'],
  translate: (key: string) => `t:${key}`,
} as const;

const META = { createdAt: INPUT.completedAt, updatedAt: 'x', deletedAt: null };

describe('SEED_CATEGORIES', () => {
  it('offers exactly the 12 tiles of the onboarding grid out of 14', () => {
    expect(PICKABLE_SEED_CATEGORIES).toHaveLength(12);
    expect(SEED_CATEGORIES).toHaveLength(14);
  });
});

describe('seedCategoryId', () => {
  it('is the same on every device, so two onboardings converge on one row', () => {
    expect(seedCategoryId('groceries')).toBe('seed-category-groceries');
  });
});

describe('onboardingSeed', () => {
  const seed = onboardingSeed(INPUT);

  it('writes the settings the steps collected', () => {
    expect(settingsSchema.parse({ id: 'settings', ...META, ...seed.settings })).toMatchObject({
      periodKind: 'cycle',
      cycleStartDay: 27,
      currency: 'EUR',
      onboardingCompletedAt: INPUT.completedAt,
      timeZone: 'Europe/Rome',
    });
  });

  it('makes the first account spendable, with no id of its own', () => {
    expect(seed.account).not.toBeNull();
    expect(accountSchema.parse({ id: 'a', ...META, ...seed.account })).toMatchObject({
      name: 'Conto corrente',
      includeInSpendable: true,
      sortOrder: 0,
    });
  });

  it('creates the selected categories with their children, then the hidden ones, in order', () => {
    expect(seed.categories.map((category) => category.id)).toEqual([
      'seed-category-groceries',
      'seed-category-supermarket',
      'seed-category-bakery',
      'seed-category-restaurants',
      'seed-category-refunds',
      'seed-category-gifts',
    ]);
    expect(seed.categories.map((category) => category.sortOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    const supermarket = seed.categories[1];
    expect(supermarket?.parentId).toBe('seed-category-groceries');
    expect(supermarket?.name).toBe('t:supermarket');
    for (const category of seed.categories) categorySchema.parse({ ...META, ...category });
  });

  it('writes no account when the accounts come from elsewhere', () => {
    expect(onboardingSeed({ ...INPUT, account: null }).account).toBeNull();
  });
});
