# Period recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the first open of a new period the app shows, once, a full-screen «Resoconto» sheet recapping the period
that just closed, and a 09:00 notification announces it that morning (spec §5.15, §6.39, D27).

**Architecture:** One pure function in `@saldo/core` (`periodRecap`, plus `recapPeriod` to know which period closed)
computes every figure from the ledger; nothing is stored. The mobile side has three pieces in
`apps/mobile/src/features/recap/`: pure scheduling helpers (`recapSchedule.ts`: the kv stamp, the «is it due» rule, the
notification id and time), a presentational sheet (`PeriodRecapSheet.tsx`, with its own bar `RecapBar.tsx`), and a gate
mounted in the tabs layout (`PeriodRecapGate.tsx`) that decides, loads the data, marks the period in `kv` and keeps the
next notification scheduled.

**Tech Stack:** TypeScript strict, Vitest (`@saldo/core`, `@saldo/i18n`), Jest (`db` project for pure `.test.ts`, `app`
project with jest-expo + React Native Testing Library for `.test.tsx`), Reanimated 4, `expo-notifications`.

**Design reference:** `.variants/period-recap.html` (not committed; serve it with
`python3 -m http.server 4711 --bind 127.0.0.1` from the repository root and open
`http://127.0.0.1:4711/.variants/period-recap.html`). Buttons «Mese in attivo» / «Mese in perdita» switch the data.

**Decisions taken while planning (spec was silent; §5.15 and §6.39 were updated in the same commit as this plan):**
- **No recap for a user who set Saldo up during the current period** (`onboardingCompletedAt` on or after its start):
  otherwise an imported history greets a brand-new user with a recap of a period they never lived in the app.
- **Budgets created after the closed period** are left out of it.
- **A weekly, monthly or yearly budget** appears when its **own calendar range** (unclipped ISO week, calendar month,
  calendar year around the period's last day) ends on that day, and is measured over that range. `budgetRange` is not
  used: it clips a closed period's week to the period, which would put every weekly budget in every monthly recap.
- **The biggest expense stays readable in hidden mode** (`AmountText plain`): it is one transaction, like a list row.
- **Patrimonio shows only its change** over the period, not the absolute figure.
- **The mover tag is chosen among the five categories shown**: a tag on a category that is not listed cannot be seen.
- **The kv stamp is written as soon as the recap is decided**, before the sheet is dismissed; an empty period is
  stamped too, so the ledger is not read again on every launch to find it still empty.
- **The notification never asks for permission.** It reads the permission and schedules only when granted; the
  onboarding step and the budget alerts are where the prompt lives (§6.29).
- **Exit timing:** the sheet leaves in `motion.fadeMs` (200 ms), under the 300 ms it takes to arrive
  (`motion.tallSheetMs`), with `SWAP_EASE`. `onClose` runs from a timer, not from the animation callback, so tests can
  drive it with fake timers.

**Branch:** `feat/period-recap`, from `main`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/recap.ts` | Create: `recapPeriod`, `periodRecap` and their types. |
| `packages/core/src/recap.test.ts` | Create: every rule of §5.15's content table. |
| `packages/core/src/index.ts` | Modify: export `./recap`. |
| `packages/i18n/src/locales/{it,en,de,es,fr,pt,sv}.ts` | Modify: the `recap` namespace. |
| `apps/mobile/src/features/recap/recapSchedule.ts` | Create: kv stamp, due rule, notification id and time. |
| `apps/mobile/src/features/recap/recapSchedule.test.ts` | Create: runs in the `db` (node) Jest project. |
| `apps/mobile/src/features/recap/RecapBar.tsx` | Create: a bar that grows once when told it is in view. |
| `apps/mobile/src/features/recap/PeriodRecapSheet.tsx` | Create: the §6.39 sheet. |
| `apps/mobile/src/features/recap/PeriodRecapSheet.test.tsx` | Create: content, hidden mode, dismissal. |
| `apps/mobile/src/features/recap/PeriodRecapGate.tsx` | Create: decides, loads, marks, schedules. |
| `apps/mobile/app/(tabs)/_layout.tsx` | Modify: mount `PeriodRecapGate`. |
| `ROADMAP.md` | Modify: tick «Plan, then build». |

---

## Task 0: Branch

- [x] **Step 1: Create the branch**

```bash
git switch -c feat/period-recap
```

---

## Task 1: `recapPeriod` — which period just closed

**Files:**
- Create: `packages/core/src/recap.ts`
- Create: `packages/core/src/recap.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: Write the failing test**

`packages/core/src/recap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PeriodDef } from './period';
import { recapPeriod } from './recap';

describe('recapPeriod', () => {
  it('is the period before the one containing today, for every kind', () => {
    const month: PeriodDef = { kind: 'month', startDay: 1 };
    const week: PeriodDef = { kind: 'week', startDay: 1 };
    const cycle: PeriodDef = { kind: 'cycle', startDay: 27 };
    const year: PeriodDef = { kind: 'year', startDay: 1 };
    expect(recapPeriod(month, '2026-10-01')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(recapPeriod(month, '2026-10-19')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(recapPeriod(week, '2026-10-05')).toEqual({ start: '2026-09-28', end: '2026-10-04' });
    expect(recapPeriod(cycle, '2026-04-27')).toEqual({ start: '2026-03-27', end: '2026-04-26' });
    expect(recapPeriod(year, '2027-01-01')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});
```

- [x] **Step 2: Run it to see it fail**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: FAIL, `Failed to resolve import "./recap"`.

- [x] **Step 3: Write the minimal implementation**

`packages/core/src/recap.ts`:

```ts
import type { DateRange } from './cycle';
import type { LocalDate } from './dates';
import { type PeriodDef, periodContaining, shiftPeriod } from './period';

/**
 * The period a recap is about (§5.15): the one immediately before the period containing today,
 * under the kind in force. Only that one — after weeks away there is still a single recap.
 */
export function recapPeriod(def: PeriodDef, today: LocalDate): DateRange {
  return shiftPeriod(def, periodContaining(def, today), -1);
}
```

In `packages/core/src/index.ts`, add `export * from './recap';` on the line **before** `export * from './recents';`.

- [x] **Step 4: Run it to see it pass**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: PASS, 1 test.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/recap.ts packages/core/src/recap.test.ts packages/core/src/index.ts
git commit -m "feat(core): the period a recap is about"
```

---

## Task 2: `periodRecap` — net, comparisons, income and expenses

**Files:**
- Modify: `packages/core/src/recap.ts`
- Modify: `packages/core/src/recap.test.ts`

- [x] **Step 1: Write the failing tests**

Replace the imports at the top of `packages/core/src/recap.test.ts` and add the fixtures and the new `describe`:

```ts
import { describe, expect, it } from 'vitest';
import { ACCOUNTS, CATEGORIES, tx } from './__tests__/fixtures';
import type { CategoryRef, LedgerTx } from './ledger';
import type { PeriodDef } from './period';
import { type PeriodRecap, type PeriodRecapInput, periodRecap, recapPeriod } from './recap';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };
const OCTOBER_FIRST = '2026-10-01';
const CATS: CategoryRef[] = [
  ...CATEGORIES,
  { id: 'cat-fun', parentId: null },
  { id: 'cat-gifts', parentId: null },
  { id: 'cat-pets', parentId: null },
];

function salary(date: string, amount: number): LedgerTx {
  return tx({ date, amount, kind: 'income', categoryId: 'cat-salary', accountId: 'acc-checking' });
}

/** July and August as history, September as the closed period. Expenses on the card. */
function ledger(): LedgerTx[] {
  return [
    salary('2026-07-27', 230000),
    tx({ date: '2026-07-01', amount: 72000, categoryId: 'cat-rent' }),
    tx({ date: '2026-07-10', amount: 41000 }),
    salary('2026-08-27', 230000),
    tx({ date: '2026-08-01', amount: 72000, categoryId: 'cat-rent' }),
    tx({ date: '2026-08-10', amount: 40000 }),
    salary('2026-09-27', 245000),
    tx({ date: '2026-09-01', amount: 72000, categoryId: 'cat-rent' }),
    tx({ date: '2026-09-10', amount: 38620 }),
    tx({ date: '2026-09-15', amount: 16200, categoryId: 'cat-transport' }),
  ];
}

function recap(overrides: Partial<PeriodRecapInput> = {}): PeriodRecap {
  const result = periodRecap({
    def: MONTH,
    period: SEPTEMBER,
    today: OCTOBER_FIRST,
    transactions: ledger(),
    categories: CATS,
    budgets: [],
    accounts: ACCOUNTS,
    ...overrides,
  });
  if (result === null) throw new Error('expected a recap');
  return result;
}

describe('periodRecap: totals', () => {
  it('has nothing to say about a period without transactions', () => {
    const withoutSeptember = ledger().filter((row) => !row.date.startsWith('2026-09'));
    expect(
      periodRecap({
        def: MONTH,
        period: SEPTEMBER,
        today: OCTOBER_FIRST,
        transactions: withoutSeptember,
        categories: CATS,
        budgets: [],
        accounts: ACCOUNTS,
      }),
    ).toBeNull();
  });

  it('computes the net and compares it with the period before and the usual median', () => {
    expect(recap()).toMatchObject({
      period: SEPTEMBER,
      income: 245000,
      spent: 126820,
      net: 118180,
      previousNet: 118000,
      // Median of August (118000) and July (117000), the two used periods of the window (§5.5).
      usualNet: 117500,
      incomeDelta: 7,
      spentDelta: 13,
    });
  });

  it('leaves the comparisons out when nothing came before', () => {
    const onlySeptember = ledger().filter((row) => row.date.startsWith('2026-09'));
    expect(recap({ transactions: onlySeptember })).toMatchObject({
      net: 118180,
      previousNet: null,
      usualNet: null,
      incomeDelta: null,
      spentDelta: null,
    });
  });
});
```

- [x] **Step 2: Run them to see them fail**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: FAIL, `periodRecap` is not exported.

- [x] **Step 3: Write the implementation**

Replace `packages/core/src/recap.ts` with:

```ts
import type { AccountRef } from './accounts';
import { type DateRange, isWithin } from './cycle';
import type { LocalDate } from './dates';
import type { Budget } from './entities';
import { periodHistory } from './history';
import { type CategoryRef, type LedgerTx, summarizePeriod } from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, periodContaining, shiftPeriod } from './period';
import { deltaPercent, median } from './stats';

