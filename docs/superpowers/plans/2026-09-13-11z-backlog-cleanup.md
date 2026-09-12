# Backlog cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three loose ends the roadmap still carries outside a phase — transfers that cannot be listed, a
business rule living in the app instead of in `@saldo/core`, and a form that refuses to save without saying why — and
correct the one roadmap entry that describes work as open when it shipped.

**Architecture:** Four independent tasks, no shared state, any order. Each one is small enough to land on its own
commit. Nothing here blocks phase 11 and phase 11 does not block any of it.

**Tech Stack:** `@saldo/core` (pure TypeScript + Vitest), Expo app (jest-expo + RNTL), `@saldo/i18n` catalogs.

**Roadmap entries this closes:** the "Transfers cannot be listed" bullet and the categories/recents items under
*Backlog from hands-on use*, plus the *Still open* list in `2026-09-11-ui-scoping.md` §B.

---

## Task 1: A transfer can be listed

`TransactionFilters.direction` is `'all' | 'expense' | 'income'` (`packages/core/src/filters.ts:10`). A transfer is
neither, so **both** chips hide it and the only way to see one is to scroll the unfiltered list. In an app whose
transfers move money between the user's own accounts, "show me what I moved" is a question with no answer.

The matcher already does the right thing — `filters.ts:84` is
`if (filters.direction !== 'all' && tx.kind !== filters.direction) return false;`, and `tx.kind` is already
`'transfer'` for transfers. So the change is the type, the param parsing, one chip and two catalog keys.

**Files:**
- Modify: `packages/core/src/filters.ts`
- Test: `packages/core/src/filters.test.ts`
- Modify: `apps/mobile/app/(tabs)/transactions.tsx`
- Modify: `packages/i18n/src/locales/it.ts`, `packages/i18n/src/locales/en.ts`

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/src/filters.test.ts`:

```ts
it('lists only transfers when the direction says so', () => {
  const rows = [
    { ...expense, id: 'a' },
    { ...income, id: 'b' },
    { ...transfer, id: 'c' },
  ];
  const matched = rows.filter((tx) => matchesFilters(tx, { ...EMPTY_FILTERS, direction: 'transfer' }, lookup));
  expect(matched.map((tx) => tx.id)).toEqual(['c']);
});

it('reads transfer out of a link, like the other two directions', () => {
  expect(filtersFromParams({ direction: 'transfer' }).direction).toBe('transfer');
});
```

Use the fixtures and the matcher name the file already uses (`matchesFilters` here is a placeholder for whatever
`filters.ts` exports — check before writing). If there is no `transfer` fixture, build one from the expense fixture
with `kind: 'transfer'` and a `toAccountId`.

- [ ] **Step 2: Run them and watch them fail**

```bash
rtk proxy pnpm --filter @saldo/core test -- --run src/filters.test.ts
```

Expected: FAIL — the first on a type error (`'transfer'` is not assignable), the second because
`filtersFromParams` drops the unrecognised value and returns `'all'`.

- [ ] **Step 3: Widen the type and the parser**

In `packages/core/src/filters.ts`:

```ts
  /**
   * "Solo uscite" / "Solo entrate" / "Solo trasferimenti". A transfer is neither an expense nor an
   * income, so the first two hide it — which is why it needs a value of its own rather than being
   * reachable only by clearing the filter.
   */
  direction: 'all' | 'expense' | 'income' | 'transfer';
```

and in `filtersFromParams`:

```ts
    ...(params.direction === 'expense' ||
    params.direction === 'income' ||
    params.direction === 'transfer'
      ? { direction: params.direction }
      : {}),
```

- [ ] **Step 4: Run them and watch them pass**

```bash
rtk proxy pnpm --filter @saldo/core test -- --run src/filters.test.ts
```

Expected: PASS. `hasActiveFilters` (`filters.ts:71`) already reads `direction !== 'all'`, so the "clear filters"
affordance follows for free — confirm the existing test for it still passes rather than assuming.

- [ ] **Step 5: Add the chip**

In `apps/mobile/app/(tabs)/transactions.tsx`, after the `onlyIncome` chip:

```tsx
        <Chip
          label={t('transactions.onlyTransfers')}
          icon="arrows"
          active={filters.direction === 'transfer'}
          onPress={() => set({ direction: filters.direction === 'transfer' ? 'all' : 'transfer' })}
        />
```

`icon="arrows"` must be a name that exists in `@saldo/ui`'s icon set — check `packages/ui/src/icons.ts` and use the
one the transfer row already uses in `transactionRow.ts`, so a transfer looks the same wherever it appears.

- [ ] **Step 6: Add the strings to both catalogs**

`packages/i18n/src/locales/it.ts`, next to `onlyIncome`:

```ts
    onlyTransfers: 'Solo trasferimenti',
