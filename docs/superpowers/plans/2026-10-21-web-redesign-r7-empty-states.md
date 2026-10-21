# Web redesign R7 — Empty states (first step) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every empty place of the web app gives the first step that fills it (W11): «Getting started» on the Home, a quick add on Transactions, matches in other periods for a search with no result, a way to a period with data on Statistics, account types, goal presets, budget suggestions, and in-page forms for Tags and Invites.

**Architecture:**
- Three new pure functions in `@saldo/core`, written test first (AGENTS.md, «Tests»):
  - `budgetSuggestions`: the top categories by their median monthly spend, without the categories that a budget already covers.
  - `matchesInOtherPeriods`: the periods outside the selected one where the same search finds rows.
  - `emergencyFundTarget`: 3 times the median monthly spend.
- The pages call them and render the empty states.
- The forms that a first step opens (new account, new goal, new budget) learn to take a prefill from the URL, in the way the new-transaction form already does.

**Tech Stack:** `@saldo/core` (Vitest), Next.js (App Router, server components), CSS Modules with the `@saldo/ui` token variables, `@saldo/i18n`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-web-pages-redesign.html`, W11, section 07 «Empty states» and its table, figure 9, section 08 «Strings», open item 3.

**Mockup (not in the repository):** `docs/design/redesign/empty.html`, variant «c» (Primo passo).

**Branch:** `redesign/web`. R1–R6 are done on it.

---

## Decisions this plan takes where the spec leaves a choice

- **«Search everywhere» does not exist.** The web has no list across all periods, so there is nothing for that button to open. The «no results» state lists the periods with matches, newest first, and each one is a link to that period with the same search. The key `transactions.searchEverywhere` is not added.
- **«Import from CSV» opens Profile → Data.** The web has no CSV import yet. That section says where the import is.
- **The quick add saves an expense on the first spendable account, today, with the chosen category.** If there is no account, the quick add shows «Add an account» instead.
- **The goal presets «Holiday» and «Car» have no amount.** The spec gives an amount only for the emergency fund. A preset opens «New goal» with the name, and for the emergency fund also the target.
- **A step body that the spec shows but does not name** gets a new key: `home.stepTransactionBody`, `home.stepBudgetBody`, `home.stepGoalBody`. The quick add also gets `transactions.importCsv`. These are the only keys beyond the spec's table.
- **The translations for de, es, fr, pt and sv** are written by the implementer, as in R1–R6. The table gives `en` and `it`.

## File structure

| File | Change |
|---|---|
| `packages/core/src/firstSteps.ts` (+ test), `index.ts` | New: the three functions. |
| `packages/i18n/src/locales/*.ts` | The keys of section 08, and the four above. |
| `apps/web/src/features/home/gettingStarted.ts`, `app/(app)/home/page.tsx`, `home.module.css` | «Getting started» and «In your accounts». |
| `apps/web/app/(app)/transactions/QuickAdd.tsx`, `page.tsx`, CSS | Quick add; matches in other periods. |
| `apps/web/app/(app)/stats/page.tsx`, CSS | An empty period. |
| `apps/web/src/features/accounts/formView.ts`, `app/(app)/accounts/page.tsx`, `app/(app)/profile/goals/page.tsx` | Account types; goal presets; prefill. |
| `apps/web/src/features/budgets/formView.ts`, `app/(app)/profile/budgets/page.tsx` | Budget suggestions; prefill. |
| `apps/web/app/(app)/profile/tags/page.tsx`, `app/(app)/admin/invites/page.tsx` | The form in the page. |
| `apps/web/e2e/*.spec.ts` | The first steps. |
| `docs/superpowers/plans/README.md` | R7 ticked; the redesign done. |

---

### Task 1: The strings

**Files:**
- Modify: `packages/i18n/src/locales/en.ts`, `it.ts`, `de.ts`, `es.ts`, `fr.ts`, `pt.ts`, `sv.ts`

- [x] **Step 1: Add the keys**

Add each key to the block its prefix names (`home`, `transactions`, `stats`, `accounts`, `goals`, `budgets`, `admin.invites`), in all seven files. Put it after the last key of that block. First check with `rtk grep` that no key of the same name exists in that block.

| Key | en | it |
|---|---|---|
| `home.startTitle` | `Getting started` | `Per iniziare` |
| `home.startProgress` | `{{done}} of {{count}}` | `{{done}} di {{count}}` |
| `home.stepAccount` | `Add an account` | `Aggiungi un conto` |
| `home.stepTransaction` | `Record the first expense` | `Registra la prima spesa` |
| `home.stepTransactionBody` | `Statistics, budgets and balances start there.` | `Statistiche, budget e saldi partono da lì.` |
| `home.stepBudget` | `Set a budget` | `Imposta un budget` |
| `home.stepBudgetBody` | `A limit for each category.` | `Un limite per ogni categoria.` |
| `home.stepGoal` | `Set aside for a goal` | `Metti da parte per un obiettivo` |
| `home.stepGoalBody` | `Optional.` | `Facoltativo.` |
| `home.inAccounts` | `In your accounts` | `Nei tuoi conti` |
| `transactions.quickAddTitle` | `Record your first expense` | `Registra la prima spesa` |
| `transactions.importCsv` | `Import from CSV` | `Importa da CSV` |
| `transactions.noResultsIn` | `No results in {{period}}` | `Nessun risultato in {{period}}` |
| `transactions.otherPeriods` | `“{{query}}” appears in other periods:` | `«{{query}}» compare in altri periodi:` |
| `stats.emptyPeriod` | `{{period}} has no transactions yet` | `{{period}} non ha ancora transazioni` |
| `stats.goToPeriod` | `Go to {{period}}` | `Vai a {{period}}` |
| `accounts.whichType` | `Which account do you want to add?` | `Che conto vuoi aggiungere?` |
| `goals.presetEmergency` | `Emergency fund` | `Fondo emergenza` |
| `goals.presetHoliday` | `Holiday` | `Vacanze` |
| `goals.presetCar` | `Car` | `Macchina` |
| `budgets.suggestTitle` | `Where you spend most` | `Dove spendi di più` |
| `budgets.suggestAmount` | `{{amount}} a month` | `{{amount}} al mese` |
| `admin.invites.createFirst` | `Create the first invite` | `Crea il primo invito` |

For `de`, `es`, `fr`, `pt` and `sv`, write a translation in the voice of the existing strings of that file. Keep `{{…}}` placeholders as they are. Use the quotes that the file already uses in similar strings.

- [x] **Step 2: Test and commit**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS.

```bash
rtk git add packages/i18n/src/locales
rtk git commit -m "feat(i18n): strings for the first steps of the empty states (W11)"
```

---

### Task 2: The three functions in `@saldo/core`

**Files:**
- Create: `packages/core/src/firstSteps.ts`
- Test: `packages/core/src/firstSteps.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/firstSteps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, tx } from './__tests__/fixtures';
import { EMPTY_FILTERS, type FilterLookup } from './filters';
import { budgetSuggestions, emergencyFundTarget, matchesInOtherPeriods } from './firstSteps';
import type { PeriodDef } from './period';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };
const TODAY = '2026-04-18';
const APRIL = { start: '2026-04-01', end: '2026-04-30' };

/** Three used months before April. Groceries (with its child) and transport are spent each month. */
function threeMonths() {
  return [
    tx({ date: '2026-01-05', amount: 10000, categoryId: 'cat-groceries' }),
    tx({ date: '2026-02-05', amount: 20000, categoryId: 'cat-supermarket' }),
    tx({ date: '2026-03-05', amount: 30000, categoryId: 'cat-groceries' }),
    tx({ date: '2026-01-07', amount: 4000, categoryId: 'cat-transport' }),
    tx({ date: '2026-02-07', amount: 6000, categoryId: 'cat-transport' }),
    tx({ date: '2026-03-07', amount: 5000, categoryId: 'cat-transport' }),
    // Spent in one month of three: its median is 0, so it suggests nothing.
    tx({ date: '2026-03-09', amount: 50000, categoryId: 'cat-rent' }),
    // Income is never a budget.
    tx({ date: '2026-03-01', amount: 200000, kind: 'income', categoryId: 'cat-salary' }),
  ];
}

