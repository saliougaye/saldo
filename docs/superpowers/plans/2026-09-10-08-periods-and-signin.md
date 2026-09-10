# Phase 08 — Generic periods, and one mandatory sign-in

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop treating the pay cycle as *the* period. The user picks how they track spending — calendar month, week,
year, or a pay cycle starting on a day they choose — and any ad-hoc range on top of that. And collapse the two ways
into the app into one: signing in to the user's own server.

**Why:** both asked for by the user after phase 07. "Non pensare a un cycle ma a periodo di tempo generico come un
normale budget tracking", and "esiste un sign in unico che si collega al server ma se l'app è offline puoi comunque
inserire dati". Since the server and its database belong to the user, the server may be required; a server-less
variant can come later.

**Architecture:** one `PeriodDef` in `@saldo/core` — a kind plus the cycle's start day — replaces the loose
`cycleStartDay` argument that 389 call sites pass around. Construction and shifting are the only kind-specific parts:
everything downstream already works on a `DateRange`, so `summarizePeriod`, `spendingByCategory`, `dailyCumulative`,
`committedSpend` and the projections need no change at all. Week and year ranges already exist in `budgetRanges.ts`
and are reused rather than rewritten.

**No users exist**, so schemas change in place: the mobile SQLite migrations and the server's Drizzle schema are
regenerated rather than migrated.

---

## Decisions taken while planning

- **`PeriodDef = { kind: 'month' | 'week' | 'cycle' | 'year'; startDay: number }`.** One object, not a kind plus
  loose arguments, because every call site that takes `cycleStartDay` today would otherwise have to learn a second
  parameter. `startDay` is only read when `kind === 'cycle'`, and stays 1–28 for the reason §5.2 gives (a start day
  of 29–31 has no meaning in February).
- **Week starts Monday.** The app is Italian-first and ISO weeks are Monday-based; `isoWeekRange` already implements
  it, so there is no second convention to configure.
- **The default period is the calendar month.** It is what "normal budget tracking" means, and it needs no setup —
  the pay cycle is the option that asks a question.
- **`budget.period` becomes `'period' | 'week' | 'month' | 'year'`.** `'period'` follows the app's own period,
  which is what today's `'cycle'` meant; rollover stays available only for it, since a rollover across two
  differently-shaped windows has no defined meaning. Existing rows are rewritten `'cycle' → 'period'`.
- **"Cycle" survives in the vocabulary only where it means the pay cycle.** The rest of the code and the strings say
  period. §5.2's clamping rule is unchanged; it just no longer applies to every user.
- **Sign-in is mandatory and comes first.** Onboarding step 0 stops offering a local-only path: it asks for the
  server and runs the passkey ceremony. Everything after it is unchanged, and everything after it works offline —
  what is required is *having* an account, not being online. This makes §1.1 stricter and is recorded there.
- **A first run with no network is therefore blocked.** That follows from the choice and the user accepted it; the
  screen says so plainly rather than pretending to be broken.

---

## Task 1: `PeriodDef` in core

**Files:**
- Create: `packages/core/src/period.ts`, `packages/core/src/period.test.ts`
- Modify: `packages/core/src/cycle.ts` (keeps the cycle primitives), `packages/core/src/index.ts`

- [x] **Step 1: Write the failing test**

