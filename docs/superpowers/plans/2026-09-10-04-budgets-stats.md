# Budgets & Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Budgets that track a cycle, a week or a year with optional rollover, and the statistics screen: cashflow, committed share, end-of-cycle projection, category breakdown and category detail.

**Architecture:** Everything numeric is a pure function. Core gains the budget ranges and the rollover carry; the mobile side adds `budgetViews`, one pure function over already-loaded rows that produces everything the budget list, the Home card and the detail sheet render. Screens call it inside `useMemo`. Budget alerts are also split: a pure `pendingBudgetAlerts` decides, and a component sends.

**Tech Stack:** As phase 03, plus `expo-notifications` for the threshold alerts.

**Spec:** §5.4, §5.5, §5.7, §5.8, §6.3, §6.4, §6.12, §6.17, §6.18.

**Note on process:** recorded *as built*, like phase 03.

---

## File structure

```
packages/core/src/
├─ budgetRanges.ts           cycle / ISO week / calendar year ranges
├─ rollover.ts               recursive carry, effective limit
└─ *.test.ts

apps/mobile/
├─ app/
│  ├─ (tabs)/stats.tsx       §6.3 / §5.7
│  ├─ budgets.tsx            §6.4
│  ├─ budget/new.tsx         §6.18
│  ├─ budget/[id].tsx        §6.18 reused for edit
│  └─ category/[id].tsx      §6.12
└─ src/features/
   ├─ budgets/useBudgetProgress.ts   pure view model
   ├─ budgets/BudgetForm.tsx         §6.18
   ├─ budgets/BudgetDetailSheet.tsx  §6.17
   ├─ budgets/HomeBudgetCard.tsx     §6.1 budget card
   ├─ budgets/budgetAlerts.ts        pure "should we notify" decision
   ├─ budgets/BudgetAlertsGate.tsx   sends them
   └─ stats/{CashflowChart,SplitBar}.tsx
```

---

### Task 1: Budget ranges in `@saldo/core`

Spec §5.8. A budget measures the selected cycle, the ISO week containing today, or the calendar
year of the cycle's end.

**Files:** create `packages/core/src/budgetRanges.ts`, test `budgetRanges.test.ts`, export from `index.ts`.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { budgetRange, isoWeekRange, yearRange } from './budgetRanges';

const APRIL = { start: '2026-03-27', end: '2026-04-26' };

describe('isoWeekRange', () => {
  it('runs Monday to Sunday around the given date', () => {
    // 2026-04-18 is a Saturday.
    expect(isoWeekRange('2026-04-18')).toEqual({ start: '2026-04-13', end: '2026-04-19' });
  });

  it('keeps a Monday and a Sunday inside their own week', () => {
    expect(isoWeekRange('2026-04-13')).toEqual({ start: '2026-04-13', end: '2026-04-19' });
    expect(isoWeekRange('2026-04-19')).toEqual({ start: '2026-04-13', end: '2026-04-19' });
  });

  it('crosses months and years', () => {
    expect(isoWeekRange('2026-01-01')).toEqual({ start: '2025-12-29', end: '2026-01-04' });
  });
});