describe('budgetSuggestions', () => {
  it('ranks the categories by their median monthly spend, at the parent level', () => {
    const suggestions = budgetSuggestions({
      txs: threeMonths(),
      categories: CATEGORIES,
      budgets: [],
      def: MONTH,
      today: TODAY,
    });
    expect(suggestions).toEqual([
      { categoryId: 'cat-groceries', amount: 20000 },
      { categoryId: 'cat-transport', amount: 5000 },
    ]);
  });

  it('leaves out a category that a budget already covers, and keeps the count', () => {
    const suggestions = budgetSuggestions({
      txs: threeMonths(),
      categories: CATEGORIES,
      budgets: [{ id: 'b1', categoryIds: ['cat-groceries'] }],
      def: MONTH,
      today: TODAY,
      count: 1,
    });
    expect(suggestions).toEqual([{ categoryId: 'cat-transport', amount: 5000 }]);
  });

  it('suggests nothing with no history', () => {
    expect(
      budgetSuggestions({ txs: [], categories: CATEGORIES, budgets: [], def: MONTH, today: TODAY }),
    ).toEqual([]);
  });
});

describe('matchesInOtherPeriods', () => {
  const lookup: FilterLookup = {
    accountName: () => '',
    categoryName: () => '',
    categoryParentId: () => null,
  };
  const txs = [
    tx({ date: '2026-01-03', amount: 100, description: 'Esselunga' }),
    tx({ date: '2026-01-20', amount: 100, description: 'Esselunga Viale' }),
    tx({ date: '2026-03-02', amount: 100, description: 'esselunga' }),
    tx({ date: '2026-04-02', amount: 100, description: 'Esselunga' }),
    tx({ date: '2026-02-02', amount: 100, description: 'Coop' }),
  ];

  it('counts the matches of each other period, newest period first', () => {
    const matches = matchesInOtherPeriods({
      txs,
      filters: { ...EMPTY_FILTERS, query: 'esselunga' },
      lookup,
      def: MONTH,
      exclude: APRIL,
    });
    expect(matches).toEqual([
      { range: { start: '2026-03-01', end: '2026-03-31' }, count: 1 },
      { range: { start: '2026-01-01', end: '2026-01-31' }, count: 2 },
    ]);
  });

  it('stops at the limit', () => {
    const matches = matchesInOtherPeriods({
      txs,
      filters: { ...EMPTY_FILTERS, query: 'esselunga' },
      lookup,
      def: MONTH,
      exclude: APRIL,
      limit: 1,
    });
    expect(matches.map((entry) => entry.range.start)).toEqual(['2026-03-01']);
  });
});