```ts
// packages/core/src/period.test.ts
import { describe, expect, it } from 'vitest';
import {
  currentPeriod,
  isPeriodKind,
  PERIOD_KINDS,
  type PeriodDef,
  periodContaining,
  periodLength,
  previousPeriods,
  shiftPeriod,
} from './period';

const month: PeriodDef = { kind: 'month', startDay: 1 };
const week: PeriodDef = { kind: 'week', startDay: 1 };
const cycle: PeriodDef = { kind: 'cycle', startDay: 27 };
const year: PeriodDef = { kind: 'year', startDay: 1 };

describe('periodContaining', () => {
  it('spans the calendar month', () => {
    expect(periodContaining(month, '2026-09-10')).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
    // February in a leap year, because that is where off-by-one lives.
    expect(periodContaining(month, '2028-02-15')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('spans the ISO week, Monday to Sunday', () => {
    // 2026-09-10 is a Thursday.
    expect(periodContaining(week, '2026-09-10')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    });
    // A Sunday belongs to the week that started six days earlier, not the next one.
    expect(periodContaining(week, '2026-09-13')).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    });
  });

  it('spans the pay cycle from its start day', () => {
    expect(periodContaining(cycle, '2026-09-10')).toEqual({
      start: '2026-08-27',
      end: '2026-09-26',
    });
    expect(periodContaining(cycle, '2026-09-27')).toEqual({
      start: '2026-09-27',
      end: '2026-10-26',
    });
  });

  it('spans the calendar year', () => {
    expect(periodContaining(year, '2026-09-10')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });
});

describe('shiftPeriod', () => {
  it('steps a month at a time, keeping month boundaries', () => {
    const september = periodContaining(month, '2026-09-10');
    expect(shiftPeriod(month, september, -1)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31',
    });
    expect(shiftPeriod(month, september, 1)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    // Two steps back from March lands on January, not on "60 days earlier".
    const march = periodContaining(month, '2026-03-15');
    expect(shiftPeriod(month, march, -2)).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });

  it('steps a week at a time', () => {
    const current = periodContaining(week, '2026-09-10');
    expect(shiftPeriod(week, current, -1)).toEqual({ start: '2026-08-31', end: '2026-09-06' });
    expect(shiftPeriod(week, current, 2)).toEqual({ start: '2026-09-21', end: '2026-09-27' });
  });

  it('steps a cycle at a time, clamping the start day per month', () => {
    const current = periodContaining({ kind: 'cycle', startDay: 31 }, '2026-03-15');
    // March has a 31st, February does not: the previous cycle starts on the 28th.
    expect(shiftPeriod({ kind: 'cycle', startDay: 31 }, current, -1).start).toBe('2026-02-28');
  });

  it('steps a year at a time', () => {
    const current = periodContaining(year, '2026-09-10');
    expect(shiftPeriod(year, current, -1)).toEqual({ start: '2025-01-01', end: '2025-12-31' });
  });

  it('is reversible for every kind', () => {
    for (const def of [month, week, cycle, year]) {
      const current = periodContaining(def, '2026-09-10');
      expect(shiftPeriod(def, shiftPeriod(def, current, -3), 3)).toEqual(current);
    }
  });
});

describe('previousPeriods', () => {
  it('walks back one step at a time, newest first', () => {
    const current = periodContaining(month, '2026-09-10');
    expect(previousPeriods(month, current, 3).map((range) => range.start)).toEqual([
      '2026-08-01',
      '2026-07-01',
      '2026-06-01',
    ]);
  });

  it('returns nothing for a count of zero', () => {
    expect(previousPeriods(month, periodContaining(month, '2026-09-10'), 0)).toEqual([]);
  });
});

describe('periodLength and currentPeriod', () => {
  it('counts the days a range covers, inclusive', () => {
    expect(periodLength(periodContaining(month, '2026-09-10'))).toBe(30);
    expect(periodLength(periodContaining(week, '2026-09-10'))).toBe(7);
    expect(periodLength(periodContaining(cycle, '2026-09-10'))).toBe(31);
    expect(periodLength(periodContaining(year, '2026-09-10'))).toBe(365);
  });

  it('describes the period around a day', () => {
    const current = currentPeriod(cycle, '2026-09-10');
    expect(current).toMatchObject({ isCurrent: true, elapsed: 15, length: 31 });
    expect(current.range).toEqual({ start: '2026-08-27', end: '2026-09-26' });
  });
});

describe('isPeriodKind', () => {
  it('guards a value read back from the database', () => {
    expect(PERIOD_KINDS).toEqual(['month', 'week', 'cycle', 'year']);
    expect(isPeriodKind('month')).toBe(true);
    expect(isPeriodKind('fortnight')).toBe(false);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @saldo/core test period`
