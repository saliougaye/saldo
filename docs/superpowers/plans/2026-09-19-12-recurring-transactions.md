# Recurring transactions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A recurrence can fire every N days, weeks, months or years, can end on a date or after N times, is set from
a visible "Ripeti" chip row in the transaction form, is listed and managed from a "Ricorrenti" screen reached from
the Transactions tab, and can be stopped.

**Architecture:** `Recurrence` gains `frequency ∈ {daily, weekly, monthly, yearly}` and `interval ≥ 1` (additive:
`'monthly'` stays valid, `interval` defaults to 1, so rows written before this phase still parse). `endDate` already
exists; "dopo N volte" is turned into an `endDate` by `@saldo/core` at save time, so nothing new reaches the wire for
it. The materialiser, the next-occurrence and the "stop" logic are pure functions in `packages/core/src/recurrence.ts`
with tests; `apps/mobile/src/db/recurrenceService.ts` runs them inside one SQLite transaction. The form keeps a
`RecurrenceRule | null` instead of a boolean. Three new UI pieces: `RecurrenceSheet` (presets, custom, end), the
`app/recurrences.tsx` list and the `app/recurrence/[id].tsx` detail. Occurrence rows get a ↻ badge on their `IconBox`.

**Tech Stack:** `@saldo/core` Zod + vitest; Drizzle + expo-sqlite (migration `0002`); Expo Router; jest-expo +
Testing Library; `@saldo/i18n`; `@saldo/ui` tokens.

**Branch:** `feat/recurrences`. Mockup committed with the plan:
`docs/superpowers/mockups/2026-09-18-recurring-transactions.html` (variant **A** for the form, **B** for the tab).

---

## Decisions

**Decided with the user (2026-09-18 / 19):**

- Management lives in the **Transactions tab**: a "Ricorrenti" card under "In arrivo" → list screen → detail screen.
- Form: **variant A** of the mockup — a "Ripeti" chip row under Data (`Mai · Ogni mese · Ogni settimana · Altro ›`)
  and a one-line summary with "Cambia". No more toggle under "Dettagli".
- Frequencies: presets (week, 2 weeks, month, year) **and** custom "Ogni N giorni/settimane/mesi/anni".
- End: mai / in una data / dopo N volte.
- Occurrences generated from a recurrence show a **↻ badge on the row icon**; no extra text.
- **No pause.** Only "Smetti di ripetere". `pausedAt` is not added.
- Occurrences keep materialising automatically; no confirm/skip flow.

**Decisions where the spec is silent** (recorded here per AGENTS.md):

- **Anchor of a schedule = `startDate`.** Monthly: its day of month, clamped to short months (unchanged). Weekly: its
  weekday. Yearly: its month and day (29 Feb → 28 Feb in common years). Daily: none.
- **"Dopo N volte" is stored as `endDate`** = the date of the N-th occurrence. The detail shows the date. No count
  column, nothing to keep in sync with `endDate`.
- **"Smetti di ripetere"** sets `endDate = today` and tombstones every occurrence dated after today, so today's row
  stays. A series whose `startDate` is still in the future is deleted whole (tombstone on the recurrence).
- **Changing the cadence** of an existing recurrence from its detail closes the old series on `today`, tombstones its
  upcoming occurrences and starts a new recurrence, same template, from the first date the new rule fires after today
  (anchored on the old `startDate`). Changing only the end keeps the same recurrence and updates `endDate`. Template
  edits (amount, category…) keep going through the existing scope sheet: "Modifica" on the detail opens the edit form
  of the next upcoming occurrence (or the latest one).
- **Editing an occurrence** shows the rule as a read-only row "Ricorrente · Ogni mese, il 18 · Gestisci ›" that opens
  the recurrence detail. Turning a **non**-recurring existing transaction into a recurrence from the edit form is
  allowed and works like the new form.
- **"Impegnate ogni mese"** = Σ `amount × occurrencesPerMonth` over live recurrences, expenses and income separately,
  transfers ignored. `occurrencesPerMonth` = 365/12, 52/12, 1, 1/12 divided by `interval`. Rounded to minor units.
- The "Ricorrenti" card on the tab is rendered only when at least one recurrence exists. The form is the entry point.
- `SYNC_SCHEMA_VERSION` **stays at 1**, as decided for the debit card on 2026-09-17: no public users yet. An old peer
  would drop a weekly recurrence row as invalid while still receiving its occurrences as plain transactions. Rebuild the
  app and redeploy the server together. Once the repository is public this kind of change bumps the version.
- No SQLite change on the server: it stores entity JSON opaquely and validates with `@saldo/core`.

---

## File map

| File | Change |
| --- | --- |
| `packages/core/src/entities.ts` (+ test) | `recurrenceFrequencySchema`, `interval` (default 1), `RecurrenceRule` |
| `packages/core/src/recurrence.ts` (+ test) | `nthOccurrence`, `occurrenceDates(schedule, horizon)`, `nextOccurrence`, `endDateAfterCount`, `occurrencesPerMonth`, `recurringMonthlyTotals`, `planStopRecurrence` |
| `packages/i18n/src/format.ts` (+ test) | `formatWeekday`, `formatDayMonthLong` |
| `packages/i18n/src/locales/it.ts`, `en.ts` | `recurrence.*` block; `transactions.recurringEveryMonth` removed |
| `apps/mobile/src/db/schema.ts`, `drizzle/0002_*.sql`, `drizzle/migrations.js` | `frequency` typed as the enum, `interval` column |
| `apps/mobile/src/db/recurrenceService.ts` (+ test) | `startRecurrence(rule)`, `stopRecurrence`, `changeRecurrenceRule`; series split copies cadence |
| `apps/mobile/src/db/demo.ts`, `scripts/seed-database.ts` | `interval: 1` |
| `apps/mobile/src/db/hooks.ts` | `useRecurrences`, `useRecurrence`, `useOccurrences` |
| `apps/mobile/src/features/transactions/useTransactionForm.ts` (+ test) | `recurrence: RecurrenceRule \| null` replaces `repeat` |
| `apps/mobile/src/features/transactions/recurrenceCopy.ts` (+ test) | `cadenceLabel`, `endLabel`, `presetOf`, `ruleForPreset` |
| `apps/mobile/src/components/CountStepper.tsx` | `−  N  +` control |
| `apps/mobile/src/features/transactions/RecurrenceSheet.tsx` (+ test) | presets, custom, end |
| `apps/mobile/src/features/transactions/TransactionForm.tsx` | Ripeti chip row (variant A); toggle removed from Dettagli |
| `apps/mobile/app/transaction/new.tsx`, `edit/[id].tsx` | pass the rule to `startRecurrence` |
| `apps/mobile/src/features/transactions/RecurrenceScopeSheet.tsx` | caption uses `cadenceLabel`; new series copies cadence |
| `apps/mobile/src/components/ListRow.tsx` | `IconBox` `badge` prop |
| `apps/mobile/app/(tabs)/index.tsx`, `(tabs)/transactions.tsx`, `account/[id].tsx`, `tag/[id].tsx` | badge on occurrence rows |
| `apps/mobile/app/transaction/[id].tsx` | note row says the cadence; "Ricorrenza ›" row |
| `apps/mobile/src/features/recurrences/RecurrencesCard.tsx` | the card on the tab |
| `apps/mobile/app/recurrences.tsx` | §6.33 list screen |
| `apps/mobile/app/recurrence/[id].tsx` | §6.34 detail screen |
| spec §4, §5.9, §6.2, §6.6, §6.16, §6.33, §6.34; `docs/superpowers/plans/README.md` | docs |

---

### Task 0: Branch and mockup

**Files:** `docs/superpowers/mockups/2026-09-18-recurring-transactions.html`, this plan

- [x] **Step 1: Branch.**

```bash
rtk git checkout -b feat/recurrences
```

- [x] **Step 2: Commit the mockup and the plan.**

```bash
rtk git add docs/superpowers/mockups/2026-09-18-recurring-transactions.html docs/superpowers/plans/2026-09-19-12-recurring-transactions.md
rtk git commit -m "docs: plan and mockup for recurring transactions"
```

---

### Task 1: `frequency` enum and `interval` in `@saldo/core`

**Files:** `packages/core/src/entities.ts:158-175`, `packages/core/src/entities.test.ts:105-140`

- [x] **Step 1: Failing tests.** In `entities.test.ts`, inside `describe('recurrenceSchema', …)` after the existing
      `it('accepts a valid monthly recurrence', …)`, add:

```ts
  it('accepts every N days, weeks, months or years, and defaults the interval to 1', () => {
    for (const frequency of ['daily', 'weekly', 'monthly', 'yearly']) {
      const parsed = recurrenceSchema.safeParse({ ...recurrence, frequency, interval: 3 });
      expect(parsed.success).toBe(true);
    }
    const legacy = recurrenceSchema.safeParse(recurrence);
    expect(legacy.success && legacy.data.interval).toBe(1);
  });

  it('rejects an interval below 1, above 99, or fractional', () => {
    for (const interval of [0, 100, 1.5, -1]) {
      expect(recurrenceSchema.safeParse({ ...recurrence, interval }).success).toBe(false);
    }
    expect(recurrenceSchema.safeParse({ ...recurrence, frequency: 'fortnightly' }).success).toBe(
      false,
    );
  });
```

- [x] **Step 2: Run to see them fail.**

Run: `pnpm --filter @saldo/core test -- entities`
Expected: FAIL — `weekly` is not `'monthly'`; `interval` unknown key is stripped (so the second `it` passes only
partially). Read the failures, not the exit code.

- [x] **Step 3: Implement.** In `entities.ts` replace the `recurrenceSchema` block with:

```ts
export const recurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

export const recurrenceSchema = z.object({
  ...syncMeta,
  frequency: recurrenceFrequencySchema,
  /**
   * Every `interval` units of `frequency`: 2 + weekly = every two weeks. Defaults to 1 so a row
   * written before the column existed still parses on pull (§8).
   */
  interval: z.number().int().min(1).max(99).default(1),
  startDate: localDate,
  endDate: localDate.nullable(),
  template: z
    .object({
      kind: transactionKindSchema,
      amount: positiveMinorUnits,
      accountId: id,
      toAccountId: id.nullable(),
      categoryId: id.nullable(),
      description: z.string().max(120),
      tagIds: z.array(id),
      excludeFromTotals: z.boolean(),
    })
    .superRefine(refineTransactionShape),
});
```

And next to `export type Recurrence = …` add:

```ts
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;
/** When a recurrence fires. The form and the sheets pass this around; the template travels apart. */
export type RecurrenceRule = Pick<Recurrence, 'frequency' | 'interval' | 'endDate'>;
```

- [x] **Step 4: Run the tests.**

Run: `pnpm --filter @saldo/core test -- entities`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
rtk git add packages/core/src/entities.ts packages/core/src/entities.test.ts
rtk git commit -m "feat(core): recurrence frequency enum and interval"
```

---

### Task 2: The schedule — `nthOccurrence` and `occurrenceDates` for every frequency

**Files:** `packages/core/src/recurrence.ts:1-64`, `packages/core/src/recurrence.test.ts`

- [x] **Step 1: Rewrite the existing `occurrenceDates` tests to the new signature and add the new cases.** In
      `recurrence.test.ts` replace the whole `describe('occurrenceDates', …)` block with:

```ts
const MONTHLY = { frequency: 'monthly', interval: 1, startDate: '2026-01-27', endDate: null } as const;

describe('nthOccurrence', () => {
  it('counts from the start date', () => {
    expect(nthOccurrence(MONTHLY, 0)).toBe('2026-01-27');
    expect(nthOccurrence(MONTHLY, 2)).toBe('2026-03-27');
    expect(nthOccurrence({ ...MONTHLY, interval: 3 }, 2)).toBe('2026-07-27');
  });

  it('steps days and weeks by the interval', () => {
    expect(nthOccurrence({ ...MONTHLY, frequency: 'daily', interval: 2 }, 3)).toBe('2026-02-02');
    expect(nthOccurrence({ ...MONTHLY, frequency: 'weekly', interval: 2 }, 1)).toBe('2026-02-10');
  });

  it('keeps a yearly date on its month and day, clamping 29 February', () => {
    const leap = { frequency: 'yearly', interval: 1, startDate: '2024-02-29' } as const;
    expect(nthOccurrence(leap, 1)).toBe('2025-02-28');
    expect(nthOccurrence(leap, 4)).toBe('2028-02-29');
  });
});

