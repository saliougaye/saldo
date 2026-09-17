import type { AccountType, CurrencyCode, PeriodKind } from '@saldo/core';
import type { IconName } from '@saldo/ui';
import type { Repositories } from './repositories';

/** One row of the §4.2 seed table. `nameKey` resolves through the `seed.*` i18n namespace. */
export interface SeedCategory {
  nameKey: string;
  direction: 'expense' | 'income';
  icon: IconName;
  colorIndex: number;
  children?: readonly Omit<SeedCategory, 'children' | 'direction'>[];
  /**
   * Hidden from the onboarding grid, which shows 12 tiles (§4.2). Hidden rows are always created,
   * because income needs somewhere to land.
   */
  hidden?: true;
}

/** Spec §4.2, in the order the onboarding grid shows them. */
export const SEED_CATEGORIES: readonly SeedCategory[] = [
  {
    nameKey: 'groceries',
    direction: 'expense',
    icon: 'cart',
    colorIndex: 0,
    children: [
      { nameKey: 'supermarket', icon: 'cart', colorIndex: 0 },
      { nameKey: 'bakery', icon: 'apple', colorIndex: 1 },
    ],
  },
  {
    nameKey: 'home',
    direction: 'expense',
    icon: 'house',
    colorIndex: 1,
    children: [
      { nameKey: 'rent', icon: 'key', colorIndex: 1 },
      { nameKey: 'maintenance', icon: 'wrench', colorIndex: 2 },
    ],
  },
  {
    nameKey: 'transport',
    direction: 'expense',
    icon: 'train',
    colorIndex: 2,
    children: [
      { nameKey: 'fuel', icon: 'fuel', colorIndex: 2 },
      { nameKey: 'publicTransport', icon: 'bus', colorIndex: 3 },
    ],
  },
  { nameKey: 'utilities', direction: 'expense', icon: 'zap', colorIndex: 3 },
  { nameKey: 'restaurants', direction: 'expense', icon: 'utensils', colorIndex: 4 },
  { nameKey: 'health', direction: 'expense', icon: 'heart', colorIndex: 5 },
  { nameKey: 'sport', direction: 'expense', icon: 'dumbbell', colorIndex: 6 },
  { nameKey: 'shopping', direction: 'expense', icon: 'bag', colorIndex: 7 },
  { nameKey: 'leisure', direction: 'expense', icon: 'film', colorIndex: 8 },
  { nameKey: 'subscriptions', direction: 'expense', icon: 'monitor', colorIndex: 9 },
  { nameKey: 'education', direction: 'expense', icon: 'cap', colorIndex: 6 },
  { nameKey: 'salary', direction: 'income', icon: 'landmark', colorIndex: 5 },
  { nameKey: 'refunds', direction: 'income', icon: 'arrowDL', colorIndex: 3, hidden: true },
  { nameKey: 'gifts', direction: 'income', icon: 'gift', colorIndex: 7, hidden: true },
];

/** The 12 tiles the onboarding grid offers (§4.2). */
export const PICKABLE_SEED_CATEGORIES = SEED_CATEGORIES.filter(
  (category) => category.hidden !== true,
);

export interface SeedInput {
  /** Written straight into `settings`, so it mirrors that row rather than a `PeriodDef`. */
  periodKind: PeriodKind;
  cycleStartDay: number;
  currency: CurrencyCode;
  language: 'system' | 'it' | 'en';
  theme: 'system' | 'dark' | 'light';
  /** Null when the accounts come from somewhere else — an import (§6.29). */
  account: {
    name: string;
    type: AccountType;
    openingBalance: number;
    icon: IconName;
  } | null;
  /** `nameKey`s the user kept selected. Hidden rows are created regardless. */
  selectedCategoryKeys: readonly string[];
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
  completedAt: string;
}

/**
 * Writes what onboarding collected: the settings singleton, the first account, and the selected
 * categories with their children (§4.2, §6.29). Every write goes through a repository, so each row
 * is validated and stamped.
 *
 * Returns false and writes nothing when the account already has settings: a first sync can land
 * while the user is still stepping through onboarding, and the account's own rows win over a
 * second set of seed data (§8.3). Inserting anyway broke on `UNIQUE constraint failed: settings.id`.
 */
export function seedFromOnboarding(repos: Repositories, input: SeedInput): boolean {
  if (repos.settings.get() !== null) return false;

  repos.settings.create({
    periodKind: input.periodKind,
    cycleStartDay: input.cycleStartDay,
    currency: input.currency,
    language: input.language,
    theme: input.theme,
    onboardingCompletedAt: input.completedAt,
  });

  if (input.account !== null) {
    repos.accounts.create({
      name: input.account.name,
      type: input.account.type,
      institution: null,
      openingBalance: input.account.openingBalance,
      includeInSpendable: true,
      colorIndex: 0,
      icon: input.account.icon,
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: 0,
    });
  }

  const selected = new Set(input.selectedCategoryKeys);
  let sortOrder = 0;
  for (const category of SEED_CATEGORIES) {
    if (category.hidden !== true && !selected.has(category.nameKey)) continue;
    const parent = repos.categories.create({
      name: input.translate(category.nameKey),
      direction: category.direction,
      parentId: null,
      icon: category.icon,
      colorIndex: category.colorIndex,
      archivedAt: null,
      sortOrder: sortOrder++,
    });
    for (const child of category.children ?? []) {
      repos.categories.create({
        name: input.translate(child.nameKey),
        direction: category.direction,
        parentId: parent.id,
        icon: child.icon,
        colorIndex: child.colorIndex,
        archivedAt: null,
        sortOrder: sortOrder++,
      });
    }
  }
  return true;
}