Expected: FAIL — cannot resolve `./period`.

- [x] **Step 3: Implement `packages/core/src/period.ts`**

```ts
import { isoWeekRange, yearRange } from './budgetRanges';
import { assertCycleStartDay, cycleContaining, type DateRange, elapsedDays, shiftCycle } from './cycle';
import { addDays, addMonths, type LocalDate, makeLocalDate, parseLocalDate } from './dates';

export const PERIOD_KINDS = ['month', 'week', 'cycle', 'year'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export function isPeriodKind(value: string): value is PeriodKind {
  return (PERIOD_KINDS as readonly string[]).includes(value);
}

/**
 * How the user tracks spending (§5.2). One object rather than a kind plus loose arguments, because
 * every function that used to take `cycleStartDay` would otherwise grow a second parameter.
 *
 * `startDay` is read only when `kind === 'cycle'`, and stays 1–28: a start day of 29–31 has no
 * meaning in February, which is why §5.2 clamps it.
 */
export interface PeriodDef {
  kind: PeriodKind;
  startDay: number;
}

function monthRange(date: LocalDate): DateRange {
  const { year, month } = parseLocalDate(date);
  const start = makeLocalDate(year, month, 1);
  return { start, end: addDays(addMonths(start, 1), -1) };
}

/** The period that contains `date`. */
export function periodContaining(def: PeriodDef, date: LocalDate): DateRange {
  switch (def.kind) {
    case 'month':
      return monthRange(date);
    case 'week':
      return isoWeekRange(date);
    case 'year':
      return yearRange(date);
    case 'cycle':
      assertCycleStartDay(def.startDay);
      return cycleContaining(date, def.startDay);
  }
}

/**
 * The period `delta` steps away. Stepping by definition, never by day arithmetic: a month is not
 * 30 days, and a cycle starting on the 31st starts on the 28th in February.
 */
export function shiftPeriod(def: PeriodDef, range: DateRange, delta: number): DateRange {
  switch (def.kind) {
    case 'month':
      return monthRange(addMonths(range.start, delta));
    case 'week':
      return isoWeekRange(addDays(range.start, delta * 7));
    case 'year':
      return yearRange(addMonths(range.start, delta * 12));
    case 'cycle':
      assertCycleStartDay(def.startDay);
      return shiftCycle(range, def.startDay, delta);
  }
}

/** The `count` periods before `range`, newest first. */
export function previousPeriods(
  def: PeriodDef,
  range: DateRange,
  count: number,
): DateRange[] {
  const periods: DateRange[] = [];
  let cursor = range;
  for (let step = 0; step < count; step += 1) {
    cursor = shiftPeriod(def, cursor, -1);
    periods.push(cursor);
  }
  return periods;
}

/** Days the range covers, inclusive of both ends. */
export function periodLength(range: DateRange): number {
  return elapsedDays(range, range.end);
}

export interface CurrentPeriod {
  range: DateRange;
  isCurrent: boolean;
  /** Days from the start through `today`, inclusive; the whole length for a closed period. */
  elapsed: number;
  length: number;
}

export function currentPeriod(def: PeriodDef, today: LocalDate): CurrentPeriod {
  const range = periodContaining(def, today);
  return {
    range,
    isCurrent: true,
    elapsed: elapsedDays(range, today),
    length: periodLength(range),
  };
}

/** The same description for a period the user navigated to, which may be closed. */
export function describePeriod(range: DateRange, today: LocalDate): CurrentPeriod {
  const isCurrent = today >= range.start && today <= range.end;
  return {
    range,
    isCurrent,
    elapsed: isCurrent ? elapsedDays(range, today) : periodLength(range),
    length: periodLength(range),
  };
}
```

- [x] **Step 4: Export it** — add `export * from './period';` to `packages/core/src/index.ts`.
      `budgetRanges.ts` must not import from `period.ts` (it is the other way round); check for a cycle.

- [x] **Step 5: Run the tests**

Run: `pnpm --filter @saldo/core test period`
Expected: PASS (14 tests).