describe('occurrenceDates', () => {
  it('repeats the start day every month', () => {
    expect(occurrenceDates(MONTHLY, '2026-04-30')).toEqual([
      '2026-01-27',
      '2026-02-27',
      '2026-03-27',
      '2026-04-27',
    ]);
  });

  it('clamps the day to short months, without losing it afterwards', () => {
    expect(occurrenceDates({ ...MONTHLY, startDate: '2026-01-31' }, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('stops at the inclusive end date', () => {
    expect(
      occurrenceDates({ ...MONTHLY, startDate: '2026-01-15', endDate: '2026-03-15' }, '2026-12-31'),
    ).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    expect(
      occurrenceDates({ ...MONTHLY, startDate: '2026-01-15', endDate: '2026-03-14' }, '2026-12-31'),
    ).toEqual(['2026-01-15', '2026-02-15']);
  });

  it('returns nothing when the start is past the horizon', () => {
    expect(occurrenceDates({ ...MONTHLY, startDate: '2027-01-01' }, '2026-12-31')).toEqual([]);
  });

  it('fires every second week on the same weekday', () => {
    expect(
      occurrenceDates(
        { frequency: 'weekly', interval: 2, startDate: '2026-09-18', endDate: null },
        '2026-10-31',
      ),
    ).toEqual(['2026-09-18', '2026-10-02', '2026-10-16', '2026-10-30']);
  });

  it('fires every day, every three days, and once a year', () => {
    expect(
      occurrenceDates(
        { frequency: 'daily', interval: 3, startDate: '2026-09-28', endDate: null },
        '2026-10-05',
      ),
    ).toEqual(['2026-09-28', '2026-10-01', '2026-10-04']);
    expect(
      occurrenceDates(
        { frequency: 'yearly', interval: 1, startDate: '2025-03-12', endDate: null },
        '2027-12-31',
      ),
    ).toEqual(['2025-03-12', '2026-03-12', '2027-03-12']);
  });
});
```

Add `nthOccurrence` to the import from `./recurrence`. Keep every other existing test in the file as it is; where they
build a `Recurrence` literal (`RECURRENCE`), add `interval: 1` after `frequency: 'monthly'`.

- [x] **Step 2: Run to see them fail.**

Run: `pnpm --filter @saldo/core test -- recurrence`
Expected: FAIL — `nthOccurrence` not exported; `occurrenceDates` called with an object.

- [x] **Step 3: Implement.** In `recurrence.ts` replace everything from the `occurrenceDates` doc comment down to
      and including its closing brace with:

```ts
/** The part of a recurrence that says *when* it fires. */
export type RecurrenceSchedule = Pick<Recurrence, 'frequency' | 'interval' | 'startDate' | 'endDate'>;

/**
 * The k-th date a schedule fires on, k = 0 being `startDate` (§5.9).
 *
 * `startDate` is the anchor: its day of month for monthly and yearly schedules — clamped per
 * month, so the 31st fires on the 28th in February and returns to the 31st in March, and 29 Feb
 * fires on the 28th in common years — and its weekday for weekly ones.
 */
export function nthOccurrence(
  schedule: Pick<RecurrenceSchedule, 'frequency' | 'interval' | 'startDate'>,
  k: number,
): LocalDate {
  const steps = k * schedule.interval;
  switch (schedule.frequency) {
    case 'daily':
      return addDays(schedule.startDate, steps);
    case 'weekly':
      return addDays(schedule.startDate, steps * 7);
    case 'monthly':
    case 'yearly': {
      const { year, month, day } = parseLocalDate(schedule.startDate);
      const ym = addMonths({ year, month }, schedule.frequency === 'monthly' ? steps : steps * 12);
      return makeLocalDate(ym.year, ym.month, Math.min(day, daysInMonth(ym.year, ym.month)));
    }
  }
}

/** Dates a schedule fires on, from `startDate` up to `min(endDate, horizonEnd)` inclusive (§5.9). */
export function occurrenceDates(schedule: RecurrenceSchedule, horizonEnd: LocalDate): LocalDate[] {
  const last =
    schedule.endDate === null || schedule.endDate > horizonEnd ? horizonEnd : schedule.endDate;
  const dates: LocalDate[] = [];
  for (let k = 0; ; k += 1) {
    const date = nthOccurrence(schedule, k);
    if (date > last) break;
    dates.push(date);
  }
  return dates;
}
```

In `materializeOccurrences`, change the call to `occurrenceDates(recurrence, horizonEnd)`.

- [x] **Step 4: Run the tests.**

Run: `pnpm --filter @saldo/core test -- recurrence`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
rtk git add packages/core/src/recurrence.ts packages/core/src/recurrence.test.ts
rtk git commit -m "feat(core): schedules fire every N days, weeks, months or years"
```

---

### Task 3: Next occurrence, "dopo N volte", monthly totals, stop plan

**Files:** `packages/core/src/recurrence.ts`, `packages/core/src/recurrence.test.ts`

- [x] **Step 1: Failing tests.** Append to `recurrence.test.ts`:

```ts
describe('nextOccurrence', () => {
  it('is the first date strictly after the given one', () => {
    expect(nextOccurrence(MONTHLY, '2026-03-27')).toBe('2026-04-27');
    expect(nextOccurrence(MONTHLY, '2026-03-26')).toBe('2026-03-27');
    expect(nextOccurrence(MONTHLY, '2025-12-01')).toBe('2026-01-27');
  });

  it('is null once the schedule has ended', () => {
    expect(nextOccurrence({ ...MONTHLY, endDate: '2026-03-27' }, '2026-03-27')).toBeNull();
    expect(nextOccurrence({ ...MONTHLY, endDate: '2026-03-27' }, '2026-03-26')).toBe('2026-03-27');
  });
});

describe('endDateAfterCount', () => {
  it('is the date of the N-th occurrence', () => {
    expect(endDateAfterCount(MONTHLY, 1)).toBe('2026-01-27');
    expect(endDateAfterCount(MONTHLY, 12)).toBe('2026-12-27');
    expect(endDateAfterCount({ ...MONTHLY, frequency: 'weekly', interval: 2 }, 3)).toBe('2026-02-24');
  });

  it('treats anything below one as one', () => {
    expect(endDateAfterCount(MONTHLY, 0)).toBe('2026-01-27');
  });
});

describe('recurringMonthlyTotals', () => {
  const template = (kind: Recurrence['template']['kind'], amount: number) => ({
    ...TEMPLATE,
    kind,
    amount,
    categoryId: kind === 'transfer' ? null : TEMPLATE.categoryId,
    toAccountId: kind === 'transfer' ? 'acc-savings' : null,
  });
  const rec = (
    frequency: Recurrence['frequency'],
    interval: number,
    kind: Recurrence['template']['kind'],
    amount: number,
  ): Recurrence => ({ ...RECURRENCE, id: `${frequency}-${interval}-${kind}`, frequency, interval, template: template(kind, amount) });

  it('brings every cadence back to a month', () => {
    expect(occurrencesPerMonth({ frequency: 'monthly', interval: 1 })).toBe(1);
    expect(occurrencesPerMonth({ frequency: 'monthly', interval: 3 })).toBeCloseTo(1 / 3);
    expect(occurrencesPerMonth({ frequency: 'weekly', interval: 2 })).toBeCloseTo(52 / 24);
    expect(occurrencesPerMonth({ frequency: 'yearly', interval: 1 })).toBeCloseTo(1 / 12);
    expect(occurrencesPerMonth({ frequency: 'daily', interval: 1 })).toBeCloseTo(365 / 12);
  });

  it('sums expenses and income apart and ignores transfers', () => {
    const totals = recurringMonthlyTotals([
      rec('monthly', 1, 'expense', 85000),
      rec('weekly', 2, 'expense', 6000), // 6000 × 52 / 24 = 13000
      rec('yearly', 1, 'expense', 48000), // 4000
      rec('monthly', 1, 'income', 215000),
      rec('monthly', 1, 'transfer', 50000),
    ]);
    expect(totals).toEqual({ expense: 102000, income: 215000 });
  });
});

describe('planStopRecurrence', () => {
  const occurrences = [
    { id: 'rec-rent:2026-03-27', date: '2026-03-27' },
    { id: 'rec-rent:2026-04-27', date: '2026-04-27' },
    { id: 'rec-rent:2026-05-27', date: '2026-05-27' },
  ] as const;

  it('ends today and removes only what is still to come', () => {
    expect(planStopRecurrence(RECURRENCE, occurrences, '2026-04-27')).toEqual({
      endDate: '2026-04-27',
      deleteRecurrence: false,
      tombstoneOccurrenceIds: ['rec-rent:2026-05-27'],
    });
  });

  it('removes a series that has not started yet', () => {
    const future = { ...RECURRENCE, startDate: '2026-05-27' };
    expect(planStopRecurrence(future, [occurrences[2]], '2026-04-18')).toEqual({
      endDate: null,
      deleteRecurrence: true,
      tombstoneOccurrenceIds: ['rec-rent:2026-05-27'],
    });
  });
});
```

Extend the import from `./recurrence` with `endDateAfterCount, nextOccurrence, occurrencesPerMonth,
planStopRecurrence, recurringMonthlyTotals`.

- [x] **Step 2: Run to see them fail.**

Run: `pnpm --filter @saldo/core test -- recurrence`
Expected: FAIL — five missing exports.

- [x] **Step 3: Implement.** Append to `recurrence.ts`:

```ts
/** The first date a schedule fires strictly after `after`, or null once it has ended. */
export function nextOccurrence(schedule: RecurrenceSchedule, after: LocalDate): LocalDate | null {
  for (let k = 0; ; k += 1) {
    const date = nthOccurrence(schedule, k);
    if (schedule.endDate !== null && date > schedule.endDate) return null;
    if (date > after) return date;
  }
}

/** The `endDate` that makes a schedule fire exactly `count` times ("dopo N volte", §5.9). */
export function endDateAfterCount(
  schedule: Pick<RecurrenceSchedule, 'frequency' | 'interval' | 'startDate'>,
  count: number,
): LocalDate {
  return nthOccurrence(schedule, Math.max(1, Math.floor(count)) - 1);
}

const FIRES_PER_YEAR: Record<Recurrence['frequency'], number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  yearly: 1,
};

/** How many times a schedule fires in an average month. */
export function occurrencesPerMonth(
  schedule: Pick<RecurrenceSchedule, 'frequency' | 'interval'>,
): number {
  return FIRES_PER_YEAR[schedule.frequency] / 12 / schedule.interval;
}

export interface RecurringMonthlyTotals {
  /** Minor units a month, positive. */
  expense: number;
  income: number;
}

/**
 * What the live recurrences add up to in a month (§6.33). Transfers move money between two of the
 * user's own accounts, so they belong to neither side.
 */
export function recurringMonthlyTotals(
  recurrences: readonly Recurrence[],
): RecurringMonthlyTotals {
  let expense = 0;
  let income = 0;
  for (const recurrence of recurrences) {
    const perMonth = Math.round(recurrence.template.amount * occurrencesPerMonth(recurrence));
    if (recurrence.template.kind === 'expense') expense += perMonth;
    else if (recurrence.template.kind === 'income') income += perMonth;
  }
  return { expense, income };
}

export interface StopRecurrencePlan {
  /** New `endDate`, or null when the recurrence goes away entirely. */
  endDate: LocalDate | null;
  deleteRecurrence: boolean;
  tombstoneOccurrenceIds: string[];
}

/**
 * "Smetti di ripetere" (§5.9): the past stays, the future goes. The series ends on `today`, so an
 * occurrence dated today is kept; a series that has not started yet has nothing to keep.
 */
export function planStopRecurrence(
  recurrence: Recurrence,
  occurrences: readonly { id: string; date: LocalDate }[],
  today: LocalDate,
): StopRecurrencePlan {
  const tombstoneOccurrenceIds = occurrences.filter((row) => row.date > today).map((row) => row.id);
  if (recurrence.startDate > today) {
    return { endDate: null, deleteRecurrence: true, tombstoneOccurrenceIds };
  }
  return { endDate: today, deleteRecurrence: false, tombstoneOccurrenceIds };
}
```

- [x] **Step 4: Run the tests.**

Run: `pnpm --filter @saldo/core test -- recurrence`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
rtk git add packages/core/src/recurrence.ts packages/core/src/recurrence.test.ts
rtk git commit -m "feat(core): next occurrence, end after N, monthly totals, stop plan"
```

---

### Task 4: i18n — keys and two date formatters

**Files:** `packages/i18n/src/format.ts`, `packages/i18n/src/format.test.ts`,
`packages/i18n/src/locales/it.ts`, `packages/i18n/src/locales/en.ts`

- [x] **Step 1: Failing formatter tests.** Append to `format.test.ts`:

```ts
describe('formatWeekday / formatDayMonthLong', () => {
  it('names the weekday in full', () => {
    expect(formatWeekday('2026-09-18', 'it')).toBe('venerdì');
    expect(formatWeekday('2026-09-18', 'en')).toBe('Friday');
    expect(formatWeekday('2026-09-20', 'it')).toBe('domenica');
  });

  it('writes day and long month without the year', () => {
    expect(formatDayMonthLong('2026-09-18', 'it')).toBe('18 settembre');
    expect(formatDayMonthLong('2026-09-18', 'en')).toBe('September 18');
  });
});
```

Add both names to the import from `./format`.

- [x] **Step 2: Run to see them fail.**

Run: `pnpm --filter @saldo/i18n test -- format`
Expected: FAIL — not exported.

- [x] **Step 3: Implement.** In `format.ts`, import `weekdayOf` from `@saldo/core` (extend the existing import), add
      after `WEEKDAYS_SHORT`:

```ts
const WEEKDAYS_LONG: Record<AppLocale, readonly string[]> = {
  it: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};
```

and after `formatLongDate`:

```ts
/** it `venerdì`, en `Friday`. Monday-first, as `weekdayOf` counts. */
export function formatWeekday(date: LocalDate, locale: AppLocale): string {
  return WEEKDAYS_LONG[locale][weekdayOf(date)] ?? '';
}

/** it `18 settembre`, en `September 18`: a yearly anchor, whose year is the point of leaving out. */
export function formatDayMonthLong(date: LocalDate, locale: AppLocale): string {
  const { month, day } = parseLocalDate(date);
  const name = monthName(MONTHS_LONG, locale, month);
  return locale === 'it' ? `${day} ${name}` : `${name} ${day}`;
}
```

- [x] **Step 4: Run the tests.**

Run: `pnpm --filter @saldo/i18n test -- format`
Expected: PASS.

- [x] **Step 5: Keys.** In `it.ts`, delete the line `recurringEveryMonth: 'Ricorrente, ogni mese',` in
      `transactions` and add a new top-level block right after `recurrenceScope: { … },`:

```ts
  recurrence: {
    title: 'Ricorrenti',
    never: 'Mai',
    everyMonth: 'Ogni mese',
    everyWeek: 'Ogni settimana',
    everyTwoWeeks: 'Ogni 2 settimane',
    everyYear: 'Ogni anno',
    other: 'Altro',
    custom: 'Personalizzato',
    customHint: 'Ogni N giorni, settimane, mesi o anni',
    change: 'Cambia',
    manage: 'Gestisci',
    every: 'Ogni',
    every_daily_one: 'Ogni giorno',
    every_daily_other: 'Ogni {{count}} giorni',
    every_weekly_one: 'Ogni settimana',
    every_weekly_other: 'Ogni {{count}} settimane',
    every_monthly_one: 'Ogni mese',
    every_monthly_other: 'Ogni {{count}} mesi',
    every_yearly_one: 'Ogni anno',
    every_yearly_other: 'Ogni {{count}} anni',
    unit_daily: 'giorni',
    unit_weekly: 'settimane',
    unit_monthly: 'mesi',
    unit_yearly: 'anni',
    onDayOfMonth: 'il {{day}}',
    onWeekday: 'il {{weekday}}',
    onDate: 'il {{date}}',
    nextDates: 'prossime: {{dates}}',
    end: 'Fine',
    endNever: 'Mai',
    endOnDate: 'In una data',
    endAfterCount: 'Dopo N volte',
    lastOccurrence: 'Ultima occorrenza',
    times: 'Numero di volte',
    noEnd: 'senza fine',
    untilDate: 'fino al {{date}}',
    recurringNote: 'Ricorrente, {{cadence}}',
    recurringRow: 'Ricorrenza',
    createsUpcoming: 'Crea anche le prossime occorrenze fino a fine ciclo prossimo',
    cardSubtitle_one: '{{count}} attiva · prossima {{name}} il {{date}}',
    cardSubtitle_other: '{{count}} attive · prossima {{name}} il {{date}}',
    perMonth: '{{amount}}/mese',
    monthlyAverage: 'Ogni mese, in media',
    shareOfIncome: 'Le uscite fisse sono il {{percent}}% delle entrate fisse',
    count_one: '{{count}} ricorrenza',
    count_other: '{{count}} ricorrenze',
    empty: 'Nessuna ricorrenza. Attiva «Ripeti» su una transazione per crearne una.',
    cadence: 'Cadenza',
    cadenceHint: 'Tocca per cambiare cadenza',
    firstOccurrence: 'Prima occorrenza',
    next: 'prossima {{date}}',
    ended: 'terminata il {{date}}',
    endedSection: 'Terminate',
    occurrences: 'Occorrenze',
    occurrencesTotal: '{{count}} · {{amount}} in tutto',
    stop: 'Smetti di ripetere',
    stopTitle: 'Smettere di ripetere «{{name}}»?',
    stopBodyNone: 'Le occorrenze passate restano.',
    stopBody_one: 'Le occorrenze passate restano. Quella futura già programmata viene rimossa.',
    stopBody_other: 'Le occorrenze passate restano. Le {{count}} future già programmate vengono rimosse.',
    stopped: 'Ripetizione interrotta',
    ruleChanged: 'Cadenza aggiornata',
    endChanged: 'Fine aggiornata',
  },
```

In `en.ts`, delete `recurringEveryMonth: 'Recurring, every month',` and add after `recurrenceScope`:

```ts
  recurrence: {
    title: 'Recurring',
    never: 'Never',
    everyMonth: 'Every month',
    everyWeek: 'Every week',
    everyTwoWeeks: 'Every 2 weeks',
    everyYear: 'Every year',
    other: 'Other',
    custom: 'Custom',
    customHint: 'Every N days, weeks, months or years',
    change: 'Change',
    manage: 'Manage',
    every: 'Every',
    every_daily_one: 'Every day',
    every_daily_other: 'Every {{count}} days',
    every_weekly_one: 'Every week',
    every_weekly_other: 'Every {{count}} weeks',
    every_monthly_one: 'Every month',
    every_monthly_other: 'Every {{count}} months',
    every_yearly_one: 'Every year',
    every_yearly_other: 'Every {{count}} years',
    unit_daily: 'days',
    unit_weekly: 'weeks',
    unit_monthly: 'months',
    unit_yearly: 'years',
    onDayOfMonth: 'on the {{day}}',
    onWeekday: 'on {{weekday}}',
    onDate: 'on {{date}}',
    nextDates: 'next: {{dates}}',
    end: 'End',
    endNever: 'Never',
    endOnDate: 'On a date',
    endAfterCount: 'After N times',
    lastOccurrence: 'Last occurrence',
    times: 'Number of times',
    noEnd: 'no end',
    untilDate: 'until {{date}}',
    recurringNote: 'Recurring, {{cadence}}',
    recurringRow: 'Recurrence',
    createsUpcoming: 'Also creates the next occurrences up to the end of next cycle',
    cardSubtitle_one: '{{count}} active · next {{name}} on {{date}}',
    cardSubtitle_other: '{{count}} active · next {{name}} on {{date}}',
    perMonth: '{{amount}}/month',
    monthlyAverage: 'Per month, on average',
    shareOfIncome: 'Fixed expenses are {{percent}}% of fixed income',
    count_one: '{{count}} recurrence',
    count_other: '{{count}} recurrences',
    empty: 'No recurrences. Turn on “Repeat” on a transaction to create one.',
    cadence: 'Cadence',
    cadenceHint: 'Tap to change the cadence',
    firstOccurrence: 'First occurrence',
    next: 'next {{date}}',
    ended: 'ended on {{date}}',
    endedSection: 'Ended',
    occurrences: 'Occurrences',
    occurrencesTotal: '{{count}} · {{amount}} in total',
    stop: 'Stop repeating',
    stopTitle: 'Stop repeating “{{name}}”?',
    stopBodyNone: 'Past occurrences stay.',
    stopBody_one: 'Past occurrences stay. The one already scheduled is removed.',
    stopBody_other: 'Past occurrences stay. The {{count}} already scheduled are removed.',
    stopped: 'Repetition stopped',
    ruleChanged: 'Cadence updated',
    endChanged: 'End updated',
  },
```

- [x] **Step 6: Parity test and lint.**

Run: `pnpm --filter @saldo/i18n test` then `pnpm lint`
Expected: locales test PASS (both files have the same keys); no `lint/…` lines. `recurringEveryMonth` is now unused
— the two call sites (`transaction/[id].tsx`, `RecurrenceScopeSheet.tsx`) are fixed in Tasks 11 and 10; typecheck of
`mobile` fails until then, which is expected at this commit.

- [x] **Step 7: Commit.**

```bash
rtk git add packages/i18n
rtk git commit -m "feat(i18n): recurrence copy, weekday and day-month formatters"
```

---

### Task 5: Mobile schema, migration, service

**Files:** `apps/mobile/src/db/schema.ts:105-115`, `apps/mobile/drizzle/`, `apps/mobile/src/db/recurrenceService.ts`,
`apps/mobile/src/db/recurrenceService.test.ts`, `apps/mobile/src/db/demo.ts:168-171`

- [x] **Step 1: Schema.** In `schema.ts` import `RecurrenceFrequency` from `@saldo/core` (extend the existing type
      import) and change the two columns:

```ts
    frequency: text('frequency').$type<RecurrenceFrequency>().notNull(),
    interval: integer('interval').notNull().default(1),
    startDate: text('start_date').notNull(),
```

- [x] **Step 2: Generate the migration.**

Run: `pnpm --filter mobile db:generate`
Expected: a new `apps/mobile/drizzle/0002_<name>.sql` containing exactly
`ALTER TABLE \`recurrences\` ADD \`interval\` integer DEFAULT 1 NOT NULL;`, a `meta/0002_snapshot.json`, a new entry
in `meta/_journal.json`, and `drizzle/migrations.js` importing `m0002`. If `migrations.js` was not regenerated, add
`import m0002 from './0002_<name>.sql';` and `m0002` to its `migrations` object by hand.

- [x] **Step 3: Failing service tests.** In `recurrenceService.test.ts`, add `interval: 1` to every
      `repos.recurrences.create({ frequency: 'monthly', … })` literal, and update every `startRecurrence(db, repos, tx,
      TODAY, CYCLE_DEF)` call to `startRecurrence(db, repos, tx, MONTHLY_RULE, TODAY, CYCLE_DEF)` with, near the top:

```ts
const MONTHLY_RULE = { frequency: 'monthly', interval: 1, endDate: null } as const;
```

Then append:

```ts
describe('startRecurrence with a rule', () => {
  it('fires every two weeks from the saved transaction', () => {
    const { db, repos } = setup();
    const tx = repos.transactions.create({
      ...TEMPLATE,
      date: '2026-04-17',
      note: null,
      recurrenceId: null,
    });
    const recurrence = startRecurrence(
      db,
      repos,
      tx,
      { frequency: 'weekly', interval: 2, endDate: null },
      TODAY,
      CYCLE_DEF,
    );
    expect(recurrence.frequency).toBe('weekly');
    expect(recurrence.interval).toBe(2);
    // Horizon 2026-05-26: 17 Apr, 1 May, 15 May.
    expect(dates(repos)).toEqual(['2026-04-17', '2026-05-01', '2026-05-15']);
  });
});

describe('stopRecurrence', () => {
  it('keeps the past, ends today, removes the scheduled future', () => {
    const { db, repos } = setup();
    const recurrence = repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    stopRecurrence(db, repos, recurrence, TODAY);
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27']);
    expect(repos.recurrences.byId('rec-rent')?.endDate).toBe(TODAY);
    // And the materialiser does not bring April back.
    expect(runMaterialiser(db, repos, TODAY, CYCLE_DEF)).toBe(0);
  });

  it('removes a series that has not started', () => {
    const { db, repos } = setup();
    const recurrence = repos.recurrences.create({
      id: 'rec-future',
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-05-01',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    stopRecurrence(db, repos, recurrence, TODAY);
    expect(dates(repos)).toEqual([]);
    expect(repos.recurrences.byId('rec-future')?.deletedAt).not.toBeNull();
  });
});

describe('changeRecurrenceRule', () => {
  function rentSeries() {
    const { db, repos } = setup();
    const recurrence = repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_DEF);
    return { db, repos, recurrence };
  }

  it('changing only the end keeps the same recurrence', () => {
    const { db, repos, recurrence } = rentSeries();
    const result = changeRecurrenceRule(
      db,
      repos,
      recurrence,
      { frequency: 'monthly', interval: 1, endDate: '2026-03-31' },
      TODAY,
      CYCLE_DEF,
    );
    expect(result?.id).toBe('rec-rent');
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27']);
  });

  it('changing the cadence closes the series today and starts a new one after today', () => {
    const { db, repos, recurrence } = rentSeries();
    const result = changeRecurrenceRule(
      db,
      repos,
      recurrence,
      { frequency: 'weekly', interval: 1, endDate: null },
      TODAY,
      CYCLE_DEF,
    );
    expect(result).not.toBeNull();
    expect(result?.id).not.toBe('rec-rent');
    expect(result?.frequency).toBe('weekly');
    // 2026-02-27 is a Friday; the first Friday after 2026-04-18 is 2026-04-24.
    expect(result?.startDate).toBe('2026-04-24');
    expect(repos.recurrences.byId('rec-rent')?.endDate).toBe(TODAY);
    expect(dates(repos)).toEqual([
      '2026-02-27',
      '2026-03-27',
      '2026-04-24',
      '2026-05-01',
      '2026-05-08',
      '2026-05-15',
      '2026-05-22',
    ]);
  });
});
```

Extend the import from `./recurrenceService` with `changeRecurrenceRule, stopRecurrence`.

- [x] **Step 4: Run to see them fail.**

Run: `pnpm --filter mobile test -- recurrenceService`
Expected: FAIL — `startRecurrence` argument count; missing exports.

- [x] **Step 5: Implement.** In `recurrenceService.ts`:

Extend the `@saldo/core` import with `nextOccurrence, planStopRecurrence, type RecurrenceRule`.

In `applyRecurrenceEdit`, the `repos.recurrences.create({ frequency: 'monthly', … })` call becomes:

```ts
      const created = repos.recurrences.create({
        // The new series keeps the cadence and the end of the one it continues.
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        startDate: plan.startNewRecurrenceOn,
        endDate: recurrence.endDate,
        template: values,
      });
```

Replace `startRecurrence` and `startRecurrenceInTransaction` with:

```ts
/** Creates a recurrence from a transaction the user set "Ripeti" on (§5.9). */
export function startRecurrence(
  db: RepositoryDatabase,
  repos: Repositories,
  transaction: Transaction,
  rule: RecurrenceRule,
  today: LocalDate,
  def: PeriodDef,
): Recurrence {
  return db.transaction(() => {
    const recurrence = repos.recurrences.create({
      frequency: rule.frequency,
      interval: rule.interval,
      startDate: transaction.date,
      endDate: rule.endDate,
      template: {
        kind: transaction.kind,
        amount: transaction.amount,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId,
        categoryId: transaction.categoryId,
        description: transaction.description,
        tagIds: transaction.tagIds,
        excludeFromTotals: transaction.excludeFromTotals,
      },
    });
    // The transaction the user just saved becomes the first occurrence, keeping its own id out of
    // the way: the deterministic id is what other devices will converge on (D21).
    repos.transactions.remove(transaction.id);
    repos.transactions.create({
      ...transaction,
      id: occurrenceId(recurrence.id, transaction.date),
      recurrenceId: recurrence.id,
    });
    runMaterialiser(db, repos, today, def);
    return recurrence;
  });
}

function occurrencesOf(repos: Repositories, recurrenceId: string): { id: string; date: LocalDate }[] {
  return repos.transactions
    .list()
    .filter((tx) => tx.recurrenceId === recurrenceId)
    .map((tx) => ({ id: tx.id, date: tx.date }));
}

/** "Smetti di ripetere" (§5.9): applies `planStopRecurrence` in one transaction. */
export function stopRecurrence(
  db: RepositoryDatabase,
  repos: Repositories,
  recurrence: Recurrence,
  today: LocalDate,
): void {
  const plan = planStopRecurrence(recurrence, occurrencesOf(repos, recurrence.id), today);
  db.transaction(() => {
    for (const id of plan.tombstoneOccurrenceIds) repos.transactions.remove(id);
    if (plan.deleteRecurrence) repos.recurrences.remove(recurrence.id);
    else if (plan.endDate !== null) repos.recurrences.update(recurrence.id, { endDate: plan.endDate });
  });
}

/**
 * A new rule for an existing recurrence (§6.34). Same cadence: only `endDate` moves, and the rows
 * past the new end go. New cadence: the old series ends today and a new one, same template, starts
 * on the first date the new rule fires after today, anchored on the old `startDate` so the day of
 * month or the weekday is the one the user already knows. Returns the recurrence that carries on,
 * or null when the new rule has already ended.
 */
export function changeRecurrenceRule(
  db: RepositoryDatabase,
  repos: Repositories,
  recurrence: Recurrence,
  rule: RecurrenceRule,
  today: LocalDate,
  def: PeriodDef,
): Recurrence | null {
  const occurrences = occurrencesOf(repos, recurrence.id);
  const sameCadence =
    rule.frequency === recurrence.frequency && rule.interval === recurrence.interval;

  return db.transaction(() => {
    if (sameCadence) {
      for (const row of occurrences) {
        if (row.date > today && rule.endDate !== null && row.date > rule.endDate) {
          repos.transactions.remove(row.id);
        }
      }
      const updated = repos.recurrences.update(recurrence.id, { endDate: rule.endDate });
      runMaterialiser(db, repos, today, def);
      return updated;
    }

    for (const row of occurrences) if (row.date > today) repos.transactions.remove(row.id);
    const hasPast = occurrences.some((row) => row.date <= today);
    if (hasPast) repos.recurrences.update(recurrence.id, { endDate: today });
    else repos.recurrences.remove(recurrence.id);

    const startDate = nextOccurrence({ ...rule, startDate: recurrence.startDate }, today);
    if (startDate === null) return null;
    const created = repos.recurrences.create({
      frequency: rule.frequency,
      interval: rule.interval,
      startDate,
      endDate: rule.endDate,
      template: recurrence.template,
    });
    runMaterialiser(db, repos, today, def);
    return created;
  });
}
```

In `demo.ts:168` add `interval: 1,` under `frequency: 'monthly',`.

- [x] **Step 6: Run the tests.**

Run: `pnpm --filter mobile test -- recurrenceService demo repositories schema`
Expected: PASS. (`new.tsx` does not compile yet — Task 7 fixes the call site; jest only loads what the tests import.)

- [x] **Step 7: Commit.**

```bash
rtk git add apps/mobile/src/db apps/mobile/drizzle
rtk git commit -m "feat(mobile): recurrence interval column, stop and rule change"
```

---

### Task 6: Hooks

**Files:** `apps/mobile/src/db/hooks.ts`

- [x] **Step 1: Add.** Extend the type import with `Recurrence`, the schema import with `recurrences`, and append:

```ts
export function useRecurrences(): Recurrence[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(recurrences)
      .where(isNull(recurrences.deletedAt))
      .orderBy(asc(recurrences.startDate)),
  );
  return data.map(toEntity);
}

export function useRecurrence(id: string): Recurrence | null {
  const { data } = useLiveQuery(
    db
      .select()
      .from(recurrences)
      .where(and(eq(recurrences.id, id), isNull(recurrences.deletedAt))),
    [id],
  );
  const row = data[0];
  return row === undefined ? null : toEntity(row);
}

/** Every live occurrence of one recurrence, newest first (§6.34). */
export function useOccurrences(recurrenceId: string): Transaction[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(transactions)
      .where(and(eq(transactions.recurrenceId, recurrenceId), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.date)),
    [recurrenceId],
  );
  return data.map(toEntity);
}
```

- [x] **Step 2: Typecheck just this file's package later with Task 7 (the app does not compile until the form is
      migrated).** Commit now:

```bash
rtk git add apps/mobile/src/db/hooks.ts
rtk git commit -m "feat(mobile): live queries for recurrences and their occurrences"
```

---

### Task 7: Form state holds a rule, not a boolean

**Files:** `apps/mobile/src/features/transactions/useTransactionForm.ts`,
`apps/mobile/src/features/transactions/useTransactionForm.test.ts`, `apps/mobile/app/transaction/new.tsx:58-62`,
`apps/mobile/app/transaction/edit/[id].tsx:49-57`

- [x] **Step 1: Failing tests.** In `useTransactionForm.test.ts` replace every `repeat: false` / `repeat: true` in
      literals with `recurrence: null` / `recurrence: { frequency: 'monthly', interval: 1, endDate: null }`, and any
      assertion on `summary.repeat` with one on `summary.recurring`. Add:

```ts
describe('detailsSummary', () => {
  it('no longer counts the recurrence, which has its own row in the form', () => {
    const summary = detailsSummary(
      { tagIds: [], recurrence: { frequency: 'weekly', interval: 2, endDate: null }, excludeFromTotals: false },
      0,
    );
    expect(detailsAreEmpty(summary)).toBe(true);
  });
});

describe('formFromTransaction', () => {
  it('leaves the rule empty for an occurrence: the rule lives on the recurrence', () => {
    const tx = {
      id: 'rec-1:2026-04-18',
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '001776506400000-0000-device1',
      deletedAt: null,
      kind: 'expense' as const,
      amount: 1299,
      date: '2026-04-18',
      accountId: 'acc-1',
      toAccountId: null,
      categoryId: 'cat-1',
      description: 'Netflix',
      note: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: 'rec-1',
    };
    expect(formFromTransaction(tx, 2).recurrence).toBeNull();
  });
});
```

(If the file already has a `describe('detailsSummary')`, add the `it` inside it instead of a second block.)

- [x] **Step 2: Run to see them fail.**

Run: `pnpm --filter mobile test -- useTransactionForm`
Expected: FAIL — `recurrence` unknown, `repeat` missing.

- [x] **Step 3: Implement.** In `useTransactionForm.ts`: add `type RecurrenceRule` to the `@saldo/core` import;
      in `TransactionFormValues` replace `repeat: boolean;` with

```ts
  /** Null = does not repeat. On an occurrence this stays null: its rule lives on the recurrence. */
  recurrence: RecurrenceRule | null;
```

In `emptyForm` and `formFromTransaction` replace the `repeat:` line with `recurrence: null,`. Replace the
`DetailsSummary` / `detailsSummary` / `detailsAreEmpty` trio with:

```ts
export interface DetailsSummary {
  tags: number;
  attachments: number;
  excludeFromTotals: boolean;
}

export function detailsSummary(
  values: Pick<TransactionFormValues, 'tagIds' | 'excludeFromTotals'>,
  attachments: number,
): DetailsSummary {
  return { tags: values.tagIds.length, attachments, excludeFromTotals: values.excludeFromTotals };
}

export function detailsAreEmpty(summary: DetailsSummary): boolean {
  return summary.tags === 0 && summary.attachments === 0 && !summary.excludeFromTotals;
}
```

and update the doc comment above it: "Tags, attachments and exclude are the three fields…". Keep `detailsOpenInitially`
as it is (it only reads the summary).

In `new.tsx` change the two lines to:

```ts
          // "Ripeti" turns the saved row into the first occurrence of a new series (§5.9).
          if (values.recurrence !== null) {
            startRecurrence(db, repos, created, values.recurrence, today, def);
          }
```

In `edit/[id].tsx`, `save` becomes:

```ts
  const save = () => {
    // A recurring occurrence must first ask which occurrences the edit applies to (§5.9).
    if (transaction.recurrenceId !== null) {
      setScopeOpen(true);
      return;
    }
    const updated = repos.transactions.update(transaction.id, toTransactionInput(values, minorDigits));
    // A plain transaction can start repeating from the edit form too, exactly as from the new one.
    if (values.recurrence !== null) startRecurrence(db, repos, updated, values.recurrence, today, def);
    toast.show(t('transactions.saved'));
    router.back();
  };
```

with `import { db } from '../../../src/db/client';` and `import { startRecurrence } from
'../../../src/db/recurrenceService';` added.

- [x] **Step 4: Run the tests.**

Run: `pnpm --filter mobile test -- useTransactionForm`
Expected: PASS. `TransactionForm.tsx` still references `values.repeat` and `summary.repeat`: Task 10 removes them.

- [x] **Step 5: Commit.**

```bash
rtk git add apps/mobile/src/features/transactions/useTransactionForm.ts apps/mobile/src/features/transactions/useTransactionForm.test.ts apps/mobile/app/transaction/new.tsx 'apps/mobile/app/transaction/edit/[id].tsx'
rtk git commit -m "feat(mobile): the transaction form holds a recurrence rule"
```

---

### Task 8: Copy helpers — `cadenceLabel`, `endLabel`, presets

**Files:** `apps/mobile/src/features/transactions/recurrenceCopy.ts`,
`apps/mobile/src/features/transactions/recurrenceCopy.test.ts`

- [x] **Step 1: Failing tests.** Create `recurrenceCopy.test.ts`:

```ts
import type { i18n as I18nInstance } from 'i18next';
import { createI18n } from '../../i18n';
import { cadenceLabel, endLabel, presetOf, ruleForPreset } from './recurrenceCopy';

let it_: I18nInstance;
let en: I18nInstance;

beforeAll(async () => {
  it_ = await createI18n('it', []);
  en = await createI18n('en', []);
});

describe('cadenceLabel', () => {
  it('names the cadence and its anchor', () => {
    expect(cadenceLabel({ frequency: 'monthly', interval: 1 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni mese, il 18',
    );
    expect(cadenceLabel({ frequency: 'monthly', interval: 3 }, '2026-09-18', en.t, 'en')).toBe(
      'Every 3 months, on the 18',
    );
    expect(cadenceLabel({ frequency: 'weekly', interval: 2 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni 2 settimane, il venerdì',
    );
    expect(cadenceLabel({ frequency: 'yearly', interval: 1 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni anno, il 18 settembre',
    );
    expect(cadenceLabel({ frequency: 'daily', interval: 1 }, '2026-09-18', it_.t, 'it')).toBe(
      'Ogni giorno',
    );
  });
});

describe('endLabel', () => {
  it('says how the series ends', () => {
    expect(endLabel(null, it_.t, 'it')).toBe('senza fine');
    expect(endLabel('2026-12-18', it_.t, 'it')).toBe('fino al 18 dic');
  });
});

describe('presets', () => {
  it('recognises the chip and sheet presets', () => {
    expect(presetOf(null)).toBe('never');
    expect(presetOf({ frequency: 'monthly', interval: 1, endDate: null })).toBe('monthly');
    expect(presetOf({ frequency: 'monthly', interval: 1, endDate: '2026-12-18' })).toBe('monthly');
    expect(presetOf({ frequency: 'weekly', interval: 1, endDate: null })).toBe('weekly');
    expect(presetOf({ frequency: 'weekly', interval: 2, endDate: null })).toBe('biweekly');
    expect(presetOf({ frequency: 'yearly', interval: 1, endDate: null })).toBe('yearly');
    expect(presetOf({ frequency: 'monthly', interval: 2, endDate: null })).toBe('custom');
    expect(presetOf({ frequency: 'daily', interval: 1, endDate: null })).toBe('custom');
  });

  it('builds a rule from a preset, keeping the end', () => {
    expect(ruleForPreset('biweekly', '2026-12-18')).toEqual({
      frequency: 'weekly',
      interval: 2,
      endDate: '2026-12-18',
    });
    expect(ruleForPreset('never', null)).toBeNull();
  });
});
```

- [x] **Step 2: Run to see it fail.**

Run: `pnpm --filter mobile test -- recurrenceCopy`
Expected: FAIL — module not found.

- [x] **Step 3: Implement.** Create `recurrenceCopy.ts`:

```ts
import { type LocalDate, parseLocalDate, type RecurrenceRule } from '@saldo/core';
import { type AppLocale, formatDayMonth, formatDayMonthLong, formatWeekday } from '@saldo/i18n';
import type { TFunction } from 'i18next';

/** "Ogni 2 settimane, il venerdì": the cadence plus what `startDate` anchors it to (§5.9). */
export function cadenceLabel(
  rule: Pick<RecurrenceRule, 'frequency' | 'interval'>,
  startDate: LocalDate,
  t: TFunction,
  locale: AppLocale,
): string {
  const every = t(`recurrence.every_${rule.frequency}`, { count: rule.interval });
  switch (rule.frequency) {
    case 'monthly':
      return `${every}, ${t('recurrence.onDayOfMonth', { day: parseLocalDate(startDate).day })}`;
    case 'weekly':
      return `${every}, ${t('recurrence.onWeekday', { weekday: formatWeekday(startDate, locale) })}`;
    case 'yearly':
      return `${every}, ${t('recurrence.onDate', { date: formatDayMonthLong(startDate, locale) })}`;
    case 'daily':
      return every;
  }
}

/** "senza fine" / "fino al 18 dic". */
export function endLabel(endDate: LocalDate | null, t: TFunction, locale: AppLocale): string {
  return endDate === null
    ? t('recurrence.noEnd')
    : t('recurrence.untilDate', { date: formatDayMonth(endDate, locale) });
}

/** The rows of the sheet and the chips of the form. `custom` is anything the presets do not name. */
export type RecurrencePreset = 'never' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';

const PRESET_RULES: Record<
  Exclude<RecurrencePreset, 'never' | 'custom'>,
  Pick<RecurrenceRule, 'frequency' | 'interval'>
> = {
  weekly: { frequency: 'weekly', interval: 1 },
  biweekly: { frequency: 'weekly', interval: 2 },
  monthly: { frequency: 'monthly', interval: 1 },
  yearly: { frequency: 'yearly', interval: 1 },
};

export function presetOf(rule: RecurrenceRule | null): RecurrencePreset {
  if (rule === null) return 'never';
  for (const [preset, candidate] of Object.entries(PRESET_RULES)) {
    if (candidate.frequency === rule.frequency && candidate.interval === rule.interval) {
      return preset as RecurrencePreset;
    }
  }
  return 'custom';
}

/** `custom` is not a rule by itself; callers keep the rule they have and open the custom block. */
export function ruleForPreset(
  preset: Exclude<RecurrencePreset, 'custom'>,
  endDate: LocalDate | null,
): RecurrenceRule | null {
  if (preset === 'never') return null;
  return { ...PRESET_RULES[preset], endDate };
}
```

- [x] **Step 4: Run the tests.**

Run: `pnpm --filter mobile test -- recurrenceCopy`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
rtk git add apps/mobile/src/features/transactions/recurrenceCopy.ts apps/mobile/src/features/transactions/recurrenceCopy.test.ts
rtk git commit -m "feat(mobile): recurrence copy helpers"
```

---

### Task 9: `CountStepper` and `RecurrenceSheet`

**Files:** `apps/mobile/src/components/CountStepper.tsx`,
`apps/mobile/src/features/transactions/RecurrenceSheet.tsx`,
`apps/mobile/src/features/transactions/RecurrenceSheet.test.tsx`

- [x] **Step 1: `CountStepper`.** Create `apps/mobile/src/components/CountStepper.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { Icon } from '../theme/Icon';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface CountStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** What the number is: "Ogni", "Numero di volte". Read out with the value. */
  accessibilityLabel: string;
  decrementLabel: string;
  incrementLabel: string;
}

/** `−  N  +`, for small integers a keyboard would be overkill for (§6.16 "Personalizzato"). */
export function CountStepper({
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
  decrementLabel,
  incrementLabel,
}: CountStepperProps) {
  const theme = useTheme();
  const key = (name: 'minus' | 'plus', label: string, disabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => onChange(next)}
      style={({ pressed }) => ({
        width: 40,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={name} size={14} color={theme.palette.textMuted} />
    </Pressable>
  );
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: String(value) }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.palette.raised,
        borderRadius: theme.radii.input,
      }}
    >
      {key('minus', decrementLabel, value <= min, value - 1)}
      <Text weight="medium" tabular style={{ minWidth: 28, textAlign: 'center' }}>
        {value}
      </Text>
      {key('plus', incrementLabel, value >= max, value + 1)}
    </View>
  );
}
```

Add `decrement: 'Meno'` / `increment: 'Più'` to `common` in `it.ts` and `decrement: 'Less'` / `increment: 'More'`
in `en.ts`.

- [x] **Step 2: Failing sheet test.** Create `RecurrenceSheet.test.tsx`:

```tsx
import { render, screen, userEvent } from '@testing-library/react-native';
import type { i18n as I18nInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { RecurrenceSheet } from './RecurrenceSheet';

let i18n: I18nInstance;

beforeAll(async () => {
  i18n = await createI18n('en', []);
});

async function show(value: Parameters<typeof RecurrenceSheet>[0]['value']) {
  const onChange = jest.fn();
  await render(
    <ThemeProvider preference="dark">
      <I18nextProvider i18n={i18n}>
        <RecurrenceSheet
          visible
          onClose={() => {}}
          value={value}
          startDate="2026-09-18"
          today="2026-09-18"
          onChange={onChange}
        />
      </I18nextProvider>
    </ThemeProvider>,
  );
  return onChange;
}

describe('RecurrenceSheet', () => {
  it('reports a preset as soon as it is tapped', async () => {
    const onChange = await show(null);
    await userEvent.press(screen.getByText('Every 2 weeks'));
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'weekly', interval: 2, endDate: null });
  });

  it('opens the custom block and steps the interval', async () => {
    const onChange = await show({ frequency: 'monthly', interval: 1, endDate: null });
    await userEvent.press(screen.getByText('Custom'));
    await userEvent.press(screen.getByLabelText('More'));
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'monthly', interval: 2, endDate: null });
    // The sheet is controlled: the parent did not re-render it with the new value in this test, so
    // the preview still describes interval 1 — every month from 18 Sep.
    expect(screen.getByText(/next: Oct 18, Nov 18, Dec 18/)).toBeTruthy();
  });

  it('turns "after N times" into an end date', async () => {
    const onChange = await show({ frequency: 'monthly', interval: 1, endDate: null });
    await userEvent.press(screen.getByText('After N times'));
    // Default 12 times from 2026-09-18 → 2027-08-18.
    expect(onChange).toHaveBeenLastCalledWith({
      frequency: 'monthly',
      interval: 1,
      endDate: '2027-08-18',
    });
  });
});
```

- [x] **Step 3: Run to see it fail.**

Run: `pnpm --filter mobile test -- RecurrenceSheet`
Expected: FAIL — module not found.

- [x] **Step 4: Implement.** Create `RecurrenceSheet.tsx`:

```tsx
import {
  endDateAfterCount,
  type LocalDate,
  nthOccurrence,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from '@saldo/core';
import { formatDayMonth } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { CountStepper } from '../../components/CountStepper';
import { DateSheet } from '../../components/DateSheet';
import { ListRow } from '../../components/ListRow';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { cadenceLabel, presetOf, type RecurrencePreset, ruleForPreset } from './recurrenceCopy';

export interface RecurrenceSheetProps {
  visible: boolean;
  onClose: () => void;
  value: RecurrenceRule | null;
  /** The transaction's date: the anchor every label and preview is computed from (§5.9). */
  startDate: LocalDate;
  today: LocalDate;
  /** Every tap reports the whole rule; the sheet keeps no draft the form does not see. */
  onChange: (rule: RecurrenceRule | null) => void;
}

const PRESETS: readonly Exclude<RecurrencePreset, 'custom'>[] = [
  'never',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
];
const PRESET_KEYS: Record<Exclude<RecurrencePreset, 'custom'>, string> = {
  never: 'recurrence.never',
  weekly: 'recurrence.everyWeek',
  biweekly: 'recurrence.everyTwoWeeks',
  monthly: 'recurrence.everyMonth',
  yearly: 'recurrence.everyYear',
};
const UNITS: readonly RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
const DEFAULT_TIMES = 12;
const MAX_INTERVAL = 99;
const MAX_TIMES = 365;

type EndMode = 'never' | 'date' | 'count';

/**
 * §6.16 "Ripeti": the presets a chip cannot hold, "Personalizzato" and the end. It edits the rule
 * in place, so closing it never loses anything; "Fatto" is only a way to close.
 */
export function RecurrenceSheet({
  visible,
  onClose,
  value,
  startDate,
  today,
  onChange,
}: RecurrenceSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const preset = presetOf(value);
  // "Personalizzato" stays open once chosen, even while its values happen to match a preset.
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const [endMode, setEndMode] = useState<EndMode>(value?.endDate === null || value === null ? 'never' : 'date');
  const [times, setTimes] = useState(DEFAULT_TIMES);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  const schedule = value === null ? null : { ...value, startDate };
  const custom = customOpen || preset === 'custom';

  const setRule = (rule: RecurrenceRule | null) => onChange(rule);
  const withEnd = (rule: RecurrenceRule, mode: EndMode, count: number): RecurrenceRule => ({
    ...rule,
    endDate:
      mode === 'never'
        ? null
        : mode === 'count'
          ? endDateAfterCount({ ...rule, startDate }, count)
          : (rule.endDate ?? endDateAfterCount({ ...rule, startDate }, count)),
  });

  const pickPreset = (next: Exclude<RecurrencePreset, 'custom'>) => {
    setCustomOpen(false);
    const rule = ruleForPreset(next, value?.endDate ?? null);
    setRule(rule === null ? null : withEnd(rule, endMode, times));
  };
  const openCustom = () => {
    setCustomOpen(true);
    if (value === null) setRule(withEnd({ frequency: 'monthly', interval: 2, endDate: null }, endMode, times));
  };
  const setInterval = (interval: number) => {
    if (value === null) return;
    setRule(withEnd({ ...value, interval }, endMode, times));
  };
  const setUnit = (frequency: RecurrenceFrequency) => {
    if (value === null) return;
    setRule(withEnd({ ...value, frequency }, endMode, times));
  };
  const pickEnd = (mode: EndMode) => {
    setEndMode(mode);
    if (value !== null) setRule(withEnd(value, mode, times));
  };
  const pickTimes = (count: number) => {
    setTimes(count);
    if (value !== null) setRule(withEnd(value, 'count', count));
  };

  const preview =
    schedule === null
      ? null
      : [1, 2, 3].map((k) => formatDayMonth(nthOccurrence(schedule, k), locale)).join(', ');

  return (
    <Sheet visible={visible} onClose={onClose} title={t('txForm.repeat')} tall>
      <View style={{ gap: 14 }}>
        <View
          style={{
            backgroundColor: theme.palette.raised,
            borderRadius: theme.radii.card,
            paddingHorizontal: 14,
          }}
        >
          {PRESETS.map((row) => (
            <ListRow
              key={row}
              testID={`recurrence-preset-${row}`}
              title={t(PRESET_KEYS[row])}
              subtitle={
                row === 'never'
                  ? undefined
                  : cadenceLabel(
                      { ...(ruleForPreset(row, null) ?? { frequency: 'monthly', interval: 1 }) },
                      startDate,
                      t,
                      locale,
                    )
              }
              selected={!custom && preset === row}
              onPress={() => pickPreset(row)}
              trailing={
                !custom && preset === row ? (
                  <Icon name="check" size={16} color={theme.palette.text} />
                ) : undefined
              }
            />
          ))}
          <ListRow
            testID="recurrence-preset-custom"
            title={t('recurrence.custom')}
            subtitle={
              custom && value !== null ? cadenceLabel(value, startDate, t, locale) : t('recurrence.customHint')
            }
            selected={custom}
            onPress={openCustom}
            trailing={custom ? <Icon name="check" size={16} color={theme.palette.text} /> : undefined}
          />
        </View>

        {custom && value !== null ? (
          <View
            style={{
              backgroundColor: theme.palette.raised,
              borderRadius: theme.radii.card,
              padding: theme.layout.cardPadding,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>{t('recurrence.every')}</Text>
              <CountStepper
                value={value.interval}
                min={1}
                max={MAX_INTERVAL}
                onChange={setInterval}
                accessibilityLabel={t('recurrence.every')}
                decrementLabel={t('common.decrement')}
                incrementLabel={t('common.increment')}
              />
            </View>
            <Segmented
              options={UNITS.map((unit) => ({ value: unit, label: t(`recurrence.unit_${unit}`) }))}
              value={value.frequency}
              onChange={setUnit}
              accessibilityLabel={t('recurrence.cadence')}
            />
            {preview === null ? null : (
              <Text size="caption" color="textFaint">
                {cadenceLabel(value, startDate, t, locale)} · {t('recurrence.nextDates', { dates: preview })}
              </Text>
            )}
          </View>
        ) : null}

        {value === null ? null : (
          <View style={{ gap: 8 }}>
            <Text size="footnote" color="textMuted">
              {t('recurrence.end')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Chip label={t('recurrence.endNever')} active={endMode === 'never'} onPress={() => pickEnd('never')} />
              <Chip
                label={t('recurrence.endOnDate')}
                icon="cal"
                active={endMode === 'date'}
                onPress={() => {
                  pickEnd('date');
                  setEndPickerOpen(true);
                }}
              />
              <Chip
                label={t('recurrence.endAfterCount')}
                active={endMode === 'count'}
                onPress={() => pickEnd('count')}
              />
            </View>
            {endMode === 'date' && value.endDate !== null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text size="footnote" color="textMuted">
                  {t('recurrence.lastOccurrence')}
                </Text>
                <Chip
                  label={formatDayMonth(value.endDate, locale)}
                  icon="cal"
                  chevron
                  onPress={() => setEndPickerOpen(true)}
                />
              </View>
            ) : null}
            {endMode === 'count' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text size="footnote" color="textMuted">
                  {t('recurrence.times')}
                </Text>
                <CountStepper
                  value={times}
                  min={1}
                  max={MAX_TIMES}
                  onChange={pickTimes}
                  accessibilityLabel={t('recurrence.times')}
                  decrementLabel={t('common.decrement')}
                  incrementLabel={t('common.increment')}
                />
              </View>
            ) : null}
          </View>
        )}

        <PrimaryButton label={t('common.done')} onPress={onClose} />
      </View>

      <DateSheet
        visible={endPickerOpen}
        value={value?.endDate ?? startDate}
        today={today}
        title={t('recurrence.lastOccurrence')}
        onSelect={(date) => {
          if (value !== null) setRule({ ...value, endDate: date < startDate ? startDate : date });
        }}
        onClose={() => setEndPickerOpen(false)}
      />
    </Sheet>
  );
}
```

`ListRow` has no `trailing` for a check yet? It does (`trailing?: ReactNode`). If `Text` does not accept `tabular`
without a size, keep `tabular` — it is what `AmountText` and the `Segmented` labels already use.

- [x] **Step 5: Run the tests.**

Run: `pnpm --filter mobile test -- RecurrenceSheet`
Expected: PASS.

- [x] **Step 6: Commit.**

```bash
rtk git add apps/mobile/src/components/CountStepper.tsx apps/mobile/src/features/transactions/RecurrenceSheet.tsx apps/mobile/src/features/transactions/RecurrenceSheet.test.tsx packages/i18n/src/locales
rtk git commit -m "feat(mobile): recurrence sheet with presets, custom cadence and end"
```

---

### Task 10: The form — "Ripeti" chip row (variant A)

**Files:** `apps/mobile/src/features/transactions/TransactionForm.tsx`,
`apps/mobile/src/features/transactions/RecurrenceScopeSheet.tsx:150-152`, `apps/mobile/app/transaction/edit/[id].tsx`

- [x] **Step 1: Props.** In `TransactionFormProps` add:

```ts
  /**
   * Set when editing an occurrence: the rule is shown read-only and "Gestisci" opens the
   * recurrence, because a rule change is a change to the whole series, not to this row (§5.9).
   */
  recurrenceId?: string | null;
```

and destructure `recurrenceId = null` in the component. Import `RecurrenceSheet` from `./RecurrenceSheet`,
`cadenceLabel, endLabel, presetOf, ruleForPreset` from `./recurrenceCopy`, `useRecurrence` from `../../db/hooks`, and
`useRouter` from `expo-router`. Add state `const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);`,
`const router = useRouter();` and `const occurrenceOf = useRecurrence(recurrenceId ?? '');`.

- [x] **Step 2: The row.** Inside the account/date `<Card>`, after the `Data` block's closing `</View>` and before
      the card's `</View></Card>`, add:

```tsx
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('txForm.repeat')}
            </Text>
            {occurrenceOf !== null ? (
              <Pressable
                testID="txform-recurrence-manage"
                accessibilityRole="button"
                accessibilityLabel={t('recurrence.manage')}
                onPress={() =>
                  router.push({ pathname: '/recurrence/[id]', params: { id: occurrenceOf.id } })
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: theme.layout.minHitTarget,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Icon name="repeat" size={14} color={theme.palette.textMuted} />
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {cadenceLabel(occurrenceOf, occurrenceOf.startDate, t, locale)} ·{' '}
                  {endLabel(occurrenceOf.endDate, t, locale)}
                </Text>
                <Text size="footnote" color="textMuted">
                  {t('recurrence.manage')}
                </Text>
                <Icon name="chevR" size={16} color={theme.palette.textFaint} />
              </Pressable>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, flexShrink: 0 }}
                  contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                >
                  <Chip
                    label={t('recurrence.never')}
                    active={values.recurrence === null}
                    onPress={() => set({ recurrence: null })}
                  />
                  <Chip
                    label={t('recurrence.everyMonth')}
                    active={presetOf(values.recurrence) === 'monthly'}
                    onPress={() =>
                      set({ recurrence: ruleForPreset('monthly', values.recurrence?.endDate ?? null) })
                    }
                  />
                  <Chip
                    label={t('recurrence.everyWeek')}
                    active={presetOf(values.recurrence) === 'weekly'}
                    onPress={() =>
                      set({ recurrence: ruleForPreset('weekly', values.recurrence?.endDate ?? null) })
                    }
                  />
                  <Chip
                    label={
                      values.recurrence !== null &&
                      !['monthly', 'weekly'].includes(presetOf(values.recurrence))
                        ? cadenceLabel(values.recurrence, values.date, t, locale)
                        : t('recurrence.other')
                    }
                    icon="repeat"
                    chevron
                    active={
                      values.recurrence !== null &&
                      !['monthly', 'weekly'].includes(presetOf(values.recurrence))
                    }
                    onPress={() => setRecurrenceSheetOpen(true)}
                  />
                </ScrollView>
                {values.recurrence === null ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('recurrence.change')}
                    onPress={() => setRecurrenceSheetOpen(true)}
                    hitSlop={6}
                    style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}
                  >
                    <Text size="caption" color="textFaint" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {cadenceLabel(values.recurrence, values.date, t, locale)} ·{' '}
                      {endLabel(values.recurrence.endDate, t, locale)}
                    </Text>
                    <Text
                      size="caption"
                      color="textMuted"
                      style={{ textDecorationLine: 'underline' }}
                    >
                      {t('recurrence.change')}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
