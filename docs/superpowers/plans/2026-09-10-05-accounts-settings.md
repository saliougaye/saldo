# Accounts, Categories, Tags, Settings, Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the app's UI: accounts with balances and credit-card figures, the category and tag admin with their maintenance operations, and Settings/Profile.

**Architecture:** The maintenance operations each rewrite several tables, so they live in one `adminService` and each runs inside a single transaction. Two new pure core functions carry the arithmetic: the month-end balance series for the sparkline, and the inverse of the balance formula so the user can edit a *current* balance.

**Spec:** §5.3 (balances, credit card), §5.10, §5.11, §6.5, §6.7–§6.11, §6.13, §6.19, §6.20, §6.22, §6.24, §6.25.

**Note on process:** recorded *as built*.

---

### Task 1: Balance series and the opening-balance inverse

**Files:** create `packages/core/src/accountSeries.ts` + test, export from `index.ts`.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { monthEndBalances, openingBalanceForCurrent } from './accountSeries';
import type { LedgerTx } from './ledger';

function tx(overrides: Partial<LedgerTx> & Pick<LedgerTx, 'date' | 'amount'>): LedgerTx {
  return {
    id: `${overrides.date}-${overrides.amount}`,
    kind: 'expense',
    accountId: 'acc-1',
    toAccountId: null,
    categoryId: 'cat-1',
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
    description: '',
    ...overrides,
  };
}

describe('monthEndBalances', () => {
  it('returns one point per month, ending with the balance today', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 100000,
      txs: [tx({ date: '2026-02-10', amount: 20000 })],
      today: '2026-04-18',
      months: 3,
    });
    // Feb, Mar, Apr: the February expense lands in the first point and stays.
    expect(series).toEqual([80000, 80000, 80000]);
  });

  it('accumulates month by month', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 0,
      txs: [
        tx({ date: '2026-02-05', amount: 1000 }),
        tx({ date: '2026-03-05', amount: 2000 }),
        tx({ date: '2026-04-05', amount: 3000 }),
      ],
      today: '2026-04-18',
      months: 3,
    });
    expect(series).toEqual([-1000, -3000, -6000]);
  });

  it('counts both legs of a transfer', () => {
    const out = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 50000,
      txs: [
        tx({
          date: '2026-03-10',
          amount: 10000,
          kind: 'transfer',
          categoryId: null,
          toAccountId: 'acc-2',
        }),
      ],
      today: '2026-04-18',
      months: 2,
    });
    expect(out).toEqual([40000, 40000]);

    const incoming = monthEndBalances({
      accountId: 'acc-2',
      openingBalance: 0,
      txs: [
        tx({
          date: '2026-03-10',
          amount: 10000,
          kind: 'transfer',
          categoryId: null,
          accountId: 'acc-1',
          toAccountId: 'acc-2',
        }),
      ],
      today: '2026-04-18',
      months: 2,
    });
    expect(incoming).toEqual([10000, 10000]);
  });

  it('counts excluded transactions, like every balance does', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 0,
      txs: [tx({ date: '2026-04-01', amount: 5000, excludeFromTotals: true })],
      today: '2026-04-18',
      months: 1,
    });
    expect(series).toEqual([-5000]);
  });

  it('ignores rows dated after today', () => {
    const series = monthEndBalances({
      accountId: 'acc-1',
      openingBalance: 0,
      txs: [tx({ date: '2026-04-30', amount: 5000 })],
      today: '2026-04-18',
      months: 1,
    });
    expect(series).toEqual([0]);
  });
});

describe('openingBalanceForCurrent', () => {
  it('inverts the balance formula, so editing the current balance is exact', () => {
    const txs = [
      tx({ date: '2026-04-01', amount: 3000 }),
      tx({ date: '2026-04-02', amount: 1000, kind: 'income', categoryId: 'cat-salary' }),
    ];
    const opening = openingBalanceForCurrent({
      accountId: 'acc-1',
      currentBalance: 98000,
      txs,
      today: '2026-04-18',
    });
    expect(opening).toBe(100000);
  });

  it('is the balance itself when nothing has happened', () => {
    expect(
      openingBalanceForCurrent({
        accountId: 'acc-1',
        currentBalance: 42000,
        txs: [],
        today: '2026-04-18',
      }),
    ).toBe(42000);
  });
});
```

- [x] **Step 2: Implement it**

`accountEffect` is shared by both functions and counts *both* legs of a transfer.
`openingBalanceForCurrent` runs the balance formula backwards, which is what makes §6.22 exact:
people mean the balance they can see, and the opening balance is an implementation detail they
never encounter.

```ts
import { addMonths, daysInMonth, type LocalDate, makeLocalDate, parseLocalDate } from './dates';
import type { LedgerTx } from './ledger';
import type { MinorUnits } from './money';

/** Signed effect of one transaction on one account, both legs of a transfer included (§5.3). */
export function accountEffect(tx: LedgerTx, accountId: string): MinorUnits {
  let effect = 0;
  if (tx.accountId === accountId) effect += tx.kind === 'income' ? tx.amount : -tx.amount;
  if (tx.kind === 'transfer' && tx.toAccountId === accountId) effect += tx.amount;
  return effect;
}

export interface MonthEndBalancesInput {
  accountId: string;
  openingBalance: MinorUnits;
  txs: readonly LedgerTx[];
  today: LocalDate;
  /** How many months the sparkline covers, ending with the current one (§6.10). */
  months: number;
}

/**
 * Balance at the end of each of the last `months` months, the last point being the balance today
 * (§6.10). `excludeFromTotals` still counts: it hides a row from cycle totals, not from balances.
 */
export function monthEndBalances(input: MonthEndBalancesInput): MinorUnits[] {
  const { accountId, openingBalance, txs, today, months } = input;
  const { year, month } = parseLocalDate(today);

  const cutoffs: LocalDate[] = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const ym = addMonths({ year, month }, -back);
    const monthEnd = makeLocalDate(ym.year, ym.month, daysInMonth(ym.year, ym.month));
    // The current month is cut at today, not at its last day.
    cutoffs.push(monthEnd > today ? today : monthEnd);
  }

  return cutoffs.map((cutoff) => {
    let balance = openingBalance;
    for (const tx of txs) {
      if (tx.date > cutoff) continue;
      balance += accountEffect(tx, accountId);
    }
    return balance;
  });
}

export interface OpeningBalanceInput {
  accountId: string;
  /** What the user typed as the balance right now. */
  currentBalance: MinorUnits;
  txs: readonly LedgerTx[];
  today: LocalDate;
}

/**
 * The `openingBalance` to store so the account's computed balance equals what the user typed
 * (§6.22): the balance formula run backwards. Editing a *current* balance is what people mean; the
 * opening balance is an implementation detail they never see.
 */
export function openingBalanceForCurrent(input: OpeningBalanceInput): MinorUnits {
  const { accountId, currentBalance, txs, today } = input;
  let effects = 0;
  for (const tx of txs) {
    if (tx.date > today) continue;
    effects += accountEffect(tx, accountId);
  }
  return currentBalance - effects;
}
```

- [x] **Step 3: Commit**

```bash
git add packages/core/src/accountSeries.ts packages/core/src/accountSeries.test.ts packages/core/src/index.ts
git commit -m "feat(core): add month-end balance series and the opening-balance inverse"
```

---

### Task 2: The admin service

Spec §5.10, §5.11. Each operation touches several tables, so each is one transaction.

**Files:** create `apps/mobile/src/db/adminService.ts` + test.

- [x] **Step 1: Write the failing test**

```ts
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
      period: 'cycle',
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
      period: 'cycle',
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
```

- [x] **Step 2: Implement it**

Three decisions the tests pin down:

- **Archiving with a move rewrites budgets too.** Otherwise a budget keeps pointing at an archived
  category and silently starts measuring nothing.
- **Children follow their parent** into the archive, since a live child under an archived parent
  would dangle.
- **Merging and deleting a tag de-duplicate.** A transaction already carrying both tags must not
  end up with the target twice.

```ts
import type { Category, Tag } from '@saldo/core';
import { eq } from 'drizzle-orm';
import type { Repositories } from './repositories';
import type { RepositoryDatabase } from './repositories/support';
import { transactions } from './schema';