/** The budget fields a recap reads. */
export type RecapBudgetRef = Pick<
  Budget,
  'id' | 'name' | 'categoryIds' | 'amount' | 'period' | 'rollover' | 'createdAt'
>;

export interface PeriodRecapInput {
  def: PeriodDef;
  /** The closed period, from {@link recapPeriod}. */
  period: DateRange;
  today: LocalDate;
  /**
   * Every live row dated up to `period.end`. The history window, the rollover chain and the
   * balances all read further back than the period itself.
   */
  transactions: readonly LedgerTx[];
  categories: readonly CategoryRef[];
  budgets: readonly RecapBudgetRef[];
  accounts: readonly AccountRef[];
}

export interface RecapCategory {
  /** Parent-level category id. */
  categoryId: string;
  amount: MinorUnits;
  /** % above the category's own median (§5.5), on the one category that moved most; else null. */
  aboveUsual: number | null;
}

export interface RecapBudgetLine {
  budgetId: string;
  name: string;
  spent: MinorUnits;
  /** The limit the period measured against, carry included (§5.8). */
  limit: MinorUnits;
  over: boolean;
  /** What rolls into the next period; 0 without rollover. */
  carry: MinorUnits;
}

export interface RecapExpense {
  transactionId: string;
  description: string;
  categoryId: string | null;
  date: LocalDate;
  amount: MinorUnits;
}

export interface PeriodRecap {
  period: DateRange;
  income: MinorUnits;
  spent: MinorUnits;
  net: MinorUnits;
  /** Net of the period before; null when it has no transaction. */
  previousNet: MinorUnits | null;
  /** Median net over the §5.5 window; null without history. */
  usualNet: MinorUnits | null;
  incomeDelta: number | null;
  spentDelta: number | null;
  categories: RecapCategory[];
  otherCategories: { count: number; amount: MinorUnits };
  budgets: RecapBudgetLine[];
  biggestExpense: RecapExpense | null;
  netWorthChange: MinorUnits;
}

/**
 * The period a recap is about (§5.15): the one immediately before the period containing today,
 * under the kind in force. Only that one — after weeks away there is still a single recap.
 */
export function recapPeriod(def: PeriodDef, today: LocalDate): DateRange {
  return shiftPeriod(def, periodContaining(def, today), -1);
}

/**
 * Everything the recap sheet shows (§5.15), computed from the ledger and never stored: a row
 * entered late for the closed period changes the recap as it changes the stats. Null when the
 * period has no transaction at all — the same emptiness rule as the history window.
 */
export function periodRecap(input: PeriodRecapInput): PeriodRecap | null {
  const { def, period, today, transactions } = input;
  const inPeriod = transactions.filter((row) => isWithin(period, row.date));
  if (inPeriod.length === 0) return null;

  const summary = summarizePeriod(inPeriod, period, today);
  const previous = shiftPeriod(def, period, -1);
  const inPrevious = transactions.filter((row) => isWithin(previous, row.date));
  const before = inPrevious.length === 0 ? null : summarizePeriod(inPrevious, previous, today);

  const history = periodHistory(transactions, def, period);
  const usual = median(
    history.map((entry) => {
      const past = summarizePeriod(entry.txs, entry.period, today);
      return past.income - past.spent;
    }),
  );

  return {
    period,
    income: summary.income,
    spent: summary.spent,
    net: summary.income - summary.spent,
    previousNet: before === null ? null : before.income - before.spent,
    usualNet: usual === null ? null : Math.round(usual),
    incomeDelta: deltaPercent(summary.income, before?.income ?? null),
    spentDelta: deltaPercent(summary.spent, before?.spent ?? null),
    categories: [],
    otherCategories: { count: 0, amount: 0 },
    budgets: [],
    biggestExpense: null,
    netWorthChange: 0,
  };
}
```

- [x] **Step 4: Run them to see them pass**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: PASS, 4 tests.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/recap.ts packages/core/src/recap.test.ts
git commit -m "feat(core): recap totals against the period before and the usual median"
```

---

## Task 3: `periodRecap` — categories

**Files:**
- Modify: `packages/core/src/recap.ts`
- Modify: `packages/core/src/recap.test.ts`

- [x] **Step 1: Write the failing tests**

Append to `packages/core/src/recap.test.ts`:

```ts
describe('periodRecap: categories', () => {
  it('lists parent-level spend, largest first, with no tag when nothing grew', () => {
    expect(recap().categories).toEqual([
      { categoryId: 'cat-home', amount: 72000, aboveUsual: null },
      { categoryId: 'cat-groceries', amount: 38620, aboveUsual: null },
      { categoryId: 'cat-transport', amount: 16200, aboveUsual: null },
    ]);
    expect(recap().otherCategories).toEqual({ count: 0, amount: 0 });
  });

  it('tags the category that grew most against its own median', () => {
    // Groceries 38620 + 22130 = 60750 against a median of 40500: +50%.
    const rows = [...ledger(), tx({ date: '2026-09-20', amount: 22130 })];
    const groceries = recap({ transactions: rows }).categories.find(
      (row) => row.categoryId === 'cat-groceries',
    );
    expect(groceries?.aboveUsual).toBe(50);
    expect(
      recap({ transactions: rows }).categories.filter((row) => row.aboveUsual !== null),
    ).toHaveLength(1);
  });

  it('never tags a category without history', () => {
    const onlySeptember = ledger().filter((row) => row.date.startsWith('2026-09'));
    expect(
      recap({ transactions: onlySeptember }).categories.every((row) => row.aboveUsual === null),
    ).toBe(true);
  });

  it('keeps the top five and folds the rest', () => {
    const spend = (categoryId: string, amount: number) =>
      tx({ date: '2026-09-12', amount, categoryId });
    const rows = [
      spend('cat-groceries', 700),
      spend('cat-home', 600),
      spend('cat-health', 500),
      spend('cat-transport', 400),
      spend('cat-fun', 300),
      spend('cat-gifts', 200),
      spend('cat-pets', 100),
    ];
    const result = recap({ transactions: rows });
    expect(result.categories.map((row) => row.categoryId)).toEqual([
      'cat-groceries',
      'cat-home',
      'cat-health',
      'cat-transport',
      'cat-fun',
    ]);
    expect(result.otherCategories).toEqual({ count: 2, amount: 300 });
  });
});
```

- [x] **Step 2: Run them to see them fail**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: FAIL, `categories` is `[]`.

- [x] **Step 3: Implement**

In `packages/core/src/recap.ts`:

1. Change the history import to `import { categorySpendHistory, type PeriodHistoryEntry, periodHistory } from './history';`
   and the ledger import to
   `import { type CategoryRef, type LedgerTx, rollupToParents, spendingByCategory, summarizePeriod } from './ledger';`.
2. Add, above `recapPeriod`:

```ts
/** How many categories the recap lists before folding the rest into «Altre N categorie». */
export const RECAP_TOP_CATEGORIES = 5;

/**
 * The top categories at parent level, and the one that grew most against its own median (§5.5).
 * The tag is looked for among the listed ones only: a tag on a folded category cannot be seen.
 * A category with no history has a zero or missing median, so `deltaPercent` gives null.
 */
function recapCategories(
  inPeriod: readonly LedgerTx[],
  period: DateRange,
  today: LocalDate,
  categories: readonly CategoryRef[],
  history: readonly PeriodHistoryEntry[],
): Pick<PeriodRecap, 'categories' | 'otherCategories'> {
  const totals = rollupToParents(spendingByCategory(inPeriod, period, today), categories);
  const ranked = [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked.slice(0, RECAP_TOP_CATEGORIES);
  const rest = ranked.slice(RECAP_TOP_CATEGORIES);

  const past = categorySpendHistory(history, categories, today);
  let mover: { categoryId: string; delta: number } | null = null;
  for (const [categoryId, amount] of top) {
    const usual = median(past.map((amounts) => amounts.get(categoryId) ?? 0));
    const delta = deltaPercent(amount, usual);
    if (delta !== null && delta > 0 && (mover === null || delta > mover.delta)) {
      mover = { categoryId, delta };
    }
  }

  return {
    categories: top.map(([categoryId, amount]) => ({
      categoryId,
      amount,
      aboveUsual: mover?.categoryId === categoryId ? mover.delta : null,
    })),
    otherCategories: {
      count: rest.length,
      amount: rest.reduce((sum, [, amount]) => sum + amount, 0),
    },
  };
}
```

3. In `periodRecap`, replace the two lines `categories: [],` and `otherCategories: { count: 0, amount: 0 },` with
   `...recapCategories(inPeriod, period, today, input.categories, history),`.