```

- [x] **Step 3: Remove the toggle from Dettagli.** Delete the `<View style={{ flexDirection:'row', … }}>…<Toggle
      testID="txform-repeat" …/></View>` block (the one with `t('txForm.repeat')` and `values.repeat`) inside
      `detailsOpen`. In `summaryParts` delete the `summary.repeat ? t('txForm.repeat') : null,` line. Delete the
      `Toggle` import only if nothing else in the file uses it (the exclude toggle does — keep it).

- [x] **Step 4: Mount the sheet.** Next to `<DateSheet …/>` at the bottom of the form add:

```tsx
      <RecurrenceSheet
        visible={recurrenceSheetOpen}
        onClose={() => setRecurrenceSheetOpen(false)}
        value={values.recurrence}
        startDate={values.date}
        today={today}
        onChange={(recurrence) => set({ recurrence })}
      />
```

- [x] **Step 5: Footer hint.** Where the form renders its save button (the `footer` of `Screen` / the primary
      button), add above the button, only when `values.recurrence !== null && occurrenceOf === null`:

```tsx
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Icon name="repeat" size={12} color={theme.palette.textMuted} />
          <Text size="caption" color="textMuted">
            {t('recurrence.createsUpcoming')}
          </Text>
        </View>
```

- [x] **Step 6: Edit route passes the id.** In `edit/[id].tsx` add `recurrenceId={transaction.recurrenceId}` to
      `<TransactionForm …/>`.

- [x] **Step 7: Scope sheet caption.** In `RecurrenceScopeSheet.tsx` replace the last `<Text size="caption" …>
      {t('transactions.recurringEveryMonth')}</Text>` with:

```tsx
        <Text size="caption" color="textFaint" style={{ paddingTop: 6 }}>
          {cadenceLabel(recurrence, recurrence.startDate, t, locale)}
        </Text>