/**
 * Category and tag maintenance (§5.10, §5.11). Each operation rewrites several tables, so it runs
 * inside one transaction: a half-applied merge would leave transactions pointing at a tombstoned
 * row.
 */

export interface ArchiveCategoryInput {
  categoryId: string;
  /** Optional target for the affected transactions and budgets (§5.11). */
  moveToCategoryId?: string | null;
  nowIso: string;
}

/**
 * Archives a category, optionally moving its transactions first (§5.11). Categories are never
 * deleted: a transaction without a category could not satisfy `transactionSchema`.
 *
 * Moving rewrites `categoryId` on the affected transactions **and** the `categoryIds` of every
 * budget, so a budget does not silently start measuring nothing.
 */
export function archiveCategory(
  db: RepositoryDatabase,
  repos: Repositories,
  input: ArchiveCategoryInput,
): void {
  const { categoryId, moveToCategoryId, nowIso } = input;
  db.transaction(() => {
    if (moveToCategoryId !== undefined && moveToCategoryId !== null) {
      const affected = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.categoryId, categoryId))
        .all();
      for (const row of affected) {
        repos.transactions.update(row.id, { categoryId: moveToCategoryId });
      }
      for (const budget of repos.budgets.list()) {
        if (!budget.categoryIds.includes(categoryId)) continue;
        const next = [
          ...new Set(budget.categoryIds.map((id) => (id === categoryId ? moveToCategoryId : id))),
        ];
        repos.budgets.update(budget.id, { categoryIds: next });
      }
    }
    // Children follow their parent, otherwise they would dangle under an archived category.
    for (const child of repos.categories.list()) {
      if (child.parentId === categoryId) repos.categories.update(child.id, { archivedAt: nowIso });
    }
    repos.categories.update(categoryId, { archivedAt: nowIso });
  });
}

export function restoreCategory(repos: Repositories, categoryId: string): Category {
  return repos.categories.update(categoryId, { archivedAt: null });
}

/** How many live transactions use a category, for the archive sheet's copy (§5.11). */
export function categoryUsage(db: RepositoryDatabase, categoryId: string): number {
  return db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.categoryId, categoryId))
    .all().length;
}

/**
 * Merges `sourceId` into `targetId` (§5.10): every transaction carrying the source gets the target
 * instead, de-duplicated, and the source is tombstoned.
 */
export function mergeTags(
  db: RepositoryDatabase,
  repos: Repositories,
  sourceId: string,
  targetId: string,
): void {
  if (sourceId === targetId) return;
  db.transaction(() => {
    for (const tx of repos.transactions.list()) {
      if (!tx.tagIds.includes(sourceId)) continue;
      const next = [...new Set(tx.tagIds.map((id) => (id === sourceId ? targetId : id)))];
      repos.transactions.update(tx.id, { tagIds: next });
    }
    repos.tags.remove(sourceId);
  });
}

/** Deletes a tag (§5.10): the id leaves every transaction, then the tag is tombstoned. */
export function deleteTag(db: RepositoryDatabase, repos: Repositories, tagId: string): void {
  db.transaction(() => {
    for (const tx of repos.transactions.list()) {
      if (!tx.tagIds.includes(tagId)) continue;
      repos.transactions.update(tx.id, { tagIds: tx.tagIds.filter((id) => id !== tagId) });
    }
    repos.tags.remove(tagId);
  });
}

export function renameTag(repos: Repositories, tagId: string, name: string): Tag {
  return repos.tags.rename(tagId, name);
}

