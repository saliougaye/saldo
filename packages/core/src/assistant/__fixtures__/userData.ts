import {
  type Account,
  accountSchema,
  type Budget,
  budgetSchema,
  type Category,
  categorySchema,
  type Recurrence,
  recurrenceSchema,
  type Settings,
  settingsSchema,
  type Tag,
  type Transaction,
  tagSchema,
  transactionSchema,
} from '../../entities';
import type { UserData } from '../../userData';
import type { ToolContext } from '../types';

// Built through the schemas, as `apps/web/src/features/test/fixtures.ts` is: a row the app could
// never store would make the assertions prove nothing. Mid-September 2026, calendar months, EUR.
// The numbers every test expects are worked out in the plan (0.4a-1, «The fixture»).

export const CONTEXT: ToolContext = { today: '2026-09-15', timeZone: 'Europe/Rome' };

const META = {
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-01T08:00:00.000Z-0000-test',
  deletedAt: null,
};

export const SETTINGS: Settings = settingsSchema.parse({
  id: 'settings',
  ...META,
  periodKind: 'month',
  cycleStartDay: 27,
  currency: 'EUR',
  language: 'it',
  theme: 'system',
  onboardingCompletedAt: '2026-06-01T08:00:00.000Z',
  timeZone: 'Europe/Rome',
});

function account(over: Partial<Account> & Pick<Account, 'id' | 'name'>): Account {
  return accountSchema.parse({
    type: 'checking',
    institution: null,
    openingBalance: 0,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'wallet',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
    ...META,
    ...over,
  });
}

function category(over: Partial<Category> & Pick<Category, 'id' | 'name'>): Category {
  return categorySchema.parse({
    direction: 'expense',
    parentId: null,
    icon: 'tag',
    colorIndex: 1,
    archivedAt: null,
    sortOrder: 0,
    ...META,
    ...over,
  });
}

function tag(id: string, name: string): Tag {
  return tagSchema.parse({ id, name, ...META });
}

function recurrence(over: {
  id: string;
  startDate: string;
  template: Recurrence['template'];
}): Recurrence {
  return recurrenceSchema.parse({
    frequency: 'monthly',
    interval: 1,
    endDate: null,
    ...META,
    ...over,
  });
}

function tx(over: Partial<Transaction> & Pick<Transaction, 'id' | 'date' | 'amount'>): Transaction {
  return transactionSchema.parse({
    kind: 'expense',
    accountId: 'a-main',
    toAccountId: null,
    categoryId: 'c-food',
    description: '',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    createdAt: `${over.date}T08:00:00.000Z`,
    updatedAt: META.updatedAt,
    deletedAt: null,
    ...over,
  });
}

export const ACCOUNTS: Account[] = [
  account({ id: 'a-main', name: 'Conto corrente', institution: 'Banca', openingBalance: 100000 }),
  account({
    id: 'a-save',
    name: 'Risparmi',
    type: 'savings',
    openingBalance: 500000,
    includeInSpendable: false,
    icon: 'piggy',
    sortOrder: 1,
  }),
  account({
    id: 'a-pocket',
    name: 'Vacanze',
    type: 'pocket',
    includeInSpendable: false,
    parentAccountId: 'a-main',
    goalTarget: 120000,
    goalStartDate: '2026-06-01',
    goalDeadline: '2026-12-31',
    icon: 'plane',
    sortOrder: 2,
  }),
  account({
    id: 'a-old',
    name: 'Contanti',
    type: 'cash',
    openingBalance: 2000,
    archivedAt: '2026-03-01T00:00:00.000Z',
    icon: 'cash',
    sortOrder: 3,
  }),
];

export const CATEGORIES: Category[] = [
  category({ id: 'c-food', name: 'Spesa' }),
  category({ id: 'c-super', name: 'Supermercato', parentId: 'c-food' }),
  category({ id: 'c-home', name: 'Casa', sortOrder: 1 }),
  category({ id: 'c-old', name: 'Vecchia', archivedAt: '2026-07-01T00:00:00.000Z', sortOrder: 2 }),
  category({ id: 'c-salary', name: 'Stipendio', direction: 'income' }),
];

export const TAGS: Tag[] = [tag('g-trip', 'Viaggio'), tag('g-work', 'Lavoro')];

const RENT: Recurrence['template'] = {
  kind: 'expense',
  amount: 80000,
  accountId: 'a-main',
  toAccountId: null,
  categoryId: 'c-home',
  description: 'Affitto',
  tagIds: [],
  excludeFromTotals: false,
};

const SALARY: Recurrence['template'] = {
  kind: 'income',
  amount: 250000,
  accountId: 'a-main',
  toAccountId: null,
  categoryId: 'c-salary',
  description: 'Stipendio',
  tagIds: [],
  excludeFromTotals: false,
};