- [x] **Step 6: Commit** — `feat(core): PeriodDef for month, week, cycle and year`

---

## Task 2: Move the core's period-shaped functions onto `PeriodDef`

**Files:**
- Modify: `packages/core/src/history.ts`, `budgets.ts`, `budgetRanges.ts`, `rollover.ts`, `stats.ts`
  and their tests

The rename table — every one of these keeps its behaviour and gains a `PeriodDef` where it took a
`cycleStartDay`:

| Before | After |
| --- | --- |
| `cycleHistory(txs, range, startDay, count)` | `periodHistory(txs, def, range, count)` |
| `cycleSpendHistory(history, today)` | `periodSpendHistory(history, today)` (name only) |
| `budgetRange(budget, range, startDay, today)` | `budgetRange(budget, def, range, today)` |
| `budgetCarry(budget, txs, range, startDay, today)` | `budgetCarry(budget, txs, def, range, today)` |
| `previousCycles` (call sites) | `previousPeriods(def, …)` |
| `shiftCycle` (call sites outside `period.ts`) | `shiftPeriod(def, …)` |
| `cycleContaining` (call sites outside `period.ts`) | `periodContaining(def, …)` |

`cycle.ts` keeps `cycleContaining`, `shiftCycle`, `assertCycleStartDay`, `cycleLength`,
`elapsedDays`, `isWithin` — they are the pay-cycle primitives `period.ts` builds on, and the last
three are already period-shaped.

- [x] **Step 1: `budget.period` gains its new vocabulary**

In `packages/core/src/entities.ts`:

```ts
export const budgetPeriodSchema = z.enum(['period', 'week', 'month', 'year']);
```

`'period'` means "the app's own period" — what `'cycle'` meant before. Update `budgetSchema` and the
`Budget` type, and the entity tests that name a period.

- [x] **Step 2: `budgetRange` learns the fourth case**

```ts
/**
 * The window a budget is measured over (§5.8). `'period'` follows the app's own period, so a
 * budget keeps meaning the same thing when the user switches from a pay cycle to a month.
 */
export function budgetRange(
  budget: Pick<Budget, 'period'>,
  def: PeriodDef,
  range: DateRange,
  today: LocalDate,
): DateRange {
  switch (budget.period) {
    case 'period':
      return range;
    case 'week':
      // A past period shows its last week, clipped to the period (§5.8).
      return clipToRange(isoWeekRange(referenceDay(range, today)), range);
    case 'month':
      return clipToRange(monthRangeOf(referenceDay(range, today)), range);
    case 'year':
      return clipToRange(yearRange(referenceDay(range, today)), range);
  }
}
```

Keep the existing `referenceDay`/clipping behaviour — the only new case is `'month'`, and `'period'`
replaces `'cycle'`. Add tests for the month case and for a month budget inside a *cycle* period,
where the two windows do not line up.

- [x] **Step 3: `rollover.ts` walks by definition**

`budgetCarry` currently steps with `shiftCycle` back to the budget's creation cycle; it now steps
with `shiftPeriod(def, …)`. Rollover stays limited to `period: 'period'`, and its test that walks
three periods back gains a month-kind case.

- [x] **Step 4: `history.ts` renames and re-parameterises**

`periodHistory(txs, def, range, count)` — bounded to `count` periods, empties removed, emptiness
still measured on rows and not on counted amounts (the two properties its tests already pin down).

- [x] **Step 5: Run the whole core suite**

Run: `pnpm --filter @saldo/core test`
Expected: green, with the renamed functions covered by the tests that already existed.

- [x] **Step 6: Commit** — `refactor(core)!: period-shaped functions take a PeriodDef`

---

## Task 3: `settings.periodKind`

**Files:**
- Modify: `packages/core/src/entities.ts`, `apps/mobile/src/db/schema.ts`,
  `apps/mobile/src/db/seed.ts`, `apps/mobile/drizzle/**` (regenerated)

- [x] **Step 1: The entity**