```

importing `cadenceLabel` from `./recurrenceCopy` and `useAppLocale` from `../../i18n/useAppLocale`
(`const locale = useAppLocale();`).

- [x] **Step 8: Typecheck and existing form tests.**

Run: `pnpm --filter mobile typecheck` then `pnpm --filter mobile test -- TransactionForm useTransactionForm a11y`
Expected: only errors left are in `transaction/[id].tsx` (`recurringEveryMonth`, fixed in Task 11). Tests PASS; if
an a11y or form test looked for the `txform-repeat` toggle, point it at the chip instead:
`screen.getByLabelText('Every month')` (`Chip` exposes its label as the accessibility label).

- [x] **Step 9: Commit.**

```bash
rtk git add apps/mobile/src/features/transactions 'apps/mobile/app/transaction/edit/[id].tsx'
rtk git commit -m "feat(mobile): Ripeti chip row in the transaction form"
```

---

### Task 11: ↻ badge on occurrence rows, cadence in the transaction detail

**Files:** `apps/mobile/src/components/ListRow.tsx:128-155`, `apps/mobile/app/(tabs)/index.tsx:151,201`,
`apps/mobile/app/(tabs)/transactions.tsx:173-200`, `apps/mobile/app/account/[id].tsx:250-280`,
`apps/mobile/app/tag/[id].tsx:138-160`, `apps/mobile/app/transaction/[id].tsx:205-214`

- [x] **Step 1: `IconBox` badge.** Replace `IconBox` in `ListRow.tsx` with:

```tsx
/** Rounded icon box used as a row's leading element (§6). */
export function IconBox({
  name,
  colour,
  small = false,
  badge,
}: {
  name: Parameters<typeof Icon>[0]['name'];
  colour: string;
  small?: boolean;
  /** A second, tiny glyph on the corner: `repeat` marks an occurrence of a recurrence (§5.9). */
  badge?: Parameters<typeof Icon>[0]['name'];
}) {
  const theme = useTheme();
  const size = small ? theme.layout.iconBoxSmall : theme.layout.iconBox;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.iconBox,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.tint(colour, 0.14),
      }}
    >
      <Icon name={name} size={small ? 14 : 16} color={colour} />
      {badge === undefined ? null : (
        <View
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 15,
            height: 15,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.palette.surface,
          }}
        >
          <Icon name={badge} size={9} color={theme.palette.textMuted} />
        </View>
      )}
    </View>
  );
}
```

- [x] **Step 2: Call sites.** In each of the four screens, on the `<IconBox name={row.icon} colour={colour} />`
      (or `rowMeta.icon`) that sits next to a `transactionRow(tx, …)` call, add
      `badge={tx.recurrenceId === null ? undefined : 'repeat'}`. That is two places in `(tabs)/index.tsx`, one each in
      `(tabs)/transactions.tsx`, `account/[id].tsx` and `tag/[id].tsx`.

- [x] **Step 3: Transaction detail.** In `transaction/[id].tsx` add `useRecurrence` to the hooks import, and after
      `const transaction = useTransaction(id ?? '');` (before the early return — hooks first) add
      `const recurrence = useRecurrence(transaction?.recurrenceId ?? '');`. Move that line **above** the `if
      (transaction === null)` return. Replace the note row with:

```tsx
        {row(
          t('transactions.detailNote'),
          <Text style={{ textAlign: 'right' }}>
            {transaction.note ??
              (recurrence === null
                ? t('transactions.manual')
                : t('recurrence.recurringNote', {
                    cadence: cadenceLabel(recurrence, recurrence.startDate, t, locale).toLowerCase(),
                  }))}
          </Text>,
        )}
        {recurrence === null
          ? null
          : row(
              t('recurrence.recurringRow'),
              <Text>{endLabel(recurrence.endDate, t, locale)}</Text>,
              {
                onPress: () =>
                  router.push({ pathname: '/recurrence/[id]', params: { id: recurrence.id } }),
              },
            )}