describe('emergencyFundTarget', () => {
  it('is three times the median monthly spend', () => {
    const txs = [
      tx({ date: '2026-01-05', amount: 10000 }),
      tx({ date: '2026-02-05', amount: 30000 }),
      tx({ date: '2026-03-05', amount: 20000 }),
    ];
    expect(emergencyFundTarget({ txs, def: MONTH, today: TODAY })).toBe(60000);
  });

  it('is null with no history', () => {
    expect(emergencyFundTarget({ txs: [], def: MONTH, today: TODAY })).toBeNull();
  });
});
```

If `DateRange` from `periodContaining` has more fields than `start` and `end`, change the expected `range` objects to `expect.objectContaining({ start, end })`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `rtk proxy pnpm --filter @saldo/core exec vitest run src/firstSteps.test.ts`
Expected: FAIL, because `./firstSteps` does not exist.

- [ ] **Step 3: Write the functions**

Create `packages/core/src/firstSteps.ts`:

```ts
import { type BudgetRef, suggestBudgetAmount, takenCategoryIds } from './budgets';
import type { LocalDate } from './dates';
import { type FilterLookup, filterTransactions, type TransactionFilters } from './filters';
import {
  categorySpendHistory,
  HISTORY_WINDOW,
  periodHistory,
  periodSpendHistory,
} from './history';
import type { CategoryRef, LedgerTx } from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, periodContaining } from './period';
import { median } from './stats';

/** How many months of spend the emergency fund covers (W11). */
export const EMERGENCY_FUND_MONTHS = 3;

export interface BudgetSuggestion {
  categoryId: string;
  /** The median monthly spend of the category, the amount §5.5 suggests for its budget. */
  amount: MinorUnits;
}

/**
 * W11, Profile · Budgets: «Where you spend most» — the categories with the largest median spend of
 * the last periods, at the parent level, without the ones a budget already covers. The amount is
 * `suggestBudgetAmount`, the same figure the budget form offers. A category with a median of 0 (spent
 * in fewer than half the periods) suggests nothing.
 */
export function budgetSuggestions(input: {
  txs: readonly LedgerTx[];
  categories: readonly CategoryRef[];
  budgets: readonly BudgetRef[];
  def: PeriodDef;
  today: LocalDate;
  count?: number;
}): BudgetSuggestion[] {
  const { txs, categories, budgets, def, today, count = 3 } = input;
  const history = categorySpendHistory(
    periodHistory(txs, def, periodContaining(def, today), HISTORY_WINDOW),
    categories,
    today,
  );
  const taken = takenCategoryIds(budgets, categories);
  const known = new Set(categories.map((category) => category.id));
  const ids = new Set(history.flatMap((amounts) => [...amounts.keys()]));
  return [...ids]
    .filter((id) => known.has(id) && !taken.has(id))
    .map((categoryId) => ({
      categoryId,
      amount: suggestBudgetAmount(history, [categoryId], categories) ?? 0,
    }))
    .filter((suggestion) => suggestion.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId))
    .slice(0, count);
}

export interface PeriodMatches {
  range: ReturnType<typeof periodContaining>;
  count: number;
}

/**
 * W11, Transactions · no results: the periods other than `exclude` where the same filters find rows,
 * newest first, with how many rows each one holds.
 */
export function matchesInOtherPeriods<T extends LedgerTx>(input: {
  txs: readonly T[];
  filters: TransactionFilters;
  lookup: FilterLookup;
  def: PeriodDef;
  exclude: { start: LocalDate };
  limit?: number;
}): PeriodMatches[] {
  const { def, exclude, limit = 3 } = input;
  const byStart = new Map<string, PeriodMatches>();
  for (const tx of filterTransactions(input.txs, input.filters, input.lookup)) {
    const range = periodContaining(def, tx.date);
    if (range.start === exclude.start) continue;
    const entry = byStart.get(range.start);
    if (entry === undefined) byStart.set(range.start, { range, count: 1 });
    else entry.count += 1;
  }
  return [...byStart.values()]
    .sort((a, b) => b.range.start.localeCompare(a.range.start))
    .slice(0, limit);
}

/**
 * W11, Goals · none: the target the «Emergency fund» preset offers — `EMERGENCY_FUND_MONTHS` times
 * the median spend of the last used periods. `null` with no history: the preset then has no amount.
 */
export function emergencyFundTarget(input: {
  txs: readonly LedgerTx[];
  def: PeriodDef;
  today: LocalDate;
}): MinorUnits | null {
  const { txs, def, today } = input;
  const middle = median(
    periodSpendHistory(periodHistory(txs, def, periodContaining(def, today), HISTORY_WINDOW), today),
  );
  return middle === null ? null : Math.round(middle * EMERGENCY_FUND_MONTHS);
}
```

If an import path differs, import the name from the module that exports it (`rtk grep -n "export function <name>" packages/core/src`). For example, `periodContaining` or `median` may live in another file.

- [ ] **Step 4: Export them**

In `packages/core/src/index.ts`, add `export * from './firstSteps';` in alphabetical order (after `./filters`).

- [ ] **Step 5: Run the tests to see them pass**

Run: `rtk proxy pnpm --filter @saldo/core exec vitest run src/firstSteps.test.ts`
Expected: PASS.

Run: `rtk proxy pnpm --filter @saldo/core test` and `rtk proxy pnpm --filter @saldo/core typecheck`
Expected: PASS, no error.

- [ ] **Step 6: Commit**

```bash
rtk git add packages/core/src/firstSteps.ts packages/core/src/firstSteps.test.ts packages/core/src/index.ts
rtk git commit -m "feat(core): budget suggestions, matches in other periods, emergency fund target (W11)"
```

---

### Task 3: The Home — «Getting started» (W11, figure 9)

**Files:**
- Create: `apps/web/src/features/home/gettingStarted.ts`
- Modify: `apps/web/app/(app)/home/page.tsx`
- Modify: `apps/web/app/(app)/home/home.module.css`

- [ ] **Step 1: The steps**

Create `apps/web/src/features/home/gettingStarted.ts`:

```ts
import { type Account, isPocket, type UserData } from '@saldo/core';

export type StartStepKey = 'account' | 'transaction' | 'budget' | 'goal';

export interface StartStep {
  key: StartStepKey;
  done: boolean;
}