/** Usage counts per tag id, for the admin list and the filter sheet ordering (§5.10). */
export function tagUsage(repos: Repositories): Map<string, number> {
  const usage = new Map<string, number>();
  for (const tx of repos.transactions.list()) {
    for (const id of tx.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

/** Archives an account; its transactions stay, as they still describe money that moved. */
export function archiveAccount(repos: Repositories, accountId: string, nowIso: string): void {
  repos.accounts.update(accountId, { archivedAt: nowIso });
}

export function restoreAccount(repos: Repositories, accountId: string): void {
  repos.accounts.update(accountId, { archivedAt: null });
}

/** Reorders siblings within one group (§5.11): only `sortOrder` changes. */
export function reorderCategories(
  db: RepositoryDatabase,
  repos: Repositories,
  orderedIds: readonly string[],
): void {
  db.transaction(() => {
    orderedIds.forEach((id, index) => {
      repos.categories.update(id, { sortOrder: index });
    });
  });
}
```

- [x] **Step 3: Run and commit**

```bash
pnpm --filter mobile test src/db/adminService
```

---

### Task 3: Screens

Spec §6.5, §6.7–§6.11, §6.13, §6.19, §6.20, §6.22, §6.24.

- [x] **Step 1: The sparkline**

```tsx
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

/** Month-end balances drawn as one line (§6.10). Negative values are handled by the scale. */
export function Sparkline({ series, height = 48 }: { series: readonly number[]; height?: number }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const min = Math.min(...series, 0);
  const max = Math.max(...series, 0);
  const span = max - min || 1;

  const points =
    series.length === 0 || width === 0
      ? ''
      : series
          .map((value, index) => {
            const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;
            const y = height - ((value - min) / span) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
    >
      {points === '' ? null : (
        <Svg width={width} height={height}>
          <Polyline points={points} fill="none" stroke={theme.palette.accent} strokeWidth={1.5} />
        </Svg>
      )}
    </View>
  );
}
```

- [x] **Step 2: Accounts tab (§6.5)**

```tsx
import { accountBalances, netWorth, spendableTotal } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { SectionLabel } from '../../src/components/SectionLabel';
import { restoreAccount } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** Account types that belong under "Risparmi e investimenti" (§6.5). */
const SAVINGS_TYPES = new Set(['savings', 'investment']);

export default function AccountsTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [archivedOpen, setArchivedOpen] = useState(false);

  // A balance covers the whole history, so the range is deliberately unbounded (§5.3).
  const rows = useTransactionsInRange('1970-01-01', today);
  const balances = useMemo(() => accountBalances(accounts, rows, today), [accounts, rows, today]);

  const live = accounts.filter((account) => account.archivedAt === null);
  const archived = accounts.filter((account) => account.archivedAt !== null);
  const spendable = live.filter(
    (account) => !SAVINGS_TYPES.has(account.type) && account.includeInSpendable,
  );
  const savings = live.filter((account) => SAVINGS_TYPES.has(account.type));
  const others = live.filter(
    (account) => !SAVINGS_TYPES.has(account.type) && !account.includeInSpendable,
  );

  const row = (account: (typeof accounts)[number]) => (
    <ListRow
      key={account.id}
      title={account.name}
      subtitle={account.institution ?? t(`accountTypes.${account.type}`)}
      leading={
        <IconBox name={account.icon as IconName} colour={theme.categoryColor(account.colorIndex)} />
      }
      onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
      trailing={
        <AmountText minor={balances.get(account.id) ?? 0} currency={currency} locale={locale} />
      }
    />
  );

  return (
    <Screen underTabBar>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('accounts.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          hitSlop={10}
          onPress={() => router.push('/settings')}
        >
          <IconBox name="settings" colour={theme.palette.textMuted} small />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('accounts.newAccount')}
          hitSlop={10}
          onPress={() => router.push('/account/new')}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.spendable')}
        </Text>
        <AmountText
          minor={spendableTotal(accounts, balances)}
          currency={currency}
          locale={locale}
          size="hero"
          weight="semibold"
          tracking="tightest"
        />
      </Card>

      {spendable.length + others.length === 0 ? null : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            {[...spendable, ...others].map(row)}
          </View>
        </Card>
      )}

      {savings.length === 0 ? null : (
        <>
          <SectionLabel>{t('accounts.savings')}</SectionLabel>
          <Card padded={false}>
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
              {savings.map(row)}
            </View>
          </Card>
        </>
      )}

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.netWorth')}
        </Text>
        <AmountText
          minor={netWorth(accounts, balances)}
          currency={currency}
          locale={locale}
          size="amountMd"
          weight="semibold"
          tracking="tighter"
        />
      </Card>

      {archived.length === 0 ? null : (
        <Card padded={false}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setArchivedOpen(!archivedOpen)}
            style={{ padding: theme.layout.cardPadding }}
          >
            <Text color="textMuted">
              {t('accounts.archived_other', { count: archived.length })}
            </Text>
          </Pressable>
          {archivedOpen ? (
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
              {archived.map((account) => (
                <ListRow
                  key={account.id}
                  title={account.name}
                  leading={
                    <IconBox name={account.icon as IconName} colour={theme.palette.textFaint} />
                  }
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => restoreAccount(repos, account.id)}
                    >
                      <Text size="footnote" color="accent">
                        {t('accounts.restore')}
                      </Text>
                    </Pressable>
                  }
                />
              ))}
            </View>
          ) : null}
        </Card>
      )}

      <Text size="caption" color="textFaint">
        {formatMoney(netWorth(accounts, balances), currency, locale)}
      </Text>
    </Screen>
  );
}
```

- [x] **Step 3: Account detail (§6.10)**

```tsx
import {
  accountBalances,
  creditCardDue,
  creditStatementAccrued,
  cycleContaining,
  deltaPercent,
  isWithin,
  monthEndBalances,
  nextCreditChargeDate,
  summarizePeriod,
} from '@saldo/core';
import { formatDayMonth, formatLongDate, formatMoney, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { PrimaryButton, SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { archiveAccount } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { Sparkline } from '../../src/features/accounts/Sparkline';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.10 shows eight months of balances. */
const SPARK_MONTHS = 8;
const RECENT = 6;

export default function AccountDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, cycleStartDay } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [confirmArchive, setConfirmArchive] = useState(false);

  const rows = useTransactionsInRange('1970-01-01', today);
  const account = accounts.find((candidate) => candidate.id === id);

  const balances = useMemo(() => accountBalances(accounts, rows, today), [accounts, rows, today]);
  const series = useMemo(
    () =>
      account === undefined
        ? []
        : monthEndBalances({
            accountId: account.id,
            openingBalance: account.openingBalance,
            txs: rows,
            today,
            months: SPARK_MONTHS,
          }),
    [account, rows, today],
  );

  const cycle = cycleContaining(today, cycleStartDay);
  const cycleRows = useMemo(
    () => rows.filter((tx) => tx.accountId === id && isWithin(cycle, tx.date)),
    [rows, id, cycle],
  );
  const cycleSummary = summarizePeriod(cycleRows, cycle, today);
  const recent = useMemo(
    () => rows.filter((tx) => tx.accountId === id || tx.toAccountId === id).slice(0, RECENT),
    [rows, id],
  );

  if (account === undefined) {
    return (
      <Screen>
        <Text color="textMuted">{t('accounts.empty')}</Text>
      </Screen>
    );
  }

  const balance = balances.get(account.id) ?? 0;
  const first = series[0] ?? 0;
  const delta = deltaPercent(balance, first === 0 ? null : first);

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton
            label={t('accounts.transferTo')}
            onPress={() => router.push('/transaction/new')}
          />
          <SecondaryButton
            label={t('common.edit')}
            onPress={() =>
              router.push({ pathname: '/account/edit/[id]', params: { id: account.id } })
            }
          />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBox name={account.icon as IconName} colour={theme.categoryColor(account.colorIndex)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="headline" weight="semibold" tracking="tight" numberOfLines={1}>
            {account.name}
          </Text>
          <Text size="caption" color="textMuted">
            {account.institution ?? t(`accountTypes.${account.type}`)}
          </Text>
        </View>
      </View>

      <Card>
        <Text size="footnote" color="textMuted">
          {account.type === 'credit_card' && balance < 0
            ? t('accounts.toRepay')
            : t('accounts.balance')}
        </Text>
        <AmountText
          minor={account.type === 'credit_card' && balance < 0 ? creditCardDue(balance) : balance}
          currency={currency}
          locale={locale}
          size="hero"
          weight="semibold"
          tracking="tightest"
        />
        <View style={{ marginTop: 12 }}>
          <Sparkline series={series} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text size="caption" color="textFaint">
            {t('accounts.monthsDelta')}
          </Text>
          <Text size="caption" color="textFaint">
            {delta === null ? '—' : formatSignedPercent(delta)}
          </Text>
        </View>
      </Card>

      {account.type === 'credit_card' && account.creditCloseDay !== null ? (
        <Card>
          <ListRow
            title={t('accounts.accruedInCycle')}
            trailing={
              <AmountText
                minor={creditStatementAccrued(account.id, account.creditCloseDay, rows, today)}
                currency={currency}
                locale={locale}
              />
            }
          />
          {account.creditChargeDay === null ? null : (
            <ListRow
              title={t('accounts.nextCharge')}
              trailing={
                <Text color="textMuted">
                  {formatLongDate(nextCreditChargeDate(account.creditChargeDay, today), locale)}
                </Text>
              }
            />
          )}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text size="caption" color="textMuted">
              {t('home.income')}
            </Text>
            <AmountText
              minor={cycleSummary.income}
              currency={currency}
              locale={locale}
              weight="medium"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text size="caption" color="textMuted">
              {t('home.expenses')}
            </Text>
            <AmountText
              minor={cycleSummary.spent}
              currency={currency}
              locale={locale}
              weight="medium"
            />
          </View>
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
          <Text weight="medium" tracking="tight">
            {t('accounts.lastTransactions')}
          </Text>
        </View>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
          {recent.length === 0 ? (
            <Text color="textMuted" style={{ paddingVertical: 12 }}>
              {t('transactions.empty')}
            </Text>
          ) : (
            recent.map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.description.length > 0 ? tx.description : t(`kinds.${tx.kind}`)}
                subtitle={formatDayMonth(tx.date, locale)}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                }
                trailing={
                  <AmountText
                    minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                    currency={currency}
                    locale={locale}
                  />
                }
              />
            ))
          )}
        </View>
      </Card>

      <SecondaryButton label={t('accounts.archive')} onPress={() => setConfirmArchive(true)} />
      <Text size="caption" color="textFaint">
        {formatMoney(balance, currency, locale)}
      </Text>

      <ConfirmDialog
        visible={confirmArchive}
        title={t('accounts.archive')}
        body={account.name}
        confirmLabel={t('common.archive')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          archiveAccount(repos, account.id, new Date().toISOString());
          setConfirmArchive(false);
          router.back();
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </Screen>
  );
}
```

- [x] **Step 4: Account form (§6.22) and its routes**

```tsx
import {
  type Account,
  amountBufferToMinor,
  minorToAmountBuffer,
  openingBalanceForCurrent,
} from '@saldo/core';
import { accountIconOptions, categoryColors, type IconName } from '@saldo/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

const TYPES = ['cash', 'checking', 'credit_card', 'savings', 'investment'] as const;

export interface AccountFormValues {
  name: string;
  institution: string;
  type: Account['type'];
  /** Keypad buffer of the **current** balance, not the opening one (§6.22). */
  buffer: string;
  includeInSpendable: boolean;
  colorIndex: number;
  icon: IconName;
  creditCloseDay: number | null;
  creditChargeDay: number | null;
}

export function emptyAccountForm(): AccountFormValues {
  return {
    name: '',
    institution: '',
    type: 'checking',
    buffer: '',
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
  };
}