- [x] **Step 4: Run them to see them pass**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: PASS, 8 tests.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/recap.ts packages/core/src/recap.test.ts
git commit -m "feat(core): recap categories with the one that grew most"
```

---

## Task 4: `periodRecap` — budgets

**Files:**
- Modify: `packages/core/src/recap.ts`
- Modify: `packages/core/src/recap.test.ts`

- [x] **Step 1: Write the failing tests**

Append to `packages/core/src/recap.test.ts` (and add `type RecapBudgetRef` to the import from `./recap`):

```ts
function budget(overrides: Partial<RecapBudgetRef> & Pick<RecapBudgetRef, 'id'>): RecapBudgetRef {
  return {
    name: overrides.id,
    categoryIds: ['cat-groceries'],
    amount: 40000,
    period: 'period',
    rollover: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('periodRecap: budgets', () => {
  it('measures the budgets that closed with the period, in their order', () => {
    const budgets = [
      budget({ id: 'plain' }),
      // Created in August: 42000 − 40000 spent carries 2000 into September, so September measures
      // against 44000 and carries 44000 − 38620 = 5380 into October.
      budget({ id: 'rolling', amount: 42000, rollover: true, createdAt: '2026-08-15T10:00:00.000Z' }),
      budget({ id: 'tight', amount: 30000 }),
      budget({ id: 'monthly', period: 'month' }),
      budget({ id: 'yearly', period: 'year' }),
      budget({ id: 'weekly', period: 'week' }),
      budget({ id: 'too-new', createdAt: '2026-10-01T08:00:00.000Z' }),
    ];
    expect(recap({ budgets }).budgets).toEqual([
      { budgetId: 'plain', name: 'plain', spent: 38620, limit: 40000, over: false, carry: 0 },
      { budgetId: 'rolling', name: 'rolling', spent: 38620, limit: 44000, over: false, carry: 5380 },
      { budgetId: 'tight', name: 'tight', spent: 38620, limit: 30000, over: true, carry: 0 },
      { budgetId: 'monthly', name: 'monthly', spent: 38620, limit: 40000, over: false, carry: 0 },
    ]);
  });

  it('keeps a weekly budget in a weekly recap and drops a monthly one', () => {
    const week: PeriodDef = { kind: 'week', startDay: 1 };
    const closed = recapPeriod(week, '2026-10-05');
    const result = periodRecap({
      def: week,
      period: closed,
      today: '2026-10-05',
      transactions: [tx({ date: '2026-09-30', amount: 5000 })],
      categories: CATS,
      budgets: [
        budget({ id: 'weekly', period: 'week', amount: 10000 }),
        budget({ id: 'monthly', period: 'month' }),
      ],
      accounts: ACCOUNTS,
    });
    expect(result?.budgets).toEqual([
      { budgetId: 'weekly', name: 'weekly', spent: 5000, limit: 10000, over: false, carry: 0 },
    ]);
  });
});
```

- [x] **Step 2: Run them to see them fail**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: FAIL, `budgets` is `[]`.

- [x] **Step 3: Implement**

In `packages/core/src/recap.ts`:

1. Add the imports `import { expandCategoryIds } from './budgets';`, `import { parseLocalDate } from './dates';` (next to
   the `LocalDate` type import: `import { type LocalDate, parseLocalDate } from './dates';`),
   `import { effectiveLimit } from './rollover';`, and extend the period import to
   `import { isoWeekRange, monthRangeOf, type PeriodDef, periodContaining, shiftPeriod, yearRange } from './period';`.
2. Add, above `recapPeriod`:

```ts
/**
 * The calendar window a budget measures when its period closes with `period` (§5.15). Not
 * `budgetRange`: that one clips a closed period's week to the period, which would put every weekly
 * budget in every monthly recap. Here a weekly budget belongs to a recap only when its whole ISO
 * week ends on the period's last day.
 */
function ownRange(kind: RecapBudgetRef['period'], period: DateRange): DateRange {
  switch (kind) {
    case 'period':
      return period;
    case 'week':
      return isoWeekRange(period.end);
    case 'month': {
      const { year, month } = parseLocalDate(period.end);
      return monthRangeOf({ year, month });
    }
    case 'year':
      return yearRange(period.end);
  }
}

/** The budgets that closed with the period, measured as closed (§5.8), in the caller's order. */
function recapBudgets(input: PeriodRecapInput): RecapBudgetLine[] {
  const { def, period, today, transactions, categories, budgets } = input;
  const lines: RecapBudgetLine[] = [];
  for (const budget of budgets) {
    const createdOn = budget.createdAt.slice(0, 10);
    if (createdOn > period.end) continue;
    const range = ownRange(budget.period, period);
    if (range.end !== period.end) continue;

    const ids = expandCategoryIds(budget.categoryIds, categories);
    const spentIn = (target: DateRange): MinorUnits => {
      const amounts = spendingByCategory(transactions, target, today);
      let total = 0;
      for (const id of ids) total += amounts.get(id) ?? 0;
      return total;
    };
    const spent = spentIn(range);
    // Rollover exists for budgets that follow the app's period only (§5.8).
    const rolls = budget.period === 'period';
    const limit = rolls
      ? effectiveLimit({
          amount: budget.amount,
          createdAtPeriodStart: periodContaining(def, createdOn).start,
          period,
          def,
          spentInPeriod: spentIn,
          rollover: budget.rollover,
        })
      : budget.amount;
    lines.push({
      budgetId: budget.id,
      name: budget.name,
      spent,
      limit,
      over: spent > limit,
      carry: rolls && budget.rollover ? Math.max(0, limit - spent) : 0,
    });
  }
  return lines;
}
```

3. In `periodRecap`, replace `budgets: [],` with `budgets: recapBudgets(input),`.

- [x] **Step 4: Run them to see them pass**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: PASS, 10 tests.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/recap.ts packages/core/src/recap.test.ts
git commit -m "feat(core): recap budgets that closed with the period"
```

---

## Task 5: `periodRecap` — biggest expense and net worth

**Files:**
- Modify: `packages/core/src/recap.ts`
- Modify: `packages/core/src/recap.test.ts`

- [x] **Step 1: Write the failing tests**

Append to `packages/core/src/recap.test.ts`:

```ts
describe('periodRecap: biggest expense and net worth', () => {
  it('names the single largest counted expense', () => {
    expect(recap().biggestExpense).toMatchObject({
      amount: 72000,
      date: '2026-09-01',
      categoryId: 'cat-rent',
      description: '',
    });
  });

  it('skips excluded rows and transfers, and breaks a tie by the earlier date', () => {
    const rows = [
      tx({ date: '2026-09-05', amount: 9000, excludeFromTotals: true }),
      tx({ date: '2026-09-08', amount: 5000, description: 'Treno' }),
      tx({ date: '2026-09-03', amount: 5000, description: 'Cena' }),
      tx({
        date: '2026-09-04',
        amount: 20000,
        kind: 'transfer',
        categoryId: null,
        accountId: 'acc-checking',
        toAccountId: 'acc-savings',
      }),
    ];
    expect(recap({ transactions: rows }).biggestExpense).toMatchObject({
      amount: 5000,
      description: 'Cena',
      date: '2026-09-03',
    });
  });

  it('measures net worth from the day before the period to its last day', () => {
    expect(recap().netWorthChange).toBe(118180);
    // A transfer moves nothing; an excluded expense leaves the totals but not the balances.
    const rows = [
      ...ledger(),
      tx({
        date: '2026-09-20',
        amount: 50000,
        kind: 'transfer',
        categoryId: null,
        accountId: 'acc-checking',
        toAccountId: 'acc-savings',
      }),
      tx({ date: '2026-09-21', amount: 1000, excludeFromTotals: true }),
    ];
    const result = recap({ transactions: rows });
    expect(result.net).toBe(118180);
    expect(result.netWorthChange).toBe(117180);
  });
});
```

- [x] **Step 2: Run them to see them fail**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: FAIL, `biggestExpense` is null and `netWorthChange` is 0.

- [x] **Step 3: Implement**

In `packages/core/src/recap.ts`:

1. Change the accounts import to `import { type AccountRef, accountBalances, netWorth } from './accounts';`, add
   `addDays` to the dates import (`import { addDays, type LocalDate, parseLocalDate } from './dates';`), and add
   `countsInTotals` to the ledger import.
2. Add, above `recapPeriod`:

```ts
/** The largest counted expense of the period; on a tie the earlier one, then the lower id. */
function biggestExpense(inPeriod: readonly LedgerTx[], today: LocalDate): RecapExpense | null {
  let best: LedgerTx | null = null;
  for (const row of inPeriod) {
    if (row.kind !== 'expense' || !countsInTotals(row, today)) continue;
    if (
      best === null ||
      row.amount > best.amount ||
      (row.amount === best.amount &&
        (row.date < best.date || (row.date === best.date && row.id < best.id)))
    ) {
      best = row;
    }
  }
  return best === null
    ? null
    : {
        transactionId: best.id,
        description: best.description,
        categoryId: best.categoryId,
        date: best.date,
        amount: best.amount,
      };
}

/** «Patrimonio complessivo» at the end of `date` (§5.3). */
function netWorthOn(
  accounts: readonly AccountRef[],
  transactions: readonly LedgerTx[],
  date: LocalDate,
): MinorUnits {
  return netWorth(accounts, accountBalances(accounts, transactions, date));
}
```

3. In `periodRecap`, replace `biggestExpense: null,` with `biggestExpense: biggestExpense(inPeriod, today),` and
   `netWorthChange: 0,` with:

```ts
    netWorthChange:
      netWorthOn(input.accounts, transactions, period.end) -
      netWorthOn(input.accounts, transactions, addDays(period.start, -1)),
```

- [x] **Step 4: Run them to see them pass, then the whole package**

Run: `pnpm --filter @saldo/core test -- recap`
Expected: PASS, 13 tests.

Run: `pnpm --filter @saldo/core typecheck && pnpm --filter @saldo/core test`
Expected: no type errors; every test passes.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/recap.ts packages/core/src/recap.test.ts
git commit -m "feat(core): recap biggest expense and net worth change"
```

---

## Task 6: The `recap` strings

The parity test (`packages/i18n/src/locales.test.ts`) requires the same keys and the same `{{variables}}` in all seven
catalogs. Each block goes **at the end of the catalog object**, after the last namespace, in every file.

**Files:**
- Modify: `packages/i18n/src/locales/it.ts`, `en.ts`, `de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `sv.ts`

- [x] **Step 1: Add the Italian source block to `it.ts`**

```ts
  recap: {
    title_month: '{{month}} si è chiuso',
    title_week: 'La settimana si è chiusa',
    title_cycle: 'Il ciclo si è chiuso',
    title_year: 'Il {{year}} si è chiuso',
    net_month: 'Netto del mese',
    net_week: 'Netto della settimana',
    net_cycle: 'Netto del ciclo',
    net_year: 'Netto dell’anno',
    previous_month: 'Mese scorso {{amount}}',
    previous_week: 'Settimana scorsa {{amount}}',
    previous_cycle: 'Ciclo scorso {{amount}}',
    previous_year: 'Anno scorso {{amount}}',
    usual: 'di solito {{amount}}',
    delta_month: '{{pct}} sul mese scorso',
    delta_week: '{{pct}} sulla settimana scorsa',
    delta_cycle: '{{pct}} sul ciclo scorso',
    delta_year: '{{pct}} sull’anno scorso',
    income: 'Entrate',
    expenses: 'Uscite',
    categories: 'Categorie',
    otherCategories_one: 'Un’altra categoria',
    otherCategories_other: 'Altre {{count}} categorie',
    aboveUsual: '{{pct}} sulla media',
    uncategorized: 'Senza categoria',
    budgets: 'Budget',
    of: 'di {{amount}}',
    within: 'Nei limiti',
    withinCarry: 'Nei limiti · riporti {{amount}}',
    over: 'Sforato di {{amount}}',
    other: 'Altro',
    biggest: 'Spesa più grande',
    netWorth: 'Patrimonio',
    start_month: 'Inizia il nuovo mese',
    start_week: 'Inizia la nuova settimana',
    start_cycle: 'Inizia il nuovo ciclo',
    start_year: 'Inizia il nuovo anno',
    notification_month: 'Il tuo mese si è chiuso: guarda il riepilogo',
    notification_week: 'La tua settimana si è chiusa: guarda il riepilogo',
    notification_cycle: 'Il tuo ciclo si è chiuso: guarda il riepilogo',
    notification_year: 'Il tuo anno si è chiuso: guarda il riepilogo',
  },
```

- [x] **Step 2: Add `en.ts`**

```ts
  recap: {
    title_month: '{{month}} is over',
    title_week: 'The week is over',
    title_cycle: 'The cycle is over',
    title_year: '{{year}} is over',
    net_month: 'Net for the month',
    net_week: 'Net for the week',
    net_cycle: 'Net for the cycle',
    net_year: 'Net for the year',
    previous_month: 'Last month {{amount}}',
    previous_week: 'Last week {{amount}}',
    previous_cycle: 'Last cycle {{amount}}',
    previous_year: 'Last year {{amount}}',
    usual: 'usually {{amount}}',
    delta_month: '{{pct}} vs last month',
    delta_week: '{{pct}} vs last week',
    delta_cycle: '{{pct}} vs last cycle',
    delta_year: '{{pct}} vs last year',
    income: 'Income',
    expenses: 'Expenses',
    categories: 'Categories',
    otherCategories_one: 'One more category',
    otherCategories_other: '{{count}} more categories',
    aboveUsual: '{{pct}} vs usual',
    uncategorized: 'Uncategorized',
    budgets: 'Budgets',
    of: 'of {{amount}}',
    within: 'Within the limit',
    withinCarry: 'Within the limit · {{amount}} carried over',
    over: 'Over by {{amount}}',
    other: 'Other',
    biggest: 'Biggest expense',
    netWorth: 'Net worth',
    start_month: 'Start the new month',
    start_week: 'Start the new week',
    start_cycle: 'Start the new cycle',
    start_year: 'Start the new year',
    notification_month: 'Your month is over: see the recap',
    notification_week: 'Your week is over: see the recap',
    notification_cycle: 'Your cycle is over: see the recap',
    notification_year: 'Your year is over: see the recap',
  },
```

- [x] **Step 3: Add `de.ts`**

```ts
  recap: {
    title_month: '{{month}} ist vorbei',
    title_week: 'Die Woche ist vorbei',
    title_cycle: 'Der Zyklus ist vorbei',
    title_year: '{{year}} ist vorbei',
    net_month: 'Saldo des Monats',
    net_week: 'Saldo der Woche',
    net_cycle: 'Saldo des Zyklus',
    net_year: 'Saldo des Jahres',
    previous_month: 'Letzter Monat {{amount}}',
    previous_week: 'Letzte Woche {{amount}}',
    previous_cycle: 'Letzter Zyklus {{amount}}',
    previous_year: 'Letztes Jahr {{amount}}',
    usual: 'üblich {{amount}}',
    delta_month: '{{pct}} ggü. Vormonat',
    delta_week: '{{pct}} ggü. Vorwoche',
    delta_cycle: '{{pct}} ggü. letztem Zyklus',
    delta_year: '{{pct}} ggü. Vorjahr',
    income: 'Einnahmen',
    expenses: 'Ausgaben',
    categories: 'Kategorien',
    otherCategories_one: 'Eine weitere Kategorie',
    otherCategories_other: '{{count}} weitere Kategorien',
    aboveUsual: '{{pct}} ggü. üblich',
    uncategorized: 'Ohne Kategorie',
    budgets: 'Budgets',
    of: 'von {{amount}}',
    within: 'Im Rahmen',
    withinCarry: 'Im Rahmen · {{amount}} übertragen',
    over: '{{amount}} überschritten',
    other: 'Sonstiges',
    biggest: 'Größte Ausgabe',
    netWorth: 'Vermögen',
    start_month: 'Neuen Monat beginnen',
    start_week: 'Neue Woche beginnen',
    start_cycle: 'Neuen Zyklus beginnen',
    start_year: 'Neues Jahr beginnen',
    notification_month: 'Dein Monat ist vorbei: sieh dir die Übersicht an',
    notification_week: 'Deine Woche ist vorbei: sieh dir die Übersicht an',
    notification_cycle: 'Dein Zyklus ist vorbei: sieh dir die Übersicht an',
    notification_year: 'Dein Jahr ist vorbei: sieh dir die Übersicht an',
  },
```

- [x] **Step 4: Add `es.ts`**

```ts
  recap: {
    title_month: '{{month}} ha terminado',
    title_week: 'La semana ha terminado',
    title_cycle: 'El ciclo ha terminado',
    title_year: '{{year}} ha terminado',
    net_month: 'Neto del mes',
    net_week: 'Neto de la semana',
    net_cycle: 'Neto del ciclo',
    net_year: 'Neto del año',
    previous_month: 'Mes pasado {{amount}}',
    previous_week: 'Semana pasada {{amount}}',
    previous_cycle: 'Ciclo pasado {{amount}}',
    previous_year: 'Año pasado {{amount}}',
    usual: 'lo habitual {{amount}}',
    delta_month: '{{pct}} frente al mes pasado',
    delta_week: '{{pct}} frente a la semana pasada',
    delta_cycle: '{{pct}} frente al ciclo pasado',
    delta_year: '{{pct}} frente al año pasado',
    income: 'Ingresos',
    expenses: 'Gastos',
    categories: 'Categorías',
    otherCategories_one: 'Otra categoría',
    otherCategories_other: 'Otras {{count}} categorías',
    aboveUsual: '{{pct}} sobre lo habitual',
    uncategorized: 'Sin categoría',
    budgets: 'Presupuestos',
    of: 'de {{amount}}',
    within: 'Dentro del límite',
    withinCarry: 'Dentro del límite · pasan {{amount}}',
    over: 'Superado en {{amount}}',
    other: 'Otros',
    biggest: 'Mayor gasto',
    netWorth: 'Patrimonio',
    start_month: 'Empieza el nuevo mes',
    start_week: 'Empieza la nueva semana',
    start_cycle: 'Empieza el nuevo ciclo',
    start_year: 'Empieza el nuevo año',
    notification_month: 'Tu mes ha terminado: mira el resumen',
    notification_week: 'Tu semana ha terminado: mira el resumen',
    notification_cycle: 'Tu ciclo ha terminado: mira el resumen',
    notification_year: 'Tu año ha terminado: mira el resumen',
  },
```

- [x] **Step 5: Add `fr.ts`**

```ts
  recap: {
    title_month: '{{month}} est terminé',
    title_week: 'La semaine est terminée',
    title_cycle: 'Le cycle est terminé',
    title_year: '{{year}} est terminée',
    net_month: 'Solde du mois',
    net_week: 'Solde de la semaine',
    net_cycle: 'Solde du cycle',
    net_year: 'Solde de l’année',
    previous_month: 'Mois dernier {{amount}}',
    previous_week: 'Semaine dernière {{amount}}',
    previous_cycle: 'Cycle précédent {{amount}}',
    previous_year: 'Année dernière {{amount}}',
    usual: 'd’habitude {{amount}}',
    delta_month: '{{pct}} par rapport au mois dernier',
    delta_week: '{{pct}} par rapport à la semaine dernière',
    delta_cycle: '{{pct}} par rapport au cycle précédent',
    delta_year: '{{pct}} par rapport à l’année dernière',
    income: 'Revenus',
    expenses: 'Dépenses',
    categories: 'Catégories',
    otherCategories_one: 'Une autre catégorie',
    otherCategories_other: '{{count}} autres catégories',
    aboveUsual: '{{pct}} par rapport à d’habitude',
    uncategorized: 'Sans catégorie',
    budgets: 'Budgets',
    of: 'sur {{amount}}',
    within: 'Dans la limite',
    withinCarry: 'Dans la limite · {{amount}} reportés',
    over: 'Dépassé de {{amount}}',
    other: 'Autre',
    biggest: 'Plus grosse dépense',
    netWorth: 'Patrimoine',
    start_month: 'Commencer le nouveau mois',
    start_week: 'Commencer la nouvelle semaine',
    start_cycle: 'Commencer le nouveau cycle',
    start_year: 'Commencer la nouvelle année',
    notification_month: 'Ton mois est terminé : regarde le récapitulatif',
    notification_week: 'Ta semaine est terminée : regarde le récapitulatif',
    notification_cycle: 'Ton cycle est terminé : regarde le récapitulatif',
    notification_year: 'Ton année est terminée : regarde le récapitulatif',
  },
```

- [x] **Step 6: Add `pt.ts`**

```ts
  recap: {
    title_month: '{{month}} terminou',
    title_week: 'A semana terminou',
    title_cycle: 'O ciclo terminou',
    title_year: '{{year}} terminou',
    net_month: 'Saldo do mês',
    net_week: 'Saldo da semana',
    net_cycle: 'Saldo do ciclo',
    net_year: 'Saldo do ano',
    previous_month: 'Mês passado {{amount}}',
    previous_week: 'Semana passada {{amount}}',
    previous_cycle: 'Ciclo anterior {{amount}}',
    previous_year: 'Ano passado {{amount}}',
    usual: 'o habitual {{amount}}',
    delta_month: '{{pct}} face ao mês passado',
    delta_week: '{{pct}} face à semana passada',
    delta_cycle: '{{pct}} face ao ciclo anterior',
    delta_year: '{{pct}} face ao ano passado',
    income: 'Receitas',
    expenses: 'Despesas',
    categories: 'Categorias',
    otherCategories_one: 'Outra categoria',
    otherCategories_other: 'Outras {{count}} categorias',
    aboveUsual: '{{pct}} face ao habitual',
    uncategorized: 'Sem categoria',
    budgets: 'Orçamentos',
    of: 'de {{amount}}',
    within: 'Dentro do limite',
    withinCarry: 'Dentro do limite · transitam {{amount}}',
    over: 'Ultrapassado em {{amount}}',
    other: 'Outros',
    biggest: 'Maior despesa',
    netWorth: 'Património',
    start_month: 'Começar o novo mês',
    start_week: 'Começar a nova semana',
    start_cycle: 'Começar o novo ciclo',
    start_year: 'Começar o novo ano',
    notification_month: 'O teu mês terminou: vê o resumo',
    notification_week: 'A tua semana terminou: vê o resumo',
    notification_cycle: 'O teu ciclo terminou: vê o resumo',
    notification_year: 'O teu ano terminou: vê o resumo',
  },
```

- [x] **Step 7: Add `sv.ts`**

```ts
  recap: {
    title_month: '{{month}} är slut',
    title_week: 'Veckan är slut',
    title_cycle: 'Cykeln är slut',
    title_year: '{{year}} är slut',
    net_month: 'Netto för månaden',
    net_week: 'Netto för veckan',
    net_cycle: 'Netto för cykeln',
    net_year: 'Netto för året',
    previous_month: 'Förra månaden {{amount}}',
    previous_week: 'Förra veckan {{amount}}',
    previous_cycle: 'Förra cykeln {{amount}}',
    previous_year: 'Förra året {{amount}}',
    usual: 'vanligtvis {{amount}}',
    delta_month: '{{pct}} mot förra månaden',
    delta_week: '{{pct}} mot förra veckan',
    delta_cycle: '{{pct}} mot förra cykeln',
    delta_year: '{{pct}} mot förra året',
    income: 'Inkomster',
    expenses: 'Utgifter',
    categories: 'Kategorier',
    otherCategories_one: 'En kategori till',
    otherCategories_other: '{{count}} kategorier till',
    aboveUsual: '{{pct}} mot det vanliga',
    uncategorized: 'Utan kategori',
    budgets: 'Budgetar',
    of: 'av {{amount}}',
    within: 'Inom gränsen',
    withinCarry: 'Inom gränsen · {{amount}} förs över',
    over: 'Över med {{amount}}',
    other: 'Övrigt',
    biggest: 'Största utgiften',
    netWorth: 'Förmögenhet',
    start_month: 'Börja den nya månaden',
    start_week: 'Börja den nya veckan',
    start_cycle: 'Börja den nya cykeln',
    start_year: 'Börja det nya året',
    notification_month: 'Din månad är slut: se sammanfattningen',
    notification_week: 'Din vecka är slut: se sammanfattningen',
    notification_cycle: 'Din cykel är slut: se sammanfattningen',
    notification_year: 'Ditt år är slut: se sammanfattningen',
  },
```

- [x] **Step 8: Run the parity test**

Run: `pnpm --filter @saldo/i18n test && pnpm --filter @saldo/i18n typecheck`
Expected: PASS. A failure names the locale and the key that differs.

- [x] **Step 9: Commit**

```bash
git add packages/i18n/src/locales
git commit -m "feat(i18n): period recap strings"
```

---

## Task 7: Scheduling helpers

**Files:**
- Create: `apps/mobile/src/features/recap/recapSchedule.ts`
- Create: `apps/mobile/src/features/recap/recapSchedule.test.ts`

- [x] **Step 1: Write the failing tests**

`apps/mobile/src/features/recap/recapSchedule.test.ts`:

```ts
import type { PeriodDef } from '@saldo/core';
import {
  isRecapDue,
  isRecapNotificationId,
  nextRecapNotification,
  recapNotificationId,
  recapStamp,
} from './recapSchedule';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };
const WEEK: PeriodDef = { kind: 'week', startDay: 1 };
const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' };

describe('recapStamp', () => {
  it('names the kind and the start, so a change of kind is a new period', () => {
    expect(recapStamp(MONTH, SEPTEMBER)).toBe('month:2026-09-01');
    expect(recapStamp(WEEK, { start: '2026-09-28', end: '2026-10-04' })).toBe('week:2026-09-28');
  });
});

describe('isRecapDue', () => {
  const base = {
    stamp: 'month:2026-09-01',
    stored: 'month:2026-08-01',
    onboardingCompletedAt: '2026-05-02T09:00:00.000Z',
    currentStart: '2026-10-01',
  };

  it('is due for a period not recapped yet', () => {
    expect(isRecapDue(base)).toBe(true);
    expect(isRecapDue({ ...base, stored: null })).toBe(true);
  });

  it('is shown once', () => {
    expect(isRecapDue({ ...base, stored: 'month:2026-09-01' })).toBe(false);
  });

  it('waits for onboarding, and skips a user who set Saldo up during this period', () => {
    expect(isRecapDue({ ...base, onboardingCompletedAt: null })).toBe(false);
    expect(isRecapDue({ ...base, onboardingCompletedAt: '2026-10-01T07:00:00.000Z' })).toBe(false);
    expect(isRecapDue({ ...base, onboardingCompletedAt: '2026-09-30T21:00:00.000Z' })).toBe(true);
  });
});

describe('nextRecapNotification', () => {
  it('rings at 09:00 on the first day of the next period', () => {
    const now = new Date(2026, 8, 25, 12, 0, 0, 0);
    expect(nextRecapNotification(MONTH, '2026-09-25', now)).toEqual({
      identifier: 'period-recap:2026-10-01',
      at: new Date(2026, 9, 1, 9, 0, 0, 0),
    });
    expect(nextRecapNotification(WEEK, '2026-09-25', now)).toEqual({
      identifier: 'period-recap:2026-09-28',
      at: new Date(2026, 8, 28, 9, 0, 0, 0),
    });
  });
});

describe('recapNotificationId', () => {
  it('is recognisable among the other scheduled notifications', () => {
    expect(isRecapNotificationId(recapNotificationId('2026-10-01'))).toBe(true);
    expect(isRecapNotificationId('card-charge:acc-1')).toBe(false);
  });
});
```

- [x] **Step 2: Run them to see them fail**

Run: `pnpm --filter mobile test -- recapSchedule`
Expected: FAIL, `Cannot find module './recapSchedule'`.

- [x] **Step 3: Implement**

`apps/mobile/src/features/recap/recapSchedule.ts`:

```ts
import {
  type DateRange,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  shiftPeriod,
} from '@saldo/core';
import { reminderTrigger } from '../accounts/cardReminders';

/** kv key holding the last period recapped on this device (§5.15). Never synced. */
export const RECAP_KEY = 'lastRecapPeriod';

/** The notification rings at this hour on the first day of a period (§5.15). */
export const RECAP_HOUR = 9;

const PREFIX = 'period-recap:';

/** `{kind}:{start}`: a change of kind or start day gives a new stamp (§5.15). */
export function recapStamp(def: PeriodDef, period: DateRange): string {
  return `${def.kind}:${period.start}`;
}

export interface RecapDueInput {
  stamp: string;
  stored: string | null;
  onboardingCompletedAt: string | null;
  /** Start of the period containing today. */
  currentStart: LocalDate;
}

/**
 * Whether the closed period still has to be recapped (§5.15): not yet stamped, and not for a user
 * who finished onboarding during the current period — an imported history must not greet a new
 * user with a recap of a period they never lived in Saldo. Whether the period has transactions is
 * the core's answer (`periodRecap` returns null), not this one.
 */
export function isRecapDue(input: RecapDueInput): boolean {
  if (input.stored === input.stamp) return false;
  if (input.onboardingCompletedAt === null) return false;
  return input.onboardingCompletedAt.slice(0, 10) < input.currentStart;
}

export function recapNotificationId(start: LocalDate): string {
  return `${PREFIX}${start}`;
}

export function isRecapNotificationId(identifier: string): boolean {
  return identifier.startsWith(PREFIX);
}

/** What the notification carries; a tap only opens the app, which shows the sheet by itself. */
export function recapPayload(): Record<string, string> {
  return { kind: 'periodRecap' };
}

/** The next recap notification: 09:00 on the first day of the period after today's. */
export function nextRecapNotification(
  def: PeriodDef,
  today: LocalDate,
  now: Date,
): { identifier: string; at: Date } | null {
  const next = shiftPeriod(def, periodContaining(def, today), 1);
  const at = reminderTrigger(next.start, RECAP_HOUR, now);
  return at === null ? null : { identifier: recapNotificationId(next.start), at };
}
```

- [x] **Step 4: Run them to see them pass**

Run: `pnpm --filter mobile test -- recapSchedule`
Expected: PASS, 6 tests.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/features/recap/recapSchedule.ts apps/mobile/src/features/recap/recapSchedule.test.ts
git commit -m "feat(mobile): when a period recap is due and when it rings"
```

---

## Task 8: The recap bar

A bar of its own rather than `ProgressBar`: `ProgressBar` starts at its value and animates only when the value
changes, and these bars must grow once, from empty, when their section scrolls into view.

**Files:**
- Create: `apps/mobile/src/features/recap/RecapBar.tsx`

- [x] **Step 1: Write the component**

```tsx
import { motion } from '@saldo/ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SWAP_EASE, useMotion } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts } from '../hidden/hiddenAmounts';

export interface RecapBarProps {
  /** 0..1, clamped. */
  ratio: number;
  /** The tagged category, or a budget over its limit (§6.39). */
  accent?: boolean;
  /** True once the bar's section has scrolled into view; the bar grows the first time. */
  seen: boolean;
  /** Position in its list, for the stagger. */
  index: number;
}

/**
 * A 4pt bar of the recap (§6.39). It grows from empty once, `staggerMs` after the bar above it,
 * when told it is in view; with Reduce Motion it is drawn full at once. Decorative: every figure
 * it draws is also written next to it, so screen readers skip it. Empty in hidden mode, like
 * `ProgressBar`: a full bar beside a masked figure would still tell the amount.
 */
export function RecapBar({ ratio, accent = false, seen, index }: RecapBarProps) {
  const theme = useTheme();
  const { reduced } = useMotion();
  const { hidden } = useHiddenAmounts();
  const target = hidden ? 0 : Math.min(1, Math.max(0, ratio));
  const fill = useSharedValue(reduced ? target : 0);

  useEffect(() => {
    if (reduced) {
      fill.value = target;
      return;
    }
    if (!seen) return;
    fill.value = withDelay(
      index * motion.staggerMs,
      withTiming(target, { duration: motion.progressMs, easing: SWAP_EASE }),
    );
  }, [reduced, seen, target, index, fill]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        marginTop: 8,
        height: theme.layout.progressHeight,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.track,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            width: '100%',
            borderRadius: theme.radii.pill,
            backgroundColor: accent ? theme.palette.accent : theme.palette.barGrey,
            transformOrigin: 'left',
          },
          style,
        ]}
      />
    </View>
  );
}
```

- [x] **Step 2: Typecheck**

Run: `pnpm --filter mobile typecheck`
Expected: no errors.

- [x] **Step 3: Commit**

```bash
git add apps/mobile/src/features/recap/RecapBar.tsx
git commit -m "feat(mobile): recap bar that grows once in view"
```

---

## Task 9: The recap sheet

**Files:**
- Create: `apps/mobile/src/features/recap/PeriodRecapSheet.tsx`
- Create: `apps/mobile/src/features/recap/PeriodRecapSheet.test.tsx`

- [x] **Step 1: Write the failing test**

`apps/mobile/src/features/recap/PeriodRecapSheet.test.tsx`:

```tsx
import type { Category, PeriodRecap } from '@saldo/core';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { type Metrics, SafeAreaProvider } from 'react-native-safe-area-context';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { HiddenAmountsContext, VISIBLE } from '../hidden/hiddenAmounts';
import { PeriodRecapSheet } from './PeriodRecapSheet';