export interface GettingStarted {
  steps: StartStep[];
  done: number;
  /** While an account, a transaction or a budget is missing; the goal step is optional. */
  show: boolean;
  /** No transaction yet: «In your accounts» takes the place of the summary (H5). */
  noTransactions: boolean;
  /** The account the done «Add an account» step names. */
  firstAccount: Account | null;
}

/** W11: the four first steps of a new user, in the order of figure 9. */
export function gettingStarted(data: UserData): GettingStarted {
  const live = data.accounts.filter((account) => account.archivedAt === null);
  const steps: StartStep[] = [
    { key: 'account', done: live.some((account) => !isPocket(account)) },
    { key: 'transaction', done: data.transactions.length > 0 },
    { key: 'budget', done: data.budgets.length > 0 },
    { key: 'goal', done: live.some(isPocket) },
  ];
  return {
    steps,
    done: steps.filter((step) => step.done).length,
    show: steps.slice(0, 3).some((step) => !step.done),
    noTransactions: data.transactions.length === 0,
    firstAccount: live.find((account) => !isPocket(account)) ?? null,
  };
}
```

No unit test: it is a mapping of four flags (AGENTS.md, «Tests»). Task 7 covers it with Playwright.

- [ ] **Step 2: Render it on the Home**

Read `apps/web/app/(app)/home/page.tsx`. Then make these changes:

1. Import `gettingStarted` and `accountBalances` (from `@saldo/core`), and `NEW_GOAL_HREF` if it is not imported yet.
2. After `const view = homeView(…)`, add:

```tsx
  // W11: a new user starts here. The blocks with nothing to show do not show.
  const start = gettingStarted(page.data);
  const balances = accountBalances(page.data.accounts, page.data.transactions, today);
  const liveAccounts = page.data.accounts.filter((account) => account.archivedAt === null);