export function accountFormFrom(
  account: Account,
  currentBalance: number,
  minorDigits: 0 | 2 | 3,
): AccountFormValues {
  return {
    name: account.name,
    institution: account.institution ?? '',
    type: account.type,
    buffer: minorToAmountBuffer(currentBalance, minorDigits),
    includeInSpendable: account.includeInSpendable,
    colorIndex: account.colorIndex,
    icon: account.icon as IconName,
    creditCloseDay: account.creditCloseDay,
    creditChargeDay: account.creditChargeDay,
  };
}

/**
 * The opening balance to store for what the user typed (§6.22). In edit mode the amount is the
 * *current* balance, so it has to be turned back into an opening balance.
 */
export function openingBalanceFrom(
  values: AccountFormValues,
  minorDigits: 0 | 2 | 3,
  context: {
    accountId: string | null;
    txs: Parameters<typeof openingBalanceForCurrent>[0]['txs'];
    today: string;
  },
): number {
  const current = amountBufferToMinor(values.buffer, minorDigits);
  if (context.accountId === null) return current;
  return openingBalanceForCurrent({
    accountId: context.accountId,
    currentBalance: current,
    txs: context.txs,
    today: context.today,
  });
}

export interface AccountFormProps {
  values: AccountFormValues;
  onChange: (values: AccountFormValues) => void;
  mode: 'new' | 'edit';
  onSubmit: () => void;
}