// Reduce Motion on: the sheet is drawn in place and every bar is already full.
jest.mock('../../theme/motion', () => ({
  ...jest.requireActual('../../theme/motion'),
  useMotion: () => ({ reduced: true, duration: () => 0 }),
}));

function category(id: string, name: string, colorIndex: number): Category {
  return {
    id,
    name,
    colorIndex,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '1',
    deletedAt: null,
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    archivedAt: null,
    sortOrder: 0,
  };
}

const CATEGORIES = [category('cat-home', 'Casa', 5), category('cat-food', 'Ristoranti', 0)];

const RECAP: PeriodRecap = {
  period: { start: '2026-09-01', end: '2026-09-30' },
  income: 245000,
  spent: 187240,
  net: 57760,
  previousNet: 19510,
  usualNet: 35680,
  incomeDelta: 7,
  spentDelta: -11,
  categories: [
    { categoryId: 'cat-home', amount: 72000, aboveUsual: null },
    { categoryId: 'cat-food', amount: 21450, aboveUsual: 62 },
  ],
  otherCategories: { count: 6, amount: 27130 },
  budgets: [
    { budgetId: 'b1', name: 'Ristoranti', spent: 21450, limit: 18000, over: true, carry: 0 },
    { budgetId: 'b2', name: 'Spesa', spent: 38620, limit: 40000, over: false, carry: 1380 },
  ],
  biggestExpense: {
    transactionId: 't1',
    description: 'Affitto',
    categoryId: 'cat-home',
    date: '2026-09-01',
    amount: 72000,
  },
  netWorthChange: 61240,
};

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