```

with `cadenceLabel, endLabel` imported from `../../src/features/transactions/recurrenceCopy`.

- [x] **Step 4: Typecheck.**

Run: `pnpm typecheck`
Expected: clean across the workspace.

- [x] **Step 5: Commit.**

```bash
rtk git add apps/mobile/src/components/ListRow.tsx 'apps/mobile/app/(tabs)' 'apps/mobile/app/account/[id].tsx' 'apps/mobile/app/tag/[id].tsx' 'apps/mobile/app/transaction/[id].tsx'
rtk git commit -m "feat(mobile): repeat badge on occurrences, cadence in the detail"
```

---

### Task 12: "Ricorrenti" card and list screen (§6.33)

**Files:** `apps/mobile/src/features/recurrences/RecurrencesCard.tsx`, `apps/mobile/app/(tabs)/transactions.tsx`,
`apps/mobile/app/recurrences.tsx`

- [x] **Step 1: A shared view model.** Create `apps/mobile/src/features/recurrences/recurrenceViews.ts`:

```ts
import { type LocalDate, nextOccurrence, type Recurrence } from '@saldo/core';

export interface RecurrenceView {
  recurrence: Recurrence;
  /** Null once the series has ended. */
  next: LocalDate | null;
  /** The description, or the category's name when there is none, as a transaction row does. */
  title: string;
}