export const RECURRENCES: Recurrence[] = [
  recurrence({ id: 'r-rent', startDate: '2026-01-05', template: RENT }),
  recurrence({ id: 'r-salary', startDate: '2026-01-01', template: SALARY }),
];

/** A used month of history: salary, rent, a supermarket run and the market. */
function month(ym: string): Transaction[] {
  return [
    tx({
      id: `r-salary:${ym}-01`,
      date: `${ym}-01`,
      amount: 250000,
      kind: 'income',
      categoryId: 'c-salary',
      description: 'Stipendio',
      recurrenceId: 'r-salary',
    }),
    tx({
      id: `r-rent:${ym}-05`,
      date: `${ym}-05`,
      amount: 80000,
      categoryId: 'c-home',
      description: 'Affitto',
      recurrenceId: 'r-rent',
    }),
    tx({
      id: `tx-${ym}-super`,
      date: `${ym}-10`,
      amount: 12000,
      categoryId: 'c-super',
      description: 'Esselunga',
    }),
    tx({ id: `tx-${ym}-food`, date: `${ym}-20`, amount: 3000, description: 'Mercato' }),
  ];
}

const POCKET_JULY = tx({
  id: 'tx-jul-pocket',
  date: '2026-07-01',
  amount: 30000,
  kind: 'transfer',
  categoryId: null,
  toAccountId: 'a-pocket',
  description: 'Accantonamento',
});

/** The current period, today the 15th: two rows still ahead of today. */
export const SEPTEMBER: Transaction[] = [
  tx({
    id: 'r-salary:2026-09-01',
    date: '2026-09-01',
    amount: 250000,
    kind: 'income',
    categoryId: 'c-salary',
    description: 'Stipendio',
    recurrenceId: 'r-salary',
  }),
  tx({
    id: 'tx-sep-pocket',
    date: '2026-09-01',
    amount: 20000,
    kind: 'transfer',
    categoryId: null,
    toAccountId: 'a-pocket',
    description: 'Accantonamento',
  }),
  tx({
    id: 'r-rent:2026-09-05',
    date: '2026-09-05',
    amount: 80000,
    categoryId: 'c-home',
    description: 'Affitto',
    recurrenceId: 'r-rent',
  }),
  tx({
    id: 'tx-sep-super',
    date: '2026-09-08',
    amount: 4550,
    categoryId: 'c-super',
    description: 'Esselunga',
    tagIds: ['g-trip'],
  }),
  tx({
    id: 'tx-sep-excluded',
    date: '2026-09-10',
    amount: 9900,
    categoryId: 'c-home',
    description: 'Anticipo per un amico',
    excludeFromTotals: true,
  }),
  tx({
    id: 'tx-sep-food',
    date: '2026-09-12',
    amount: 2500,
    description: 'Mercato',
    note: 'Frutta',
  }),
  tx({ id: 'tx-sep-dinner', date: '2026-09-25', amount: 1500, description: 'Cena' }),
];

/** What the materialiser has already written for October (§5.9). */
const OCTOBER: Transaction[] = [
  tx({
    id: 'r-salary:2026-10-01',
    date: '2026-10-01',
    amount: 250000,
    kind: 'income',
    categoryId: 'c-salary',
    description: 'Stipendio',
    recurrenceId: 'r-salary',
  }),
  tx({
    id: 'r-rent:2026-10-05',
    date: '2026-10-05',
    amount: 80000,
    categoryId: 'c-home',
    description: 'Affitto',
    recurrenceId: 'r-rent',
  }),
];

/** `b-home` comes first in the array and second in the user's order. */
export const BUDGETS: Budget[] = [
  budgetSchema.parse({
    id: 'b-home',
    name: 'Casa',
    categoryIds: ['c-home'],
    amount: 75000,
    period: 'month',
    alertThreshold: 100,
    rollover: false,
    icon: 'home',
    sortOrder: 1,
    ...META,
  }),
  budgetSchema.parse({
    id: 'b-food',
    name: 'Spesa',
    categoryIds: ['c-food'],
    amount: 20000,
    period: 'period',
    alertThreshold: 80,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
    ...META,
  }),
];

export function fixtureData(): UserData {
  return {
    settings: SETTINGS,
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    tags: TAGS,
    transactions: [
      ...month('2026-06'),
      POCKET_JULY,
      ...month('2026-07'),
      ...month('2026-08'),
      ...SEPTEMBER,
      ...OCTOBER,
    ],
    recurrences: RECURRENCES,
    budgets: BUDGETS,
    attachments: [],
  };
}

/** The same data for someone paid on the 27th: a pay cycle instead of calendar months. */
export function cycleData(): UserData {
  return { ...fixtureData(), settings: { ...SETTINGS, periodKind: 'cycle', cycleStartDay: 27 } };
}