async function show(node: ReactElement, hidden = false) {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider preference="dark">
        <I18nextProvider i18n={i18n}>
          <HiddenAmountsContext.Provider value={{ ...VISIBLE, hidden }}>
            {node}
          </HiddenAmountsContext.Provider>
        </I18nextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('PeriodRecapSheet', () => {
  it('shows the closed month, its net and every section', async () => {
    await show(
      <PeriodRecapSheet
        recap={RECAP}
        kind="month"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('September 2026 is over')).toBeTruthy();
    expect(screen.getByText('Net for the month')).toBeTruthy();
    expect(screen.getByText(/^Last month .* · usually /)).toBeTruthy();
    expect(screen.getByText('+7% vs last month')).toBeTruthy();
    expect(screen.getByText('−11% vs last month')).toBeTruthy();
    expect(screen.getByText('+62% vs usual')).toBeTruthy();
    expect(screen.getByText('6 more categories')).toBeTruthy();
    expect(screen.getByText(/^Over by /)).toBeTruthy();
    expect(screen.getByText(/^Within the limit · .* carried over$/)).toBeTruthy();
    expect(screen.getByText('Affitto')).toBeTruthy();
    expect(screen.getByText('Net worth')).toBeTruthy();
  });

  it('masks the aggregates in hidden mode but not the single biggest expense', async () => {
    await show(
      <PeriodRecapSheet
        recap={RECAP}
        kind="month"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={() => {}}
      />,
      true,
    );
    expect(screen.getAllByLabelText('Amount hidden').length).toBeGreaterThan(3);
    expect(screen.getByText('Affitto')).toBeTruthy();
    expect(screen.getByText(/^Over by .*•/)).toBeTruthy();
  });

  it('names the week and leaves out what has no history', async () => {
    await show(
      <PeriodRecapSheet
        recap={{ ...RECAP, previousNet: null, usualNet: null, incomeDelta: null, spentDelta: null }}
        kind="week"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText('The week is over')).toBeTruthy();
    expect(screen.getByText('Net for the week')).toBeTruthy();
    expect(screen.queryByText(/vs last week/)).toBeNull();
    expect(screen.queryByText(/usually/)).toBeNull();
    expect(screen.getByText('Start the new week')).toBeTruthy();
  });

  it('closes once it has left the screen', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    await show(
      <PeriodRecapSheet
        recap={RECAP}
        kind="month"
        categories={CATEGORIES}
        currency="EUR"
        locale="en"
        onClose={onClose}
      />,
    );
    fireEvent.press(screen.getByText('Start the new month'));
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
```

- [x] **Step 2: Run it to see it fail**

Run: `pnpm --filter mobile test -- PeriodRecapSheet`
Expected: FAIL, `Cannot find module './PeriodRecapSheet'`.

- [x] **Step 3: Write the component**

`apps/mobile/src/features/recap/PeriodRecapSheet.tsx`:

```tsx
import {
  type Category,
  type CurrencyCode,
  type PeriodKind,
  type PeriodRecap,
  parseLocalDate,
} from '@saldo/core';
import {
  type AppLocale,
  formatCycleRange,
  formatDayMonth,
  formatMonthYear,
  formatSignedPercent,
} from '@saldo/i18n';
import { motion } from '@saldo/ui';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AmountText } from '../../components/AmountText';
import { PrimaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { EASE, SWAP_EASE, stepDelay, stepEntering, useCountUp, useMotion } from '../../theme/motion';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { useHiddenAmounts, useHiddenMoney } from '../hidden/hiddenAmounts';
import { RecapBar } from './RecapBar';

export interface PeriodRecapSheetProps {
  recap: PeriodRecap;
  kind: PeriodKind;
  categories: readonly Category[];
  currency: CurrencyCode;
  locale: AppLocale;
  /** Runs once the sheet has left the screen. */
  onClose: () => void;
}

/** The blocks of the entrance, in the order they arrive (§5.15). */
const CHUNK = { eyebrow: 0, title: 1, hero: 2, rest: 3 } as const;
/** Leaving is quicker than arriving (`tallSheetMs`): the eye has already moved on to Home. */
const EXIT_MS = motion.fadeMs;
/** The bars wait for the blocks above them to land before they grow. */
const BARS_ARM_MS = stepDelay(CHUNK.rest) + motion.stepEnterMs;
/** A section counts as seen once its top is this far into the viewport. */
const SEEN_FRACTION = 0.9;

function recapTitle(t: TFunction, kind: PeriodKind, start: string, locale: AppLocale): string {
  const { year, month } = parseLocalDate(start);
  if (kind === 'month') {
    const label = formatMonthYear({ year, month }, locale);
    return t('recap.title_month', { month: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  if (kind === 'year') return t('recap.title_year', { year });
  return t(`recap.title_${kind}`);
}

/**
 * The recap of a closed period (§6.39): a full-screen sheet over the Home of the new one, seen
 * once. It rises over `tallSheetMs`, its blocks arrive like an onboarding step's, the net counts up
 * from zero and the bars grow as their section scrolls into view; it leaves in `EXIT_MS`. With
 * Reduce Motion it only fades.
 */
export function PeriodRecapSheet({
  recap,
  kind,
  categories,
  currency,
  locale,
  onClose,
}: PeriodRecapSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { reduced } = useMotion();
  const { format } = useHiddenMoney();
  const byId = useMemo(() => new Map(categories.map((row) => [row.id, row])), [categories]);

  // --- Arrival and departure -------------------------------------------------------------------
  const offset = useSharedValue(reduced ? 0 : height);
  const opacity = useSharedValue(reduced ? 0 : 1);
  const scrim = useSharedValue(0);
  useEffect(() => {
    scrim.value = withTiming(1, { duration: motion.fadeMs, easing: EASE });
    if (reduced) opacity.value = withTiming(1, { duration: motion.fadeMs, easing: EASE });
    else offset.value = withTiming(0, { duration: motion.tallSheetMs, easing: EASE });
  }, [reduced, offset, opacity, scrim]);
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const config = { duration: EXIT_MS, easing: SWAP_EASE };
    scrim.value = withTiming(0, config);
    if (reduced) opacity.value = withTiming(0, config);
    else offset.value = withTiming(height, config);
    // A timer rather than the animation's callback: it also runs when Reanimated skips the motion.
    timer.current = setTimeout(onClose, EXIT_MS);
  }, [reduced, height, offset, opacity, scrim, onClose]);

  // --- Bars growing in view --------------------------------------------------------------------
  const [armed, setArmed] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setArmed(true), BARS_ARM_MS);
    return () => clearTimeout(id);
  }, [reduced]);
  const [viewport, setViewport] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [restY, setRestY] = useState<number | null>(null);
  const [sectionY, setSectionY] = useState<{ categories?: number; budgets?: number }>({});
  const inView = (y: number | undefined): boolean =>
    reduced ||
    (armed &&
      restY !== null &&
      y !== undefined &&
      viewport > 0 &&
      restY + y < scrollY + viewport * SEEN_FRACTION);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setScrollY(event.nativeEvent.contentOffset.y);

  // --- Copy ------------------------------------------------------------------------------------
  const title = recapTitle(t, kind, recap.period.start, locale);
  const comparisons = [
    recap.previousNet === null
      ? null
      : t(`recap.previous_${kind}`, { amount: format(recap.previousNet, currency, locale, 'always') }),
    recap.usualNet === null
      ? null
      : t('recap.usual', { amount: format(recap.usualNet, currency, locale, 'always') }),
  ].filter((part): part is string => part !== null);
  const topAmount = recap.categories[0]?.amount ?? 0;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.palette.scrim }, scrimStyle]}
      />
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            flex: 1,
            marginTop: insets.top + 8,
            backgroundColor: theme.palette.bg,
            borderTopLeftRadius: theme.radii.sheet,
            borderTopRightRadius: theme.radii.sheet,
            borderTopWidth: 1,
            borderColor: theme.palette.borderStrong,
            overflow: 'hidden',
          },
          sheetStyle,
        ]}
      >
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View
            style={{
              width: theme.layout.sheetHandleWidth,
              height: theme.layout.sheetHandleHeight,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.palette.borderStrong,
            }}
          />
        </View>

        <ScrollView
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
          onScroll={onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingTop: 18,
            paddingBottom: 32,
          }}
        >
          <Animated.View entering={stepEntering(CHUNK.eyebrow)}>
            <Text size="caption" color="textFaint" tabular>
              {formatCycleRange(recap.period, locale)}
            </Text>
          </Animated.View>

          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={title}
            style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, marginTop: 4 }}
          >
            {title.split(' ').map((word, index) => (
              <Animated.View
                // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
                key={`${index}-${word}`}
                entering={stepEntering(CHUNK.title, index)}
              >
                <Text size="title" weight="semibold" tracking="tighter">
                  {word}
                </Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={stepEntering(CHUNK.hero)} style={{ marginTop: 18 }}>
            <Card>
              <Text size="footnote" color="textMuted">
                {t(`recap.net_${kind}`)}
              </Text>
              <HeroNet net={recap.net} currency={currency} locale={locale} />
              {comparisons.length === 0 ? null : (
                <Text size="caption" color="textMuted" tabular style={{ marginTop: 8 }}>
                  {comparisons.join(' · ')}
                </Text>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 16,
                  marginTop: 16,
                  paddingTop: 16,
                  borderTopWidth: 1,
                  borderColor: theme.palette.border,
                }}
              >
                <Figure
                  label={t('recap.income')}
                  minor={recap.income}
                  delta={recap.incomeDelta === null ? null : t(`recap.delta_${kind}`, { pct: formatSignedPercent(recap.incomeDelta) })}
                  currency={currency}
                  locale={locale}
                  positive
                />
                <Figure
                  label={t('recap.expenses')}
                  minor={recap.spent}
                  delta={recap.spentDelta === null ? null : t(`recap.delta_${kind}`, { pct: formatSignedPercent(recap.spentDelta) })}
                  currency={currency}
                  locale={locale}
                />
              </View>
            </Card>
          </Animated.View>

          <Animated.View
            entering={stepEntering(CHUNK.rest)}
            onLayout={(event) => setRestY(event.nativeEvent.layout.y)}
          >
            {recap.categories.length === 0 ? null : (
              <View
                style={{ marginTop: 28 }}
                onLayout={(event) => {
                  const y = event.nativeEvent.layout.y;
                  setSectionY((current) => ({ ...current, categories: y }));
                }}
              >
                <Text weight="medium" tracking="tight">
                  {t('recap.categories')}
                </Text>
                <View style={{ marginTop: 14, gap: 14 }}>
                  {recap.categories.map((row, index) => {
                    const found = byId.get(row.categoryId);
                    return (
                      <View key={row.categoryId}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: theme.radii.pill,
                              backgroundColor: theme.categoryColor(found?.colorIndex ?? 9),
                            }}
                          />
                          <Text size="footnote" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {found?.name ?? t('recap.uncategorized')}
                          </Text>
                          {row.aboveUsual === null ? null : (
                            <View
                              style={{
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: theme.radii.pill,
                                backgroundColor: theme.palette.raised,
                                borderWidth: 1,
                                borderColor: theme.palette.border,
                              }}
                            >
                              <Text size="caption" tabular>
                                {t('recap.aboveUsual', { pct: formatSignedPercent(row.aboveUsual) })}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }} />
                          <AmountText
                            minor={row.amount}
                            currency={currency}
                            locale={locale}
                            size="footnote"
                            align="end"
                          />
                        </View>
                        <RecapBar
                          ratio={topAmount === 0 ? 0 : row.amount / topAmount}
                          accent={row.aboveUsual !== null}
                          seen={inView(sectionY.categories)}
                          index={index}
                        />
                      </View>
                    );
                  })}
                  {recap.otherCategories.count === 0 ? null : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text size="footnote" color="textFaint" style={{ flex: 1 }}>
                        {t('recap.otherCategories', { count: recap.otherCategories.count })}
                      </Text>
                      <AmountText
                        minor={recap.otherCategories.amount}
                        currency={currency}
                        locale={locale}
                        size="footnote"
                        color="textFaint"
                        align="end"
                      />
                    </View>
                  )}
                </View>
              </View>
            )}

            {recap.budgets.length === 0 ? null : (
              <View
                style={{ marginTop: 28 }}
                onLayout={(event) => {
                  const y = event.nativeEvent.layout.y;
                  setSectionY((current) => ({ ...current, budgets: y }));
                }}
              >
                <Text weight="medium" tracking="tight">
                  {t('recap.budgets')}
                </Text>
                <View style={{ marginTop: 14, gap: 14 }}>
                  {recap.budgets.map((row, index) => (
                    <View key={row.budgetId}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text size="footnote" numberOfLines={1} style={{ flex: 1 }}>
                          {row.name}
                        </Text>
                        <AmountText
                          minor={row.spent}
                          currency={currency}
                          locale={locale}
                          size="footnote"
                          color={row.over ? 'accent' : 'text'}
                          align="end"
                        />
                        <Text size="footnote" color="textFaint" tabular>
                          {t('recap.of', { amount: format(row.limit, currency, locale) })}
                        </Text>
                      </View>
                      <RecapBar
                        ratio={row.limit === 0 ? 0 : row.spent / row.limit}
                        accent={row.over}
                        seen={inView(sectionY.budgets)}
                        index={index}
                      />
                      <Text
                        size="caption"
                        color={row.over ? 'accent' : 'textMuted'}
                        weight={row.over ? 'medium' : 'regular'}
                        tabular
                        style={{ marginTop: 6 }}
                      >
                        {row.over
                          ? t('recap.over', { amount: format(row.spent - row.limit, currency, locale) })
                          : row.carry > 0
                            ? t('recap.withinCarry', { amount: format(row.carry, currency, locale) })
                            : t('recap.within')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ marginTop: 28 }}>
              <Text weight="medium" tracking="tight">
                {t('recap.other')}
              </Text>
              {recap.biggestExpense === null ? null : (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 12, gap: 12 }}>
                  <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
                    {t('recap.biggest')}
                  </Text>
                  <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
                    <Text size="footnote" numberOfLines={1}>
                      {recap.biggestExpense.description.trim() === ''
                        ? (byId.get(recap.biggestExpense.categoryId ?? '')?.name ?? t('recap.uncategorized'))
                        : recap.biggestExpense.description}
                    </Text>
                    <AmountText
                      minor={recap.biggestExpense.amount}
                      currency={currency}
                      locale={locale}
                      size="footnote"
                      align="end"
                      plain
                    />
                    <Text size="caption" color="textFaint">
                      {formatDayMonth(recap.biggestExpense.date, locale)}
                    </Text>
                  </View>
                </View>
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  paddingVertical: 12,
                  borderTopWidth: recap.biggestExpense === null ? 0 : 1,
                  borderColor: theme.palette.border,
                }}
              >
                <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
                  {t('recap.netWorth')}
                </Text>
                <AmountText
                  minor={recap.netWorthChange}
                  currency={currency}
                  locale={locale}
                  size="footnote"
                  signDisplay="always"
                  color={recap.netWorthChange >= 0 ? 'positive' : 'text'}
                  align="end"
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        <View
          style={{
            paddingHorizontal: theme.layout.screenPaddingX,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 1,
            borderColor: theme.palette.border,
            backgroundColor: theme.palette.bg,
          }}
        >
          <PrimaryButton label={t(`recap.start_${kind}`)} onPress={dismiss} />
        </View>
      </Animated.View>
    </Modal>
  );
}