```ts
export const settingsSchema = z.object({
  ...syncMeta,
  id: z.literal(SETTINGS_ID),
  /** How the user tracks spending (§5.2). */
  periodKind: periodKindSchema,
  /** Read only when `periodKind === 'cycle'`; kept so switching back remembers the day. */
  cycleStartDay: z.number().int().min(1).max(28),
  currency: z.enum(CURRENCY_CODES),
  …
});
```

`periodKindSchema` is `z.enum(PERIOD_KINDS)` re-exported from `period.ts`, so there is one list.

- [x] **Step 2: The local column** — `period_kind text not null` in the `settings` table.

- [x] **Step 3: Regenerate the migrations**

No user exists, so the history is squashed rather than migrated:

```bash
rm -rf apps/mobile/drizzle && pnpm --filter mobile db:generate
```

Then reseed any simulator with `pnpm --filter mobile seed:db <path> --reset`.

- [x] **Step 4: Leave the sync schema version at 1**

`SYNC_SCHEMA_VERSION` **stays 1**, on the user's instruction. The gate of §8.1 protects a peer that
already speaks an older shape, and no such peer exists: no instance is deployed and no account has
ever been created, so version 1 simply *is* the current shape. Bumping it would only mean two
versions where one of them was never used by anything. It gets bumped the first time a schema
changes after a real device is in the field.

The same reasoning is why the local database is regenerated rather than migrated: wipe the
simulator's copy (`pnpm --filter mobile seed:db <path> --reset`, or uninstall the app) instead of
writing a migration for rows nobody has.

- [x] **Step 5: Commit** — `feat!: settings carry the period kind`

---

## Task 4: The app's period layer

**Files:**
- Modify: `apps/mobile/src/features/period/PeriodProvider.tsx`, `PeriodSheet.tsx`, `PeriodHeader.tsx`
- Create: `apps/mobile/src/features/period/PeriodKindSheet.tsx`,
  `apps/mobile/src/features/period/CustomRangeSheet.tsx`

- [x] **Step 1: `PeriodProvider` exposes the definition**

It replaces `cycleStartDay: number` with `def: PeriodDef` (read from settings, defaulting to
`{ kind: 'month', startDay: 27 }`), keeps the selection union
`{ kind: 'period'; range } | { kind: 'custom'; range }`, and keeps `shift(delta)` — which now calls
`shiftPeriod(def, …)` and is a no-op for a custom range, since "the week before this arbitrary
range" is not a thing the user asked for.

- [x] **Step 2: The sheet gets the rows the design shows**