```

`packages/i18n/src/locales/en.ts`:

```ts
    onlyTransfers: 'Transfers only',
```

- [ ] **Step 7: Run everything**

```bash
rtk proxy pnpm --filter @saldo/i18n test
rtk proxy pnpm --filter mobile test
rtk proxy pnpm typecheck
```

Expected: green, including the it/en parity test.

- [ ] **Step 8: Commit**

```bash
rtk git add packages/core/src/filters.ts packages/core/src/filters.test.ts packages/i18n apps/mobile/app
rtk git commit -m "feat(mobile): transfers can be listed, not only scrolled past"
```

---

## Task 2: The recents rule moves into core, and starts counting the period

`topCategories` (`apps/mobile/src/features/transactions/useTransactionForm.ts:151`) decides which seven categories the
transaction form offers. Two things are wrong with where it is and how it counts.

**Where.** AGENTS.md: business rules live in `@saldo/core` as pure functions with injected time and unit tests;
screens load data, call core, and render. The function is already pure and already tested — this is a move, not a
rewrite.

**How.** It ranks by the number of transactions **since 1970** up to the transaction's date, which the form pays for
literally: `TransactionForm.tsx:104` reads `useTransactionsInRange('1970-01-01', …)` on every open. Two consequences —
a category used heavily two years ago and never since still outranks one used weekly now, and the query grows without
bound (Task 5 of the phase-11 plan measures what that costs at 20k rows).

**The decision to take, and it is a product one:** rank on a **window**, not on all of history. Recommended:
transactions in the last 90 days, falling back to all-time when the window holds fewer than five rows (a new install
would otherwise show an arbitrary seven). Recency alone (last used first) is rejected: it makes the tiles move under
the user's thumb between one entry and the next, which costs more than it saves. Write whichever rule you take into
the function's doc comment with its reason — the next person will otherwise re-derive it.

**Files:**
- Create: `packages/core/src/recents.ts`
- Create: `packages/core/src/recents.test.ts`
- Modify: `packages/core/src/index.ts` (export it)
- Modify: `apps/mobile/src/features/transactions/useTransactionForm.ts` (remove the function, re-export nothing)
- Modify: `apps/mobile/src/features/transactions/TransactionForm.tsx` (call it, and narrow the query)
- Modify: `apps/mobile/src/features/transactions/useTransactionForm.test.ts` (drop the moved tests)

- [ ] **Step 1: Write the failing tests in core**

Create `packages/core/src/recents.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from './entities';
import { topCategories } from './recents';

const category = (id: string, direction: 'expense' | 'income', sortOrder: number): Category => ({
  id,
  name: id,
  direction,
  parentId: null,
  icon: 'tag',
  colour: null,
  sortOrder,
  archivedAt: null,
  deletedAt: null,
});

const use = (categoryId: string, date: string): Pick<Transaction, 'categoryId' | 'date'> => ({
  categoryId,
  date,
});