/**
 * The net, counting up from zero as its block lands (`countMs`). Read once as its final value: the
 * wrapper carries the label, so a screen reader never hears the count.
 */
function HeroNet({
  net,
  currency,
  locale,
}: {
  net: number;
  currency: CurrencyCode;
  locale: AppLocale;
}) {
  const { reduced } = useMotion();
  const { hidden } = useHiddenAmounts();
  const { format } = useHiddenMoney();
  const [target, setTarget] = useState(reduced ? net : 0);
  useEffect(() => {
    if (reduced) {
      setTarget(net);
      return;
    }
    const id = setTimeout(() => setTarget(net), stepDelay(CHUNK.hero));
    return () => clearTimeout(id);
  }, [net, reduced]);
  const shown = useCountUp(target, !hidden);
  return (
    <View accessible accessibilityLabel={format(net, currency, locale, 'always')} style={{ marginTop: 6 }}>
      <AmountText
        minor={hidden ? net : shown}
        currency={currency}
        locale={locale}
        size="display"
        weight="semibold"
        tracking="tighter"
        signDisplay="always"
        color={net >= 0 ? 'positive' : 'text'}
      />
    </View>
  );
}

function Figure({
  label,
  minor,
  delta,
  currency,
  locale,
  positive = false,
}: {
  label: string;
  minor: number;
  delta: string | null;
  currency: CurrencyCode;
  locale: AppLocale;
  positive?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text size="caption" color="textFaint">
        {label}
      </Text>
      <AmountText
        minor={minor}
        currency={currency}
        locale={locale}
        color={positive ? 'positive' : 'text'}
        style={{ marginTop: 3 }}
      />
      {delta === null ? null : (
        <Text size="caption" color="textMuted" tabular style={{ marginTop: 3 }}>
          {delta}
        </Text>
      )}
    </View>
  );
}
```

- [x] **Step 4: Run the test to see it pass**

Run: `pnpm --filter mobile test -- PeriodRecapSheet`
Expected: PASS, 4 tests. If `getByLabelText('September 2026 is over')` fails, print
`formatMonthYear({ year: 2026, month: 9 }, 'en')` and match the test to the formatter's real output; the formatter is
the source of truth, not the test.

- [x] **Step 5: Lint and typecheck**

Run: `pnpm --filter mobile typecheck && pnpm lint`
Expected: no type errors; no `lint/…` lines in the Biome output (see AGENTS.md: the exit code alone is not proof). Let
Biome format the file with `pnpm exec biome format --write apps/mobile/src/features/recap` if it reports formatting.

- [x] **Step 6: Commit**

```bash
git add apps/mobile/src/features/recap/PeriodRecapSheet.tsx apps/mobile/src/features/recap/PeriodRecapSheet.test.tsx
git commit -m "feat(mobile): the period recap sheet"
```

---

## Task 10: The gate

**Files:**
- Create: `apps/mobile/src/features/recap/PeriodRecapGate.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [x] **Step 1: Write the gate**