`PeriodSheet` (§6.15, the design's bottom sheet) lists the periods that hold data, then two rows the
implementation was missing:

- **"Periodo personalizzato"** → `CustomRangeSheet`: two dates through the existing
  `DateTimePicker`, validated `start <= end`, applied as a custom selection.
- **"Tipo di periodo"** → `PeriodKindSheet`: mese / settimana / ciclo di stipendio / anno, writing
  `settings.periodKind`.
- **"Giorno di inizio ciclo"**, shown only when the kind is `cycle`, reusing the day grid the
  onboarding step already has.

The header keeps `formatCycleRange` for a cycle and a plain range for the others.

- [x] **Step 3: Every call site drops `cycleStartDay` for `def`**

The screens and hooks in this list pass `def` through instead: `(tabs)/index.tsx`,
`(tabs)/stats.tsx`, `budgets.tsx`, `category/[id].tsx`, `account/[id].tsx`, `transaction/new.tsx`,
`transaction/edit/[id].tsx`, `BudgetForm.tsx`, `useBudgetProgress.ts`, `RecurrenceScopeSheet.tsx`,
`MaterialiserGate.tsx`, `SyncProvider.tsx`, `DevTools.tsx`, `recurrenceService.ts`, `demo.ts`,
`seed.ts`. None of them changes behaviour; they stop knowing that a period is a cycle.

- [x] **Step 4: Strings**

The `period` namespace gains `kind`, `kindMonth`, `kindWeek`, `kindCycle`, `kindYear`,
`customRange`, `customFrom`, `customTo`, `cycleStartDay`; `budgets` renames its `cycle` option to
`period`. Both locales, as the parity test requires.

- [x] **Step 5: Run the mobile suite**

Run: `pnpm --filter mobile test`
Expected: green after the call sites are updated.

- [x] **Step 6: Commit** — `feat(mobile): pick the period, not just the cycle`

---

## Task 5: Onboarding asks for the period

**Files:**
- Modify: `apps/mobile/app/(onboarding)/cycle-day.tsx` → `period.tsx`,
  `apps/mobile/src/features/onboarding/state.tsx`

- [x] **Step 1** Replace step 1 with a period question: four options, with the day grid revealed
      under "Ciclo di stipendio" — the only kind that needs a second answer. The default selection
      is the month, and the progress bar and copy keep their shape (§6.29).
- [x] **Step 2** The draft carries `periodKind` and `cycleStartDay`, and "Inizia" writes both.
- [x] **Step 3** Commit — `feat(mobile): onboarding asks how you track spending`

---

## Task 6: One mandatory sign-in

**Files:**
- Modify: `apps/mobile/app/(onboarding)/welcome.tsx`, `apps/mobile/app/index.tsx`,
  `apps/mobile/app/profile.tsx`, `apps/mobile/app/profile/server.tsx`

- [x] **Step 1: The welcome step asks for the server, and only that**

The two buttons become one flow: server address → "Verifica" → passkey sign-in or account creation.
It reuses the pieces `profile/server.tsx` already has, so the logic is shared rather than copied —
extract the connect form into `src/features/server/ConnectForm.tsx` and use it from both.

When there is no network, the screen says so and offers "Riprova": with sign-in mandatory, a first
run offline cannot proceed, and pretending otherwise would be worse than saying it.

- [x] **Step 2: Boot gating**

`app/index.tsx` becomes: not signed in → `/welcome`; signed in but no settings row → `/period`
(step 1); otherwise → `/(tabs)`. The lock screen still wins over everything.

A signed-in device with no local settings pulls first: if the server already holds settings with
`onboardingCompletedAt`, the rest of onboarding is skipped (§6.29 already says so).

- [x] **Step 3: "Esci" no longer means "go local-only"**

Signing out returns to `/welcome`; the local data stays on the phone, and signing back in resumes
sync. The confirm sheet says exactly that.

- [x] **Step 4** Commit — `feat(mobile)!: one sign-in, and it is required`

---

## Task 7: Docs and verification

- [x] **Step 1:** Spec: §1.1 (the server is required; a server-less variant is a later option),
      §5.2 (periods, with the pay cycle as one kind and its clamping rule intact), §5.8
      (`budget.period` vocabulary), §6.15 (the sheet's three extra rows), §6.29 (step 0 is a
      sign-in; step 1 asks the period), §8.1 (why the version stays 1 for now).
- [x] **Step 2:** Roadmap: this phase, and renumber attachments/import-export to 09 and
      docs/hardening to 10.
- [x] **Step 3:** `pnpm lint`, `pnpm typecheck`, `pnpm test` — reading the output, not the exit code
      (see AGENTS.md).
- [ ] **Step 4:** On the simulator, with a reseeded database: the period sheet shows the new rows,
      switching to "settimana" reshapes Home and Statistics, and a custom range applies. Screenshot
      each, because that is how the last three UI defects were found.
- [ ] **Step 5:** Code review, then merge.

---

## Self-review notes

- **What does not change:** every function that already took a `DateRange` — `summarizePeriod`,
  `spendingByCategory`, `dailyCumulative`, `committedSpend`, `projectEndOfCycle`, `accountBalances`.
  That is why this is a wide but shallow refactor.
- **What breaks on purpose:** `budget.period`'s vocabulary and `settings`' shape. No instance is
  deployed and no account exists, so the migrations are regenerated and the sync schema version
  stays 1 — there is no older peer for it to protect.
- **Risk to watch:** a month budget inside a cycle period (and the reverse) — two windows that do
  not line up. `budgetRange` clips, and Task 2 step 2 pins that down with a test.