export function recurrenceViews(
  recurrences: readonly Recurrence[],
  today: LocalDate,
  categoryName: (id: string | null) => string,
  transferLabel: string,
): RecurrenceView[] {
  return recurrences.map((recurrence) => ({
    recurrence,
    next: nextOccurrence(recurrence, today),
    title:
      recurrence.template.description.length > 0
        ? recurrence.template.description
        : recurrence.template.kind === 'transfer'
          ? transferLabel
          : categoryName(recurrence.template.categoryId),
  }));
}

/** Live first, soonest first; ended series last, most recently ended first. */
export function byNext(a: RecurrenceView, b: RecurrenceView): number {
  if (a.next !== null && b.next !== null) return a.next < b.next ? -1 : a.next > b.next ? 1 : 0;
  if (a.next !== null) return -1;
  if (b.next !== null) return 1;
  const ea = a.recurrence.endDate ?? '';
  const eb = b.recurrence.endDate ?? '';
  return ea > eb ? -1 : ea < eb ? 1 : 0;
}
```

- [x] **Step 2: The card.** Create `RecurrencesCard.tsx`:

```tsx
import { recurringMonthlyTotals } from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '../../components/Card';
import { IconBox } from '../../components/ListRow';
import { useCategories, useRecurrences, useSettings } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { usePeriod } from '../period/PeriodProvider';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { byNext, recurrenceViews } from './recurrenceViews';