`apps/mobile/src/features/recap/PeriodRecapGate.tsx`:

```tsx
import {
  type DateRange,
  type LocalDate,
  type PeriodDef,
  periodContaining,
  periodRecap,
  recapPeriod,
} from '@saldo/core';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../db/DatabaseProvider';
import {
  useAccountsQuery,
  useBudgetsQuery,
  useCategoriesQuery,
  useSettings,
  useTransactionsInRangeQuery,
} from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { log } from '../../log';
import { usePeriod } from '../period/PeriodProvider';
import { PeriodRecapSheet } from './PeriodRecapSheet';
import {
  isRecapDue,
  isRecapNotificationId,
  nextRecapNotification,
  RECAP_KEY,
  recapPayload,
  recapStamp,
} from './recapSchedule';

/**
 * The period recap of §5.15: on the first open of a new period, once, a sheet recapping the one
 * that closed; and, always, the next 09:00 notification kept scheduled.
 *
 * Mounted in the tabs layout, which exists only past the boot router and the lock, so the sheet
 * never draws over the lock screen. The ledger is read only when a recap is due, by `RecapHost`.
 */
export function PeriodRecapGate() {
  const { t } = useTranslation();
  const { kv } = useDatabase();
  const settings = useSettings();
  const { today, def } = usePeriod();
  const closed = useMemo(() => recapPeriod(def, today), [def, today]);
  const stamp = recapStamp(def, closed);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (settings === null || open !== null) return;
    const due = isRecapDue({
      stamp,
      stored: kv.get(RECAP_KEY),
      onboardingCompletedAt: settings.onboardingCompletedAt,
      currentStart: periodContaining(def, today).start,
    });
    if (due) setOpen(stamp);
  }, [settings, open, stamp, kv, def, today]);

  const ready = settings !== null;
  useEffect(() => {
    if (!ready) return;
    const planned = nextRecapNotification(def, today, new Date());
    const title = t(`recap.notification_${def.kind}`);
    let cancelled = false;
    void (async () => {
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const request of scheduled) {
          if (isRecapNotificationId(request.identifier)) {
            await Notifications.cancelScheduledNotificationAsync(request.identifier);
          }
        }
        if (planned === null || cancelled) return;
        // Never asks: the prompt belongs to onboarding and to the budget alerts (§6.29).
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted || cancelled) return;
        await Notifications.scheduleNotificationAsync({
          identifier: planned.identifier,
          content: { title, data: recapPayload() },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: planned.at },
        });
      } catch (error) {
        log('recap', 'scheduling failed', { error: String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, def, today, t]);

  if (open === null) return null;
  return (
    <RecapHost
      period={closed}
      def={def}
      today={today}
      stamp={open}
      onClosed={() => setOpen(null)}
    />
  );
}

/**
 * Loads the ledger up to the closed period's end, stamps the period as soon as the answer is known
 * — so closing the app with the sheet open does not show it again — and shows the sheet unless
 * the period turned out empty.
 */
function RecapHost({
  period,
  def,
  today,
  stamp,
  onClosed,
}: {
  period: DateRange;
  def: PeriodDef;
  today: LocalDate;
  stamp: string;
  onClosed: () => void;
}) {
  const { kv } = useDatabase();
  const settings = useSettings();
  const locale = useAppLocale();
  const { rows, loaded: rowsLoaded } = useTransactionsInRangeQuery('1970-01-01', period.end);
  const { rows: categories, loaded: categoriesLoaded } = useCategoriesQuery();
  const { rows: budgets, loaded: budgetsLoaded } = useBudgetsQuery();
  const { accounts, loaded: accountsLoaded } = useAccountsQuery();
  const loaded = rowsLoaded && categoriesLoaded && budgetsLoaded && accountsLoaded;

  const recap = useMemo(
    () =>
      loaded
        ? periodRecap({ def, period, today, transactions: rows, categories, budgets, accounts })
        : null,
    [loaded, def, period, today, rows, categories, budgets, accounts],
  );

  const settled = useRef(false);
  useEffect(() => {
    if (!loaded || settled.current) return;
    settled.current = true;
    kv.set(RECAP_KEY, stamp);
    if (recap === null) onClosed();
  }, [loaded, recap, kv, stamp, onClosed]);

  if (!loaded || recap === null || settings === null) return null;
  return (
    <PeriodRecapSheet
      recap={recap}
      kind={def.kind}
      categories={categories}
      currency={settings.currency}
      locale={locale}
      onClose={onClosed}
    />
  );
}
```