describe('topCategories', () => {
  const categories = [
    category('old-favourite', 'expense', 0),
    category('current', 'expense', 1),
    category('salary', 'income', 2),
  ];

  it('ranks a category used inside the window above one used only before it', () => {
    const usage = [
      ...Array.from({ length: 20 }, () => use('old-favourite', '2024-01-10')),
      ...Array.from({ length: 5 }, () => use('current', '2026-09-01')),
    ];
    const ranked = topCategories(categories, usage, 'expense', { today: '2026-09-13' });
    expect(ranked[0]?.id).toBe('current');
  });

  it('falls back to all of history when the window is nearly empty', () => {
    const usage = Array.from({ length: 20 }, () => use('old-favourite', '2024-01-10'));
    const ranked = topCategories(categories, usage, 'expense', { today: '2026-09-13' });
    expect(ranked[0]?.id).toBe('old-favourite');
  });

  it('offers only the direction being entered', () => {
    const ranked = topCategories(categories, [], 'income', { today: '2026-09-13' });
    expect(ranked.map((c) => c.id)).toEqual(['salary']);
  });

  it('never returns more than the limit', () => {
    const many = Array.from({ length: 30 }, (_, index) => category(`c-${index}`, 'expense', index));
    expect(topCategories(many, [], 'expense', { today: '2026-09-13' })).toHaveLength(7);
  });

  it('leaves an archived category out', () => {
    const archived = { ...category('gone', 'expense', 9), archivedAt: 1 };
    const ranked = topCategories([...categories, archived], [], 'expense', { today: '2026-09-13' });
    expect(ranked.map((c) => c.id)).not.toContain('gone');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
rtk proxy pnpm --filter @saldo/core test -- --run src/recents.test.ts
```

Expected: FAIL — `Cannot find module './recents'`.

- [ ] **Step 3: Write the function**

Create `packages/core/src/recents.ts`, moving the body from `useTransactionForm.ts:151` and adding the window:

```ts
import { addDays, type LocalDate } from './dates';
import type { Category, Transaction, TransactionKind } from './entities';

/** How far back "recently used" reaches, and how much use it takes to trust the window. */
export const RECENTS_WINDOW_DAYS = 90;
const MIN_ROWS_IN_WINDOW = 5;

/**
 * The categories the transaction form offers as tiles (§6.16), most used first.
 *
 * **Ranked on the last 90 days, not on all of history.** A category used heavily two years ago and
 * never since is not what the next transaction wants, and all-time counts never let go of it. The
 * fallback matters as much as the window: a fresh install, or somebody who has not entered anything
 * in months, has nothing inside it, and ranking on an almost-empty sample is worse than ranking on
 * everything — so under five rows in the window, the whole history decides.
 *
 * Recency (last used first) was considered and rejected: it moves the tiles between one entry and
 * the next, and a target that moves costs more than the ranking saves.
 *
 * Seven, not the ten the spec names: with the "Altro" tile that is two rows of four, and the grid
 * stops pushing the date, the tags and the attachments off the screen.
 */
export function topCategories(
  categories: readonly Category[],
  transactions: readonly Pick<Transaction, 'categoryId' | 'date'>[],
  kind: TransactionKind,
  options: { today: LocalDate; limit?: number },
): Category[] {
  const limit = options.limit ?? 7;
  const direction = kind === 'income' ? 'income' : 'expense';
  const since = addDays(options.today, -RECENTS_WINDOW_DAYS);
  const inWindow = transactions.filter((tx) => tx.date >= since);
  const counted = inWindow.length >= MIN_ROWS_IN_WINDOW ? inWindow : transactions;

  const usage = new Map<string, number>();
  for (const tx of counted) {
    if (tx.categoryId === null) continue;
    usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
  }
  return categories
    .filter((category) => category.direction === direction && category.archivedAt === null)
    .sort((a, b) => {
      const diff = (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.sortOrder - b.sortOrder;
    })
    .slice(0, limit);
}
```

Export it from `packages/core/src/index.ts` alongside the other modules.

- [ ] **Step 4: Run and watch it pass**

```bash
rtk proxy pnpm --filter @saldo/core test -- --run src/recents.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Point the form at it**

In `apps/mobile/src/features/transactions/useTransactionForm.ts`, delete `topCategories` and its doc comment. In
`TransactionForm.tsx`, import it from `@saldo/core` instead and pass `today`:

```tsx
  const grid = useMemo(
    () => topCategories(categories, recent, values.kind, { today }),
    [categories, recent, values.kind, today],
  );
```

`today` is already in scope on that screen (it comes from `usePeriod`); if it is not, take it from there rather than
calling a clock inside the component — AGENTS.md wants the clock injected.

Then narrow the query. `TransactionForm.tsx:104` reads from `1970-01-01` because the same rows feed the category
ranking, the tag suggestions **and** the transfer balance preview. The balances genuinely need all of history, so
leave that read alone in this task and record the cost — narrowing it means splitting one query into two, which is a
change worth measuring first (phase 11, Task 5) rather than guessing at here.

- [ ] **Step 6: Move the tests over**

Delete the `describe('topCategories', …)` block from `useTransactionForm.test.ts` — it now lives in
`packages/core/src/recents.test.ts`, and two copies of a rule is one copy that goes stale.

- [ ] **Step 7: Run everything**

```bash
rtk proxy pnpm --filter @saldo/core test
rtk proxy pnpm --filter mobile test
rtk proxy pnpm typecheck
```

Expected: green.

- [ ] **Step 8: Look at it on a device**

```bash
rtk proxy pnpm --filter mobile ios
```

Open the FAB on a seeded database. The seven tiles must be categories the demo data uses *recently*, and switching to
"Entrata" must swap the whole grid to income categories.

- [ ] **Step 9: Commit**

```bash
rtk git add packages/core/src apps/mobile/src/features/transactions
rtk git commit -m "feat(core): the category tiles follow the last 90 days, not all of history"
```

---

## Task 3: A form that cannot be saved says why

From `2026-09-11-ui-scoping.md` §B question 6: *"What is disabled, what is explained, and where — today a form that
cannot be saved does not always say why."* A disabled button with no explanation is the worst of both: it refuses and
it will not say what it wants.

**The rule to apply, everywhere:** the primary button is **never** silently disabled. Either it is enabled and pressing
it reveals what is missing (inline, on the field that is missing it), or it is disabled **and** a line under it says
what is needed. The second is right when the missing thing is obvious and singular ("Inserisci un importo"); the first
is right when several things could be missing.

**Files:**
- Modify: whichever forms the audit in step 1 finds — start with `TransactionForm.tsx`, `AccountForm.tsx`,
  `CategoryForm.tsx`, the budget form, and the tag editor
- Modify: `packages/i18n/src/locales/it.ts`, `en.ts`
- Test: the existing form test files, one assertion each

- [ ] **Step 1: Find every disabled primary button**

```bash
rtk grep -rn "disabled" apps/mobile/src/features apps/mobile/app
```

For each hit on a `PrimaryButton`, write down: what makes it disabled, and whether anything on screen says so. That
list is the task.

- [ ] **Step 2: Write the failing test for the first one**

For the transaction form, in its existing test file:

```tsx
it('says what it is waiting for instead of only greying the button out', () => {
  renderForm({ mode: 'new' });
  expect(screen.getByText('Inserisci un importo')).toBeTruthy();
});
```

Use the render helper the file already has, and assert through the i18n key's Italian value the way the other tests in
that file do.

- [ ] **Step 3: Run it and watch it fail**

```bash
rtk proxy pnpm --filter mobile test -- TransactionForm
```

Expected: FAIL — no such text.

- [ ] **Step 4: Add the hint**

Under the pinned button, when the button is disabled:

```tsx
      {saveDisabledReason === null ? null : (
        <Text size="footnote" color="textMuted" style={{ textAlign: 'center', marginTop: 8 }}>
          {saveDisabledReason}
        </Text>
      )}
```

with the reason computed next to whatever already decides `disabled`, as a small pure function so it can be tested
without the screen:

```ts
/** Why the save button is refusing, or `null` when it is not. */
export function saveBlockedReason(values: TransactionFormValues, amountMinor: number): string | null {
  if (amountMinor <= 0) return 'txForm.needsAmount';
  if (values.kind === 'transfer' && values.toAccountId === null) return 'txForm.needsDestination';
  return null;
}
```

The function returns the **key**; the screen translates it. New keys go in both catalogs.

- [ ] **Step 5: Run it, then repeat for each remaining form**

```bash
rtk proxy pnpm --filter mobile test
rtk proxy pnpm --filter @saldo/i18n test
```

Expected: green, with the parity test passing on the new keys.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/mobile/src packages/i18n
rtk git commit -m "feat(mobile): a form that will not save says what it is missing"
```

---

## Task 4: The roadmap stops describing shipped work as open

`2026-09-11-ui-scoping.md` §B lists *"what a 'more' disclosure should hide (`excludeFromTotals`, the note)"* as still
open. It shipped: `useTransactionForm.ts:198-237` has `detailsSummary`, `detailsAreEmpty` and `detailsOpenInitially`,
the "Dettagli" disclosure holds tags, attachments, repeat and exclude, and the description deliberately stays outside
it. A plan that describes finished work as pending costs the next reader the time it takes to discover otherwise.

**Files:**
- Modify: `docs/superpowers/plans/2026-09-11-ui-scoping.md`

- [ ] **Step 1: Rewrite the "Still open" list in §B**

Move the disclosure out of it and into the decided part of the section, recording what was decided and where it lives:

```markdown
- **The disclosure.** "Dettagli" holds tags, attachments, repeat and `excludeFromTotals` —
  the four rarely-touched fields that together pushed the frequent ones off the screen. The
  description stays outside it: it is typed on most transactions. `detailsSummary` counts what is
  inside so a *set* value is readable without opening it, which is the only thing that makes
  collapsing safe, and `detailsOpenInitially` opens it on an edit that has something in it — edit is
  random access, and the field you came back for is the one already filled.
  (`src/features/transactions/useTransactionForm.ts`.)
```

leaving the remaining two items — the recents rule (Task 2 of this plan) and the error/save-button rules (Task 3) — in
"Still open", each with a pointer to the task that closes it.

- [ ] **Step 2: Commit**

```bash
rtk git add docs/superpowers/plans/2026-09-11-ui-scoping.md
rtk git commit -m "docs(plans): the transaction form's disclosure is built, not pending"
```

---

## Out of scope

The timed fast path (deferred by the user on 2026-09-13, recorded in `2026-09-11-ui-scoping.md` §B), splitting the
transaction form's single history query into two (measure first — phase 11, Task 5), and the local-row scoping that
10b stands in for (blocked on the owning entity, decided 2026-09-12).
