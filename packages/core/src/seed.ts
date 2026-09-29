import type {
  Account,
  AccountType,
  Category,
  CategoryDirection,
  PeriodKindValue,
  Settings,
} from './entities';
import type { CurrencyCode } from './money';

/** One row of the §4.2 seed table. `nameKey` resolves through the `seed.*` i18n namespace. */
export interface SeedCategory {
  nameKey: string;
  direction: CategoryDirection;
  /** An `IconName` of `@saldo/ui`; core imports no other package, so each app checks it (§3). */
  icon: string;
  colorIndex: number;
  children?: readonly { nameKey: string; icon: string; colorIndex: number }[];
  /** Hidden from the onboarding grid (§4.2), always created: income needs somewhere to land. */
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

/**
 * The id a seed category has on **every** device (§17.1.3). A phone that onboarded offline and a
 * web onboarding of the same account would otherwise each create fourteen categories, and the
 * merge would keep both sets; with one id per `nameKey` they converge by LWW.
 */
export function seedCategoryId(nameKey: string): string {
  return `seed-category-${nameKey}`;
}

type Fields<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export interface OnboardingSeedInput {
  periodKind: PeriodKindValue;
  cycleStartDay: number;
  currency: CurrencyCode;
  language: Settings['language'];
  theme: Settings['theme'];
  completedAt: string;
  timeZone: string;
  /** Null when the accounts come from somewhere else — an import (§6.29). */
  account: { name: string; type: AccountType; openingBalance: number; icon: string } | null;
  /** `nameKey`s the user kept selected. Hidden rows are created regardless. */
  selectedCategoryKeys: readonly string[];
  /** Resolves a `seed.*` key to the user's language. */
  translate: (key: string) => string;
}

export interface OnboardingSeed {
  settings: Fields<Settings>;
  /** No id: the first account is the user's own, and two of them are two accounts (§17.1.3). */
  account: Fields<Account> | null;
  categories: (Fields<Category> & { id: string })[];
}

/**
 * What «Inizia» writes (§4.2, §6.29), as plain fields: the phone stamps them through its
 * repositories, the web through `writeChanges`. One implementation, so both onboardings seed the
 * same thing.
 */
export function onboardingSeed(input: OnboardingSeedInput): OnboardingSeed {
  const selected = new Set(input.selectedCategoryKeys);
  const categories: OnboardingSeed['categories'] = [];
  let sortOrder = 0;
  for (const category of SEED_CATEGORIES) {
    if (category.hidden !== true && !selected.has(category.nameKey)) continue;
    const parentId = seedCategoryId(category.nameKey);
    categories.push({
      id: parentId,
      name: input.translate(category.nameKey),
      direction: category.direction,
      parentId: null,
      icon: category.icon,
      colorIndex: category.colorIndex,
      archivedAt: null,
      sortOrder: sortOrder++,
    });
    for (const child of category.children ?? []) {
      categories.push({
        id: seedCategoryId(child.nameKey),
        name: input.translate(child.nameKey),
        direction: category.direction,
        parentId,
        icon: child.icon,
        colorIndex: child.colorIndex,
        archivedAt: null,
        sortOrder: sortOrder++,
      });
    }
  }
  return {
    settings: {
      periodKind: input.periodKind,
      cycleStartDay: input.cycleStartDay,
      currency: input.currency,
      language: input.language,
      theme: input.theme,
      onboardingCompletedAt: input.completedAt,
      timeZone: input.timeZone,
    },
    account:
      input.account === null
        ? null
        : {
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
          },
    categories,
  };
}