describe('yearRange', () => {
  it('is the calendar year of the date', () => {
    expect(yearRange('2026-04-18')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('budgetRange', () => {
  it('is the selected cycle for a cycle budget', () => {
    expect(budgetRange('cycle', APRIL, '2026-04-18')).toEqual(APRIL);
  });

  it('is the week containing today when the cycle is the current one', () => {
    expect(budgetRange('week', APRIL, '2026-04-18')).toEqual({
      start: '2026-04-13',
      end: '2026-04-19',
    });
  });

  it('is the last week of a past cycle, clipped to the cycle', () => {
    // §5.8: for past cycles, the week budget shows that cycle's last week.
    expect(budgetRange('week', APRIL, '2026-06-01')).toEqual({
      start: '2026-04-20',
      end: '2026-04-26',
    });
  });

  it('is the calendar year of the cycle end for a year budget', () => {
    expect(budgetRange('year', APRIL, '2026-04-18')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
    expect(budgetRange('year', { start: '2025-12-27', end: '2026-01-26' }, '2026-01-05')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @saldo/core exec vitest run src/budgetRanges`

- [x] **Step 3: Implement it**

The week of a *past* cycle is that cycle's last week, clipped to the cycle: "this week" means
nothing once the cycle is closed, and an unclipped week would leak days into the next cycle.

```ts
import type { Cycle, DateRange } from './cycle';
import { isWithin } from './cycle';
import { addDays, type LocalDate, makeLocalDate, parseLocalDate } from './dates';
import type { Budget } from './entities';

/** Day of week with Monday as 0, from a `LocalDate` without going through a time zone. */
function isoWeekday(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  // getUTCDay is Sunday-based; shift so Monday is 0.
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** The ISO week (Monday–Sunday) containing `date` (§5.8). */
export function isoWeekRange(date: LocalDate): DateRange {
  const start = addDays(date, -isoWeekday(date));
  return { start, end: addDays(start, 6) };
}

/** The calendar year containing `date`. */
export function yearRange(date: LocalDate): DateRange {
  const { year } = parseLocalDate(date);
  return { start: makeLocalDate(year, 1, 1), end: makeLocalDate(year, 12, 31) };
}

/**
 * The range a budget measures (§5.8): the selected cycle, the ISO week containing today, or the
 * calendar year of the cycle's end.
 *
 * For a past cycle the week budget shows *that cycle's last week*, clipped to the cycle, since
 * "this week" is meaningless once the cycle is closed.
 */
export function budgetRange(period: Budget['period'], cycle: Cycle, today: LocalDate): DateRange {
  if (period === 'cycle') return cycle;
  if (period === 'year') return yearRange(cycle.end);
  if (isWithin(cycle, today)) return isoWeekRange(today);
  const lastWeek = isoWeekRange(cycle.end);
  return {
    start: lastWeek.start < cycle.start ? cycle.start : lastWeek.start,
    end: lastWeek.end > cycle.end ? cycle.end : lastWeek.end,
  };
}
```

- [x] **Step 4: Commit**

```bash
git add packages/core/src/budgetRanges.ts packages/core/src/budgetRanges.test.ts packages/core/src/index.ts
git commit -m "feat(core): add budget ranges"
```

---

### Task 2: Rollover carry in `@saldo/core`

Spec §5.8: `effectiveLimit = amount + carry`, `carry = max(0, prevEffectiveLimit − prevSpent)`,
recursive back to the budget's creation cycle.

**Files:** create `packages/core/src/rollover.ts`, test `rollover.test.ts`, export from `index.ts`.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { budgetCarry, effectiveLimit } from './rollover';

const START_DAY = 27;
const APRIL = { start: '2026-03-27', end: '2026-04-26' };

/** Spend per cycle start, as the caller would load it. */
function spentBy(entries: Record<string, number>) {
  return (range: { start: string }) => entries[range.start] ?? 0;
}

describe('budgetCarry', () => {
  it('is zero in the cycle the budget was created in', () => {
    expect(
      budgetCarry({
        amount: 40000,
        createdAtCycleStart: APRIL.start,
        cycle: APRIL,
        cycleStartDay: START_DAY,
        spentInCycle: spentBy({}),
      }),
    ).toBe(0);
  });

  it('carries what the previous cycle left unspent', () => {
    const carry = budgetCarry({
      amount: 40000,
      createdAtCycleStart: '2026-02-27',
      cycle: APRIL,
      cycleStartDay: START_DAY,
      spentInCycle: spentBy({ '2026-02-27': 30000 }),
    });
    expect(carry).toBe(10000);
  });

  it('accumulates across cycles', () => {
    // The cycle starting 27 Mar is preceded by the ones starting 27 Feb, 27 Jan and 27 Dec, and a
    // cycle never contributes to its own carry.
    const carry = budgetCarry({
      amount: 40000,
      createdAtCycleStart: '2025-12-27',
      cycle: APRIL,
      cycleStartDay: START_DAY,
      spentInCycle: spentBy({ '2025-12-27': 40000, '2026-01-27': 30000, '2026-02-27': 20000 }),
    });
    // Dec: spent the lot → carry 0. Jan: limit 40000, spent 30000 → carry 10000.
    // Feb: limit 50000, spent 20000 → carry 30000.
    expect(carry).toBe(30000);
  });

  it('ignores what the selected cycle itself has spent', () => {
    const carry = budgetCarry({
      amount: 40000,
      createdAtCycleStart: '2026-02-27',
      cycle: APRIL,
      cycleStartDay: START_DAY,
      spentInCycle: spentBy({ '2026-02-27': 30000, '2026-03-27': 99999 }),
    });
    expect(carry).toBe(10000);
  });

  it('never carries a debt', () => {
    const carry = budgetCarry({
      amount: 40000,
      createdAtCycleStart: '2026-02-27',
      cycle: APRIL,
      cycleStartDay: START_DAY,
      spentInCycle: spentBy({ '2026-02-27': 90000 }),
    });
    expect(carry).toBe(0);
  });

  it('is zero for a cycle before the budget existed', () => {
    expect(
      budgetCarry({
        amount: 40000,
        createdAtCycleStart: '2026-04-27',
        cycle: APRIL,
        cycleStartDay: START_DAY,
        spentInCycle: spentBy({}),
      }),
    ).toBe(0);
  });
});

describe('effectiveLimit', () => {
  it('adds the carry only when rollover is on', () => {
    const input = {
      amount: 40000,
      createdAtCycleStart: '2026-02-27',
      cycle: APRIL,
      cycleStartDay: START_DAY,
      spentInCycle: spentBy({ '2026-02-27': 30000 }),
    };
    expect(effectiveLimit({ ...input, rollover: true })).toBe(50000);
    expect(effectiveLimit({ ...input, rollover: false })).toBe(40000);
  });
});
```

Careful with the fixtures: the cycle *starting* 27 March is preceded by the one starting 27
February, and a cycle never contributes to its own carry. A first version of this test asserted
30000 where the answer is 10000 — the code was right and the test was wrong, which is worth
knowing when this fails for you.

- [x] **Step 2: Implement it**

The chain is collected oldest-first by walking `shiftCycle` back from the selected cycle, so each
step can use the carry the step before produced. `max(0, …)` at every step is what stops a cycle
carrying a *debt* forward: overspending is shown, never deducted from next month.

```ts
import { type Cycle, shiftCycle } from './cycle';
import type { LocalDate } from './dates';
import type { MinorUnits } from './money';

export interface RolloverInput {
  /** The budget's own limit, before any carry. */
  amount: MinorUnits;
  /** Start of the cycle the budget was created in; earlier cycles carry nothing. */
  createdAtCycleStart: LocalDate;
  cycle: Cycle;
  cycleStartDay: number;
  /** Counted spend of the budget's categories in a cycle, loaded by the caller. */
  spentInCycle: (cycle: Cycle) => MinorUnits;
}

/**
 * Unspent budget carried into `cycle` (§5.8): `carry = max(0, prevEffectiveLimit − prevSpent)`,
 * applied recursively back to the cycle the budget was created in.
 *
 * A cycle can never carry a debt forward — overspending is shown, not deducted from next month —
 * hence the `max(0, …)` at every step.
 */
export function budgetCarry(input: RolloverInput): MinorUnits {
  const { amount, createdAtCycleStart, cycle, cycleStartDay, spentInCycle } = input;
  if (cycle.start <= createdAtCycleStart) return 0;

  // Collect the cycles from creation up to the one before `cycle`, oldest first, so each step can
  // use the carry the step before produced.
  const chain: Cycle[] = [];
  let previous = shiftCycle(cycle, cycleStartDay, -1);
  while (previous.start >= createdAtCycleStart) {
    chain.unshift(previous);
    if (previous.start === createdAtCycleStart) break;
    previous = shiftCycle(previous, cycleStartDay, -1);
  }

  let carry = 0;
  for (const previous of chain) {
    carry = Math.max(0, amount + carry - spentInCycle(previous));
  }
  return carry;
}

/** The limit a cycle budget actually measures against (§5.8). */
export function effectiveLimit(input: RolloverInput & { rollover: boolean }): MinorUnits {
  return input.rollover ? input.amount + budgetCarry(input) : input.amount;
}
```

- [x] **Step 3: Commit**

```bash
git add packages/core/src/rollover.ts packages/core/src/rollover.test.ts packages/core/src/index.ts
git commit -m "feat(core): add rollover carry"
```

---

### Task 3: The budget view model

Spec §5.8, §6.4. One pure function over already-loaded rows, so the list, the Home card and the
detail sheet all read the same numbers and none of them computes anything.

**Files:** create `apps/mobile/src/features/budgets/useBudgetProgress.ts` and its test.

- [x] **Step 1: Write the failing test**

```ts
import type { Budget, Category, Transaction } from '@saldo/core';
import { budgetViews } from './useBudgetProgress';

const CYCLE = { start: '2026-03-27', end: '2026-04-26' };
const TODAY = '2026-04-18';
const START_DAY = 27;

function category(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name: id,
    direction: 'expense',
    parentId: null,
    icon: 'cart',
    colorIndex: 0,
    archivedAt: null,
    sortOrder: 0,
    ...overrides,
  };
}

function tx(date: string, amount: number, categoryId = 'cat-food'): Transaction {
  return {
    id: `${date}-${amount}-${categoryId}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    kind: 'expense',
    amount,
    date,
    accountId: 'acc-1',
    toAccountId: null,
    categoryId,
    description: '',
    note: null,
    tagIds: [],
    excludeFromTotals: false,
    recurrenceId: null,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '001775000000000-0000-dev',
    deletedAt: null,
    name: 'Spesa',
    categoryIds: ['cat-food'],
    amount: 40000,
    period: 'cycle',
    alertThreshold: 90,
    rollover: false,
    icon: 'cart',
    sortOrder: 0,
    ...overrides,
  };
}

const categories = [category('cat-food'), category('cat-market', { parentId: 'cat-food' })];

function view(overrides: Partial<Budget>, transactions: Transaction[]) {
  const [only] = budgetViews({
    budgets: [budget(overrides)],
    categories,
    transactions,
    cycle: CYCLE,
    cycleStartDay: START_DAY,
    today: TODAY,
  });
  if (only === undefined) throw new Error('no view');
  return only;
}

describe('budgetViews', () => {
  it('sums the budget categories and their children inside the cycle', () => {
    const result = view({}, [tx('2026-04-01', 12000), tx('2026-04-02', 8000, 'cat-market')]);
    expect(result.spent).toBe(20000);
    expect(result.limit).toBe(40000);
    expect(result.ratio).toBeCloseTo(0.5, 10);
  });

  it('ignores rows outside the range', () => {
    const result = view({}, [tx('2026-03-26', 50000), tx('2026-04-27', 50000)]);
    expect(result.spent).toBe(0);
  });

  it('reports the days left and whether the range is still open', () => {
    const result = view({}, []);
    // Cycle is 31 days and today is day 23.
    expect(result.daysLeft).toBe(8);
    expect(result.open).toBe(true);
  });

  it('measures a week budget against the ISO week containing today', () => {
    const result = view({ period: 'week' }, [
      tx('2026-04-13', 1000),
      tx('2026-04-17', 2000),
      // Outside the week 13–19 Apr.
      tx('2026-04-12', 9000),
      tx('2026-04-20', 9000),
    ]);
    expect(result.range).toEqual({ start: '2026-04-13', end: '2026-04-19' });
    expect(result.spent).toBe(3000);
  });

  it('leaves a scheduled row inside the range out of the spend', () => {
    // 19 Apr is inside the week but still in the future, and §5.3 counts nothing after today.
    const result = view({ period: 'week' }, [tx('2026-04-13', 1000), tx('2026-04-19', 2000)]);
    expect(result.spent).toBe(1000);
  });

  it('measures a year budget against the calendar year', () => {
    const result = view({ period: 'year' }, [tx('2026-01-15', 5000), tx('2025-12-31', 9000)]);
    expect(result.range).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(result.spent).toBe(5000);
  });

  it('adds the rollover carry to the limit, but only for a cycle budget', () => {
    // Created in the cycle starting 27 Dec; the two cycles before this one each leave 30000.
    const transactions = [tx('2026-01-05', 10000), tx('2026-02-05', 10000)];
    const withRollover = view(
      { rollover: true, createdAt: '2025-12-28T00:00:00.000Z' },
      transactions,
    );
    const without = view({ rollover: false, createdAt: '2025-12-28T00:00:00.000Z' }, transactions);
    expect(withRollover.limitWithCarry).toBeGreaterThan(without.limitWithCarry);
    expect(without.limitWithCarry).toBe(40000);
  });

  it('flags over pace, over limit and the alert threshold', () => {
    const result = view({ alertThreshold: 50 }, [tx('2026-04-01', 45000)]);
    expect(result.overLimit).toBe(true);
    expect(result.overPace).toBe(true);
    expect(result.alertReached).toBe(true);
  });
});
```

- [x] **Step 2: Implement it**

Note `createdAtCycleStart`: the carry walks back to the cycle the budget was created **in**, so the
ISO timestamp has to be mapped onto a cycle first — slicing the date out of it is not the same
thing.

```ts
import type { Budget } from '@saldo/core';
import {
  type BudgetProgress,
  budgetProgress,
  budgetRange,
  type Category,
  type Cycle,
  cycleContaining,
  cycleLength,
  effectiveLimit,
  elapsedDays,
  expandCategoryIds,
  type LocalDate,
  spendingByCategory,
  type Transaction,
} from '@saldo/core';

export interface BudgetView extends BudgetProgress {
  budget: Budget;
  range: { start: LocalDate; end: LocalDate };
  /** Days left in the range, floored at 0 (§6.4). */
  daysLeft: number;
  /** True while the range still contains today. */
  open: boolean;
  /** `amount` plus any rollover carry (§5.8). */
  limitWithCarry: number;
}

export interface BudgetProgressInput {
  budgets: readonly Budget[];
  categories: readonly Category[];
  /** Rows covering the selected cycle *and* the cycles the carry walks back through. */
  transactions: readonly Transaction[];
  cycle: Cycle;
  cycleStartDay: number;
  today: LocalDate;
}

/**
 * Turns budgets into everything §5.8 and §6.4 render. Kept as a pure function over already-loaded
 * rows: screens call it inside `useMemo`, and it is testable without a database.
 */
export function budgetViews(input: BudgetProgressInput): BudgetView[] {
  const { budgets, categories, transactions, cycle, cycleStartDay, today } = input;

  return budgets.map((budget) => {
    const range = budgetRange(budget.period, cycle, today);
    const spending = spendingByCategory(transactions, range, today);

    // Rollover only applies to cycle budgets (§5.8); the others ignore the toggle.
    const ids = expandCategoryIds(budget.categoryIds, categories);
    const spentIn = (target: Cycle): number => {
      const amounts = spendingByCategory(transactions, target, today);
      let total = 0;
      for (const id of ids) total += amounts.get(id) ?? 0;
      return total;
    };
    const limitWithCarry =
      budget.period === 'cycle'
        ? effectiveLimit({
            amount: budget.amount,
            // The carry walks back to the cycle the budget was created *in*, not to its
            // creation date, so the ISO timestamp has to be mapped onto a cycle first.
            createdAtCycleStart: cycleContaining(budget.createdAt.slice(0, 10), cycleStartDay)
              .start,
            cycle,
            cycleStartDay,
            spentInCycle: spentIn,
            rollover: budget.rollover,
          })
        : budget.amount;

    const length = cycleLength(range);
    const elapsed = elapsedDays(range, today);
    const progress = budgetProgress(
      { ...budget, amount: limitWithCarry },
      spending,
      categories,
      length === 0 ? 0 : elapsed / length,
    );

    return {
      ...progress,
      budget,
      range,
      daysLeft: Math.max(0, length - elapsed),
      open: today >= range.start && today <= range.end,
      limitWithCarry,
    };
  });
}
```

- [x] **Step 3: Run and commit**

```bash
pnpm --filter mobile test src/features/budgets
```

---

### Task 4: Budget alerts

Spec §5.8: notify once per budget per period when `ratio × 100` crosses `alertThreshold`.

**Files:** create `budgetAlerts.ts` + test, and `BudgetAlertsGate.tsx`.

- [x] **Step 1: Write the failing test**

```ts
import { alertKey, pendingBudgetAlerts } from './budgetAlerts';
import type { BudgetView } from './useBudgetProgress';

function view(overrides: Partial<BudgetView> = {}): BudgetView {
  return {
    budget: {
      id: 'b1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '001775000000000-0000-dev',
      deletedAt: null,
      name: 'Spesa',
      categoryIds: ['cat-food'],
      amount: 40000,
      period: 'cycle',
      alertThreshold: 90,
      rollover: false,
      icon: 'cart',
      sortOrder: 0,
    },
    range: { start: '2026-03-27', end: '2026-04-26' },
    daysLeft: 8,
    open: true,
    limitWithCarry: 40000,
    spent: 38000,
    limit: 40000,
    ratio: 0.95,
    overPace: true,
    overLimit: false,
    alertReached: true,
    ...overrides,
  };
}

function store(entries: Record<string, string> = {}) {
  return { get: (key: string) => entries[key] ?? null };
}

describe('pendingBudgetAlerts', () => {
  it('reports a budget that just crossed its threshold', () => {
    expect(pendingBudgetAlerts([view()], store())).toEqual([
      { budgetId: 'b1', name: 'Spesa', percent: 95 },
    ]);
  });

  it('stays quiet when the threshold is not reached', () => {
    expect(pendingBudgetAlerts([view({ alertReached: false })], store())).toEqual([]);
  });

  it('stays quiet for a closed period', () => {
    expect(pendingBudgetAlerts([view({ open: false })], store())).toEqual([]);
  });

  it('notifies once per period', () => {
    const alerted = store({ [alertKey('b1')]: '2026-03-27' });
    expect(pendingBudgetAlerts([view()], alerted)).toEqual([]);
  });

  it('notifies again in the next period', () => {
    const alerted = store({ [alertKey('b1')]: '2026-02-27' });
    expect(pendingBudgetAlerts([view()], alerted)).toHaveLength(1);
  });
});
```

- [x] **Step 2: The pure decision**

The "already alerted" marker lives in `kv`, which is **not synced**: a notification is a property
of this device, not of the data, so two phones each alert once. The function only *reads* the
store, so the caller can mark the period after the notification is actually scheduled — a failure
then leaves the budget eligible instead of silently swallowing the alert.

```ts
import type { KvStore } from '../../db/kv';
import type { BudgetView } from './useBudgetProgress';

/** kv key holding the period a budget was last alerted for (§5.8). */
export function alertKey(budgetId: string): string {
  return `lastAlertPeriodStart:${budgetId}`;
}

export interface BudgetAlert {
  budgetId: string;
  name: string;
  /** Rounded percentage of the limit, for the notification body. */
  percent: number;
}

/**
 * Budgets whose threshold has just been crossed (§5.8). Notify **once per budget per period**, so
 * the decision needs the period the budget was last alerted for — kept device-locally in `kv`,
 * never synced: a notification is a property of this device, not of the data.
 *
 * Pure: it reads the store but does not write it, so the caller can send first and only then mark
 * the period as alerted.
 */
export function pendingBudgetAlerts(
  views: readonly BudgetView[],
  store: Pick<KvStore, 'get'>,
): BudgetAlert[] {
  return views
    .filter((view) => view.alertReached && view.open)
    .filter((view) => store.get(alertKey(view.budget.id)) !== view.range.start)
    .map((view) => ({
      budgetId: view.budget.id,
      name: view.budget.name,
      percent: Math.round(view.ratio * 100),
    }));
}
```

- [x] **Step 3: The sender**

```tsx
import * as Notifications from 'expo-notifications';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '../../db/DatabaseProvider';
import { alertKey, pendingBudgetAlerts } from './budgetAlerts';
import type { BudgetView } from './useBudgetProgress';

/**
 * Sends the local notifications of §5.8 when a budget crosses its threshold, once per budget per
 * period. The period is marked as alerted only after the notification is scheduled, so a failure
 * leaves the budget eligible to alert again rather than silently swallowing it.
 */
export function BudgetAlertsGate({
  views,
  children,
}: {
  views: readonly BudgetView[];
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { kv } = useDatabase();

  useEffect(() => {
    const alerts = pendingBudgetAlerts(views, kv);
    if (alerts.length === 0) return;
    let cancelled = false;

    void (async () => {
      const permission = await Notifications.getPermissionsAsync();
      const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted || cancelled) return;
      for (const alert of alerts) {
        await Notifications.scheduleNotificationAsync({
          content: { title: t('budgets.alertTitle', { name: alert.name, pct: alert.percent }) },
          trigger: null,
        });
        const view = views.find((candidate) => candidate.budget.id === alert.budgetId);
        if (view !== undefined) kv.set(alertKey(alert.budgetId), view.range.start);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [views, kv, t]);

  return <>{children}</>;
}
```

Install the module with `pnpm --filter mobile exec expo install expo-notifications`.

---

### Task 5: Screens

Spec §6.3, §6.4, §6.12, §6.17, §6.18, and the Home budget card of §6.1.

- [x] **Step 1: Charts**

```tsx
import { View } from 'react-native';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface CashflowBar {
  key: string;
  label: string;
  income: number;
  expenses: number;
  /** The current cycle is drawn hatched in the design; here it keeps full opacity. */
  current: boolean;
}

/**
 * Cashflow of §5.7: income up, expenses down, one pair per cycle. Plain views rather than SVG —
 * bars are rectangles, and this keeps the layout responsive for free.
 */
export function CashflowChart({
  bars,
  height = 96,
}: {
  bars: readonly CashflowBar[];
  height?: number;
}) {
  const theme = useTheme();
  const max = Math.max(1, ...bars.flatMap((bar) => [bar.income, bar.expenses]));
  const half = height / 2;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      {bars.map((bar) => (
        <View key={bar.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{ height, justifyContent: 'center', width: '100%' }}>
            <View style={{ height: half, justifyContent: 'flex-end' }}>
              <View
                style={{
                  height: Math.max(1, (bar.income / max) * half),
                  borderRadius: 2,
                  backgroundColor: theme.palette.positive,
                  opacity: bar.current ? 1 : 0.55,
                }}
              />
            </View>
            <View style={{ height: half }}>
              <View
                style={{
                  height: Math.max(1, (bar.expenses / max) * half),
                  borderRadius: 2,
                  backgroundColor: theme.palette.accent,
                  opacity: bar.current ? 1 : 0.55,
                }}
              />
            </View>
          </View>
          <Text size="caption" color={bar.current ? 'text' : 'textFaint'} numberOfLines={1}>
            {bar.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

```tsx
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface SplitSegment {
  key: string;
  amount: number;
  colour: string;
}

/** "Ripartizione" bar of §5.4: segments sized by share, in the order given. */
export function SplitBar({
  segments,
  height = 8,
}: {
  segments: readonly SplitSegment[];
  height?: number;
}) {
  const theme = useTheme();
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0);
  if (total <= 0) {
    return (
      <View
        style={{ height, borderRadius: theme.radii.pill, backgroundColor: theme.palette.track }}
      />
    );
  }
  return (
    <View
      style={{ flexDirection: 'row', height, borderRadius: theme.radii.pill, overflow: 'hidden' }}
    >
      {segments.map((segment) => (
        <View
          key={segment.key}
          style={{ flexGrow: segment.amount, backgroundColor: segment.colour }}
        />
      ))}
    </View>
  );
}
```

- [x] **Step 2: Statistics (§6.3 / §5.7)**

```tsx
import {
  categorySpendHistory,
  committedSpend,
  cycleHistory,
  cycleSpendHistory,
  deltaPercent,
  isWithin,
  median,
  previousCycles,
  projectEndOfCycle,
  rollupToParents,
  shiftCycle,
  spendingByCategory,
  summarizePeriod,
  upcomingExpenses,
} from '@saldo/core';
import { formatCycleRange, formatDayMonth, formatMoney, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { Segmented } from '../../src/components/Segmented';
import { useCategories, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { CashflowChart } from '../../src/features/stats/CashflowChart';
import { SplitBar } from '../../src/features/stats/SplitBar';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §5.7 shows six cycles including the current one. */
const CASHFLOW_CYCLES = 6;
/** The projection is only offered with at least this many days left (§5.7). */
const MIN_DAYS_LEFT = 3;

export default function StatsTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const { today, cycleStartDay, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [direction, setDirection] = useState<'expense' | 'income'>('expense');

  const historyStart =
    previousCycles(period.range, cycleStartDay, CASHFLOW_CYCLES).at(-1)?.start ??
    period.range.start;
  const rows = useTransactionsInRange(historyStart, period.range.end);

  const summary = useMemo(
    () => summarizePeriod(rows, period.range, today),
    [rows, period.range, today],
  );

  const bars = useMemo(() => {
    const cycles = [period.range];
    for (let back = 1; back < CASHFLOW_CYCLES; back += 1) {
      cycles.push(shiftCycle(period.range, cycleStartDay, -back));
    }
    return cycles.reverse().map((cycle) => {
      const cycleSummary = summarizePeriod(rows, cycle, today);
      return {
        key: cycle.start,
        label: formatDayMonth(cycle.start, locale),
        income: cycleSummary.income,
        expenses: cycleSummary.spent,
        current: cycle.start === period.range.start,
      };
    });
  }, [rows, period.range, cycleStartDay, today, locale]);

  const committed = useMemo(
    () => committedSpend(rows, period.range, today),
    [rows, period.range, today],
  );
  const discretionary = Math.max(0, summary.spent - committed);
  const committedPct = summary.spent === 0 ? 0 : Math.round((committed / summary.spent) * 100);

  const cycleMedian = useMemo(() => {
    const history = cycleHistory(rows, period.range, cycleStartDay, CASHFLOW_CYCLES);
    return median(cycleSpendHistory(history, today));
  }, [rows, period.range, cycleStartDay, today]);

  const projection = useMemo(
    () =>
      projectEndOfCycle({
        spent: summary.spent,
        committed,
        elapsed: period.elapsed,
        length: period.length,
        upcoming: upcomingExpenses(rows, period.range, today),
      }),
    [summary.spent, committed, period, rows, today],
  );
  const daysLeft = Math.max(0, period.length - period.elapsed);
  const showProjection = period.isCurrent && daysLeft >= MIN_DAYS_LEFT && cycleMedian !== null;

  const split = useMemo(() => {
    const amounts = rollupToParents(
      spendingByCategory(rows, period.range, today, direction),
      categories,
    );
    const history = categorySpendHistory(
      cycleHistory(rows, period.range, cycleStartDay, CASHFLOW_CYCLES),
      categories,
      today,
    );
    const total = [...amounts.values()].reduce((sum, value) => sum + value, 0);
    return {
      total,
      rows: [...amounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([id, amount]) => {
          const category = categories.find((candidate) => candidate.id === id);
          const past = history.map((cycle) => cycle.get(id) ?? 0).filter((value) => value > 0);
          return {
            id,
            amount,
            name: category?.name ?? '—',
            icon: (category?.icon ?? 'tag') as IconName,
            colour: theme.categoryColor(category?.colorIndex ?? 9),
            delta: deltaPercent(amount, median(past)),
            share: total === 0 ? 0 : Math.round((amount / total) * 100),
          };
        }),
    };
  }, [rows, period.range, today, direction, categories, cycleStartDay, theme]);

  // "N transazioni escluse dai totali" (§5.7): in range, already happened, and flagged out.
  const excluded = useMemo(
    () =>
      rows.filter(
        (tx) =>
          tx.excludeFromTotals &&
          tx.kind === direction &&
          isWithin(period.range, tx.date) &&
          tx.date <= today,
      ),
    [rows, period.range, today, direction],
  );

  return (
    <Screen underTabBar>
      <PeriodHeader />

      <Card>
        <Text weight="medium" tracking="tight">
          {t('stats.cashflow')}
        </Text>
        <View style={{ marginTop: 12 }}>
          <CashflowChart bars={bars} />
        </View>
      </Card>

      <Card>
        <Text weight="medium" tracking="tight">
          {t('stats.committed')}
        </Text>
        <View style={{ marginTop: 12 }}>
          <SplitBar
            segments={[
              { key: 'committed', amount: committed, colour: theme.palette.barGrey },
              { key: 'discretionary', amount: discretionary, colour: theme.palette.accent },
            ]}
          />
        </View>
        <Text size="footnote" color="textMuted" style={{ marginTop: 10 }}>
          {t('stats.committedLine', {
            pct: committedPct,
            amount: formatMoney(committed, currency, locale),
          })}
        </Text>
      </Card>

      {showProjection ? (
        <Card>
          <Text weight="medium" tracking="tight">
            {t('stats.projection')}
          </Text>
          <AmountText
            minor={projection}
            currency={currency}
            locale={locale}
            size="amountMd"
            weight="semibold"
            tracking="tighter"
            style={{ marginTop: 4 }}
          />
          <Text size="footnote" color="textMuted" style={{ marginTop: 6 }}>
            {t(
              projection >= (cycleMedian ?? 0) ? 'stats.projectionAbove' : 'stats.projectionBelow',
              {
                amount: formatMoney(Math.abs(projection - (cycleMedian ?? 0)), currency, locale),
              },
            )}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Segmented
          accessibilityLabel={t('stats.split')}
          options={[
            { value: 'expense', label: t('stats.expenses') },
            { value: 'income', label: t('stats.income') },
          ]}
          value={direction}
          onChange={setDirection}
        />
        <AmountText
          minor={split.total}
          currency={currency}
          locale={locale}
          size="amountMd"
          weight="semibold"
          tracking="tighter"
          style={{ marginTop: 12 }}
        />
        <View style={{ marginTop: 10 }}>
          <SplitBar
            segments={split.rows.map((row) => ({
              key: row.id,
              amount: row.amount,
              colour: row.colour,
            }))}
          />
        </View>
        <View style={{ marginTop: 6 }}>
          {split.rows.length === 0 ? (
            <Text color="textMuted" style={{ paddingVertical: 12 }}>
              {t('stats.empty')}
            </Text>
          ) : (
            split.rows.map((row) => (
              <ListRow
                key={row.id}
                title={row.name}
                subtitle={`${row.delta === null ? t('stats.newLabel') : formatSignedPercent(row.delta)} · ${t('stats.ofTotal', { pct: row.share })}`}
                leading={<IconBox name={row.icon} colour={row.colour} />}
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: row.id } })}
                trailing={<AmountText minor={row.amount} currency={currency} locale={locale} />}
              />
            ))
          )}
          {excluded.length === 0 ? null : (
            <ListRow
              title={t('stats.excludedRow', { count: excluded.length })}
              trailing={
                <AmountText
                  minor={excluded.reduce((sum, tx) => sum + tx.amount, 0)}
                  currency={currency}
                  locale={locale}
                  color="textMuted"
                />
              }
            />
          )}
        </View>
      </Card>

      <Text size="caption" color="textFaint">
        {formatCycleRange(period.range, locale)}
      </Text>
    </Screen>
  );
}
```

- [x] **Step 3: Category detail (§6.12)**

```tsx
import {
  cycleHistory,
  deltaPercent,
  isWithin,
  median,
  previousCycles,
  shiftCycle,
  spendingByCategory,
} from '@saldo/core';
import { formatDayMonth, formatMoney, formatSignedPercent } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { useCategories, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { CashflowChart } from '../../src/features/stats/CashflowChart';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

const HISTORY_CYCLES = 6;
/** §5.4: the children breakdown only appears when at least two of them have spend. */
const MIN_CHILDREN_WITH_SPEND = 2;

/** §6.12 / §5.7. */
export default function CategoryDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const categories = useCategories();
  const { today, cycleStartDay, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const category = categories.find((row) => row.id === id);
  const children = categories.filter((row) => row.parentId === id);
  const ids = useMemo(
    () =>
      new Set(
        [id, ...children.map((child) => child.id)].filter(
          (value): value is string => value !== undefined,
        ),
      ),
    [id, children],
  );

  const historyStart =
    previousCycles(period.range, cycleStartDay, HISTORY_CYCLES).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(historyStart, period.range.end);

  const inRange = useMemo(
    () =>
      rows.filter(
        (tx) =>
          tx.categoryId !== null &&
          ids.has(tx.categoryId) &&
          isWithin(period.range, tx.date) &&
          tx.date <= today,
      ),
    [rows, ids, period.range, today],
  );
  const total = inRange.reduce((sum, tx) => sum + tx.amount, 0);

  const bars = useMemo(() => {
    const cycles = [period.range];
    for (let back = 1; back < HISTORY_CYCLES; back += 1) {
      cycles.push(shiftCycle(period.range, cycleStartDay, -back));
    }
    return cycles.reverse().map((cycle) => {
      const amounts = spendingByCategory(rows, cycle, today);
      let spent = 0;
      for (const categoryId of ids) spent += amounts.get(categoryId) ?? 0;
      return {
        key: cycle.start,
        label: formatDayMonth(cycle.start, locale),
        income: 0,
        expenses: spent,
        current: cycle.start === period.range.start,
      };
    });
  }, [rows, period.range, cycleStartDay, today, ids, locale]);

  const pastMedian = useMemo(() => {
    const history = cycleHistory(rows, period.range, cycleStartDay, HISTORY_CYCLES);
    return median(
      history.map((entry) => {
        const amounts = spendingByCategory(entry.txs, entry.cycle, today);
        let spent = 0;
        for (const categoryId of ids) spent += amounts.get(categoryId) ?? 0;
        return spent;
      }),
    );
  }, [rows, period.range, cycleStartDay, today, ids]);

  const childSpend = useMemo(() => {
    const amounts = spendingByCategory(rows, period.range, today);
    const direct = amounts.get(id ?? '') ?? 0;
    const withSpend = children
      .map((child) => ({ child, amount: amounts.get(child.id) ?? 0 }))
      .filter((entry) => entry.amount > 0);
    return { direct, withSpend };
  }, [rows, period.range, today, id, children]);

  if (category === undefined) {
    return (
      <Screen>
        <Text color="textMuted">{t('stats.empty')}</Text>
      </Screen>
    );
  }

  const delta = deltaPercent(total, pastMedian);

  return (
    <Screen>
      <Text size="headline" weight="semibold" tracking="tight">
        {category.name}
      </Text>
      <AmountText
        minor={total}
        currency={currency}
        locale={locale}
        size="hero"
        weight="semibold"
        tracking="tightest"
      />
      <Text color="textMuted">
        {delta === null ? t('stats.newLabel') : formatSignedPercent(delta)}
      </Text>

      <Card>
        <Text weight="medium" tracking="tight">
          {t('stats.lastCycles')}
        </Text>
        <View style={{ marginTop: 12 }}>
          <CashflowChart bars={bars} />
        </View>
        {pastMedian === null ? null : (
          <Text size="footnote" color="textMuted" style={{ marginTop: 8 }}>
            {t('stats.median', { amount: formatMoney(pastMedian, currency, locale) })}
          </Text>
        )}
      </Card>

      {childSpend.withSpend.length < MIN_CHILDREN_WITH_SPEND ? null : (
        <Card padded={false}>
          <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
            <Text weight="medium" tracking="tight">
              {t('stats.subcategories')}
            </Text>
          </View>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
            {childSpend.withSpend.map(({ child, amount }) => (
              <ListRow
                key={child.id}
                title={child.name}
                leading={
                  <IconBox
                    name={child.icon as IconName}
                    colour={theme.categoryColor(child.colorIndex)}
                  />
                }
                trailing={<AmountText minor={amount} currency={currency} locale={locale} />}
              />
            ))}
            {childSpend.direct === 0 ? null : (
              <ListRow
                title={t('stats.noSubcategory')}
                trailing={
                  <AmountText minor={childSpend.direct} currency={currency} locale={locale} />
                }
              />
            )}
          </View>
        </Card>
      )}

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          {[...inRange]
            .sort((a, b) => b.amount - a.amount)
            .map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.description.length > 0 ? tx.description : category.name}
                subtitle={formatDayMonth(tx.date, locale)}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                }
                trailing={<AmountText minor={-tx.amount} currency={currency} locale={locale} />}
              />
            ))}
        </View>
      </Card>
    </Screen>
  );
}
```

- [x] **Step 4: Budget list (§6.4) and detail sheet (§6.17)**

```tsx
import { previousCycles } from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../src/components/AmountText';
import { Card } from '../src/components/Card';
import { IconBox } from '../src/components/ListRow';
import { ProgressBar } from '../src/components/ProgressBar';
import { Screen } from '../src/components/Screen';
import { useBudgets, useCategories, useSettings, useTransactionsInRange } from '../src/db/hooks';
import { BudgetDetailSheet } from '../src/features/budgets/BudgetDetailSheet';
import { budgetViews } from '../src/features/budgets/useBudgetProgress';
import { usePeriod } from '../src/features/period/PeriodProvider';
import { useAppLocale } from '../src/i18n/useAppLocale';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

/** The carry of a rollover budget can reach back this far (§5.8). */
const CARRY_LOOKBACK = 12;

/** §6.4. */
export default function BudgetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const budgets = useBudgets();
  const categories = useCategories();
  const { today, cycleStartDay, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const [openId, setOpenId] = useState<string | null>(null);

  const start =
    previousCycles(period.range, cycleStartDay, CARRY_LOOKBACK).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(start, period.range.end);

  const views = useMemo(
    () =>
      budgetViews({
        budgets,
        categories,
        transactions: rows,
        cycle: period.range,
        cycleStartDay,
        today,
      }),
    [budgets, categories, rows, period.range, cycleStartDay, today],
  );

  return (
    <Screen>
      <Text size="display" weight="semibold" tracking="tighter">
        {t('budgets.title')}
      </Text>

      {views.length === 0 ? (
        <Card>
          <Text color="textMuted">{t('budgets.empty')}</Text>
        </Card>
      ) : (
        views.map((view) => {
          const category = categories.find((row) => row.id === view.budget.categoryIds[0]);
          return (
            <Pressable key={view.budget.id} onPress={() => setOpenId(view.budget.id)}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <IconBox
                    name={view.budget.icon as IconName}
                    colour={theme.categoryColor(category?.colorIndex ?? 9)}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="medium" numberOfLines={1}>
                      {view.budget.name}
                    </Text>
                    <Text size="caption" color="textMuted">
                      {view.open
                        ? t('budgets.daysLeft', { count: view.daysLeft })
                        : t('budgets.closed')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AmountText
                      minor={view.spent}
                      currency={currency}
                      locale={locale}
                      weight="medium"
                      color={view.overLimit ? 'accent' : 'text'}
                    />
                    <Text size="caption" color="textMuted">
                      {t('budgets.ofLimit', {
                        amount: formatMoney(view.limitWithCarry, currency, locale),
                      })}
                    </Text>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <ProgressBar
                    ratio={view.ratio}
                    pace={view.open ? view.spent / Math.max(1, view.limitWithCarry) : undefined}
                    overPace={view.overPace}
                  />
                </View>
              </Card>
            </Pressable>
          );
        })
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/budget/new')}
        style={{
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.palette.borderStrong,
          borderRadius: theme.radii.card,
          paddingVertical: 18,
          alignItems: 'center',
        }}
      >
        <Text color="textMuted">{t('budgets.newBudget')}</Text>
      </Pressable>

      <BudgetDetailSheet
        visible={openId !== null}
        onClose={() => setOpenId(null)}
        view={views.find((view) => view.budget.id === openId) ?? null}
      />
    </Screen>
  );
}
```

```tsx
import { formatMoney } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { ProgressBar } from '../../components/ProgressBar';
import { Sheet } from '../../components/Sheet';
import { useRepositories } from '../../db/DatabaseProvider';
import { useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import type { BudgetView } from './useBudgetProgress';

export interface BudgetDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  view: BudgetView | null;
}

/** §6.17 / §5.8, plus the edit and delete actions the spec adds to the prototype. */
export function BudgetDetailSheet({ visible, onClose, view }: BudgetDetailSheetProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const repos = useRepositories();
  const currency = settings?.currency ?? 'EUR';

  if (view === null) return null;

  return (
    <Sheet visible={visible} onClose={onClose} title={view.budget.name}>
      <Text size="amountLg" weight="semibold" tracking="tighter" tabular>
        {formatMoney(view.spent, currency, locale)}
      </Text>
      <Text color="textMuted">
        {t('budgets.ofLimit', { amount: formatMoney(view.limitWithCarry, currency, locale) })}
      </Text>
      <View style={{ marginTop: 6 }}>
        <ProgressBar
          ratio={view.ratio}
          pace={view.open ? view.spent / Math.max(1, view.limitWithCarry) : undefined}
          overPace={view.overPace}
        />
      </View>
      <Text size="footnote" color="textMuted">
        {view.open ? t('budgets.daysLeft', { count: view.daysLeft }) : t('budgets.closed')}
      </Text>
      <View style={{ gap: 8, marginTop: 8 }}>
        <PrimaryButton
          label={t('common.edit')}
          onPress={() => {
            onClose();
            router.push({ pathname: '/budget/[id]', params: { id: view.budget.id } });
          }}
        />
        <SecondaryButton
          label={t('budgets.deleteBudget')}
          onPress={() => {
            repos.budgets.remove(view.budget.id);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
```

- [x] **Step 5: The form (§6.18) and its routes**

`onSubmit` receives the *resolved* name — what was typed, or the auto name built from the chosen
categories — so the caller never has to rebuild it.

```tsx
import {
  amountBufferToMinor,
  autoBudgetName,
  BUDGET_ALERT_THRESHOLDS,
  type Budget,
  categorySpendHistory,
  cycleHistory,
  getCurrency,
  previousCycles,
  suggestBudgetAmount,
  takenCategoryIds,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { Toggle } from '../../components/Toggle';
import { useBudgets, useCategories, useSettings, useTransactionsInRange } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { usePeriod } from '../period/PeriodProvider';

const HISTORY_CYCLES = 6;
/** §6.18 footnote: the suggestion is the median plus this much headroom. */
const SUGGESTION_HEADROOM = 0.12;

export interface BudgetFormValues {
  buffer: string;
  categoryIds: string[];
  name: string;
  period: Budget['period'];
  alertThreshold: number | null;
  rollover: boolean;
}

export function emptyBudgetForm(): BudgetFormValues {
  return {
    buffer: '',
    categoryIds: [],
    name: '',
    period: 'cycle',
    alertThreshold: 90,
    rollover: false,
  };
}

export function budgetFormFrom(budget: Budget, minorDigits: 0 | 2 | 3): BudgetFormValues {
  return {
    buffer: (budget.amount / 10 ** minorDigits).toString(),
    categoryIds: [...budget.categoryIds],
    name: budget.name,
    period: budget.period,
    alertThreshold: budget.alertThreshold,
    rollover: budget.rollover,
  };
}

export interface BudgetFormProps {
  values: BudgetFormValues;
  onChange: (values: BudgetFormValues) => void;
  mode: 'new' | 'edit';
  /** Excluded from the "already taken" check when editing (§5.8). */
  editingBudgetId?: string;
  /** Receives the name to store: what was typed, or the auto name from the categories (§6.18). */
  onSubmit: (name: string) => void;
  onDelete?: () => void;
}

/** §6.18. Reused for edit. */
export function BudgetForm({
  values,
  onChange,
  mode,
  editingBudgetId,
  onSubmit,
  onDelete,
}: BudgetFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const toast = useToast();
  const settings = useSettings();
  const categories = useCategories();
  const budgets = useBudgets();
  const { today, cycleStartDay, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';
  const { minorDigits } = getCurrency(currency);

  const start =
    previousCycles(period.range, cycleStartDay, HISTORY_CYCLES).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(start, period.range.end);

  const taken = useMemo(
    () => takenCategoryIds(budgets, categories, editingBudgetId ?? null),
    [budgets, categories, editingBudgetId],
  );

  const suggestion = useMemo(() => {
    const history = categorySpendHistory(
      cycleHistory(rows, period.range, cycleStartDay, HISTORY_CYCLES),
      categories,
      today,
    );
    const value = suggestBudgetAmount(history, values.categoryIds, categories);
    return value === null ? null : Math.round(value * (1 + SUGGESTION_HEADROOM));
  }, [rows, period.range, cycleStartDay, categories, today, values.categoryIds]);

  const expense = categories.filter(
    (category) =>
      category.direction === 'expense' &&
      category.parentId === null &&
      category.archivedAt === null,
  );

  const autoName = autoBudgetName(
    values.categoryIds
      .map((id) => categories.find((category) => category.id === id)?.name)
      .filter((name): name is string => name !== undefined),
    t('common.and'),
  );
  const set = (patch: Partial<BudgetFormValues>) => onChange({ ...values, ...patch });
  const amount = amountBufferToMinor(values.buffer, minorDigits);
  const ready = amount > 0 && values.categoryIds.length > 0;

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton
            label={mode === 'new' ? t('budgets.create') : t('common.save')}
            disabled={!ready}
            onPress={() => onSubmit(values.name.trim().length > 0 ? values.name.trim() : autoName)}
          />
          {onDelete === undefined ? null : (
            <SecondaryButton label={t('budgets.deleteBudget')} onPress={onDelete} />
          )}
        </View>
      }
    >
      <Text size="headline" weight="semibold" tracking="tight">
        {mode === 'new' ? t('budgets.newBudget') : t('budgets.editBudget')}
      </Text>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('budgets.amount')}
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
        {suggestion === null ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <Text size="footnote" color="textMuted" style={{ flex: 1 }}>
              {t('budgets.medianHint', { amount: formatMoney(suggestion, currency, locale) })}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => set({ buffer: (suggestion / 10 ** minorDigits).toString() })}
            >
              <Text color="accent" weight="medium">
                {t('budgets.useMedian')}
              </Text>
            </Pressable>
          </View>
        )}
        <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
          {t('budgets.footnote')}
        </Text>
      </Card>

      <Card>
        <Text size="footnote" color="textMuted">
          {t('budgets.categories')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {expense.map((category) => {
            const selected = values.categoryIds.includes(category.id);
            const isTaken = taken.has(category.id) && !selected;
            const colour = theme.categoryColor(category.colorIndex);
            return (
              <Pressable
                key={category.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: isTaken }}
                onPress={() => {
                  if (isTaken) {
                    toast.show(t('budgets.taken', { name: category.name }));
                    return;
                  }
                  set({
                    categoryIds: selected
                      ? values.categoryIds.filter((id) => id !== category.id)
                      : [...values.categoryIds, category.id],
                  });
                }}
                style={{
                  width: '47%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  borderRadius: theme.radii.input,
                  borderWidth: 1,
                  borderColor: selected ? theme.palette.borderStrong : 'transparent',
                  backgroundColor: selected ? theme.tint(colour, 0.14) : theme.palette.raised,
                  opacity: isTaken ? 0.4 : 1,
                }}
              >
                <IconBox name={category.icon as IconName} colour={colour} small />
                <Text size="footnote" numberOfLines={1} style={{ flex: 1 }}>
                  {category.name}
                </Text>
                {isTaken ? (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.palette.textFaint,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <TextField
            label={t('budgets.name')}
            placeholder={autoName}
            value={values.name}
            onChangeText={(name) => set({ name })}
          />
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('budgets.repeats')}
            </Text>
            <Segmented
              accessibilityLabel={t('budgets.repeats')}
              options={[
                { value: 'cycle', label: t('budgets.periodCycle') },
                { value: 'week', label: t('budgets.periodWeek') },
                { value: 'year', label: t('budgets.periodYear') },
              ]}
              value={values.period}
              onChange={(value) => set({ period: value })}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('budgets.alertAt')}
            </Text>
            <Segmented
              accessibilityLabel={t('budgets.alertAt')}
              options={[
                { value: 'never', label: t('budgets.alertNever') },
                ...BUDGET_ALERT_THRESHOLDS.map((value) => ({
                  value: String(value),
                  label: `${value}%`,
                })),
              ]}
              value={values.alertThreshold === null ? 'never' : String(values.alertThreshold)}
              onChange={(value) =>
                set({ alertThreshold: value === 'never' ? null : Number(value) })
              }
            />
            <Text size="caption" color="textFaint">
              {t('budgets.alertNote')}
            </Text>
          </View>
          {values.period === 'cycle' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text>{t('budgets.rollover')}</Text>
              <Toggle
                value={values.rollover}
                onChange={(rollover) => set({ rollover })}
                accessibilityLabel={t('budgets.rollover')}
              />
            </View>
          ) : null}
        </View>
      </Card>
    </Screen>
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
  BudgetForm,
  type BudgetFormValues,
  emptyBudgetForm,
} from '../../src/features/budgets/BudgetForm';

export default function NewBudget() {
  const router = useRouter();
  const repos = useRepositories();
  const settings = useSettings();
  const categories = useCategories();
  const budgets = useBudgets();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState<BudgetFormValues>(emptyBudgetForm);

  return (
    <BudgetForm
      values={values}
      onChange={setValues}
      mode="new"
      onSubmit={(name) => {
        const first = categories.find((category) => category.id === values.categoryIds[0]);
        repos.budgets.create({
          name,
          categoryIds: values.categoryIds,
          amount: amountBufferToMinor(values.buffer, minorDigits),
          period: values.period,
          alertThreshold: values.alertThreshold,
          rollover: values.period === 'cycle' ? values.rollover : false,
          icon: first?.icon ?? 'target',
          sortOrder: budgets.length,
        });
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
import { Screen } from '../../src/components/Screen';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useSettings } from '../../src/db/hooks';
import { BudgetForm, budgetFormFrom } from '../../src/features/budgets/BudgetForm';
import { Text } from '../../src/theme/Text';

export default function EditBudget() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');

  const [budget] = useState(() => (id === undefined ? null : repos.budgets.byId(id)));
  const [values, setValues] = useState(() =>
    budget === null ? null : budgetFormFrom(budget, minorDigits),
  );

  if (budget === null || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('budgets.empty')}</Text>
      </Screen>
    );
  }

  return (
    <BudgetForm
      values={values}
      onChange={setValues}
      mode="edit"
      editingBudgetId={budget.id}
      onSubmit={(name) => {
        repos.budgets.update(budget.id, {
          name,
          categoryIds: values.categoryIds,
          amount: amountBufferToMinor(values.buffer, minorDigits),
          period: values.period,
          alertThreshold: values.alertThreshold,
          rollover: values.period === 'cycle' ? values.rollover : false,
        });
        router.back();
      }}
      onDelete={() => {
        repos.budgets.remove(budget.id);
        router.back();
      }}
    />
  );
}
```

- [x] **Step 6: Home budget card (§6.1)**

```tsx
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { ProgressBar } from '../../components/ProgressBar';
import { useCategories, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { BudgetView } from './useBudgetProgress';

/** §6.1: the top three budgets by ratio, plus a link to the full list. */
const TOP = 3;

export function HomeBudgetCard({ views }: { views: readonly BudgetView[] }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const currency = settings?.currency ?? 'EUR';

  if (views.length === 0) return null;

  const top = [...views].sort((a, b) => b.ratio - a.ratio).slice(0, TOP);
  const overPace = views.filter((view) => view.overPace).length;

  return (
    <Card>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <Text weight="medium" tracking="tight">
          {t('home.budget')}
        </Text>
        <Text size="footnote" color={overPace > 0 ? 'accent' : 'textMuted'}>
          {overPace > 0 ? t('budgets.overPace', { count: overPace }) : t('budgets.withinLimits')}
        </Text>
      </View>

      <View style={{ gap: 12, marginTop: 12 }}>
        {top.map((view) => {
          const category = categories.find((row) => row.id === view.budget.categoryIds[0]);
          return (
            <View key={view.budget.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconBox
                  name={view.budget.icon as IconName}
                  colour={theme.categoryColor(category?.colorIndex ?? 9)}
                  small
                />
                <Text size="footnote" style={{ flex: 1 }} numberOfLines={1}>
                  {view.budget.name}
                </Text>
                <Text size="footnote" color="textMuted" tabular>
                  {`${formatMoney(view.spent, currency, locale)} · ${t('budgets.ofLimit', {
                    amount: formatMoney(view.limitWithCarry, currency, locale),
                  })}`}
                </Text>
              </View>
              <ProgressBar ratio={view.ratio} overPace={view.overPace} />
            </View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/budgets')}
        style={{ marginTop: 12 }}
      >
        <Text size="footnote" color="accent">
          {t('home.allBudgets')}
        </Text>
      </Pressable>
    </Card>
  );
}
```

- [x] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "feat: add budgets and statistics"
```

---

### Task 6: Verify

- [x] **Step 1: The pipeline, through `rtk proxy`**

```bash
rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm test
```

Expected: clean, and 96 mobile tests.

- [x] **Step 2: Look at it on a simulator**

`expo-notifications` adds a native module, so this needs a fresh `expo run:ios` (CocoaPods
re-installs). Seed a database first, as in the phase 03 plan.

Verified: Statistics renders the cashflow over six cycles (income up in `positive`, expenses down in
`accent`, the current cycle at full opacity), the committed share at 64% with its sentence, the
projection with the distance from the cycle median, and the breakdown with the multicolour split
bar. **The budget list and the Home budget card were not seen on screen**: reaching them needs a
tap, and neither `simctl` nor a deep link can provide one (a deep link raises a system dialog that
itself needs a tap). They rest on `budgetViews`, which is unit-tested.

Note: after a rebuild the app keeps serving the previous JS until it is terminated and relaunched —
`expo run:ios` reinstalling the binary is not enough.

- [ ] **Step 3: Android**

Not verified: no Android SDK on this machine.

---