/**
 * §6.2: one row under "In arrivo" that leads to the recurrences (§6.33). Rendered only when there
 * is at least one, because the form is where a recurrence is born and an empty card would only
 * point at an empty screen.
 */
export function RecurrencesCard() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const recurrences = useRecurrences();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const views = useMemo(
    () =>
      recurrenceViews(
        recurrences,
        today,
        (id) => categories.find((row) => row.id === id)?.name ?? '',
        t('kinds.transfer'),
      )
        .filter((view) => view.next !== null)
        .sort(byNext),
    [recurrences, today, categories, t],
  );
  const totals = useMemo(
    () => recurringMonthlyTotals(views.map((view) => view.recurrence)),
    [views],
  );
  const first = views[0];
  if (first === undefined || first.next === null) return null;

  return (
    <Card padded={false}>
      <Pressable
        testID="transactions-recurrences"
        accessibilityRole="button"
        accessibilityLabel={t('recurrence.title')}
        onPress={() => router.push('/recurrences')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: theme.layout.cardPadding,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <IconBox name="repeat" colour={theme.palette.textMuted} small />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium" tracking="tight">
            {t('recurrence.title')}
          </Text>
          <Text size="caption" color="textMuted" numberOfLines={1}>
            {t('recurrence.cardSubtitle', {
              count: views.length,
              name: first.title,
              date: formatDayMonth(first.next, locale),
            })}
          </Text>
        </View>
        <Text size="footnote" color="textMuted" tabular>
          {t('recurrence.perMonth', { amount: formatMoney(-totals.expense, currency, locale) })}
        </Text>
        <Icon name="chevR" size={16} color={theme.palette.textFaint} />
      </Pressable>
    </Card>
  );
}
```

- [x] **Step 3: Mount it in the tab.** In `(tabs)/transactions.tsx` import `RecurrencesCard` from
      `'../../src/features/recurrences/RecurrencesCard'` and render `<RecurrencesCard />` as the first child after the sticky header `</View>` (before the `{!loaded ? …}`
      ternary), so it shows whether or not the period has rows.

- [x] **Step 4: The list screen.** Create `apps/mobile/app/recurrences.tsx`:

```tsx
import { type Recurrence, recurringMonthlyTotals } from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../src/components/AmountText';
import { Card } from '../src/components/Card';
import { IconBox, ListRow } from '../src/components/ListRow';
import { ProgressBar } from '../src/components/ProgressBar';
import { Screen } from '../src/components/Screen';
import { BackButton } from '../src/components/ScreenHeader';
import { useCategories, useRecurrences, useSettings } from '../src/db/hooks';
import { usePeriod } from '../src/features/period/PeriodProvider';
import { byNext, type RecurrenceView, recurrenceViews } from '../src/features/recurrences/recurrenceViews';
import { cadenceLabel } from '../src/features/transactions/recurrenceCopy';
import { NEUTRAL_COLOR_INDEX } from '../src/features/transactions/transactionRow';
import { useAppLocale } from '../src/i18n/useAppLocale';
import { Text } from '../src/theme/Text';
import { useTheme } from '../src/theme/ThemeProvider';

const FREQUENCY_ORDER: Record<Recurrence['frequency'], number> = {
  monthly: 0,
  weekly: 1,
  daily: 2,
  yearly: 3,
};

/** One card per cadence: "Ogni mese", "Ogni 2 settimane", … */
function groupKey(recurrence: Recurrence): string {
  return `${recurrence.frequency}:${recurrence.interval}`;
}

/** §6.33. */
export default function RecurrencesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const recurrences = useRecurrences();
  const { today } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const views = useMemo(
    () =>
      recurrenceViews(
        recurrences,
        today,
        (id) => categories.find((row) => row.id === id)?.name ?? '',
        t('kinds.transfer'),
      ).sort(byNext),
    [recurrences, today, categories, t],
  );
  const live = views.filter((view) => view.next !== null);
  const ended = views.filter((view) => view.next === null);
  const totals = useMemo(() => recurringMonthlyTotals(live.map((view) => view.recurrence)), [live]);
  const share = totals.income > 0 ? totals.expense / totals.income : null;

  const groups = useMemo(() => {
    const map = new Map<string, RecurrenceView[]>();
    for (const view of live) {
      const key = groupKey(view.recurrence);
      map.set(key, [...(map.get(key) ?? []), view]);
    }
    return [...map.entries()].sort(([, a], [, b]) => {
      const ra = a[0]?.recurrence;
      const rb = b[0]?.recurrence;
      if (ra === undefined || rb === undefined) return 0;
      return (
        FREQUENCY_ORDER[ra.frequency] - FREQUENCY_ORDER[rb.frequency] || ra.interval - rb.interval
      );
    });
  }, [live]);

  const rowFor = (view: RecurrenceView) => {
    const category = categories.find((row) => row.id === view.recurrence.template.categoryId);
    const icon = (view.recurrence.template.kind === 'transfer' ? 'swap' : (category?.icon ?? 'grip')) as IconName;
    const colour = theme.categoryColor(category?.colorIndex ?? NEUTRAL_COLOR_INDEX);
    const signed =
      view.recurrence.template.kind === 'income'
        ? view.recurrence.template.amount
        : -view.recurrence.template.amount;
    return (
      <ListRow
        key={view.recurrence.id}
        testID={`recurrence-${view.recurrence.id}`}
        title={view.title}
        subtitle={`${cadenceLabel(view.recurrence, view.recurrence.startDate, t, locale)} · ${
          view.next === null
            ? t('recurrence.ended', { date: formatDayMonth(view.recurrence.endDate ?? today, locale) })
            : t('recurrence.next', { date: formatDayMonth(view.next, locale) })
        }`}
        leading={<IconBox name={icon} colour={colour} badge="repeat" />}
        trailing={
          <AmountText
            minor={view.recurrence.template.kind === 'transfer' ? view.recurrence.template.amount : signed}
            currency={currency}
            locale={locale}
            signDisplay={view.recurrence.template.kind === 'transfer' ? 'never' : 'always'}
            color={view.next === null ? 'textMuted' : signed > 0 ? 'positive' : undefined}
          />
        }
        chevron
        onPress={() =>
          router.push({ pathname: '/recurrence/[id]', params: { id: view.recurrence.id } })
        }
      />
    );
  };

  return (
    <Screen refreshable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BackButton />
        <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }}>
          {t('recurrence.title')}
        </Text>
      </View>

      {views.length === 0 ? (
        <Card>
          <Text color="textMuted">{t('recurrence.empty')}</Text>
        </Card>
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text size="footnote" color="textMuted">
                {t('recurrence.monthlyAverage')}
              </Text>
              <Text size="caption" color="textFaint">
                {t('recurrence.count', { count: live.length })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
              <AmountText
                minor={-totals.expense}
                currency={currency}
                locale={locale}
                size="amountMd"
                weight="semibold"
                tracking="tighter"
              />
              {totals.income === 0 ? null : (
                <AmountText
                  minor={totals.income}
                  currency={currency}
                  locale={locale}
                  signDisplay="always"
                  size="footnote"
                  color="positive"
                />
              )}
            </View>
            {share === null ? null : (
              <View style={{ marginTop: 12, gap: 6 }}>
                <ProgressBar ratio={share} />
                <Text size="caption" color="textFaint">
                  {t('recurrence.shareOfIncome', { percent: Math.round(share * 100) })}
                </Text>
              </View>
            )}
          </Card>

          {groups.map(([key, rows]) => {
            const head = rows[0];
            if (head === undefined) return null;
            return (
              <Card key={key} padded={false}>
                <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 6 }}>
                  <Text size="footnote" color="textMuted" style={{ paddingTop: 14, paddingBottom: 2 }}>
                    {t(`recurrence.every_${head.recurrence.frequency}`, { count: head.recurrence.interval })}
                  </Text>
                  {rows.map(rowFor)}
                </View>
              </Card>
            );
          })}

          {ended.length === 0 ? null : (
            <Card padded={false}>
              <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 6 }}>
                <Text size="footnote" color="textMuted" style={{ paddingTop: 14, paddingBottom: 2 }}>
                  {t('recurrence.endedSection')}
                </Text>
                {ended.map(rowFor)}
              </View>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
```

`AmountText` extends `TextProps` minus `children`/`tabular`, so `size`, `weight`, `tracking` and `color` pass through.

- [x] **Step 5: Typecheck, lint, run on the simulator.**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. Then `pnpm --filter mobile seed:db` (the seed's recurrences are monthly, `interval 1`), start Metro
with `--clear` and, since the migration changed, delete the simulator's `Documents/SQLite/saldo.db` first (see
AGENTS.md). Tap "Ricorrenti" on the Transactions tab: summary, groups, rows.

- [x] **Step 6: Commit.**

```bash
rtk git add apps/mobile/src/features/recurrences apps/mobile/app/recurrences.tsx 'apps/mobile/app/(tabs)/transactions.tsx' packages/i18n/src/locales
rtk git commit -m "feat(mobile): Ricorrenti card and list screen"
```

---

### Task 13: Recurrence detail (§6.34) — cadence, end, occurrences, stop

**Files:** `apps/mobile/app/recurrence/[id].tsx`

- [x] **Step 1: Create the screen.**

```tsx
import type { RecurrenceRule } from '@saldo/core';
import { formatDayMonth, formatLongDate, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { BackButton } from '../../src/components/ScreenHeader';
import { useToast } from '../../src/components/Toast';
import { db } from '../../src/db/client';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useCategories, useOccurrences, useRecurrence, useSettings } from '../../src/db/hooks';
import { changeRecurrenceRule, stopRecurrence } from '../../src/db/recurrenceService';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { cadenceLabel, endLabel } from '../../src/features/transactions/recurrenceCopy';
import { RecurrenceSheet } from '../../src/features/transactions/RecurrenceSheet';
import { NEUTRAL_COLOR_INDEX } from '../../src/features/transactions/transactionRow';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Icon } from '../../src/theme/Icon';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.34. */
export default function RecurrenceDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const toast = useToast();
  const repos = useRepositories();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettings();
  const categories = useCategories();
  const accounts = useAccounts();
  const { today, def } = usePeriod();
  const recurrence = useRecurrence(id ?? '');
  const occurrences = useOccurrences(id ?? '');
  // The sheet edits a draft: every tap in it reports a whole rule, and a cadence change splits the
  // series, so the database is written once, when the sheet closes (§5.9).
  const [draft, setDraft] = useState<RecurrenceRule | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);

  if (recurrence === null) {
    return (
      <Screen>
        <BackButton />
        <Text color="textMuted">{t('recurrence.empty')}</Text>
      </Screen>
    );
  }

  const currency = settings?.currency ?? 'EUR';
  const { template } = recurrence;
  const category = categories.find((row) => row.id === template.categoryId);
  const account = accounts.find((row) => row.id === template.accountId);
  const toAccount = accounts.find((row) => row.id === template.toAccountId);
  const colour = theme.categoryColor(category?.colorIndex ?? NEUTRAL_COLOR_INDEX);
  const icon = (template.kind === 'transfer' ? 'swap' : (category?.icon ?? 'grip')) as IconName;
  const name =
    template.description.length > 0
      ? template.description
      : template.kind === 'transfer'
        ? t('kinds.transfer')
        : (category?.name ?? t('common.thisOne'));
  const signed = template.kind === 'income' ? template.amount : -template.amount;
  const upcoming = occurrences.filter((tx) => tx.date > today);
  const nextDate = upcoming.at(-1)?.date ?? null; // newest first, so the soonest future row is last
  const editTarget = upcoming.at(-1) ?? occurrences[0];
  const total = occurrences.reduce((sum, tx) => sum + tx.amount, 0);
  const where =
    template.kind === 'transfer'
      ? `${account?.name ?? ''} → ${toAccount?.name ?? ''}`
      : `${category?.name ?? ''} · ${account?.name ?? ''}`;

  const stop = () => {
    stopRecurrence(db, repos, recurrence, today);
    setConfirmingStop(false);
    toast.show(t('recurrence.stopped'));
    router.back();
  };

  const openRule = () => {
    setDraft({ frequency: recurrence.frequency, interval: recurrence.interval, endDate: recurrence.endDate });
    setRuleOpen(true);
  };

  /** `Sheet.onClose` fires on the scrim, on "Fatto" and on the Android back button: the one moment the user is done. */
  const closeRule = () => {
    setRuleOpen(false);
    if (draft === null) {
      // "Mai" from the detail is the same thing as stopping.
      setConfirmingStop(true);
      return;
    }
    const unchanged =
      draft.frequency === recurrence.frequency &&
      draft.interval === recurrence.interval &&
      draft.endDate === recurrence.endDate;
    if (unchanged) return;
    const sameCadence =
      draft.frequency === recurrence.frequency && draft.interval === recurrence.interval;
    const carriedOn = changeRecurrenceRule(db, repos, recurrence, draft, today, def);
    toast.show(t(sameCadence ? 'recurrence.endChanged' : 'recurrence.ruleChanged'));
    if (carriedOn === null) router.back();
    else if (carriedOn.id !== recurrence.id) {
      router.replace({ pathname: '/recurrence/[id]', params: { id: carriedOn.id } });
    }
  };

  const factRow = (label: string, value: string, onPress?: () => void) => {
    const content = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: theme.layout.minHitTarget,
          paddingVertical: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text size="footnote" color="textMuted">
            {label}
          </Text>
          <Text>{value}</Text>
        </View>
        {onPress === undefined ? null : <Icon name="chevR" size={16} color={theme.palette.textFaint} />}
      </View>
    );
    if (onPress === undefined) return content;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        {content}
      </Pressable>
    );
  };

  return (
    <>
      <Screen refreshable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BackButton />
          <Text size="display" weight="semibold" tracking="tighter" style={{ flex: 1 }} numberOfLines={1}>
            {name}
          </Text>
          {editTarget === undefined ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              hitSlop={10}
              onPress={() =>
                router.push({ pathname: '/transaction/edit/[id]', params: { id: editTarget.id } })
              }
            >
              <Text color="textMuted">{t('common.edit')}</Text>
            </Pressable>
          )}
        </View>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBox name={icon} colour={colour} badge="repeat" />
            <Text size="footnote" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
              {where}
            </Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <AmountText
              minor={template.kind === 'transfer' ? template.amount : signed}
              currency={currency}
              locale={locale}
              signDisplay={template.kind === 'transfer' ? 'never' : 'always'}
              size="hero"
              weight="semibold"
              tracking="tightest"
              color={signed > 0 && template.kind !== 'transfer' ? 'positive' : undefined}
            />
          </View>
          <Text size="footnote" color="textMuted" style={{ marginTop: 4 }}>
            {cadenceLabel(recurrence, recurrence.startDate, t, locale)}
            {nextDate === null
              ? recurrence.endDate === null
                ? ''
                : ` · ${t('recurrence.ended', { date: formatDayMonth(recurrence.endDate, locale) })}`
              : ` · ${t('recurrence.next', { date: formatDayMonth(nextDate, locale) })}`}
          </Text>
        </Card>

        <Card>
          {factRow(
            t('recurrence.cadence'),
            cadenceLabel(recurrence, recurrence.startDate, t, locale),
            openRule,
          )}
          <View style={{ height: 1, backgroundColor: theme.palette.border }} />
          {factRow(
            t('recurrence.end'),
            recurrence.endDate === null
              ? t('recurrence.endNever')
              : formatLongDate(recurrence.endDate, locale),
            openRule,
          )}
          <View style={{ height: 1, backgroundColor: theme.palette.border }} />
          {factRow(t('recurrence.firstOccurrence'), formatLongDate(recurrence.startDate, locale))}
        </Card>

        <Card padded={false}>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 6 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingTop: 14,
                paddingBottom: 2,
              }}
            >
              <Text size="footnote" color="textMuted">
                {t('recurrence.occurrences')}
              </Text>
              <Text size="caption" color="textFaint" tabular>
                {t('recurrence.occurrencesTotal', {
                  count: occurrences.length,
                  amount: formatMoney(total, currency, locale),
                })}
              </Text>
            </View>
            {occurrences.map((tx) => (
              <ListRow
                key={tx.id}
                title={formatDayMonth(tx.date, locale)}
                subtitle={tx.date > today ? t('transactions.upcoming') : tx.date === today ? t('txForm.today') : undefined}
                leading={<IconBox name={icon} colour={colour} badge="repeat" />}
                upcoming={tx.date > today}
                trailing={
                  <AmountText
                    minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                    currency={currency}
                    locale={locale}
                    signDisplay={tx.kind === 'transfer' ? 'never' : 'always'}
                    color={tx.date > today ? 'textMuted' : tx.kind === 'income' ? 'positive' : undefined}
                  />
                }
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })}
                chevron
              />
            ))}
          </View>
        </Card>

        {nextDate === null && recurrence.endDate !== null ? null : (
          <View style={{ gap: 8 }}>
            <SecondaryButton label={t('recurrence.stop')} onPress={() => setConfirmingStop(true)} />
            <Text size="caption" color="textFaint" style={{ textAlign: 'center' }}>
              {upcoming.length === 0
                ? t('recurrence.stopBodyNone')
                : t('recurrence.stopBody', { count: upcoming.length })}
            </Text>
          </View>
        )}
      </Screen>

      <RecurrenceSheet
        visible={ruleOpen}
        onClose={closeRule}
        value={draft}
        startDate={recurrence.startDate}
        today={today}
        onChange={setDraft}
      />

      <ConfirmDialog
        visible={confirmingStop}
        title={t('recurrence.stopTitle', { name })}
        body={
          upcoming.length === 0
            ? t('recurrence.stopBodyNone')
            : t('recurrence.stopBody', { count: upcoming.length })
        }
        confirmLabel={t('recurrence.stop')}
        cancelLabel={t('common.cancel')}
        onConfirm={stop}
        onCancel={() => setConfirmingStop(false)}
      />
    </>
  );
}
```

- [x] **Step 2: Typecheck, lint, drive it.**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. On the simulator: open a recurrence, change the end → toast "Fine aggiornata", rows past the end
disappear; change the cadence → new detail with the new id; "Smetti di ripetere" → future rows gone, series ends today.

- [x] **Step 3: Commit.**

```bash
rtk git add 'apps/mobile/app/recurrence/[id].tsx'
rtk git commit -m "feat(mobile): recurrence detail with cadence, end and stop"
```

---

### Task 14: Docs, gates, review

**Files:** `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`, `docs/superpowers/plans/README.md`

- [x] **Step 1: Spec §4 Recurrence table** (line 228 onward). Replace the `frequency` row and add `interval`:

```markdown
| `frequency` | `daily \| weekly \| monthly \| yearly` | With `interval`: every N units. Rows written when only `monthly` existed still parse. |
| `interval` | int 1–99 | Defaults to 1 on parse. |
| `startDate` | LocalDate | The anchor: day of month for monthly and yearly (clamped to the month), weekday for weekly. |
| `endDate` | LocalDate \| null | Inclusive. "Dopo N volte" is stored as the date of the N-th occurrence. |
```

- [x] **Step 2: Spec §5.9.** Replace the first two bullets with:

```markdown
- The "Ripeti" chip row of the new-transaction sheet (Mai / Ogni mese / Ogni settimana / Altro › sheet with presets,
  "Personalizzato" every N days/weeks/months/years, and an end: mai / in una data / dopo N volte) creates a
  `Recurrence` whose `startDate` is the transaction date, plus the first occurrence (id = `${recurrenceId}:${date}`).