```

3. Add this element before the Summary block:

```tsx
      {start.show ? (
        <section className={styles.box} aria-labelledby="start-title">
          <div className={styles.blockHead}>
            <h2 id="start-title">{t('home.startTitle')}</h2>
            <span className={styles.meta}>
              {t('home.startProgress', { done: start.done, count: start.steps.length })}
            </span>
          </div>
          <ol className={styles.steps}>
            {start.steps.map((step) => {
              const action =
                step.key === 'account' ? (
                  <Link className={styles.action} href="/accounts?new">
                    {t('accounts.newAccount')}
                  </Link>
                ) : step.key === 'transaction' ? (
                  <NewTransactionLink className={styles.action}>
                    {t('web.shell.newTransaction')}
                  </NewTransactionLink>
                ) : step.key === 'budget' ? (
                  <Link className={styles.action} href="/profile/budgets?new">
                    {t('budgets.create')}
                  </Link>
                ) : (
                  <Link className={styles.action} href={NEW_GOAL_HREF}>
                    {t('goals.create')}
                  </Link>
                );
              const body =
                step.key === 'account'
                  ? start.firstAccount === null
                    ? null
                    : `${start.firstAccount.name} · ${money(balances.get(start.firstAccount.id) ?? 0)}`
                  : step.key === 'transaction'
                    ? t('home.stepTransactionBody')
                    : step.key === 'budget'
                      ? t('home.stepBudgetBody')
                      : t('home.stepGoalBody');
              const title = {
                account: t('home.stepAccount'),
                transaction: t('home.stepTransaction'),
                budget: t('home.stepBudget'),
                goal: t('home.stepGoal'),
              }[step.key];
              return (
                <li key={step.key} className={styles.step} data-done={step.done ? '' : undefined}>
                  <span className={styles.stepMark} aria-hidden="true">
                    {step.done ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className={styles.stepText}>
                    <b>{title}</b>
                    {body === null ? null : <span>{body}</span>}
                  </span>
                  {step.done ? null : action}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {start.noTransactions && liveAccounts.length > 0 ? (
        <section className={styles.box} aria-labelledby="in-accounts-title">
          <div className={styles.blockHead}>
            <h2 id="in-accounts-title">{t('home.inAccounts')}</h2>
          </div>
          {liveAccounts.map((account) => (
            <Link key={account.id} className={styles.accountRow} href={`/accounts?a=${account.id}`}>
              <span>{account.name}</span>
              <AmountText
                minor={balances.get(account.id) ?? 0}
                currency={currency}
                locale={locale}
              />
            </Link>
          ))}
        </section>
      ) : null}
```

If the page renders the period header and the summary in one wrapper, put the two new blocks right after the period header, inside the same parent as the other boxes.

4. Wrap the Summary block (H5) in `{start.noTransactions ? null : (…)}`. Wrap the Budget block in `{view.budgets.items.length === 0 ? null : (…)}`. Wrap the Transactions block in `{start.noTransactions ? null : (…)}`. Wrap the Goals block in `{view.goals.items.length === 0 ? null : (…)}`. The old empty states of those blocks (`emptyTransactions`, the Goals `EmptyState`, the Budget empty text) can no longer show, so delete them and the constants that only they used. Keep the `step.done` check (a done step shows no action, and a line through its title).

The step text uses `t(…)` keys from Task 1. A new user with no account sees no «In your accounts» block, because there is nothing to list.

- [ ] **Step 3: The CSS**

Add to `apps/web/app/(app)/home/home.module.css` (check first that `.action` and `.meta` exist; reuse them if they do, and do not add them twice):

```css
/* W11: «Getting started» — one row for each step, a check and a line through a done one. */
.steps {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  border-top: 1px solid var(--color-border);
}

.step:first-child {
  border-top: 0;
}

.stepMark {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  border: 1.5px solid var(--color-border-strong);
  color: var(--color-bg);
}

.step[data-done] .stepMark {
  border-color: var(--color-text);
  background: var(--color-text);
}

.stepText {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stepText b {
  font-weight: var(--font-weight-medium);
}

.stepText span {
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.step[data-done] .stepText b {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

.accountRow {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
  align-items: center;
  padding: 0 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
}

@media (hover: hover) and (pointer: fine) {
  .accountRow:hover {
    background: var(--color-raised);
  }
}
```

- [ ] **Step 4: Check and commit**

Run: `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm --filter web test`
Expected: clean, no error, PASS.

Look at `/home` for a new member with no data, then with one account, then with a seeded member: use a temporary Playwright script and delete it before you commit. Expected:
- **No data:** «Getting started 0 of 4» and no other block.
- **One account:** the account step is checked, with its name and balance. «In your accounts» lists the account.
- **Seeded member:** no «Getting started» if the member has an account, a transaction and a budget. The Home is the R1 Home.

```bash
rtk git add apps/web/src/features/home/gettingStarted.ts "apps/web/app/(app)/home"
rtk git commit -m "feat(web): Getting started on the Home of a new user (W11)"
```

---

### Task 4: Transactions — quick add, and matches in other periods

**Files:**
- Create: `apps/web/app/(app)/transactions/QuickAdd.tsx`
- Modify: `apps/web/app/(app)/transactions/page.tsx`
- Modify: `apps/web/app/(app)/transactions/transactions.module.css`

- [ ] **Step 1: Read the save action**

Read `apps/web/app/(app)/transactions/actions.ts` (`saveTransactionAction`) and `TransactionForm.tsx` (`save`). Write down what `buffer` must hold: the amount as the user typed it, or the keypad's digits. Read how `formView` builds `initial.buffer` and how `@saldo/core` reads it (`amountKeypad.ts`, `parseAmount` or similar). The quick add must send what the form sends for the same amount.

- [ ] **Step 2: The quick add**

Create `apps/web/app/(app)/transactions/QuickAdd.tsx`. It is a client component with:
- **Props:**
  - `accountId: string`: the first spendable account.
  - `categories: { id: string; name: string }[]`: the top-level expense categories, in the order of the new form's «all categories».
  - `today: string`.
  - `strings`: title, amount, category, add, busy, importCsv, and the error texts. The page resolves them from the catalog.
  - `decimalSeparator` and `symbol`, as `TransactionForm` takes them.
- **Markup:** a `<form>` with the title `transactions.quickAddTitle` as an `h2`. Then one row:
  - an amount `<input inputMode="decimal">` with the label `txForm.amount`;
  - a `<select>` with the label `txForm.category`, first category selected;
  - a submit button `common.add` (if that key does not exist, use `txForm.create`).
- **Link:** under the form, a link `transactions.importCsv` to `/profile/data`.
- **Submit:** call `saveTransactionAction` with the same fields `TransactionForm.save` sends:
  - `id: null`, `expectedUpdatedAt: undefined`, `kind: 'expense'`;
  - `buffer` as Step 1 says;
  - `date: today`, `accountId`, `toAccountId: null`, `categoryId`;
  - `description: ''`, `tagIds: []`, `excludeFromTotals: false`, `closeGoalId: null`.

  On `ok`, call `actionApplied()` and `router.refresh()`. On a refusal, show the message in a `role="alert"` line, with the texts `TransactionForm` uses for the same errors.
- **Pending:** a `useTransition` pending state disables the button and shows `strings.busy`.

Use the same classes and tokens as the tool row of R3 (`Chip.module.css` for the button look, the `SearchField` look for the inputs). Put the new classes in `transactions.module.css`.

- [ ] **Step 3: Show it when there are no transactions at all**

In `page.tsx`, the branch `!hasRows && !view.filtered` renders `<EmptyState title={t('transactions.empty')} …/>`. Replace it with:

```tsx
            <div className={styles.listBox}>
              {defaultAccount === null ? (
                <div className={styles.empty}>
                  <EmptyState title={t('transactions.empty')} body={t('transactions.emptyBody')} />
                  <Link className={styles.reset} href="/accounts?new">
                    {t('home.stepAccount')}
                  </Link>
                </div>
              ) : (
                <QuickAdd …props from Step 2… />
              )}
            </div>
```

Above the `return`, add:

```tsx
  // W11: the quick add saves on the first spendable account (not a pocket, not archived).
  const defaultAccount =
    page.data.accounts.find(
      (account) => account.archivedAt === null && !isPocket(account) && account.type !== 'savings',
    ) ?? null;
```

Import `isPocket` from `@saldo/core`. If the account type for savings has another name, or the app has a helper for «spendable» (`rtk grep -rn "spendable" packages/core/src`), use that helper. Show the quick add only when the user has no transaction at all (`page.data.transactions.length === 0`). For an empty period of a user who has transactions, keep `transactions.empty`.

- [ ] **Step 4: No results — the matches in other periods**

In `page.tsx`, the branch `!hasRows && view.filtered` renders `transactions.noResults`. Replace its content with:

```tsx
            <div className={styles.empty}>
              <EmptyState
                title={t('transactions.noResultsIn', {
                  period: formatCycleRange(period.range, locale, today),
                })}
                body={t('transactions.noResultsBody')}
              />
              {otherPeriods.length === 0 || filters.query === '' ? null : (
                <div className={styles.otherPeriods}>
                  <p>{t('transactions.otherPeriods', { query: filters.query })}</p>
                  {otherPeriods.map((entry) => (
                    <Link
                      key={entry.range.start}
                      className={styles.otherPeriod}
                      href={periodHref(PATH, entry.range, def, today, searchFromFilters(filters))}
                    >
                      <span>{formatCycleRange(entry.range, locale, today)}</span>
                      <span>{plural(t, locale, 'transactions.periodCount', entry.count)}</span>
                    </Link>
                  ))}
                </div>
              )}
              <Link className={styles.reset} href={link(periodOnly)}>
                {t('transactions.resetFilters')}
              </Link>
            </div>
```

Above the `return`, add:

```tsx
  // W11: the same search in the other periods, when this one finds nothing.
  const otherPeriods =
    hasRows || !view.filtered
      ? []
      : matchesInOtherPeriods({
          txs: page.data.transactions,
          filters,
          lookup: filterLookup(page.data),
          def,
          exclude: period.range,
        });
```

`listView` already builds a `FilterLookup` for `filterTransactions`. Find it (`rtk grep -n "FilterLookup\|categoryParentId" apps/web/src/features/transactions/listView.ts`) and export it from `listView.ts` as `filterLookup(data)`, so that both use one lookup. Import `matchesInOtherPeriods` from `@saldo/core`, and `periodHref` from `src/features/period/periodParams` (Statistics uses it). Import `formatCycleRange` from `@saldo/i18n`. If `filters` is not the core `TransactionFilters` type, convert it the way `listView` does.

Add the CSS:

```css
.otherPeriods {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  max-width: 420px;
  color: var(--color-text-muted);
  font-size: var(--font-size-footnote);
}

.otherPeriod {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  align-items: center;
  padding: 0 10px;
  margin: 0 -10px;
  border-radius: var(--radius-input);
  color: var(--color-text);
  text-decoration: none;
}

@media (hover: hover) and (pointer: fine) {
  .otherPeriod:hover {
    background: var(--color-raised);
  }
}
```

- [ ] **Step 5: Check and commit**

Run: `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm --filter web test`
Expected: clean, no error, PASS.

Look at `/transactions` for a member with one account and no transaction. Add an expense with the quick add, and expect it in the list. Then on a seeded member, search `esselunga` in a period with no match. Expect the periods with matches, each a link to that period with the same search.

```bash
rtk git add "apps/web/app/(app)/transactions" apps/web/src/features/transactions/listView.ts
rtk git commit -m "feat(web): the quick add, and a search's matches in other periods (W11)"
```

---

### Task 5: Statistics — an empty period

**Files:**
- Modify: `apps/web/app/(app)/stats/page.tsx`
- Modify: `apps/web/app/(app)/stats/stats.module.css`

- [ ] **Step 1: Render it**

In the running/closed branch of `page.tsx`, after `const view = statsView(…)`, add:

```tsx
  // W11: a period with no row at all. The chart stays; the breakdown and the tags give the way out.
  const periodEmpty = !page.data.transactions.some((tx) => isWithin(period.range, tx.date));
  const lastWithData = periodEmpty
    ? (periodHistory(page.data.transactions, def, period.range, 24)[0]?.period ?? null)
    : null;
```

Import `isWithin` and `periodHistory` from `@saldo/core`. In the returned JSX, replace the Breakdown and the Tags `section`s with this block when `periodEmpty`:

```tsx
        {periodEmpty ? (
          <section className={styles.box}>
            <p className={styles.emptyTitle}>
              {t('stats.emptyPeriod', {
                period: formatCycleRange(period.range, locale, today),
              })}
            </p>
            <div className={styles.emptyActions}>
              {lastWithData === null ? null : (
                <Link
                  className={styles.emptyAction}
                  href={periodHref(PATH, lastWithData, def, today, keep)}
                >
                  {t('stats.goToPeriod', {
                    period: formatCycleRange(lastWithData, locale, today),
                  })}
                </Link>
              )}
              <NewTransactionLink className={styles.emptyAction}>
                {t('web.shell.newTransaction')}
              </NewTransactionLink>
            </div>
          </section>
        ) : (
          <>
            {/* the Breakdown section, unchanged */}
            {/* the Tags section, unchanged */}
          </>
        )}
```

The two comments mark where the existing sections go: move the existing Breakdown and Tags `section` elements there, unchanged. Import `NewTransactionLink` from `src/ui/NewTransactionLink`. `periodHistory` only looks back from `period`, so a forecast period never reaches this branch.

- [ ] **Step 2: The CSS**

Add to `stats.module.css`:

```css
.emptyTitle {
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-medium);
}

.emptyActions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.emptyAction {
  display: inline-flex;
  align-items: center;
  height: var(--layout-nav-item-height);
  padding: 0 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-input);
  color: var(--color-text);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}
```

- [ ] **Step 3: Check and commit**

Run the gates as in Task 4, Step 5. Look at `/stats?p=` for a month before the seed's first transaction: expect the chart, then «‹Month› has no transactions yet», «Go to ‹the oldest month with data›» and «New transaction».

```bash
rtk git add "apps/web/app/(app)/stats"
rtk git commit -m "feat(web): an empty period on Statistics points to one with data (W11)"
```

---

### Task 6: Accounts, goals, budgets, tags, invites

**Files:**
- Modify: `apps/web/src/features/accounts/formView.ts`
- Modify: `apps/web/app/(app)/accounts/page.tsx`, `accounts.module.css`
- Modify: `apps/web/app/(app)/profile/goals/page.tsx`
- Modify: `apps/web/src/features/budgets/formView.ts`, `apps/web/app/(app)/profile/budgets/page.tsx`
- Modify: `apps/web/app/(app)/profile/tags/page.tsx`
- Modify: `apps/web/app/(app)/admin/invites/page.tsx`

- [ ] **Step 1: The forms take a prefill**

In `apps/web/src/features/accounts/formView.ts`:
- Add `prefill?: Partial<AccountFormValues>` to `accountFormView`'s input, and `prefill?: Partial<GoalFormValues>` to `goalFormView`'s input. To do this, split `Input` into two interfaces, or add both fields as optional to `Input`.
- For a new form, use `{ ...emptyAccountForm(), ...input.prefill }` and `{ ...emptyGoalForm(), ...input.prefill }`. An edit form ignores the prefill.

Read `AccountFormValues` and `GoalFormValues` in `@saldo/core`. Write down the field names of the type, the name and the target, and the format of the target: a minor-unit number, or a typed string such as `"1500,00"`. The pages below must give that format.

In `apps/web/src/features/budgets/formView.ts`, add `prefill?: { categoryIds: string[]; amount?: string }` to `budgetFormView`. A new form starts with those categories and that amount, in the shape of `BudgetFormValues`.

- [ ] **Step 2: Accounts — «Which account do you want to add?»**

In `apps/web/app/(app)/accounts/page.tsx`:

1. **The new form reads the URL.** Build the `new` panel with `accountFormView({ …, prefill: typeParam === undefined ? undefined : { type: typeParam } })`. Take `typeParam` from `params.type` only when it is one of `accountTypesFor(page.data.accounts, null)`. If the type sets a default icon in `emptyAccountForm` or in the form's change handler, keep that behaviour. Read `AccountForm.tsx` to see what changes when the type changes.
2. **The empty state.** Replace `<EmptyState title={t('accounts.empty')} />` with:

```tsx
                <section className={styles.box}>
                  <h2 className={styles.boxTitle}>{t('accounts.whichType')}</h2>
                  <div className={styles.types}>
                    {accountTypesFor(page.data.accounts, null).map((type) => (
                      <PanelLink key={type} className={styles.type} href={`${PATH}?new&type=${type}`}>
                        <Icon name={typeIcon(type)} size={20} />
                        {t(`accountTypes.${type}`)}
                      </PanelLink>
                    ))}
                  </div>
                </section>
```

`typeIcon` is the icon the new-account form gives that type. Find it in `@saldo/core` (`rtk grep -rn "icon" packages/core/src/accounts.ts`). If no map exists, add a small `const TYPE_ICON: Record<Account['type'], IconName>` in the page, with icons from `@saldo/ui`'s set that the phone uses for the same types. A link with `&type=` changes more than the panel, so it navigates, and the server renders the prefilled form.

3. **The CSS.** Add to `accounts.module.css`:

```css
.types {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}

.type {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-input);
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
  transition: background-color var(--motion-press) var(--motion-easing);
}

@media (hover: hover) and (pointer: fine) {
  .type:hover {
    background: var(--color-raised);
  }
}
```

- [ ] **Step 3: Goals — three presets**

The Goals block of Accounts (R5) and `/profile/goals` both show the goals' empty state. In both, when there is no goal and `canCreateGoal` (or the same rule on `/profile/goals`), show three presets before the «Create a goal» link:

```tsx
                        <div className={styles.presets}>
                          {presets.map((preset) => (
                            <Link key={preset.key} className={styles.type} href={preset.href}>
                              <b>{preset.name}</b>
                              {preset.amount === null ? null : <span>{money(preset.amount)}</span>}
                            </Link>
                          ))}
                        </div>
```

with, above the `return`:

```tsx
  // W11: the emergency fund is 3 times the median monthly spend; holiday and car have no amount.
  const emergency = emergencyFundTarget({ txs: page.data.transactions, def, today });
  const presets = [
    { key: 'emergency', name: t('goals.presetEmergency'), amount: emergency },
    { key: 'holiday', name: t('goals.presetHoliday'), amount: null },
    { key: 'car', name: t('goals.presetCar'), amount: null },
  ].map((preset) => ({
    ...preset,
    href: `${NEW_GOAL_HREF}&name=${encodeURIComponent(preset.name)}${
      preset.amount === null ? '' : `&target=${preset.amount}`
    }`,
  }));
```

On `/profile/goals`, the `new` panel must read `params.name` and `params.target`, and pass them as `goalFormView`'s `prefill`. Convert `target` from minor units to the format Step 1 found. Use the `@saldo/core` money helper that the goal form uses for an edit (`goalFormFrom`): it turns a stored target into the form's value. Add a `.presets` rule as `.types` above, and add `.type span { margin-inline-start: auto; color: var(--color-text-muted); }`. Import `emergencyFundTarget` from `@saldo/core`.

- [ ] **Step 4: Budgets — «Where you spend most»**

In `apps/web/app/(app)/profile/budgets/page.tsx`, when there is no budget, replace the empty state with:

```tsx
        <Section title={t('budgets.suggestTitle')}>
          {suggestions.map((suggestion) => {
            const category = page.data.categories.find((c) => c.id === suggestion.categoryId);
            return (
              <ListRow
                key={suggestion.categoryId}
                icon={category?.icon as IconName | undefined}
                colorIndex={category?.colorIndex}
                title={category?.name ?? '—'}
                subtitle={t('budgets.suggestAmount', { amount: money(suggestion.amount) })}
                trailing={
                  <PanelLink
                    className={styles.newBudget}
                    href={`${PATH}?new&category=${suggestion.categoryId}&amount=${suggestion.amount}`}
                  >
                    {t('budgets.create')}
                  </PanelLink>
                }
              />
            );
          })}
        </Section>
```

with `const suggestions = budgetSuggestions({ txs: page.data.transactions, categories: page.data.categories, budgets: page.data.budgets, def, today });`. When `suggestions` is empty, keep the old empty state. The `new` panel reads `params.category` (only a live category id) and `params.amount`, and passes them as `budgetFormView`'s `prefill`, with the amount converted to the form's format as in Step 3. Import `budgetSuggestions` from `@saldo/core`, and `ListRow`/`IconName` if they are not imported.

- [ ] **Step 5: Tags — the field in the page**

In `apps/web/app/(app)/profile/tags/page.tsx`, when there is no tag, render the body of the existing «New tag» panel (`TagForm` with the new form's view) inside the page, in place of the empty state, with `closeHref={PATH}` and `afterSave={PATH}`. Read `TagForm.tsx` first. If it assumes it is inside a `Panel` (for example, it focuses the panel's heading), give it a prop `inline` that skips that, and keep the panel behaviour as the default.

- [ ] **Step 6: Invites — the form in the page**

In `apps/web/app/(app)/admin/invites/page.tsx`, when there is no invite, render the body of the «New invite» panel (`MintInvite`, or whatever the `new` panel renders) inside the page, under the heading `admin.invites.createFirst`, in place of the empty state. Keep `requireWebAdmin` and the Server Action guards exactly as they are.

- [ ] **Step 7: Check and commit**

Run: `rtk proxy pnpm lint`, `rtk proxy pnpm --filter web typecheck`, `rtk proxy pnpm --filter web test`
Expected: clean, no error, PASS.

Look at each place, using a temporary Playwright script, and delete it before you commit:
- `/accounts` for a new member: six types; a type opens «New account» with that type.
- The Goals block and `/profile/goals` with no goal: three presets. «Emergency fund» opens «New goal» with its name and target.
- `/profile/budgets` on a seeded member with no budget: the suggestions. «Create» opens the form with the category and the amount.
- `/profile/tags` with no tag: the field in the page. Adding a tag lists it.
- `/admin/invites` with no invite: the form in the page.

```bash
rtk git add apps/web/src/features/accounts/formView.ts apps/web/src/features/budgets/formView.ts "apps/web/app/(app)/accounts" "apps/web/app/(app)/profile" "apps/web/app/(app)/admin/invites"
rtk git commit -m "feat(web): first steps for accounts, goals, budgets, tags and invites (W11)"
```

---

### Task 7: e2e

**Files:**
- Modify or create in `apps/web/e2e/`: a spec `empty-states.spec.ts`, and the specs that read an old empty state

- [ ] **Step 1: Find the old empty states in the tests**

Run: `rtk grep -rn "transactions.empty\|accounts.empty\|goals.empty\|budgets.empty\|tags.empty\|noResults\|stats.empty" apps/web/e2e`
Each test that reads one of them must read the new state. Change it only where the page changed on purpose, and say so in the commit.

- [ ] **Step 2: Write the new spec**

Create `apps/web/e2e/empty-states.spec.ts`. Use `createMember` from `./support/members` (without `seed` for a new member), `readLedger`, `createExpense` and the fixtures the other specs use. One test for each of these:

1. **New member, Home:**
   - The Home shows the heading `home.startTitle` and `home.startProgress` «0 of 4».
   - The link `accounts.newAccount` goes to `/accounts?new`.
   - After you create an account in the form, the Home shows «1 of 4», and `home.inAccounts` lists the account.
2. **Quick add:**
   - A member with one account and no transaction opens `/transactions` and fills the amount.
   - Pressing the add button makes the row appear in the list.
   - The link `transactions.importCsv` points to `/profile/data`.
3. **No results:**
   - On a seeded member, search `Esselunga` in the current period with the filter `onlyIncome` on, so that nothing matches. Use any search that has matches in other periods but none in this one.
   - The page shows `transactions.noResultsIn`, and at least one link to another period that keeps `q=`.
4. **Statistics, empty period:**
   - On a seeded member, open `/stats?p=` a month before the seed's first transaction.
   - The page shows `stats.emptyPeriod` and a `stats.goToPeriod` link.
   - Clicking that link opens a period whose breakdown has rows.
5. **Accounts, new member:**
   - `/accounts` shows `accounts.whichType`.
   - Clicking the first type opens the dialog `accounts.newAccount`, with that type selected.
6. **Budgets, seeded member with no budget:**
   - If the seed has budgets, delete them first through the page.
   - `/profile/budgets` shows `budgets.suggestTitle`.
   - The first «Create» opens the form with its category selected.

Make every assertion read strings through `t(…)`, as the other specs do.

- [ ] **Step 3: Run the suite**

Run: `rtk proxy pnpm --filter web e2e`
Expected: every test passes.

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/web/e2e
rtk git commit -m "test(web): the first steps of the empty states (W11)"
```

---

### Task 8: Roadmap and gates

**Files:**
- Modify: `docs/superpowers/plans/README.md`

- [ ] **Step 1: Tick R7 and close the redesign**

In `docs/superpowers/plans/README.md`:
- Replace `- [ ] **R7** — empty states and the new \`@saldo/core\` functions (W11).` with `- [x] **R7** — empty states and the new \`@saldo/core\` functions (W11) (\`plans/2026-10-21-web-redesign-r7-empty-states.md\`).`
- Change the heading `### Web redesign — top bar, one column, new pages ◐ in progress` to `### Web redesign — top bar, one column, new pages ✅ done`.
- After the paragraph `**Acceptance for R6:** …`, add:

```markdown
**Acceptance for R7:**
- A new user sees «Getting started» on the Home, and the blocks with no data do not show.
- Transactions:
  - with no transaction, it has a quick add;
  - a search with no result lists the other periods that match.
- An empty period of Statistics links to the last period with data.
- Accounts offers the account types, Goals offers three presets, and Budgets offers «Where you spend most».
- Tags and Invites show their form in the page.
- `budgetSuggestions`, `matchesInOtherPeriods` and `emergencyFundTarget` are in `@saldo/core`, with tests.
```

- [ ] **Step 2: Run the gates, unfiltered**

Run: `rtk proxy pnpm lint`
Expected: no `lint/…` lines and no `× Some errors were emitted while running checks.`

Run: `rtk proxy pnpm typecheck --continue`
Expected: every package passes. On a machine with Node older than 22.22, `site` fails on the engine check only; that is not a failure of this plan.

Run: `rtk proxy pnpm test`
Expected: every package passes.

- [ ] **Step 3: Commit**

```bash
rtk git add docs/superpowers/plans/README.md
rtk git commit -m "docs: the web redesign in the roadmap, R7 done"
```