/** §6.22. */
export function AccountForm({ values, onChange, mode, onSubmit }: AccountFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const currency = settings?.currency ?? 'EUR';
  const set = (patch: Partial<AccountFormValues>) => onChange({ ...values, ...patch });
  const ready = values.name.trim().length > 0;

  return (
    <Screen
      footer={<PrimaryButton label={t('common.save')} disabled={!ready} onPress={onSubmit} />}
    >
      <Text size="headline" weight="semibold" tracking="tight">
        {mode === 'new' ? t('accounts.newAccount') : t('accounts.editAccount')}
      </Text>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.balance')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <AmountInput
            buffer={values.buffer}
            onChange={(buffer) => set({ buffer })}
            currency={currency}
            locale={locale}
            autoFocus={mode === 'new'}
            doneLabel={t('common.done')}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('accounts.name')}
            value={values.name}
            onChangeText={(name) => set({ name })}
          />
          <TextField
            label={t('accounts.institution')}
            value={values.institution}
            onChangeText={(institution) => set({ institution })}
          />
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('accounts.type')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TYPES.map((type) => {
                const selected = type === values.type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => set({ type })}
                    style={{
                      width: '31%',
                      height: 38,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: theme.radii.chipSmall,
                      backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                    }}
                  >
                    <Text size="caption" color={selected ? 'onAccent' : 'text'} numberOfLines={1}>
                      {t(`accountTypes.${type}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Card>

      {values.type === 'credit_card' ? (
        <Card>
          <View style={{ gap: 14 }}>
            <DayPicker
              label={t('accounts.creditCloseDay')}
              value={values.creditCloseDay}
              onChange={(creditCloseDay) => set({ creditCloseDay })}
            />
            <DayPicker
              label={t('accounts.creditChargeDay')}
              value={values.creditChargeDay}
              onChange={(creditChargeDay) => set({ creditChargeDay })}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <Text size="footnote" color="textMuted">
          {t('accounts.colour')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {categoryColors.map((colour, index) => (
            <Pressable
              key={colour}
              accessibilityRole="button"
              accessibilityState={{ selected: index === values.colorIndex }}
              accessibilityLabel={colour}
              onPress={() => set({ colorIndex: index })}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colour,
                borderWidth: index === values.colorIndex ? 2 : 0,
                borderColor: theme.palette.text,
              }}
            />
          ))}
        </View>

        <Text size="footnote" color="textMuted" style={{ marginTop: 14 }}>
          {t('accounts.icon')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {accountIconOptions.map((name) => {
            const selected = name === values.icon;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={name}
                onPress={() => set({ icon: name })}
                style={{
                  width: 38,
                  height: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: theme.radii.iconBox,
                  backgroundColor: selected
                    ? theme.tint(theme.categoryColor(values.colorIndex), 0.18)
                    : theme.palette.raised,
                }}
              >
                <Icon
                  name={name}
                  size={18}
                  color={
                    selected ? theme.categoryColor(values.colorIndex) : theme.palette.textMuted
                  }
                />
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ flex: 1 }}>{t('accounts.includeInSpendable')}</Text>
          <Toggle
            value={values.includeInSpendable}
            onChange={(includeInSpendable) => set({ includeInSpendable })}
            accessibilityLabel={t('accounts.includeInSpendable')}
          />
        </View>
        <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
          {t('accounts.includeNote')}
        </Text>
      </Card>
    </Screen>
  );
}

/** Credit-card days are 1–28 so every month has them (§4). */
function DayPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => {
          const selected = day === value;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={String(day)}
              onPress={() => onChange(day)}
              style={{
                width: 30,
                height: 30,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
              }}
            >
              <Text size="caption" tabular color={selected ? 'onAccent' : 'text'}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

```tsx
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings } from '../../src/db/hooks';
import {
  AccountForm,
  type AccountFormValues,
  emptyAccountForm,
} from '../../src/features/accounts/AccountForm';

export default function NewAccount() {
  const router = useRouter();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<AccountFormValues>(emptyAccountForm);

  return (
    <AccountForm
      values={values}
      onChange={setValues}
      mode="new"
      onSubmit={() => {
        repos.accounts.create({
          name: values.name.trim(),
          type: values.type,
          institution: values.institution.trim().length > 0 ? values.institution.trim() : null,
          // A new account has no transactions, so the typed balance *is* the opening balance.
          openingBalance: amountBufferToMinor(values.buffer, minorDigits),
          includeInSpendable: values.includeInSpendable,
          colorIndex: values.colorIndex,
          icon: values.icon,
          creditCloseDay: values.type === 'credit_card' ? values.creditCloseDay : null,
          creditChargeDay: values.type === 'credit_card' ? values.creditChargeDay : null,
          creditPaymentAccountId: null,
          archivedAt: null,
          sortOrder: accounts.length,
        });
        router.back();
      }}
    />
  );
}
```

```tsx
import {
  accountBalances,
  amountBufferToMinor,
  getCurrency,
  openingBalanceForCurrent,
} from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../src/components/Screen';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useAccounts, useSettings, useTransactionsInRange } from '../../../src/db/hooks';
import { AccountForm, accountFormFrom } from '../../../src/features/accounts/AccountForm';
import { usePeriod } from '../../../src/features/period/PeriodProvider';
import { Text } from '../../../src/theme/Text';

export default function EditAccount() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const rows = useTransactionsInRange('1970-01-01', today);

  const account = accounts.find((candidate) => candidate.id === id);
  const balance = useMemo(
    () =>
      account === undefined ? 0 : (accountBalances(accounts, rows, today).get(account.id) ?? 0),
    [account, accounts, rows, today],
  );
  const [values, setValues] = useState(() =>
    account === undefined ? null : accountFormFrom(account, balance, minorDigits),
  );

  if (account === undefined || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('accounts.empty')}</Text>
      </Screen>
    );
  }

  return (
    <AccountForm
      values={values}
      onChange={setValues}
      mode="edit"
      onSubmit={() => {
        repos.accounts.update(account.id, {
          name: values.name.trim(),
          type: values.type,
          institution: values.institution.trim().length > 0 ? values.institution.trim() : null,
          // The field edits the *current* balance (§6.22), so store the opening balance that
          // produces it.
          openingBalance: openingBalanceForCurrent({
            accountId: account.id,
            currentBalance: amountBufferToMinor(values.buffer, minorDigits),
            txs: rows,
            today,
          }),
          includeInSpendable: values.includeInSpendable,
          colorIndex: values.colorIndex,
          icon: values.icon,
          creditCloseDay: values.type === 'credit_card' ? values.creditCloseDay : null,
          creditChargeDay: values.type === 'credit_card' ? values.creditChargeDay : null,
        });
        router.back();
      }}
    />
  );
}
```

- [x] **Step 5: Categories admin (§6.9) and the archive sheet (§6.20)**

```tsx
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { SectionLabel } from '../../src/components/SectionLabel';
import { restoreCategory } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useCategories, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.9 / §5.11. Delete is deliberately not offered: archive, optionally moving the rows. */
export default function CategoriesAdmin() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const all = useCategories();
  const { today } = usePeriod();
  const rows = useTransactionsInRange('1970-01-01', today);
  const [showArchived, setShowArchived] = useState(false);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of rows) {
      if (tx.categoryId === null) continue;
      counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const archived = all.filter((category) => category.archivedAt !== null);
  const live = all.filter((category) => category.archivedAt === null);

  const section = (direction: 'expense' | 'income') => {
    const parents = live.filter(
      (category) => category.direction === direction && category.parentId === null,
    );
    return (
      <View key={direction}>
        <SectionLabel>
          {direction === 'expense' ? t('categories.expenses') : t('categories.income')}
        </SectionLabel>
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            {parents.flatMap((parent) => [
              <ListRow
                key={parent.id}
                title={parent.name}
                subtitle={t('categories.uses', { count: usage.get(parent.id) ?? 0 })}
                leading={
                  <IconBox
                    name={parent.icon as IconName}
                    colour={theme.categoryColor(parent.colorIndex)}
                  />
                }
                onPress={() =>
                  router.push({ pathname: '/category/edit/[id]', params: { id: parent.id } })
                }
                chevron
              />,
              ...live
                .filter((child) => child.parentId === parent.id)
                .map((child) => (
                  <View key={child.id} style={{ paddingLeft: 32 }}>
                    <ListRow
                      title={child.name}
                      subtitle={t('categories.uses', { count: usage.get(child.id) ?? 0 })}
                      leading={
                        <IconBox
                          name={child.icon as IconName}
                          colour={theme.categoryColor(child.colorIndex)}
                          small
                        />
                      }
                      onPress={() =>
                        router.push({ pathname: '/category/edit/[id]', params: { id: child.id } })
                      }
                      chevron
                    />
                  </View>
                )),
            ])}
          </View>
        </Card>
      </View>
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('categories.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('categories.newCategory')}
          hitSlop={10}
          onPress={() => router.push('/category/new')}
        >
          <IconBox name="plus" colour={theme.palette.textMuted} small />
        </Pressable>
      </View>

      {section('expense')}
      {section('income')}

      {archived.length === 0 ? null : (
        <Card padded={false}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowArchived(!showArchived)}
            style={{ padding: theme.layout.cardPadding }}
          >
            <Text color="textMuted">
              {`${t('categories.archivedSection')} · ${archived.length}`}
            </Text>
          </Pressable>
          {showArchived ? (
            <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
              {archived.map((category) => (
                <ListRow
                  key={category.id}
                  title={category.name}
                  leading={
                    <IconBox name={category.icon as IconName} colour={theme.palette.textFaint} />
                  }
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => restoreCategory(repos, category.id)}
                    >
                      <Text size="footnote" color="accent">
                        {t('accounts.restore')}
                      </Text>
                    </Pressable>
                  }
                />
              ))}
            </View>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
```

```tsx
import type { Category } from '@saldo/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { archiveCategory, categoryUsage } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { useCategories } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface ArchiveCategorySheetProps {
  visible: boolean;
  onClose: () => void;
  category: Category;
  onDone: () => void;
}

/**
 * §6.20 / §5.11. Deleting a category is not offered: a transaction without one could not satisfy
 * `transactionSchema`, so the choice is archive, optionally moving the rows to another category of
 * the same direction.
 */
export function ArchiveCategorySheet({
  visible,
  onClose,
  category,
  onDone,
}: ArchiveCategorySheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const categories = useCategories();
  const [target, setTarget] = useState<string | null>(null);

  const uses = useMemo(() => categoryUsage(db, category.id), [category.id]);
  const targets = categories.filter(
    (candidate) =>
      candidate.id !== category.id &&
      candidate.direction === category.direction &&
      candidate.archivedAt === null,
  );

  const archive = (moveTo: string | null) => {
    archiveCategory(db, repos, {
      categoryId: category.id,
      moveToCategoryId: moveTo,
      nowIso: new Date().toISOString(),
    });
    onDone();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('categories.archiveTitle')}>
      <Text color="textMuted">{t('categories.archiveBody', { count: uses })}</Text>

      {uses === 0 ? null : (
        <View style={{ gap: 8 }}>
          <Text size="footnote" color="textMuted">
            {t('categories.moveTo')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {targets.map((candidate) => {
              const selected = candidate.id === target;
              return (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setTarget(selected ? null : candidate.id)}
                  style={{
                    paddingHorizontal: 10,
                    height: 30,
                    justifyContent: 'center',
                    borderRadius: theme.radii.chipSmall,
                    backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                  }}
                >
                  <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
                    {candidate.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ gap: 8, marginTop: 6 }}>
        {target === null ? (
          <PrimaryButton label={t('categories.archive')} onPress={() => archive(null)} />
        ) : (
          <PrimaryButton label={t('categories.moveAndArchive')} onPress={() => archive(target)} />
        )}
        <SecondaryButton label={t('common.cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
```

- [x] **Step 6: Category form (§6.19) and its routes**

```tsx
import { type Category, minorToAmountBuffer } from '@saldo/core';
import { categoryColors, categoryIconGroups, ICON_NAMES, type IconName } from '@saldo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface CategoryFormValues {
  name: string;
  direction: Category['direction'];
  icon: IconName;
  colorIndex: number;
  parentId: string | null;
  /** §6.19: a single-category cycle budget, created or updated on save. */
  budgetEnabled: boolean;
  budgetBuffer: string;
}

export function emptyCategoryForm(): CategoryFormValues {
  return {
    name: '',
    direction: 'expense',
    icon: 'tag',
    colorIndex: 0,
    parentId: null,
    budgetEnabled: false,
    budgetBuffer: '',
  };
}

export function categoryFormFrom(
  category: Category,
  budgetAmount: number | null,
  minorDigits: 0 | 2 | 3,
): CategoryFormValues {
  return {
    name: category.name,
    direction: category.direction,
    icon: category.icon as IconName,
    colorIndex: category.colorIndex,
    parentId: category.parentId,
    budgetEnabled: budgetAmount !== null,
    budgetBuffer: budgetAmount === null ? '' : minorToAmountBuffer(budgetAmount, minorDigits),
  };
}

export interface CategoryFormProps {
  values: CategoryFormValues;
  onChange: (values: CategoryFormValues) => void;
  mode: 'new' | 'edit';
  /** Excluded from the parent picker, and used to hide it when the category has children. */
  editingCategoryId?: string;
  onSubmit: () => void;
  onArchive?: () => void;
}

/** §6.19. */
export function CategoryForm({
  values,
  onChange,
  mode,
  editingCategoryId,
  onSubmit,
  onArchive,
}: CategoryFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const currency = settings?.currency ?? 'EUR';
  const [iconQuery, setIconQuery] = useState('');
  const set = (patch: Partial<CategoryFormValues>) => onChange({ ...values, ...patch });

  // A child cannot have children (§4), so the parent picker disappears once one exists.
  const hasChildren = categories.some((category) => category.parentId === editingCategoryId);
  const parents = categories.filter(
    (category) =>
      category.parentId === null &&
      category.direction === values.direction &&
      category.archivedAt === null &&
      category.id !== editingCategoryId,
  );

  const searchResults = useMemo(() => {
    const query = iconQuery.trim().toLowerCase();
    if (query.length === 0) return null;
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(query));
  }, [iconQuery]);

  const colour = theme.categoryColor(values.colorIndex);
  const ready = values.name.trim().length > 0;

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton label={t('common.save')} disabled={!ready} onPress={onSubmit} />
          {onArchive === undefined ? null : (
            <SecondaryButton label={t('categories.archive')} onPress={onArchive} />
          )}
        </View>
      }
    >
      <Text size="headline" weight="semibold" tracking="tight">
        {mode === 'new' ? t('categories.newCategory') : t('categories.editCategory')}
      </Text>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBox name={values.icon} colour={colour} />
          <Text weight="medium" style={{ flex: 1 }} numberOfLines={1}>
            {values.name.length > 0 ? values.name : t('categories.name')}
          </Text>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('categories.name')}
            value={values.name}
            onChangeText={(name) => set({ name })}
            autoFocus={mode === 'new'}
          />
          {mode === 'new' ? (
            <Segmented
              accessibilityLabel={t('categories.title')}
              options={[
                { value: 'expense', label: t('categories.expenses') },
                { value: 'income', label: t('categories.income') },
              ]}
              value={values.direction}
              onChange={(direction) => set({ direction, parentId: null })}
            />
          ) : null}
        </View>
      </Card>

      <Card>
        <TextField
          label={t('categories.iconSearch')}
          value={iconQuery}
          onChangeText={setIconQuery}
        />
        {searchResults === null ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            {categoryIconGroups.map((group) => (
              <View key={group.key} style={{ gap: 6 }}>
                <Text size="caption" color="textFaint">
                  {t(`iconGroups.${group.key}`)}
                </Text>
                <IconGrid
                  names={group.icons}
                  selected={values.icon}
                  colour={colour}
                  onSelect={(icon) => set({ icon })}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <IconGrid
              names={searchResults}
              selected={values.icon}
              colour={colour}
              onSelect={(icon) => set({ icon })}
            />
          </View>
        )}
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('categories.colour')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {categoryColors.map((swatch, index) => (
            <Pressable
              key={swatch}
              accessibilityRole="button"
              accessibilityState={{ selected: index === values.colorIndex }}
              accessibilityLabel={swatch}
              onPress={() => set({ colorIndex: index })}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: swatch,
                borderWidth: index === values.colorIndex ? 2 : 0,
                borderColor: theme.palette.text,
              }}
            />
          ))}
        </View>
      </Card>

      {hasChildren ? null : (
        <Card>
          <Text size="footnote" color="textMuted">
            {t('categories.parent')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {[{ id: null, name: t('categories.noParent') }, ...parents].map((option) => {
              const selected = option.id === values.parentId;
              return (
                <Pressable
                  key={option.id ?? 'none'}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => set({ parentId: option.id })}
                  style={{
                    paddingHorizontal: 10,
                    height: 30,
                    justifyContent: 'center',
                    borderRadius: theme.radii.chipSmall,
                    backgroundColor: selected ? theme.palette.accent : theme.palette.raised,
                  }}
                >
                  <Text size="footnote" color={selected ? 'onAccent' : 'text'}>
                    {option.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      {values.direction === 'income' ? null : (
        <Card>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ flex: 1 }}>{t('categories.monthlyBudget')}</Text>
            <Toggle
              value={values.budgetEnabled}
              onChange={(budgetEnabled) => set({ budgetEnabled })}
              accessibilityLabel={t('categories.monthlyBudget')}
            />
          </View>
          {values.budgetEnabled ? (
            <View style={{ marginTop: 10 }}>
              <AmountInput
                buffer={values.budgetBuffer}
                onChange={(budgetBuffer) => set({ budgetBuffer })}
                currency={currency}
                locale={locale}
                doneLabel={t('common.done')}
              />
            </View>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

function IconGrid({
  names,
  selected,
  colour,
  onSelect,
}: {
  names: readonly IconName[];
  selected: IconName;
  colour: string;
  onSelect: (name: IconName) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {names.map((name) => {
        const isSelected = name === selected;
        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={name}
            onPress={() => onSelect(name)}
            style={{
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.iconBox,
              backgroundColor: isSelected ? theme.tint(colour, 0.18) : theme.palette.raised,
            }}
          >
            <Icon name={name} size={18} color={isSelected ? colour : theme.palette.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
```

```tsx
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useBudgets, useCategories, useSettings } from '../../src/db/hooks';
import {
  CategoryForm,
  type CategoryFormValues,
  emptyCategoryForm,
} from '../../src/features/categories/CategoryForm';

export default function NewCategory() {
  const router = useRouter();
  const repos = useRepositories();
  const settings = useSettings();
  const categories = useCategories();
  const budgets = useBudgets();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<CategoryFormValues>(emptyCategoryForm);

  return (
    <CategoryForm
      values={values}
      onChange={setValues}
      mode="new"
      onSubmit={() => {
        const created = repos.categories.create({
          name: values.name.trim(),
          direction: values.direction,
          parentId: values.parentId,
          icon: values.icon,
          colorIndex: values.colorIndex,
          archivedAt: null,
          sortOrder: categories.length,
        });
        const amount = amountBufferToMinor(values.budgetBuffer, minorDigits);
        // "Budget mensile" creates a single-category cycle budget (§5.11).
        if (values.budgetEnabled && amount > 0) {
          repos.budgets.create({
            name: created.name,
            categoryIds: [created.id],
            amount,
            period: 'cycle',
            alertThreshold: 90,
            rollover: false,
            icon: created.icon,
            sortOrder: budgets.length,
          });
        }
        router.back();
      }}
    />
  );
}
```

```tsx
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../src/components/Screen';
import { useRepositories } from '../../../src/db/DatabaseProvider';
import { useBudgets, useSettings } from '../../../src/db/hooks';
import { ArchiveCategorySheet } from '../../../src/features/categories/ArchiveCategorySheet';
import { CategoryForm, categoryFormFrom } from '../../../src/features/categories/CategoryForm';
import { Text } from '../../../src/theme/Text';

export default function EditCategory() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const budgets = useBudgets();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [category] = useState(() => (id === undefined ? null : repos.categories.byId(id)));
  const ownBudget =
    category === null
      ? null
      : (budgets.find(
          (budget) => budget.categoryIds.length === 1 && budget.categoryIds[0] === category.id,
        ) ?? null);
  const [values, setValues] = useState(() =>
    category === null ? null : categoryFormFrom(category, ownBudget?.amount ?? null, minorDigits),
  );

  if (category === null || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('categories.empty')}</Text>
      </Screen>
    );
  }

  return (
    <>
      <CategoryForm
        values={values}
        onChange={setValues}
        mode="edit"
        editingCategoryId={category.id}
        onArchive={() => setArchiveOpen(true)}
        onSubmit={() => {
          repos.categories.update(category.id, {
            name: values.name.trim(),
            parentId: values.parentId,
            icon: values.icon,
            colorIndex: values.colorIndex,
          });
          const amount = amountBufferToMinor(values.budgetBuffer, minorDigits);
          if (values.budgetEnabled && amount > 0) {
            if (ownBudget === null) {
              repos.budgets.create({
                name: values.name.trim(),
                categoryIds: [category.id],
                amount,
                period: 'cycle',
                alertThreshold: 90,
                rollover: false,
                icon: values.icon,
                sortOrder: budgets.length,
              });
            } else {
              repos.budgets.update(ownBudget.id, { amount });
            }
          } else if (ownBudget !== null) {
            repos.budgets.remove(ownBudget.id);
          }
          router.back();
        }}
      />
      <ArchiveCategorySheet
        visible={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        category={category}
        onDone={() => {
          setArchiveOpen(false);
          router.back();
        }}
      />
    </>
  );
}
```

- [x] **Step 7: Tags admin (§6.13), tag view (§6.11), tag edit (§6.24)**

```tsx
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { tagUsage } from '../../src/db/adminService';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useTags } from '../../src/db/hooks';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.13 / §5.10. */
export default function TagsAdmin() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const usage = useMemo(() => tagUsage(repos), [repos]);

  return (
    <Screen>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('tags.title')}
      </Text>
      <Text color="textMuted">{t('tags.footnote')}</Text>

      {tags.length === 0 ? (
        <Card>
          <Text color="textMuted">{t('tags.empty')}</Text>
        </Card>
      ) : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            {tags.map((tag) => (
              <ListRow
                key={tag.id}
                title={tag.name}
                subtitle={t('tags.uses', { count: usage.get(tag.id) ?? 0 })}
                onPress={() => router.push({ pathname: '/tag/[id]', params: { id: tag.id } })}
                chevron
              />
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}
```

```tsx
import { rollupToParents, spendingByCategory } from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { useCategories, useSettings, useTags, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SplitBar } from '../../src/features/stats/SplitBar';
import { TagEditSheet } from '../../src/features/tags/TagEditSheet';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.11 / §5.10. A tag spans every date, so the period selector does not apply here. */
export default function TagView() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const tags = useTags();
  const categories = useCategories();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [editOpen, setEditOpen] = useState(false);

  const rows = useTransactionsInRange('1970-01-01', today);
  const tag = tags.find((candidate) => candidate.id === id);

  const tagged = useMemo(
    () =>
      rows
        .filter((tx) => id !== undefined && tx.tagIds.includes(id))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows, id],
  );

  const split = useMemo(() => {
    if (tagged.length === 0) return [];
    const range = {
      start: tagged[0]?.date ?? today,
      end: tagged[tagged.length - 1]?.date ?? today,
    };
    const amounts = rollupToParents(spendingByCategory(tagged, range, today), categories);
    return [...amounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([categoryId, amount]) => {
        const category = categories.find((candidate) => candidate.id === categoryId);
        return {
          id: categoryId,
          amount,
          name: category?.name ?? '—',
          icon: (category?.icon ?? 'tag') as IconName,
          colour: theme.categoryColor(category?.colorIndex ?? 9),
        };
      });
  }, [tagged, categories, today, theme]);

  if (tag === undefined) {
    return (
      <Screen>
        <Text color="textMuted">{t('tags.empty')}</Text>
      </Screen>
    );
  }

  const total = tagged
    .filter((tx) => tx.kind === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <Screen
      footer={<SecondaryButton label={t('tags.editTag')} onPress={() => setEditOpen(true)} />}
    >
      <Text size="headline" weight="semibold" tracking="tight">
        {tag.name}
      </Text>
      <Text size="footnote" color="textMuted">
        {t('tags.total')}
      </Text>
      <AmountText
        minor={total}
        currency={currency}
        locale={locale}
        size="hero"
        weight="semibold"
        tracking="tightest"
      />
      {tagged.length === 0 ? null : (
        <Text color="textMuted">
          {t('tags.range', {
            count: tagged.length,
            first: formatDayMonth(tagged[0]?.date ?? today, locale),
            last: formatDayMonth(tagged[tagged.length - 1]?.date ?? today, locale),
          })}
        </Text>
      )}

      {split.length === 0 ? null : (
        <Card>
          <SplitBar
            segments={split.map((row) => ({ key: row.id, amount: row.amount, colour: row.colour }))}
          />
          <View style={{ marginTop: 6 }}>
            {split.map((row) => (
              <ListRow
                key={row.id}
                title={row.name}
                leading={<IconBox name={row.icon} colour={row.colour} />}
                trailing={<AmountText minor={row.amount} currency={currency} locale={locale} />}
              />
            ))}
          </View>
        </Card>
      )}

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {tagged.map((tx) => (
            <ListRow
              key={tx.id}
              title={tx.description.length > 0 ? tx.description : t(`kinds.${tx.kind}`)}
              subtitle={formatDayMonth(tx.date, locale)}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })}
              trailing={
                <AmountText
                  minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                  currency={currency}
                  locale={locale}
                />
              }
            />
          ))}
        </View>
      </Card>

      <Text size="caption" color="textFaint">
        {formatMoney(total, currency, locale)}
      </Text>

      <TagEditSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        tag={tag}
        onDeleted={() => {
          setEditOpen(false);
          router.back();
        }}
      />
    </Screen>
  );
}
```

```tsx
import type { Tag } from '@saldo/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/TextField';
import { deleteTag, mergeTags, renameTag } from '../../db/adminService';
import { db } from '../../db/client';
import { useRepositories } from '../../db/DatabaseProvider';
import { useTags } from '../../db/hooks';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface TagEditSheetProps {
  visible: boolean;
  onClose: () => void;
  tag: Tag;
  onDeleted: () => void;
}

/** §6.24 / §5.10: rename, merge into another tag, or delete while keeping the transactions. */
export function TagEditSheet({ visible, onClose, tag, onDeleted }: TagEditSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const repos = useRepositories();
  const tags = useTags();
  const [name, setName] = useState(tag.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const others = tags.filter((candidate) => candidate.id !== tag.id);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('tags.editTag')}>
      <TextField label={t('tags.name')} value={name} onChangeText={setName} />

      {others.length === 0 ? null : (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text size="footnote" color="textMuted">
            {t('tags.mergeInto')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {others.map((other) => (
              <Pressable
                key={other.id}
                accessibilityRole="button"
                onPress={() => {
                  mergeTags(db, repos, tag.id, other.id);
                  onDeleted();
                }}
                style={{
                  paddingHorizontal: 10,
                  height: 30,
                  justifyContent: 'center',
                  borderRadius: theme.radii.chipSmall,
                  backgroundColor: theme.palette.raised,
                }}
              >
                <Text size="footnote">{other.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 8, marginTop: 6 }}>
        <PrimaryButton
          label={t('common.save')}
          disabled={name.trim().length === 0}
          onPress={() => {
            renameTag(repos, tag.id, name.trim());
            onClose();
          }}
        />
        <SecondaryButton label={t('tags.delete')} onPress={() => setConfirmDelete(true)} />
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('tags.deleteConfirm', { name: tag.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          deleteTag(db, repos, tag.id);
          setConfirmDelete(false);
          onDeleted();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  );
}
```

- [x] **Step 8: Settings (§6.7) and Profile (§6.8)**

```tsx
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { useCategories, useSettings, useTags } from '../../src/db/hooks';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.7. */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const settings = useSettings();
  const categories = useCategories();
  const tags = useTags();

  return (
    <Screen>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('settings.title')}
      </Text>
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('settings.categories')}
            trailing={<Text color="textMuted">{String(categories.length)}</Text>}
            onPress={() => router.push('/settings/categories')}
            chevron
          />
          <ListRow
            title={t('settings.tags')}
            trailing={<Text color="textMuted">{String(tags.length)}</Text>}
            onPress={() => router.push('/settings/tags')}
            chevron
          />
          <ListRow
            title={t('settings.cycle')}
            trailing={
              <Text color="textMuted">
                {t('settings.cycleValue', { day: settings?.cycleStartDay ?? 27 })}
              </Text>
            }
            onPress={() => router.push('/profile')}
            chevron
          />
          <ListRow
            title={t('settings.currency')}
            trailing={<Text color="textMuted">{settings?.currency ?? 'EUR'}</Text>}
            onPress={() => router.push('/profile')}
            chevron
          />
          <ListRow
            title={t('settings.newAccount')}
            onPress={() => router.push('/account/new')}
            chevron
          />
          <ListRow
            title={t('settings.reviewOnboarding')}
            onPress={() => router.push('/cycle-day')}
            chevron
          />
        </View>
      </Card>
    </Screen>
  );
}
```

```tsx
import { COMMON_CURRENCY_CODES, type CurrencyCode, getCurrency } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../src/components/Card';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { ListRow } from '../src/components/ListRow';
import { Screen } from '../src/components/Screen';
import { Sheet } from '../src/components/Sheet';
import { useToast } from '../src/components/Toast';
import { Toggle } from '../src/components/Toggle';
import { db } from '../src/db/client';
import { useDatabase } from '../src/db/DatabaseProvider';
import { seedDemoData } from '../src/db/demo';
import { useAccounts, useSettings } from '../src/db/hooks';
import { runMaterialiser } from '../src/db/recurrenceService';
import { usePeriod } from '../src/features/period/PeriodProvider';
import { useAppLocale } from '../src/i18n/useAppLocale';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

type SheetKind = 'language' | 'theme' | 'currency' | 'cycle' | null;

/** §6.8. The server row lands in phase 07; import/export in phase 08. */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { repos, kv } = useDatabase();
  const toast = useToast();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, cycleStartDay } = usePeriod();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [pendingCurrency, setPendingCurrency] = useState<CurrencyCode | null>(null);
  const [lockEnabled, setLockEnabled] = useState(kv.get('appLockEnabled') === 'true');

  const currency = settings?.currency ?? 'EUR';
  const archived = accounts.filter((account) => account.archivedAt !== null).length;

  const languageLabel = {
    system: t('profile.system'),
    it: t('profile.italian'),
    en: t('profile.english'),
  }[settings?.language ?? 'system'];
  const themeLabel = {
    system: t('profile.system'),
    dark: t('profile.dark'),
    light: t('profile.light'),
  }[settings?.theme ?? 'system'];

  const soon = (
    <Text size="footnote" color="textFaint">
      {t('profile.soon')}
    </Text>
  );

  return (
    <Screen>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('profile.title')}
      </Text>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('profile.cycleStart')}
            trailing={
              <Text color="textMuted">
                {t('settings.cycleValue', { day: settings?.cycleStartDay ?? 27 })}
              </Text>
            }
            onPress={() => setSheet('cycle')}
            chevron
          />
          <ListRow
            title={t('profile.currency')}
            trailing={<Text color="textMuted">{currency}</Text>}
            onPress={() => setSheet('currency')}
            chevron
          />
          <ListRow
            title={t('profile.language')}
            trailing={<Text color="textMuted">{languageLabel}</Text>}
            onPress={() => setSheet('language')}
            chevron
          />
          <ListRow
            title={t('profile.theme')}
            trailing={<Text color="textMuted">{themeLabel}</Text>}
            onPress={() => setSheet('theme')}
            chevron
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('settings.categories')}
            onPress={() => router.push('/settings/categories')}
            chevron
          />
          <ListRow
            title={t('settings.tags')}
            onPress={() => router.push('/settings/tags')}
            chevron
          />
          <ListRow
            title={t('profile.archivedAccounts')}
            trailing={<Text color="textMuted">{String(archived)}</Text>}
            onPress={() => router.push('/(tabs)/accounts')}
            chevron
          />
        </View>
      </Card>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow title={t('profile.importCsv')} trailing={soon} />
          <ListRow title={t('profile.exportData')} trailing={soon} />
          <ListRow title={t('profile.restoreBackup')} trailing={soon} />
          <ListRow
            title={t('profile.appLock')}
            trailing={
              <Toggle
                value={lockEnabled}
                onChange={(next) => {
                  setLockEnabled(next);
                  kv.set('appLockEnabled', next ? 'true' : 'false');
                }}
                accessibilityLabel={t('profile.appLock')}
              />
            }
          />
        </View>
      </Card>

      {__DEV__ ? (
        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
            <ListRow
              title={t('dev.loadDemo')}
              onPress={() => {
                seedDemoData(repos, { today, cycleStartDay, translate: (key) => t(`seed.${key}`) });
                runMaterialiser(db, repos, today, cycleStartDay);
                toast.show(t('dev.demoLoaded'));
              }}
            />
          </View>
        </Card>
      ) : null}

      <Text size="caption" color="textFaint">
        {t('profile.version', { version: Application.nativeApplicationVersion ?? '0.1.0' })}
      </Text>

      <Sheet
        visible={sheet === 'language'}
        onClose={() => setSheet(null)}
        title={t('profile.language')}
      >
        {(['system', 'it', 'en'] as const).map((value) => (
          <ListRow
            key={value}
            title={
              { system: t('profile.system'), it: t('profile.italian'), en: t('profile.english') }[
                value
              ]
            }
            onPress={() => {
              repos.settings.update({ language: value });
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'theme'} onClose={() => setSheet(null)} title={t('profile.theme')}>
        {(['system', 'dark', 'light'] as const).map((value) => (
          <ListRow
            key={value}
            title={
              { system: t('profile.system'), dark: t('profile.dark'), light: t('profile.light') }[
                value
              ]
            }
            onPress={() => {
              repos.settings.update({ theme: value });
              setSheet(null);
            }}
          />
        ))}
      </Sheet>

      <Sheet
        visible={sheet === 'currency'}
        onClose={() => setSheet(null)}
        title={t('profile.currency')}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {COMMON_CURRENCY_CODES.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected: code === currency }}
              onPress={() => {
                setSheet(null);
                if (code !== currency) setPendingCurrency(code);
              }}
              style={{
                paddingHorizontal: 12,
                height: 34,
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor: code === currency ? theme.palette.accent : theme.palette.raised,
              }}
            >
              <Text size="footnote" color={code === currency ? 'onAccent' : 'text'}>
                {code}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={sheet === 'cycle'}
        onClose={() => setSheet(null)}
        title={t('profile.cycleStart')}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={String(day)}
              onPress={() => {
                repos.settings.update({ cycleStartDay: day });
                setSheet(null);
              }}
              style={{
                width: 40,
                height: 34,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radii.chipSmall,
                backgroundColor:
                  day === settings?.cycleStartDay ? theme.palette.accent : theme.palette.raised,
              }}
            >
              <Text
                size="footnote"
                tabular
                color={day === settings?.cycleStartDay ? 'onAccent' : 'text'}
              >
                {day}
              </Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <ConfirmDialog
        visible={pendingCurrency !== null}
        title={t('profile.currencyConfirmTitle')}
        body={
          pendingCurrency === null
            ? undefined
            : getCurrency(pendingCurrency).minorDigits === getCurrency(currency).minorDigits
              ? t('profile.currencyConfirmBody')
              : // §5.1: a different scale moves the decimal point, so the copy says so with the
                // user's own number rather than a generic sentence.
                t('profile.currencyConfirmScale', {
                  before: formatMoney(184260, currency, locale),
                  after: formatMoney(184260, pendingCurrency, locale),
                })
        }
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (pendingCurrency !== null) repos.settings.update({ currency: pendingCurrency });
          setPendingCurrency(null);
        }}
        onCancel={() => setPendingCurrency(null)}
      />
    </Screen>
  );
}
```

The currency confirm spells out a scale change with the user's own number rather than a generic
sentence, because §5.1 keeps the stored integers and the decimal point therefore moves.

---

### Task 4: Verify

- [x] **Step 1: Regenerate the route types before typechecking**

Expo Router's typed routes come from `.expo/types`, written by the dev server. After adding route
files, `tsc` still rejects the new paths until the server has run once:

```bash
pnpm --filter mobile exec expo start   # wait for .expo/types/router.d.ts, then stop it
rtk proxy pnpm --filter mobile exec tsc --noEmit
```

- [x] **Step 2: The pipeline, through `rtk proxy`**

```bash
rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm test
```

Expected: clean, 109 mobile tests.

- [x] **Step 3: Look at it**

Verified: Home now shows the budget card ("2 over pace", three bars with the pace tick, correct at
day 15 of 31 where the pace is 48%).

**A bug this found:** `HomeBudgetCard` had been written but never rendered — an earlier edit added
its imports while the JSX insertion silently missed its target string. The tests do not render
Home, so only looking caught it.

**Not seen on screen:** the accounts tab, the admin screens and the forms. They need taps, and
`simctl` has no tap command. They rest on `adminService` and the core functions, which are tested.

- [ ] **Step 4: Android**

Not verified: no Android SDK on this machine.

---