- **Materialiser** (`materializeOccurrences(recurrence, existingIds, horizonEnd)`): for each date the schedule fires
  on (`nthOccurrence`) from `startDate` to `min(endDate, horizonEnd)`, if no row with the deterministic id exists
  (including tombstones), create it from the template. `horizonEnd = end of the cycle after the current one`. It runs
  on app start, on foreground, after sync pull, and after any recurrence write.
```

and append two bullets after "Deleting":

```markdown
- **Stopping** ("Smetti di ripetere", from the recurrence detail): `endDate = today`, every occurrence dated after
  today is tombstoned, today's stays. A series whose `startDate` is still ahead is tombstoned whole.
- **Changing the rule** from the detail: same cadence → only `endDate` moves (rows past it go, the materialiser
  extends if it grew). New cadence → the old series ends today, its upcoming occurrences go, and a new recurrence with
  the same template starts on the first date the new rule fires after today, anchored on the old `startDate`.
  Template edits keep going through the scope sheet from an occurrence.
```

- [x] **Step 3: Spec §6 rows.** In 6.2 append: `A **Ricorrenti** row under "In arrivo" (only when a recurrence exists)
      opens §6.33.` In 6.6 replace `"Ricorrente, ogni mese"` with `"Ricorrente, ogni mese, il 18" (the cadence)` and
      append `A **Ricorrenza** row (end) opens §6.34.` In 6.16 replace `Ripeti toggle;` with `**Ripeti** chip row under
      Data (Mai / Ogni mese / Ogni settimana / Altro › sheet) with a one-line summary and "Cambia"; on an occurrence a
      read-only "Gestisci ›" row instead;`. Then after row 6.32 add:

```markdown
| 6.33 | **Ricorrenti** (NEW) | — | Reached from the Transactions tab. "Ogni mese, in media": Σ amount × occurrences-per-month over live recurrences, expenses and income apart, transfers left out; bar = expense/income when there is income. Then one card per cadence ("Ogni mese", "Ogni 2 settimane", …) with rows name · cadence · prossima date · signed amount → §6.34; ended series in a last card. Empty state points at "Ripeti". |
| 6.34 | **Recurrence detail** (NEW) | — | Name, amount, cadence and next date; rows Cadenza › and Fine › (both open the Ripeti sheet on a draft, applied on close per §5.9), Prima occorrenza; every occurrence, newest first, upcoming ones with the 2px rule; "Modifica" opens the edit sheet of the next upcoming occurrence (or the latest), which asks the scope; "Smetti di ripetere" confirms with the real count of scheduled rows. |
```

- [x] **Step 4: Roadmap.** In `docs/superpowers/plans/README.md`, before `## Future (not POC)`, add:

```markdown
### 12 — Recurring transactions 🚧 planned

**Plan:** `2026-09-19-12-recurring-transactions.md` · **Spec:** §4 (Recurrence), §5.9, §6.2, §6.6, §6.16, §6.33, §6.34
· **Mockup:** `docs/superpowers/mockups/2026-09-18-recurring-transactions.html` (form: variant A, tab: variant B)

- Every N days/weeks/months/years, end on a date or after N times; "Ripeti" as a chip row in the form.
- "Ricorrenti" card on the Transactions tab → list with monthly totals → detail with cadence, end, occurrences and
  "Smetti di ripetere". ↻ badge on occurrence rows. No pause.

**Acceptance:** create a bi-weekly expense and see its occurrences up to the end of next cycle; change its end and
its cadence from the detail; stop it and see only the future go; `SYNC_SCHEMA_VERSION` stays 1 (documented).
```

Mark it ✅ done with a **Status** line once Step 6 passes.

- [x] **Step 5: Gates.** Run each through `rtk proxy` and read the output, not the exit code (AGENTS.md):

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines, no `× Some errors were emitted`; typecheck clean in every package; every vitest/jest
suite green.

- [x] **Step 6: Simulator pass** (AGENTS.md verification-before-completion): delete the simulator's
      `Documents/SQLite/saldo.db`, Metro `--clear`, seed, then: new expense with "Ogni 2 settimane", see two badged
      rows behind "In arrivo"; open the card → list → detail; change end; change cadence; stop; edit an occurrence and
      see the "Gestisci ›" row; a plain transaction turned recurring from the edit form.

- [x] **Step 7: Commit and review.**

```bash
rtk git add docs
rtk git commit -m "docs: recurring transactions in spec and roadmap"
```

Then use **requesting-code-review** on `main..feat/recurrences` before merging.

---

## Status (2026-09-19)

Driven on the iPhone 17 Pro simulator (iOS 26.5) with Maestro 2.10 (`~/.maestro/bin/maestro`, installed for this):
a bi-weekly expense from the form (chip row, sheet with presets, "Personalizzato", "Dopo N volte"), the "Ricorrenti"
card with the monthly figure, the list grouped by cadence with the ↻ badge, the detail, the cadence sheet, and
"Smetti di ripetere" (future rows gone, series in "Terminate", total recomputed). One defect found and fixed there: the
sheet opened from the detail reported "Mai" for a series with an end.

Notes for the next simulator session:

- `CI=1 expo start` disables Metro's file watcher; edits do not reach the app until Metro restarts. Start it plain.
- With a hardware keyboard attached to the simulator, Maestro's `hideKeyboard` fails and a tap right after
  `inputText` is spent dismissing the keyboard. Tap something inert first, or choose chips before typing.
- `apps/mobile/maestro/edit-recurring-following.yaml` was updated to the chip row but still uses `hideKeyboard`, so it
  fails on this machine for that reason alone; it was not run to the end.
- Text taps on `ListRow` titles do not resolve on iOS; rows carry `recurrence-<id>` test ids for that.
- Description text typed by Maestro did not land in the field on this run (the row was named after its category),
  which is a test-driver quirk, not a product one.