- [x] **Step 2: Mount it**

In `apps/mobile/app/(tabs)/_layout.tsx`, import it and render it next to the reminders:

```tsx
import { PeriodRecapGate } from '../../src/features/recap/PeriodRecapGate';
```

```tsx
      {/* Here rather than on Home: the reminders follow every write, whichever screen made it. */}
      <CardRemindersGate />
      {/* The recap of the period that just closed (§5.15), over whichever tab opens first. */}
      <PeriodRecapGate />
```

- [x] **Step 3: Typecheck, lint, test**

Run: `pnpm typecheck && pnpm test`
Expected: all packages pass.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

- [x] **Step 4: Commit**

```bash
git add apps/mobile/src/features/recap/PeriodRecapGate.tsx "apps/mobile/app/(tabs)/_layout.tsx"
git commit -m "feat(mobile): show the period recap once and schedule its notification"
```

---

## Task 11: Device check

The recap depends on the date and on a device-local stamp, so it is checked on the simulator by clearing the stamp.

- [ ] **Step 1: Run the app with data in the previous period**

Start Metro and the iOS simulator (`pnpm --filter mobile ios`). Use a database with transactions in the previous period
(the demo data, or real ones), and make sure onboarding was completed before the current period started.

- [ ] **Step 2: Clear the stamp and relaunch**

Find the database with `xcrun simctl get_app_container booted io.github.saldo.app data`, then
`sqlite3 "<container>/Documents/SQLite/saldo.db" "delete from kv where key = 'lastRecapPeriod';"`, and relaunch the app.

Expected, on the first launch:
- the sheet rises over Home; eyebrow, title word by word, the card, then the rest arrive in order;
- the net counts up from zero; categories and budget bars grow when scrolled to;
- «Sforato» appears in accent **and** in words; the tagged category's bar is in accent;
- «Inizia il nuovo mese» takes the sheet down, quicker than it came.

Expected, on the second launch: no sheet.

- [ ] **Step 3: Check the variants**

- Hidden mode on (eye on Home), clear the stamp, relaunch: every aggregate is `••••`, the biggest expense readable.
- Reduce Motion on (Settings › Accessibility › Motion): the sheet fades in, no count, bars full.
- Profilo › periodo «Settimana», clear the stamp, relaunch: «La settimana si è chiusa», «Inizia la nuova settimana».
- Light theme: contrast of the tag and of the accent bar.

- [ ] **Step 4: Check the notification**

Run in the Metro console (or a dev button): `Notifications.getAllScheduledNotificationsAsync()`.
Expected: one request `period-recap:{first day of the next period}` at 09:00, title «Il tuo mese si è chiuso: guarda
il riepilogo», when notifications are allowed; none when they are not.

- [ ] **Step 5: Record the check**

Tick the steps above in this plan and write, under this task, what was seen (device, iOS version, anything off).

---

## Task 12: Close the phase

- [ ] **Step 1: Full verification**

Run: `pnpm typecheck && pnpm test && rtk proxy pnpm lint`
Expected: everything passes; Biome prints no `lint/…` lines.

- [ ] **Step 2: Roadmap**

In `ROADMAP.md`, under «Period recap», change `- [ ] Plan, then build.` to
`- [x] Plan (`docs/superpowers/plans/2026-09-25-period-recap.md`) and build.`

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md docs/superpowers/plans/2026-09-25-period-recap.md
git commit -m "docs(plan): period recap done, checked on the simulator"
```

- [ ] **Step 4: Review and merge**

Use **requesting-code-review** on the branch, address the findings, then merge `feat/period-recap` into `main`.
