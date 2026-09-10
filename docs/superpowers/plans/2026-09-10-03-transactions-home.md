# Transactions & Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable: add, edit and delete transactions (including recurring ones), browse and filter them, and see the cycle on Home.

**Architecture:** Recurrence rules are pure functions in `@saldo/core` — the materialiser and the edit-scope planner — so the three scope branches are unit-tested without a database, and a thin mobile service applies a plan inside one transaction. Screens read through `useLiveQuery` and run core calculations in `useMemo`; the selected period lives in one provider shared by every tab.

**Tech Stack:** As phase 02, plus `@react-native-community/datetimepicker` for the date picker and Reanimated + Gesture Handler for the swipe rows.

**Spec:** §5.2, §5.3, §5.6, §5.9, §5.10 (tag input only), §5.12, §6.1, §6.2, §6.6, §6.15, §6.16, §6.21, §6.23, §6.26, §6.27.

**Note on process:** this phase was implemented before its plan was written, so the document below is
recorded *as built*. Where a decision was reached by running the app rather than by reading the spec,
the step says so.

---

## File structure

```
packages/core/src/
├─ recurrence.ts             occurrence dates, materialiser, edit-scope planner
└─ recurrence.test.ts

apps/mobile/
├─ app/
│  ├─ (tabs)/index.tsx              Home (§6.1)
│  ├─ (tabs)/transactions.tsx       list, search, chips, swipe (§6.2, §5.12)
│  ├─ transaction/[id].tsx          detail (§6.6)
│  ├─ transaction/new.tsx           new sheet (§6.16)
│  └─ transaction/edit/[id].tsx     edit sheet + scope sheet (§6.16, §6.21)
├─ scripts/seed-database.ts         seeds a simulator database for inspection
└─ src/
   ├─ components/                   AmountInput, Chip, ListRow, Sheet, Toast, ConfirmDialog, Toggle
   ├─ db/repositories/recurrences.ts
   ├─ db/recurrenceService.ts       applies a plan in one transaction
   └─ features/
      ├─ home/CycleTrendChart.tsx   §5.6 SVG polylines
      ├─ period/PeriodProvider.tsx  selected cycle, shared by every tab
      ├─ period/PeriodHeader.tsx    §6.1 header
      ├─ period/PeriodSheet.tsx     §6.15
      ├─ period/MaterialiserGate.tsx  runs the materialiser on start/foreground
      └─ transactions/             form rules, form, swipe row, scope sheet, tag filter
```

---

### Task 1: Recurrence rules in `@saldo/core`

Spec §5.9. Everything that decides *which* rows change is pure, so the three scope branches are
tested without a database.

**Files:**
- Create: `packages/core/src/recurrence.ts`
- Test: `packages/core/src/recurrence.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { Recurrence } from './entities';
import {
  materializeOccurrences,
  occurrenceDates,
  planRecurrenceEdit,
  recurrenceHorizonEnd,
} from './recurrence';

const TEMPLATE: Recurrence['template'] = {
  kind: 'expense',
  amount: 78000,
  accountId: 'acc-checking',
  toAccountId: null,
  categoryId: 'cat-rent',
  description: 'Affitto',
  tagIds: [],
  excludeFromTotals: false,
};

const RECURRENCE: Recurrence = {
  id: 'rec-rent',
  createdAt: '2026-01-27T10:00:00.000Z',
  updatedAt: '001775000000000-0000-dev',
  deletedAt: null,
  frequency: 'monthly',
  startDate: '2026-01-27',
  endDate: null,
  template: TEMPLATE,
};

describe('occurrenceDates', () => {
  it('repeats the start day every month', () => {
    expect(occurrenceDates('2026-01-27', null, '2026-04-30')).toEqual([
      '2026-01-27',
      '2026-02-27',
      '2026-03-27',
      '2026-04-27',
    ]);
  });

  it('clamps the day to short months, without losing it afterwards', () => {
    expect(occurrenceDates('2026-01-31', null, '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('stops at the inclusive end date', () => {
    expect(occurrenceDates('2026-01-15', '2026-03-15', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
    expect(occurrenceDates('2026-01-15', '2026-03-14', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-02-15',
    ]);
  });

  it('returns nothing when the horizon is before the start', () => {
    expect(occurrenceDates('2026-05-01', null, '2026-04-30')).toEqual([]);
  });
});

describe('recurrenceHorizonEnd', () => {
  it('reaches the end of the cycle after the current one', () => {
    expect(recurrenceHorizonEnd('2026-04-18', 27)).toBe('2026-05-26');
    expect(recurrenceHorizonEnd('2026-04-27', 27)).toBe('2026-06-26');
  });
});

describe('materializeOccurrences', () => {
  it('creates one transaction per date, with the deterministic id', () => {
    const created = materializeOccurrences(RECURRENCE, new Set(), '2026-03-31');
    expect(created.map((tx) => tx.id)).toEqual([
      'rec-rent:2026-01-27',
      'rec-rent:2026-02-27',
      'rec-rent:2026-03-27',
    ]);
    expect(created[0]).toMatchObject({
      ...TEMPLATE,
      date: '2026-01-27',
      recurrenceId: 'rec-rent',
      note: null,
    });
  });

  it('skips ids that already exist, tombstones included', () => {
    const existing = new Set(['rec-rent:2026-02-27']);
    const created = materializeOccurrences(RECURRENCE, existing, '2026-03-31');
    expect(created.map((tx) => tx.date)).toEqual(['2026-01-27', '2026-03-27']);
  });

  it('creates nothing for a tombstoned recurrence', () => {
    const deleted = { ...RECURRENCE, deletedAt: '2026-02-01T00:00:00.000Z' };
    expect(materializeOccurrences(deleted, new Set(), '2026-12-31')).toEqual([]);
  });

  it('is idempotent: running it twice adds nothing', () => {
    const first = materializeOccurrences(RECURRENCE, new Set(), '2026-03-31');
    const ids = new Set(first.map((tx) => tx.id));
    expect(materializeOccurrences(RECURRENCE, ids, '2026-03-31')).toEqual([]);
  });
});

describe('planRecurrenceEdit', () => {
  const occurrences = [
    { id: 'rec-rent:2026-02-27', date: '2026-02-27' },
    { id: 'rec-rent:2026-03-27', date: '2026-03-27' },
    { id: 'rec-rent:2026-04-27', date: '2026-04-27' },
    { id: 'rec-rent:2026-05-27', date: '2026-05-27' },
  ];

  it('"only this" touches a single row', () => {
    const plan = planRecurrenceEdit('only-this', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-04-27',
      occurrences,
      today: '2026-04-18',
    });
    expect(plan).toEqual({
      scope: 'only-this',
      updateOccurrenceIds: ['rec-rent:2026-04-27'],
      tombstoneOccurrenceIds: [],
      endCurrentRecurrenceOn: null,
      startNewRecurrenceOn: null,
      updateTemplate: false,
      unchangedCount: 3,
    });
  });

  it('"this and following" ends the old recurrence the day before and restarts', () => {
    const plan = planRecurrenceEdit('this-and-following', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-04-27',
      occurrences,
      today: '2026-04-18',
    });
    expect(plan.endCurrentRecurrenceOn).toBe('2026-04-26');
    expect(plan.startNewRecurrenceOn).toBe('2026-04-27');
    // The edited occurrence and every later one are upcoming, so they go.
    expect(plan.tombstoneOccurrenceIds).toEqual(['rec-rent:2026-04-27', 'rec-rent:2026-05-27']);
    expect(plan.updateTemplate).toBe(false);
  });

  it('"this and following" keeps past occurrences even when they sit after the edited date', () => {
    const plan = planRecurrenceEdit('this-and-following', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-03-27',
      occurrences,
      today: '2026-04-18',
    });
    // 2026-04-27 and 2026-05-27 are upcoming; 2026-03-27 is the edited one.
    expect(plan.tombstoneOccurrenceIds).toEqual([
      'rec-rent:2026-03-27',
      'rec-rent:2026-04-27',
      'rec-rent:2026-05-27',
    ]);
    expect(plan.unchangedCount).toBe(1);
  });

  it('"all" rewrites the template and every existing occurrence', () => {
    const plan = planRecurrenceEdit('all', {
      recurrence: RECURRENCE,
      occurrenceDate: '2026-04-27',
      occurrences,
      today: '2026-04-18',
    });
    expect(plan.updateTemplate).toBe(true);
    expect(plan.updateOccurrenceIds).toEqual(occurrences.map((row) => row.id));
    expect(plan.tombstoneOccurrenceIds).toEqual([]);
    expect(plan.unchangedCount).toBe(0);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @saldo/core exec vitest run src/recurrence`
Expected: FAIL, module not found.

- [x] **Step 3: Implement `packages/core/src/recurrence.ts`**

Two details worth stating, both asserted above:

- `occurrenceDates` clamps the day per month, so the 31st fires on the 28th in February and returns
  to the 31st in March. Clamping *forward* would lose the day permanently.
- "This and following" removes only the edited occurrence and the **upcoming** ones. A past
  occurrence records money that actually moved, so it stays even when its date sorts after the
  edited one — which is why the planner takes `today`.

```ts
import { cycleContaining, shiftCycle } from './cycle';
import {
  addDays,
  addMonths,
  daysInMonth,
  type LocalDate,
  makeLocalDate,
  parseLocalDate,
} from './dates';
import type { Recurrence, Transaction } from './entities';
import { occurrenceId } from './ids';

/**
 * Dates a monthly recurrence fires on, from `startDate` up to `min(endDate, horizonEnd)` (§5.9).
 *
 * The day of month comes from `startDate` and is clamped per month, so a recurrence on the 31st
 * fires on the 28th in February and returns to the 31st in March — it is never lost.
 */
export function occurrenceDates(
  startDate: LocalDate,
  endDate: LocalDate | null,
  horizonEnd: LocalDate,
): LocalDate[] {
  const { year, month, day } = parseLocalDate(startDate);
  const last = endDate === null || endDate > horizonEnd ? horizonEnd : endDate;
  const dates: LocalDate[] = [];
  for (let offset = 0; ; offset += 1) {
    const ym = addMonths({ year, month }, offset);
    const date = makeLocalDate(ym.year, ym.month, Math.min(day, daysInMonth(ym.year, ym.month)));
    if (date > last) break;
    if (date >= startDate) dates.push(date);
  }
  return dates;
}

/** How far ahead the materialiser goes: the end of the cycle after the current one (§5.9). */
export function recurrenceHorizonEnd(today: LocalDate, cycleStartDay: number): LocalDate {
  return shiftCycle(cycleContaining(today, cycleStartDay), cycleStartDay, 1).end;
}

/** A scheduled occurrence, ready for the transactions repository. */
export type NewOccurrence = Omit<Transaction, 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Occurrences that do not exist yet (§5.9). `existingIds` must include tombstones, otherwise a
 * deleted occurrence would come back on the next run.
 */
export function materializeOccurrences(
  recurrence: Recurrence,
  existingIds: ReadonlySet<string>,
  horizonEnd: LocalDate,
): NewOccurrence[] {
  if (recurrence.deletedAt !== null) return [];
  return occurrenceDates(recurrence.startDate, recurrence.endDate, horizonEnd)
    .map((date) => ({ date, id: occurrenceId(recurrence.id, date) }))
    .filter(({ id }) => !existingIds.has(id))
    .map(({ date, id }) => ({
      ...recurrence.template,
      id,
      date,
      note: null,
      recurrenceId: recurrence.id,
    }));
}

export type RecurrenceEditScope = 'only-this' | 'this-and-following' | 'all';

export interface RecurrenceEditInput {
  recurrence: Recurrence;
  /** Date of the occurrence the user is editing. */
  occurrenceDate: LocalDate;
  /** Every existing occurrence of this recurrence, tombstones excluded. */
  occurrences: readonly { id: string; date: LocalDate }[];
  today: LocalDate;
}

export interface RecurrenceEditPlan {
  scope: RecurrenceEditScope;
  /** Occurrences to rewrite with the edited values, keeping each one's own date. */
  updateOccurrenceIds: string[];
  /** Occurrences to tombstone so the new recurrence can replace them. */
  tombstoneOccurrenceIds: string[];
  /** New `endDate` for the recurrence being replaced. */
  endCurrentRecurrenceOn: LocalDate | null;
  /** `startDate` of the recurrence to create from the edited values. */
  startNewRecurrenceOn: LocalDate | null;
  updateTemplate: boolean;
  /** For the sheet's copy: how many occurrences the choice leaves alone (§5.9). */
  unchangedCount: number;
}

/**
 * Turns the scope the user picked in the sheet into the exact set of writes (§5.9). Pure, so the
 * three branches are unit-tested without a database; the repository applies the plan in one
 * transaction.
 */
export function planRecurrenceEdit(
  scope: RecurrenceEditScope,
  input: RecurrenceEditInput,
): RecurrenceEditPlan {
  const { occurrenceDate, occurrences, today } = input;

  if (scope === 'only-this') {
    const target = occurrences.filter((row) => row.date === occurrenceDate);
    return {
      scope,
      updateOccurrenceIds: target.map((row) => row.id),
      tombstoneOccurrenceIds: [],
      endCurrentRecurrenceOn: null,
      startNewRecurrenceOn: null,
      updateTemplate: false,
      unchangedCount: occurrences.length - target.length,
    };
  }

  if (scope === 'all') {
    return {
      scope,
      updateOccurrenceIds: occurrences.map((row) => row.id),
      tombstoneOccurrenceIds: [],
      endCurrentRecurrenceOn: null,
      startNewRecurrenceOn: null,
      updateTemplate: true,
      unchangedCount: 0,
    };
  }

  // "This and following": close the old series the day before, then start a new one here. Only the
  // edited occurrence and the *upcoming* ones are removed — a past occurrence records money that
  // actually moved, so it stays even if its date sorts after the edited one.
  const doomed = occurrences.filter(
    (row) => row.date >= occurrenceDate && (row.date === occurrenceDate || row.date > today),
  );
  return {
    scope,
    updateOccurrenceIds: [],
    tombstoneOccurrenceIds: doomed.map((row) => row.id),
    endCurrentRecurrenceOn: addDays(occurrenceDate, -1),
    startNewRecurrenceOn: occurrenceDate,
    updateTemplate: false,
    unchangedCount: occurrences.length - doomed.length,
  };
}
```

- [x] **Step 4: Export and verify**

Add `export * from './recurrence';` to `packages/core/src/index.ts`, then
`pnpm --filter @saldo/core test`.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/recurrence.ts packages/core/src/recurrence.test.ts packages/core/src/index.ts
git commit -m "feat(core): add the recurrence materialiser and edit-scope planner"
```

---

### Task 2: Recurrences repository and materialiser service

Spec §5.9, §7. The service is where a plan becomes writes; every branch touches several rows, so it
runs in one transaction.

**Files:**
- Create: `apps/mobile/src/db/repositories/recurrences.ts`, `apps/mobile/src/db/recurrenceService.ts`
- Test: `apps/mobile/src/db/recurrenceService.test.ts`

- [x] **Step 1: The repository**

```ts
import { newId, type Recurrence, recurrenceSchema } from '@saldo/core';
import { asc, eq, isNull } from 'drizzle-orm';
import { recurrences } from '../schema';
import { insertStamp, isoNow, type RepositoryContext, toEntity, updateStamp } from './support';

type RecurrenceInput = Omit<Recurrence, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: string;
};

export interface RecurrencesRepository {
  create(input: RecurrenceInput): Recurrence;
  update(id: string, patch: Partial<RecurrenceInput>): Recurrence;
  remove(id: string): void;
  byId(id: string): Recurrence | null;
  list(): Recurrence[];
}

export function createRecurrencesRepository(context: RepositoryContext): RecurrencesRepository {
  const { db } = context;
  const read = (id: string): Recurrence | null => {
    const [row] = db.select().from(recurrences).where(eq(recurrences.id, id)).all();
    return row === undefined ? null : toEntity(row);
  };
  return {
    create(input) {
      const entity = recurrenceSchema.parse({
        ...input,
        id: input.id ?? newId(),
        ...insertStamp(context),
      });
      db.insert(recurrences)
        .values({ ...entity, syncState: 1 })
        .run();
      return entity;
    },
    update(id, patch) {
      const current = read(id);
      if (current === null) throw new Error(`No recurrence ${id}`);
      const entity = recurrenceSchema.parse({ ...current, ...patch, id, ...updateStamp(context) });
      db.update(recurrences)
        .set({ ...entity, syncState: 1 })
        .where(eq(recurrences.id, id))
        .run();
      return entity;
    },
    remove(id) {
      db.update(recurrences)
        .set({ deletedAt: (context.nowIso ?? isoNow)(), ...updateStamp(context) })
        .where(eq(recurrences.id, id))
        .run();
    },
    byId: read,
    list() {
      return db
        .select()
        .from(recurrences)
        .where(isNull(recurrences.deletedAt))
        .orderBy(asc(recurrences.startDate))
        .all()
        .map(toEntity);
    },
  };
}
```

Register it in `src/db/repositories/index.ts` alongside the others.

- [x] **Step 2: Write the failing test**

```ts
import type { Transaction } from '@saldo/core';
import {
  applyRecurrenceEdit,
  type RecurrenceEditValues,
  runMaterialiser,
  startRecurrence,
} from './recurrenceService';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

const TODAY = '2026-04-18';
const CYCLE_START_DAY = 27;

const TEMPLATE = {
  kind: 'expense',
  amount: 78000,
  accountId: 'acc-checking',
  toAccountId: null,
  categoryId: 'cat-rent',
  description: 'Affitto',
  tagIds: [],
  excludeFromTotals: false,
} satisfies RecurrenceEditValues;

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => '2026-04-18T09:00:00.000Z');
  return { db, repos };
}

function dates(repos: ReturnType<typeof createRepositories>): string[] {
  return repos.transactions
    .list()
    .map((tx) => tx.date)
    .sort();
}

describe('runMaterialiser', () => {
  it('creates occurrences up to the end of the cycle after the current one', () => {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    const created = runMaterialiser(db, repos, TODAY, CYCLE_START_DAY);
    // Horizon is 2026-05-26, so Feb, Mar and Apr fire.
    expect(created).toBe(3);
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27', '2026-04-27']);
  });

  it('is idempotent', () => {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_START_DAY);
    expect(runMaterialiser(db, repos, TODAY, CYCLE_START_DAY)).toBe(0);
  });

  it('does not resurrect a deleted occurrence', () => {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_START_DAY);
    repos.transactions.remove('rec-rent:2026-03-27');
    expect(runMaterialiser(db, repos, TODAY, CYCLE_START_DAY)).toBe(0);
    expect(dates(repos)).toEqual(['2026-02-27', '2026-04-27']);
  });

  it('ignores a tombstoned recurrence', () => {
    const { db, repos } = setup();
    const recurrence = repos.recurrences.create({
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    repos.recurrences.remove(recurrence.id);
    expect(runMaterialiser(db, repos, TODAY, CYCLE_START_DAY)).toBe(0);
  });
});

describe('startRecurrence', () => {
  it('replaces the saved transaction with the deterministic first occurrence', () => {
    const { db, repos } = setup();
    const saved = repos.transactions.create({
      kind: 'expense',
      amount: 1299,
      date: '2026-04-10',
      accountId: 'acc-card',
      toAccountId: null,
      categoryId: 'cat-subscriptions',
      description: 'Netflix',
      note: null,
      tagIds: [],
      excludeFromTotals: false,
      recurrenceId: null,
    });
    const recurrence = startRecurrence(db, repos, saved, TODAY, CYCLE_START_DAY);
    const live = repos.transactions.list();
    expect(live.map((tx) => tx.id)).toContain(`${recurrence.id}:2026-04-10`);
    expect(repos.transactions.byId(saved.id)?.deletedAt).not.toBeNull();
    // Horizon 2026-05-26, so the May occurrence is scheduled too.
    expect(dates(repos)).toEqual(['2026-04-10', '2026-05-10']);
  });
});

describe('applyRecurrenceEdit', () => {
  function seeded() {
    const { db, repos } = setup();
    repos.recurrences.create({
      id: 'rec-rent',
      frequency: 'monthly',
      startDate: '2026-02-27',
      endDate: null,
      template: TEMPLATE,
    });
    runMaterialiser(db, repos, TODAY, CYCLE_START_DAY);
    const recurrence = repos.recurrences.byId('rec-rent');
    if (recurrence === null) throw new Error('missing recurrence');
    return { db, repos, recurrence };
  }

  const edited: RecurrenceEditValues = { ...TEMPLATE, amount: 80000 };

  function occurrence(repos: ReturnType<typeof createRepositories>, date: string): Transaction {
    const found = repos.transactions.list().find((tx) => tx.date === date);
    if (found === undefined) throw new Error(`no occurrence on ${date}`);
    return found;
  }

  it('"only this" changes one row and leaves the template alone', () => {
    const { db, repos, recurrence } = seeded();
    applyRecurrenceEdit(db, repos, 'only-this', {
      recurrence,
      occurrence: occurrence(repos, '2026-03-27'),
      values: edited,
      date: '2026-03-27',
      today: TODAY,
      cycleStartDay: CYCLE_START_DAY,
    });
    expect(occurrence(repos, '2026-03-27').amount).toBe(80000);
    expect(occurrence(repos, '2026-02-27').amount).toBe(78000);
    expect(repos.recurrences.byId('rec-rent')?.template.amount).toBe(78000);
  });

  it('"all" rewrites the template and every occurrence, keeping their dates', () => {
    const { db, repos, recurrence } = seeded();
    applyRecurrenceEdit(db, repos, 'all', {
      recurrence,
      occurrence: occurrence(repos, '2026-03-27'),
      values: edited,
      date: '2026-03-27',
      today: TODAY,
      cycleStartDay: CYCLE_START_DAY,
    });
    expect(repos.transactions.list().every((tx) => tx.amount === 80000)).toBe(true);
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27', '2026-04-27']);
    expect(repos.recurrences.byId('rec-rent')?.template.amount).toBe(80000);
  });

  it('"this and following" closes the old series and starts a new one', () => {
    const { db, repos, recurrence } = seeded();
    applyRecurrenceEdit(db, repos, 'this-and-following', {
      recurrence,
      occurrence: occurrence(repos, '2026-04-27'),
      values: edited,
      date: '2026-04-27',
      today: TODAY,
      cycleStartDay: CYCLE_START_DAY,
    });
    expect(repos.recurrences.byId('rec-rent')?.endDate).toBe('2026-04-26');
    const series = repos.recurrences.list();
    expect(series).toHaveLength(2);
    // Past occurrences keep the old amount; the new series carries the edited one.
    expect(occurrence(repos, '2026-02-27').amount).toBe(78000);
    expect(occurrence(repos, '2026-03-27').amount).toBe(78000);
    expect(occurrence(repos, '2026-04-27').amount).toBe(80000);
    // The horizon ends on 2026-05-26 (§5.9), so an occurrence on the 27th of the next month is
    // always just out of reach; the run after 27 Apr picks it up.
    expect(dates(repos)).toEqual(['2026-02-27', '2026-03-27', '2026-04-27']);
  });
});
```

The last expectation is the one to read carefully: the horizon ends on the 26th, so an occurrence on
the 27th of the next month is always just out of reach, and the run after the 27th picks it up. That
is the spec's horizon, not a bug.

- [x] **Step 3: Implement the service**

```ts
import type { LocalDate } from '@saldo/core';
import {
  materializeOccurrences,
  occurrenceId,
  planRecurrenceEdit,
  type Recurrence,
  type RecurrenceEditScope,
  recurrenceHorizonEnd,
  type Transaction,
} from '@saldo/core';
import { eq } from 'drizzle-orm';
import type { Repositories } from './repositories';
import type { RepositoryDatabase } from './repositories/support';
import { transactions } from './schema';

/**
 * Ids of every occurrence row of a recurrence, **including tombstones** — the materialiser needs
 * them so a deleted occurrence is not recreated (§5.9).
 */
function existingOccurrenceIds(db: RepositoryDatabase, recurrenceId: string): Set<string> {
  return new Set(
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.recurrenceId, recurrenceId))
      .all()
      .map((row) => row.id),
  );
}

/**
 * Runs the materialiser for every live recurrence (§5.9): on app start, on foreground, after a
 * sync pull and after any recurrence write. Returns how many occurrences it created.
 */
export function runMaterialiser(
  db: RepositoryDatabase,
  repos: Repositories,
  today: LocalDate,
  cycleStartDay: number,
): number {
  const horizonEnd = recurrenceHorizonEnd(today, cycleStartDay);
  let created = 0;
  for (const recurrence of repos.recurrences.list()) {
    const existing = existingOccurrenceIds(db, recurrence.id);
    for (const occurrence of materializeOccurrences(recurrence, existing, horizonEnd)) {
      repos.transactions.create(occurrence);
      created += 1;
    }
  }
  return created;
}

/** Fields the sheet can change on an occurrence or a template. */
export type RecurrenceEditValues = Pick<
  Transaction,
  | 'kind'
  | 'amount'
  | 'accountId'
  | 'toAccountId'
  | 'categoryId'
  | 'description'
  | 'tagIds'
  | 'excludeFromTotals'
>;

export interface ApplyRecurrenceEditInput {
  recurrence: Recurrence;
  occurrence: Transaction;
  values: RecurrenceEditValues;
  /** Only "only this" can move a single occurrence to another date. */
  date: LocalDate;
  today: LocalDate;
  cycleStartDay: number;
}

/**
 * Applies the plan of §5.9 for the scope the user picked. Every branch touches several rows, so it
 * runs inside one transaction (§7): a half-applied scope edit would leave duplicate occurrences.
 */
export function applyRecurrenceEdit(
  db: RepositoryDatabase,
  repos: Repositories,
  scope: RecurrenceEditScope,
  input: ApplyRecurrenceEditInput,
): void {
  const { recurrence, occurrence, values, date, today, cycleStartDay } = input;
  const occurrences = repos.transactions
    .list()
    .filter((tx) => tx.recurrenceId === recurrence.id)
    .map((tx) => ({ id: tx.id, date: tx.date }));

  const plan = planRecurrenceEdit(scope, {
    recurrence,
    occurrenceDate: occurrence.date,
    occurrences,
    today,
  });

  db.transaction(() => {
    for (const id of plan.updateOccurrenceIds) {
      const existing = repos.transactions.byId(id);
      if (existing === null) continue;
      repos.transactions.update(id, {
        ...values,
        // "Only this" may move the row; "all" keeps each occurrence on its own date (§5.9).
        date: plan.scope === 'only-this' ? date : existing.date,
      });
    }
    for (const id of plan.tombstoneOccurrenceIds) repos.transactions.remove(id);

    if (plan.updateTemplate) {
      repos.recurrences.update(recurrence.id, { template: values });
    }
    if (plan.endCurrentRecurrenceOn !== null) {
      repos.recurrences.update(recurrence.id, { endDate: plan.endCurrentRecurrenceOn });
    }
    if (plan.startNewRecurrenceOn !== null) {
      const created = repos.recurrences.create({
        frequency: 'monthly',
        startDate: plan.startNewRecurrenceOn,
        endDate: null,
        template: values,
      });
      // Materialise the new series immediately so the list does not show a gap.
      const horizonEnd = recurrenceHorizonEnd(today, cycleStartDay);
      for (const created2 of materializeOccurrences(created, new Set(), horizonEnd)) {
        repos.transactions.create(created2);
      }
    }
  });
}

/** Creates a recurrence from a transaction the user toggled "Ripeti" on (§5.9). */
export function startRecurrence(
  db: RepositoryDatabase,
  repos: Repositories,
  transaction: Transaction,
  today: LocalDate,
  cycleStartDay: number,
): Recurrence {
  return db.transaction(() =>
    startRecurrenceInTransaction(db, repos, transaction, today, cycleStartDay),
  );
}

function startRecurrenceInTransaction(
  db: RepositoryDatabase,
  repos: Repositories,
  transaction: Transaction,
  today: LocalDate,
  cycleStartDay: number,
): Recurrence {
  const recurrence = repos.recurrences.create({
    frequency: 'monthly',
    startDate: transaction.date,
    endDate: null,
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
  const firstId = occurrenceId(recurrence.id, transaction.date);
  repos.transactions.create({
    ...transaction,
    id: firstId,
    recurrenceId: recurrence.id,
  });
  runMaterialiser(db, repos, today, cycleStartDay);
  return recurrence;
}
```

- [x] **Step 4: Run the tests and commit**

```bash
pnpm --filter mobile test src/db/recurrenceService
git add apps/mobile/src/db
git commit -m "feat(mobile): add the recurrences repository and materialiser service"
```

---

### Task 3: Amount input on the device keyboard

Spec §5.1 and D23. This replaces the in-app keypad of phase 01/02.

**Files:**
- Modify: `packages/core/src/money.ts` (drop `pressAmountKey`/`AmountKey`, add `sanitizeAmountInput`)
- Delete: `apps/mobile/src/components/Keypad.tsx`
- Create: `apps/mobile/src/components/AmountInput.tsx`

- [x] **Step 1: Replace the reducer with a sanitizer in core**

The keypad reducer assumed it saw one keystroke at a time. A system keyboard can deliver a paste, a
minus sign, a second separator, or a comma where the app expects a dot, so the core function becomes
a normaliser over whatever arrived. Tests for it live in `money.test.ts`.

- [x] **Step 2: Write `AmountInput.tsx`**

```tsx
import {
  amountBufferToMinor,
  type CurrencyCode,
  getCurrency,
  sanitizeAmountInput,
} from '@saldo/core';
import { type AppLocale, formatMoneyParts } from '@saldo/i18n';
import { useRef } from 'react';
import { InputAccessoryView, Platform, Pressable, TextInput, View } from 'react-native';
import { Text } from '../theme/Text';
import { useTheme } from '../theme/ThemeProvider';

export interface AmountInputProps {
  /** Locale-agnostic buffer using `.` (§5.1). */
  buffer: string;
  onChange: (buffer: string) => void;
  currency: CurrencyCode;
  locale: AppLocale;
  autoFocus?: boolean;
  /** Label for the accessory bar's dismiss button. */
  doneLabel: string;
  onDone?: () => void;
}

/**
 * Amount entry on the **device keyboard** (D23): a `decimal-pad` field styled as the big amount,
 * with the currency symbol beside it.
 *
 * The field shows the raw buffer rather than a grouped number: re-formatting text while someone
 * types moves the caret and fights them. Grouping is applied everywhere the amount is *displayed*.
 *
 * iOS gets an `InputAccessoryView` with a done button, which is the platform way to extend the
 * keyboard. Android has no equivalent primitive, so there the keyboard's own dismiss key and the
 * form's save button do the job.
 */
export function AmountInput({
  buffer,
  onChange,
  currency,
  locale,
  autoFocus = false,
  doneLabel,
  onDone,
}: AmountInputProps) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const accessoryId = 'saldo-amount-accessory';
  const { minorDigits } = getCurrency(currency);
  const parts = formatMoneyParts(amountBufferToMinor(buffer, minorDigits), currency, locale);
  const separator = locale === 'it' ? ',' : '.';

  return (
    <Pressable accessibilityRole="button" onPress={() => input.current?.focus()}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        {parts.symbolPosition === 'prefix' ? (
          <Text size="amountXl" weight="semibold" color="textFaint">
            {parts.symbol}
          </Text>
        ) : null}
        <TextInput
          ref={input}
          accessibilityLabel={doneLabel}
          value={buffer.replace('.', separator)}
          onChangeText={(text) => onChange(sanitizeAmountInput(text, minorDigits))}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          placeholder="0"
          placeholderTextColor={theme.palette.textFaint}
          inputAccessoryViewID={Platform.OS === 'ios' ? accessoryId : undefined}
          style={{
            flex: 1,
            minWidth: 80,
            paddingVertical: 0,
            color: theme.palette.text,
            fontFamily: 'Geist_600SemiBold',
            fontSize: theme.fontSize.amountXl,
            fontVariant: ['tabular-nums'],
          }}
        />
        {parts.symbolPosition === 'suffix' ? (
          <Text size="amountXl" weight="semibold" color="textFaint">
            {parts.symbol}
          </Text>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              paddingHorizontal: theme.layout.screenPaddingX,
              paddingVertical: 8,
              backgroundColor: theme.palette.raised,
              borderTopWidth: 1,
              borderTopColor: theme.palette.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => {
                input.current?.blur();
                onDone?.();
              }}
            >
              <Text weight="medium" color="accent">
                {doneLabel}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </Pressable>
  );
}
```

Two things to keep:

- The field shows the **raw buffer**, not a grouped number. Re-formatting text under the caret moves
  it and fights the user; grouping belongs wherever an amount is displayed.
- `InputAccessoryView` is iOS-only. Android has no equivalent primitive, so there the keyboard's own
  dismiss key and the form's save button do the job — an asymmetry worth knowing rather than hiding.

- [x] **Step 3: Commit**

```bash
git add packages/core/src/money.ts packages/core/src/money.test.ts apps/mobile/src/components
git commit -m "feat: type amounts on the device keyboard"
```

---

### Task 4: Period provider, header and sheet

Spec §6.1, §6.15. One provider owns the selected period for every tab.

**Files:** `src/features/period/{PeriodProvider,PeriodHeader,PeriodSheet,MaterialiserGate}.tsx`.

- [x] **Step 1: `PeriodProvider.tsx`**

The selection is stored as *the cycle itself*, not as an offset from today: jumping to an arbitrary
cycle from the sheet then needs no arithmetic on month lengths. A first attempt stored an offset and
converted with a 30.44-day division — close enough to look right and wrong at boundaries.

```tsx
import {
  type Cycle,
  cycleContaining,
  cycleLength,
  type DateRange,
  elapsedDays,
  isWithin,
  type LocalDate,
  shiftCycle,
  todayLocal,
} from '@saldo/core';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { useSettings } from '../../db/hooks';

export interface Period {
  range: DateRange;
  /** True for a cycle range, false for a custom one (§6.15). */
  isCycle: boolean;
  /** True when the range contains today. */
  isCurrent: boolean;
  length: number;
  elapsed: number;
}

export interface PeriodValue {
  today: LocalDate;
  cycleStartDay: number;
  period: Period;
  /** Moves by whole cycles. On a custom range it first returns to the cycle holding today. */
  shift: (delta: number) => void;
  setCustomRange: (range: DateRange) => void;
  goToCycle: (cycle: Cycle) => void;
}

/**
 * The selection is stored as *the cycle itself*, not as an offset from today: jumping to an
 * arbitrary cycle from the period sheet then needs no arithmetic on month lengths.
 */
type Selection = { kind: 'cycle'; cycle: Cycle } | { kind: 'custom'; range: DateRange };

const PeriodContext = createContext<PeriodValue | null>(null);

function describe(range: DateRange, today: LocalDate, isCycle: boolean): Period {
  return {
    range,
    isCycle,
    isCurrent: isWithin(range, today),
    length: cycleLength(range),
    elapsed: elapsedDays(range, today),
  };
}

/**
 * The selected period, shared by Home, Transactions and Statistics (§6.15). `today` is captured
 * once per mount so every screen agrees, and `@saldo/core` receives it explicitly (§3.2).
 */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const cycleStartDay = settings?.cycleStartDay ?? 27;
  const [today] = useState(() => todayLocal());
  const [selection, setSelection] = useState<Selection | null>(null);

  const value = useMemo<PeriodValue>(() => {
    const current = cycleContaining(today, cycleStartDay);
    // A null selection means "the cycle containing today", which follows a changed start day.
    const active: Selection = selection ?? { kind: 'cycle', cycle: current };
    const period =
      active.kind === 'cycle'
        ? describe(active.cycle, today, true)
        : describe(active.range, today, false);
    return {
      today,
      cycleStartDay,
      period,
      shift: (delta) => {
        const from = active.kind === 'cycle' ? active.cycle : current;
        setSelection({ kind: 'cycle', cycle: shiftCycle(from, cycleStartDay, delta) });
      },
      setCustomRange: (range) => setSelection({ kind: 'custom', range }),
      goToCycle: (cycle) => setSelection({ kind: 'cycle', cycle }),
    };
  }, [cycleStartDay, selection, today]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodValue {
  const value = useContext(PeriodContext);
  if (value === null) throw new Error('usePeriod must be used inside a PeriodProvider');
  return value;
}
```

- [x] **Step 2: `PeriodHeader.tsx`**

```tsx
import { formatCycleRange, formatDayMonth } from '@saldo/i18n';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { usePeriod } from './PeriodProvider';
import { PeriodSheet } from './PeriodSheet';

/** Header of §6.1: the period label with its subtitle, plus ‹ › cycle navigation. */
export function PeriodHeader() {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { period, shift } = usePeriod();
  const [sheetOpen, setSheetOpen] = useState(false);

  const label = period.isCycle
    ? formatCycleRange(period.range, locale)
    : `${formatDayMonth(period.range.start, locale)} – ${formatDayMonth(period.range.end, locale)}`;
  const subtitle = period.isCurrent
    ? t('period.dayOf', { elapsed: period.elapsed, length: period.length })
    : t('period.closed');

  const navButton = (direction: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === -1 ? t('period.previous') : t('period.next')}
      hitSlop={10}
      onPress={() => shift(direction)}
      style={{
        width: theme.layout.headerButton,
        height: theme.layout.headerButton,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radii.pill,
        backgroundColor: theme.palette.raised,
      }}
    >
      <Icon name={direction === -1 ? 'chevL' : 'chevR'} size={16} color={theme.palette.textMuted} />
    </Pressable>
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('period.title')}
        onPress={() => setSheetOpen(true)}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Text weight="medium" tracking="tight" numberOfLines={1}>
          {label}
        </Text>
        <Text size="caption" color="textMuted">
          {subtitle}
        </Text>
      </Pressable>
      {navButton(-1)}
      {navButton(1)}
      <PeriodSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}
```

- [x] **Step 3: `PeriodSheet.tsx`**

```tsx
import {
  cycleHistory,
  cycleLength,
  elapsedDays,
  previousCycles,
  summarizePeriod,
} from '@saldo/core';
import { formatCycleRange, formatMoney } from '@saldo/i18n';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { useSettings, useTransactionsInRange } from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { usePeriod } from './PeriodProvider';

/** How far back the sheet looks for cycles that hold data (§6.15). */
const LOOKBACK = 12;

/**
 * §6.15: the cycles that contain data, current first. The prototype's "not available offline"
 * rows are dropped — everything is local.
 */
export function PeriodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const currency = settings?.currency ?? 'EUR';
  const { today, cycleStartDay, period, goToCycle } = usePeriod();

  const oldest =
    previousCycles(period.range, cycleStartDay, LOOKBACK).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(oldest, period.range.end);

  const cycles = useMemo(() => {
    const past = cycleHistory(rows, period.range, cycleStartDay, LOOKBACK);
    return [
      { cycle: period.range, txs: rows.filter((tx) => tx.date >= period.range.start) },
      ...past,
    ];
  }, [rows, period.range, cycleStartDay]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('period.title')}>
      <View>
        {cycles.map((entry) => {
          const isCurrent = today >= entry.cycle.start && today <= entry.cycle.end;
          const spent = summarizePeriod(entry.txs, entry.cycle, today).spent;
          return (
            <ListRow
              key={entry.cycle.start}
              title={formatCycleRange(entry.cycle, locale)}
              subtitle={
                isCurrent
                  ? t('period.inProgress', {
                      elapsed: elapsedDays(entry.cycle, today),
                      length: cycleLength(entry.cycle),
                    })
                  : t('period.spent', { amount: formatMoney(spent, currency, locale) })
              }
              onPress={() => {
                goToCycle(entry.cycle);
                onClose();
              }}
            />
          );
        })}
        {cycles.length === 1 ? (
          <Text size="footnote" color="textFaint" style={{ paddingVertical: 8 }}>
            {t('transactions.empty')}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
```

- [x] **Step 4: `MaterialiserGate.tsx`**

```tsx
import { type ReactNode, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { db } from '../../db/client';
import { useDatabase } from '../../db/DatabaseProvider';
import { useSettings } from '../../db/hooks';
import { runMaterialiser } from '../../db/recurrenceService';
import { usePeriod } from './PeriodProvider';

/**
 * Runs the recurrence materialiser on app start and on every return to the foreground (§5.9).
 * It is idempotent, so re-running is free; the sync pull and recurrence writes trigger it too,
 * from their own call sites.
 */
export function MaterialiserGate({ children }: { children: ReactNode }) {
  const { repos } = useDatabase();
  const settings = useSettings();
  const { today, cycleStartDay } = usePeriod();
  const ready = settings !== null && settings.onboardingCompletedAt !== null;
  const lastRun = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const run = () => {
      runMaterialiser(db, repos, today, cycleStartDay);
      lastRun.current = today;
    };
    if (lastRun.current !== today) run();
    const onChange = (status: AppStateStatus) => {
      if (status === 'active') run();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [ready, repos, today, cycleStartDay]);

  return <>{children}</>;
}
```

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/features/period
git commit -m "feat(mobile): add the period provider, header and sheet"
```

---

### Task 5: Transaction form rules

Spec §6.16, §5.10. All the decisions the form makes are pure functions, so they are tested without
rendering anything.

**Files:**
- Create: `apps/mobile/src/features/transactions/useTransactionForm.ts`
- Test: `apps/mobile/src/features/transactions/useTransactionForm.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import type { Category, Transaction } from '@saldo/core';
import {
  canCreateTag,
  canSave,
  changeKind,
  dateChoices,
  emptyForm,
  formFromTransaction,
  type TransactionFormValues,
  tagSuggestions,
  topCategories,
  toTransactionInput,
} from './useTransactionForm';

const TODAY = '2026-04-18';

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

const valid: TransactionFormValues = {
  ...emptyForm(TODAY, 'acc-1'),
  buffer: '45',
  categoryId: 'cat-1',
};

describe('canSave', () => {
  it('needs an amount above zero', () => {
    expect(canSave(valid, 2)).toBe(true);
    expect(canSave({ ...valid, buffer: '' }, 2)).toBe(false);
    expect(canSave({ ...valid, buffer: '0' }, 2)).toBe(false);
    expect(canSave({ ...valid, buffer: '0.00' }, 2)).toBe(false);
  });

  it('needs an account', () => {
    expect(canSave({ ...valid, accountId: null }, 2)).toBe(false);
  });

  it('needs a category unless it is a transfer', () => {
    expect(canSave({ ...valid, categoryId: null }, 2)).toBe(false);
    expect(canSave({ ...valid, kind: 'transfer', categoryId: null, toAccountId: 'acc-2' }, 2)).toBe(
      true,
    );
  });

  it('needs a transfer to go somewhere else', () => {
    const transfer: TransactionFormValues = {
      ...valid,
      kind: 'transfer',
      categoryId: null,
      toAccountId: null,
    };
    expect(canSave(transfer, 2)).toBe(false);
    expect(canSave({ ...transfer, toAccountId: 'acc-1' }, 2)).toBe(false);
    expect(canSave({ ...transfer, toAccountId: 'acc-2' }, 2)).toBe(true);
  });

  it('reads the amount at the currency scale', () => {
    // "0.5" is 50 cents at scale 2 but rounds to nothing at scale 0.
    expect(canSave({ ...valid, buffer: '0.5' }, 2)).toBe(true);
    expect(canSave({ ...valid, buffer: '0.5' }, 0)).toBe(false);
  });
});

describe('changeKind', () => {
  it('clears the field the new kind cannot hold', () => {
    const transfer = changeKind({ ...valid, toAccountId: 'acc-2' }, 'transfer');
    expect(transfer.categoryId).toBeNull();
    const expense = changeKind({ ...valid, kind: 'transfer', toAccountId: 'acc-2' }, 'expense');
    expect(expense.toAccountId).toBeNull();
  });
});

describe('toTransactionInput', () => {
  it('keeps the schema invariant for an expense', () => {
    const input = toTransactionInput(valid, 2);
    expect(input).toMatchObject({
      kind: 'expense',
      amount: 4500,
      toAccountId: null,
      categoryId: 'cat-1',
      note: null,
    });
  });

  it('keeps the schema invariant for a transfer', () => {
    const input = toTransactionInput(
      { ...valid, kind: 'transfer', categoryId: 'cat-1', toAccountId: 'acc-2' },
      2,
    );
    expect(input.categoryId).toBeNull();
    expect(input.toAccountId).toBe('acc-2');
  });

  it('trims the description', () => {
    expect(toTransactionInput({ ...valid, description: '  Bar  ' }, 2).description).toBe('Bar');
  });
});

describe('formFromTransaction', () => {
  it('round-trips an amount through the buffer', () => {
    const transaction = {
      ...toTransactionInput(valid, 2),
      id: 't1',
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '001775000000000-0000-dev',
      deletedAt: null,
      recurrenceId: null,
    } satisfies Transaction;
    const form = formFromTransaction(transaction, 2);
    expect(form.buffer).toBe('45');
    expect(form.repeat).toBe(false);
    expect(toTransactionInput(form, 2).amount).toBe(4500);
  });

  it('marks an occurrence as repeating', () => {
    const transaction = {
      ...toTransactionInput(valid, 2),
      id: 'rec:2026-04-18',
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '001775000000000-0000-dev',
      deletedAt: null,
      recurrenceId: 'rec',
    } satisfies Transaction;
    expect(formFromTransaction(transaction, 2).repeat).toBe(true);
  });
});

describe('dateChoices', () => {
  it('offers today and yesterday', () => {
    expect(dateChoices(TODAY)).toEqual([
      { key: 'today', date: '2026-04-18' },
      { key: 'yesterday', date: '2026-04-17' },
    ]);
  });
});

describe('topCategories', () => {
  const categories = [
    category('cat-rare', { sortOrder: 0 }),
    category('cat-often', { sortOrder: 1 }),
    category('cat-income', { direction: 'income', sortOrder: 2 }),
    category('cat-archived', { archivedAt: '2026-01-01T00:00:00.000Z', sortOrder: 3 }),
  ];
  const usage = [
    { categoryId: 'cat-often' },
    { categoryId: 'cat-often' },
    { categoryId: 'cat-rare' },
  ];

  it('orders by usage, then by the manual order', () => {
    expect(topCategories(categories, usage, 'expense').map((c) => c.id)).toEqual([
      'cat-often',
      'cat-rare',
    ]);
  });

  it('shows income categories for income', () => {
    expect(topCategories(categories, usage, 'income').map((c) => c.id)).toEqual(['cat-income']);
  });

  it('hides archived categories', () => {
    expect(topCategories(categories, usage, 'expense').map((c) => c.id)).not.toContain(
      'cat-archived',
    );
  });

  it('caps the grid', () => {
    const many = Array.from({ length: 20 }, (_, index) => category(`c${index}`));
    expect(topCategories(many, [], 'expense')).toHaveLength(10);
  });
});

describe('tagSuggestions / canCreateTag', () => {
  const tags = [
    { id: 't-work', name: 'Lavoro' },
    { id: 't-holiday', name: 'Vacanza' },
    { id: 't-gift', name: 'Regalo' },
  ];
  const usage = [{ tagIds: ['t-holiday'] }, { tagIds: ['t-holiday'] }, { tagIds: ['t-work'] }];

  it('orders by usage when nothing is typed', () => {
    expect(tagSuggestions(tags, usage, '', []).map((tag) => tag.id)).toEqual([
      't-holiday',
      't-work',
      't-gift',
    ]);
  });

  it('filters by what was typed, case-insensitively', () => {
    expect(tagSuggestions(tags, usage, 'vac', []).map((tag) => tag.id)).toEqual(['t-holiday']);
    expect(tagSuggestions(tags, usage, 'LAV', []).map((tag) => tag.id)).toEqual(['t-work']);
  });

  it('hides tags already on the transaction', () => {
    expect(tagSuggestions(tags, usage, '', ['t-holiday']).map((tag) => tag.id)).toEqual([
      't-work',
      't-gift',
    ]);
  });

  it('offers creation only for a name that does not exist', () => {
    expect(canCreateTag(tags, 'Nuovo')).toBe(true);
    expect(canCreateTag(tags, 'vacanza')).toBe(false);
    expect(canCreateTag(tags, '  Vacanza  ')).toBe(false);
    expect(canCreateTag(tags, '   ')).toBe(false);
  });
});
```

- [x] **Step 2: Implement the rules**

```ts
import {
  addDays,
  amountBufferToMinor,
  type Category,
  type LocalDate,
  type MinorDigits,
  minorToAmountBuffer,
  type Transaction,
  type TransactionKind,
} from '@saldo/core';

export interface TransactionFormValues {
  kind: TransactionKind;
  buffer: string;
  date: LocalDate;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  tagIds: string[];
  excludeFromTotals: boolean;
  repeat: boolean;
}

export function emptyForm(today: LocalDate, accountId: string | null): TransactionFormValues {
  return {
    kind: 'expense',
    buffer: '',
    date: today,
    accountId,
    toAccountId: null,
    categoryId: null,
    description: '',
    tagIds: [],
    excludeFromTotals: false,
    repeat: false,
  };
}

export function formFromTransaction(
  transaction: Transaction,
  minorDigits: MinorDigits,
): TransactionFormValues {
  return {
    kind: transaction.kind,
    buffer: minorToAmountBuffer(transaction.amount, minorDigits),
    date: transaction.date,
    accountId: transaction.accountId,
    toAccountId: transaction.toAccountId,
    categoryId: transaction.categoryId,
    description: transaction.description,
    tagIds: [...transaction.tagIds],
    excludeFromTotals: transaction.excludeFromTotals,
    repeat: transaction.recurrenceId !== null,
  };
}

/**
 * §6.16: save is disabled until the amount is above zero, an account is chosen, a non-transfer has
 * a category, and a transfer has a different destination.
 */
export function canSave(values: TransactionFormValues, minorDigits: MinorDigits): boolean {
  if (amountBufferToMinor(values.buffer, minorDigits) <= 0) return false;
  if (values.accountId === null) return false;
  if (values.kind === 'transfer') {
    return values.toAccountId !== null && values.toAccountId !== values.accountId;
  }
  return values.categoryId !== null;
}

/**
 * The fields a transaction write needs. Transfers carry no category and expenses/income no
 * destination, which is the invariant `transactionSchema` enforces.
 */
export function toTransactionInput(
  values: TransactionFormValues,
  minorDigits: MinorDigits,
): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'recurrenceId'> {
  const isTransfer = values.kind === 'transfer';
  return {
    kind: values.kind,
    amount: amountBufferToMinor(values.buffer, minorDigits),
    date: values.date,
    accountId: values.accountId ?? '',
    toAccountId: isTransfer ? values.toAccountId : null,
    categoryId: isTransfer ? null : values.categoryId,
    description: values.description.trim(),
    note: null,
    tagIds: values.tagIds,
    excludeFromTotals: values.excludeFromTotals,
  };
}

/** Switching kind clears the fields the new kind cannot hold, so save stays reachable. */
export function changeKind(
  values: TransactionFormValues,
  kind: TransactionKind,
): TransactionFormValues {
  if (kind === 'transfer') return { ...values, kind, categoryId: null };
  return { ...values, kind, toAccountId: null };
}

/** Date chips of §6.16. */
export function dateChoices(today: LocalDate): { key: 'today' | 'yesterday'; date: LocalDate }[] {
  return [
    { key: 'today', date: today },
    { key: 'yesterday', date: addDays(today, -1) },
  ];
}

/**
 * The category grid shows the ten most-used categories of the right direction, then "Altro" opens
 * the full picker (§6.16). Usage is counted over the rows the screen already loaded.
 */
export function topCategories(
  categories: readonly Category[],
  transactions: readonly Pick<Transaction, 'categoryId'>[],
  kind: TransactionKind,
  limit = 10,
): Category[] {
  const direction = kind === 'income' ? 'income' : 'expense';
  const usage = new Map<string, number>();
  for (const tx of transactions) {
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

/** Tag suggestions for the inline input: name match first, then usage (§5.10). */
export function tagSuggestions(
  tags: readonly { id: string; name: string }[],
  transactions: readonly Pick<Transaction, 'tagIds'>[],
  query: string,
  selected: readonly string[],
  limit = 6,
): { id: string; name: string }[] {
  const normalized = query.trim().toLowerCase();
  const usage = new Map<string, number>();
  for (const tx of transactions) {
    for (const id of tx.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return tags
    .filter((tag) => !selected.includes(tag.id))
    .filter((tag) => normalized.length === 0 || tag.name.toLowerCase().includes(normalized))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))
    .slice(0, limit);
}

/** Whether the typed name is new, so the input can offer "Crea «X»" (§5.10). */
export function canCreateTag(tags: readonly { name: string }[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return !tags.some((tag) => tag.name.trim().toLowerCase() === normalized);
}
```

- [x] **Step 3: Run and commit**

```bash
pnpm --filter mobile test src/features/transactions
git add apps/mobile/src/features/transactions
git commit -m "feat(mobile): add the transaction form rules"
```

---

### Task 6: Screens

Spec §6.1, §6.2, §6.6, §6.16, §6.21, §6.23. These are presentation over the pieces above.

**Files:** `app/(tabs)/index.tsx`, `app/(tabs)/transactions.tsx`, `app/transaction/[id].tsx`,
`app/transaction/new.tsx`, `app/transaction/edit/[id].tsx`,
`src/features/home/CycleTrendChart.tsx`, `src/features/transactions/{TransactionForm,SwipeRow,RecurrenceScopeSheet,TagFilterSheet}.tsx`,
plus the `Chip`, `ListRow`, `Sheet`, `ConfirmDialog`, `Toast` and `Toggle` primitives.

- [x] **Step 1: The cycle trend chart (§5.6)**

```tsx
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

export interface CycleTrendChartProps {
  /** Cumulative counted expenses per elapsed day (§5.6). */
  current: readonly number[];
  /** Average of the previous three cycles, resampled to the current length. */
  usual: readonly number[];
  height?: number;
}

function points(series: readonly number[], width: number, height: number, max: number): string {
  if (series.length === 0) return '';
  const step = series.length === 1 ? 0 : width / (series.length - 1);
  return series
    .map((value, index) => {
      const x = series.length === 1 ? width / 2 : index * step;
      const y = height - (max === 0 ? 0 : (value / max) * height);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * "Andamento del ciclo" (§5.6): grey `usual` behind, accent `current` in front, with a dot at the
 * last point. Drawn with SVG polylines, so it needs no charting dependency.
 */
export function CycleTrendChart({ current, usual, height = 96 }: CycleTrendChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const max = Math.max(1, ...current, ...usual);
  const last = current[current.length - 1] ?? 0;
  const lastX = current.length <= 1 ? width / 2 : width;
  const lastY = height - (last / max) * height;

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
    >
      {width === 0 ? null : (
        <Svg width={width} height={height}>
          {usual.length > 0 ? (
            <Polyline
              points={points(usual, width, height, max)}
              fill="none"
              stroke={theme.palette.borderStrong}
              strokeWidth={1.5}
            />
          ) : null}
          {current.length > 0 ? (
            <Polyline
              points={points(current, width, height, max)}
              fill="none"
              stroke={theme.palette.accent}
              strokeWidth={2}
            />
          ) : null}
          {current.length > 0 ? (
            <Circle cx={lastX} cy={lastY} r={3} fill={theme.palette.accent} />
          ) : null}
        </Svg>
      )}
    </View>
  );
}
```

- [x] **Step 2: Home (§6.1)**

```tsx
import {
  averageSeries,
  cycleHistory,
  dailyCumulative,
  isUpcoming,
  previousCycles,
  summarizePeriod,
} from '@saldo/core';
import { formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { Card } from '../../src/components/Card';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Screen } from '../../src/components/Screen';
import { useCategories, useSettings, useTransactionsInRange } from '../../src/db/hooks';
import { CycleTrendChart } from '../../src/features/home/CycleTrendChart';
import { DevTools } from '../../src/features/home/DevTools';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** How many previous cycles the "usual" line averages (§5.6). */
const USUAL_CYCLES = 3;

export default function HomeTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const settings = useSettings();
  const categories = useCategories();
  const { today, cycleStartDay, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  // Load the selected cycle plus the previous six, which is all the baselines need (§7).
  const historyStart =
    previousCycles(period.range, cycleStartDay, 6).at(-1)?.start ?? period.range.start;
  const rows = useTransactionsInRange(historyStart, period.range.end);

  const summary = useMemo(
    () => summarizePeriod(rows, period.range, today),
    [rows, period.range, today],
  );
  const current = useMemo(
    () => dailyCumulative(rows, period.range, today),
    [rows, period.range, today],
  );
  const usual = useMemo(() => {
    const history = cycleHistory(rows, period.range, cycleStartDay, USUAL_CYCLES);
    return averageSeries(
      history.map((entry) => dailyCumulative(entry.txs, entry.cycle, today)),
      Math.max(1, current.length),
    );
  }, [rows, period.range, cycleStartDay, today, current.length]);

  const upcoming = useMemo(
    () => rows.filter((tx) => isUpcoming(tx, today) && tx.date <= period.range.end),
    [rows, today, period.range.end],
  );
  const recent = useMemo(
    () => rows.filter((tx) => !isUpcoming(tx, today) && tx.date >= period.range.start).slice(0, 5),
    [rows, today, period.range.start],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const rowFor = (id: string) => {
    const category = categoryById.get(id);
    return {
      icon: (category?.icon ?? 'tag') as IconName,
      colour: theme.categoryColor(category?.colorIndex ?? 9),
      name: category?.name ?? '—',
    };
  };

  return (
    <Screen underTabBar>
      <PeriodHeader />

      <Card>
        <Text size="footnote" color="textMuted">
          {period.isCurrent ? t('home.remaining') : t('home.leftover')}
        </Text>
        <AmountText
          minor={summary.remaining}
          currency={currency}
          locale={locale}
          size="hero"
          weight="semibold"
          tracking="tightest"
          style={{ marginTop: 2 }}
        />
        <View style={{ marginTop: 14 }}>
          <ProgressBar
            ratio={summary.ratio}
            pace={period.isCurrent ? summary.pace : undefined}
            overPace={summary.overPace}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Text size="footnote" color="textMuted">
            {`${t('home.income')} ${formatMoney(summary.income, currency, locale)}`}
          </Text>
          <Text size="footnote" color="textMuted">
            {`${t('home.expenses')} ${formatMoney(summary.spent, currency, locale)}`}
          </Text>
        </View>
      </Card>

      <Card>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <Text weight="medium" tracking="tight">
            {t('home.cycleTrend')}
          </Text>
          <AmountText
            minor={current[current.length - 1] ?? 0}
            currency={currency}
            locale={locale}
            weight="medium"
          />
        </View>
        <View style={{ marginTop: 12 }}>
          <CycleTrendChart current={current} usual={usual} />
        </View>
        <Text size="caption" color="textFaint" style={{ marginTop: 8 }}>
          {t('home.trendFooter', { elapsed: period.elapsed, length: period.length })}
        </Text>
      </Card>

      {upcoming.length === 0 ? null : (
        <Card padded={false}>
          <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
            <Text weight="medium" tracking="tight">
              {t('home.upcoming')}
            </Text>
          </View>
          <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
            {upcoming.map((tx) => {
              const meta = rowFor(tx.categoryId ?? '');
              return (
                <ListRow
                  key={tx.id}
                  upcoming
                  title={tx.description.length > 0 ? tx.description : meta.name}
                  subtitle={meta.name}
                  leading={<IconBox name={meta.icon} colour={meta.colour} />}
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                  trailing={
                    <AmountText
                      minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                      currency={currency}
                      locale={locale}
                      color="textMuted"
                    />
                  }
                />
              );
            })}
          </View>
        </Card>
      )}

      <Card padded={false}>
        <View style={{ padding: theme.layout.cardPadding, paddingBottom: 4 }}>
          <Text weight="medium" tracking="tight">
            {t('home.recent')}
          </Text>
        </View>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
          {recent.length === 0 ? (
            <Text color="textMuted" style={{ paddingVertical: 12 }}>
              {t('transactions.empty')}
            </Text>
          ) : (
            recent.map((tx) => {
              const meta = rowFor(tx.categoryId ?? '');
              return (
                <ListRow
                  key={tx.id}
                  title={tx.description.length > 0 ? tx.description : meta.name}
                  subtitle={meta.name}
                  leading={<IconBox name={meta.icon} colour={meta.colour} />}
                  onPress={() =>
                    router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                  }
                  trailing={
                    <AmountText
                      minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                      currency={currency}
                      locale={locale}
                      signDisplay={tx.kind === 'income' ? 'always' : 'negative'}
                    />
                  }
                />
              );
            })
          )}
        </View>
      </Card>

      <DevTools />
    </Screen>
  );
}
```

- [x] **Step 3: The swipe row (§5.12)**

```tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '../../theme/Icon';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';

export interface SwipeRowProps {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onPress: () => void;
  editLabel: string;
  deleteLabel: string;
}

/**
 * §5.12: drag right past 70px edits, drag left past it deletes, travel is capped at 120px and a
 * release below the threshold snaps back in 240ms. The reveal's opacity tracks `|dx| / 70`.
 */
export function SwipeRow({
  children,
  onEdit,
  onDelete,
  onPress,
  editLabel,
  deleteLabel,
}: SwipeRowProps) {
  const theme = useTheme();
  const { swipeActionThreshold, swipeMaxTravel, tapSlop } = theme.gestures;
  const dx = useSharedValue(0);

  const snapBack = () => {
    dx.value = withTiming(0, { duration: theme.motion.snapBackMs });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      dx.value = Math.max(-swipeMaxTravel, Math.min(swipeMaxTravel, event.translationX));
    })
    .onEnd(() => {
      if (dx.value >= swipeActionThreshold) runOnJS(onEdit)();
      else if (dx.value <= -swipeActionThreshold) runOnJS(onDelete)();
      runOnJS(snapBack)();
    });

  const tap = Gesture.Tap()
    .maxDistance(tapSlop)
    .onEnd(() => runOnJS(onPress)());

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const editStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, dx.value) / swipeActionThreshold),
  }));
  const deleteStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -dx.value) / swipeActionThreshold),
  }));

  return (
    <View>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, editStyle]}>
          <Icon name="pencil" size={16} color={theme.palette.textMuted} />
          <Text size="footnote" color="textMuted">
            {editLabel}
          </Text>
        </Animated.View>
        <Animated.View
          style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, deleteStyle]}
        >
          <Text size="footnote" color="accent">
            {deleteLabel}
          </Text>
          <Icon name="trash" size={16} color={theme.palette.accent} />
        </Animated.View>
      </View>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <Animated.View style={[{ backgroundColor: theme.palette.surface }, rowStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
```

- [x] **Step 4: The transactions list (§6.2)**

```tsx
import {
  EMPTY_FILTERS,
  type FilterLookup,
  filterTransactions,
  groupByDay,
  hasActiveFilters,
  type TransactionFilters,
} from '@saldo/core';
import { formatDayMonth, formatMoney } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { SecondaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { IconBox, ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { useToast } from '../../src/components/Toast';
import { useRepositories } from '../../src/db/DatabaseProvider';
import {
  useAccounts,
  useCategories,
  useSettings,
  useTags,
  useTransactionsInRange,
} from '../../src/db/hooks';
import { PeriodHeader } from '../../src/features/period/PeriodHeader';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { SwipeRow } from '../../src/features/transactions/SwipeRow';
import { TagFilterSheet } from '../../src/features/transactions/TagFilterSheet';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function TransactionsTab() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const toast = useToast();
  const settings = useSettings();
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const { today, period } = usePeriod();
  const currency = settings?.currency ?? 'EUR';

  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const rows = useTransactionsInRange(period.range.start, period.range.end);

  const lookup = useMemo<FilterLookup>(() => {
    const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const parents = new Map(categories.map((category) => [category.id, category.parentId]));
    return {
      accountName: (id) => accountNames.get(id) ?? '',
      categoryName: (id) => categoryNames.get(id) ?? '',
      categoryParentId: (id) => parents.get(id) ?? null,
    };
  }, [accounts, categories]);

  const groups = useMemo(
    () => groupByDay(filterTransactions(rows, filters, lookup)),
    [rows, filters, lookup],
  );

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const set = (patch: Partial<TransactionFilters>) => setFilters({ ...filters, ...patch });
  const active = hasActiveFilters(filters);

  const confirmDelete = () => {
    if (pendingDelete === null) return;
    const { id, name } = pendingDelete;
    repos.transactions.remove(id);
    setPendingDelete(null);
    toast.show(t('transactions.deleted', { name }), {
      label: t('common.undo'),
      onPress: () => repos.transactions.restore(id),
    });
  };

  return (
    <Screen scroll={false} underTabBar>
      <PeriodHeader />
      <TextField
        label={t('transactions.searchPlaceholder')}
        placeholder={t('transactions.searchPlaceholder')}
        value={filters.query}
        onChangeText={(query) => set({ query })}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        <Chip
          label={t('transactions.onlyExpenses')}
          active={filters.direction === 'expense'}
          onPress={() => set({ direction: filters.direction === 'expense' ? 'all' : 'expense' })}
        />
        <Chip
          label={t('transactions.onlyIncome')}
          active={filters.direction === 'income'}
          onPress={() => set({ direction: filters.direction === 'income' ? 'all' : 'income' })}
        />
        <Chip
          label={t('transactions.tags')}
          active={filters.tagIds.length > 0}
          chevron
          onPress={() => setTagSheetOpen(true)}
        />
        <Chip
          label={t('transactions.onlyExcluded')}
          active={filters.onlyExcluded}
          onPress={() => set({ onlyExcluded: !filters.onlyExcluded })}
        />
      </ScrollView>

      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
        {groups.length === 0 ? (
          <Card>
            <Text color="textMuted">
              {active ? t('transactions.noResults') : t('transactions.empty')}
            </Text>
            <View style={{ marginTop: 12 }}>
              <SecondaryButton
                label={active ? t('transactions.resetFilters') : t('transactions.newTransaction')}
                onPress={() =>
                  active ? setFilters(EMPTY_FILTERS) : router.push('/transaction/new')
                }
              />
            </View>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.date} padded={false}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  padding: theme.layout.cardPadding,
                  paddingBottom: 4,
                }}
              >
                <Text size="footnote" color="textMuted">
                  {formatDayMonth(group.date, locale)}
                </Text>
                <Text size="footnote" color="textMuted" tabular>
                  {formatMoney(group.expenseTotal, currency, locale)}
                </Text>
              </View>
              <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingBottom: 8 }}>
                {group.items.map((tx) => {
                  const category = categoryById.get(tx.categoryId ?? '');
                  const colour = theme.categoryColor(category?.colorIndex ?? 9);
                  const name = category?.name ?? t(`kinds.${tx.kind}`);
                  const rowTags = tags.filter((tag) => tx.tagIds.includes(tag.id));
                  return (
                    <SwipeRow
                      key={tx.id}
                      editLabel={t('common.edit')}
                      deleteLabel={t('common.delete')}
                      onPress={() =>
                        router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })
                      }
                      onEdit={() =>
                        router.push({ pathname: '/transaction/edit/[id]', params: { id: tx.id } })
                      }
                      onDelete={() =>
                        setPendingDelete({
                          id: tx.id,
                          name: tx.description.length > 0 ? tx.description : name,
                        })
                      }
                    >
                      <ListRow
                        title={tx.description.length > 0 ? tx.description : name}
                        subtitle={
                          filters.tagIds.length > 0 && rowTags.length > 0
                            ? rowTags.map((tag) => tag.name).join(' · ')
                            : name
                        }
                        leading={
                          <IconBox name={(category?.icon ?? 'swap') as IconName} colour={colour} />
                        }
                        upcoming={tx.date > today}
                        trailing={
                          <AmountText
                            minor={tx.kind === 'income' ? tx.amount : -tx.amount}
                            currency={currency}
                            locale={locale}
                            signDisplay={tx.kind === 'income' ? 'always' : 'negative'}
                          />
                        }
                      />
                    </SwipeRow>
                  );
                })}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <TagFilterSheet
        visible={tagSheetOpen}
        onClose={() => setTagSheetOpen(false)}
        selected={filters.tagIds}
        onChange={(tagIds) => set({ tagIds })}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('transactions.deleteTitle', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}
```

- [x] **Step 5: The form (§6.16)**

```tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { amountBufferToMinor, getCurrency } from '@saldo/core';
import { formatLongDate } from '@saldo/i18n';
import type { IconName } from '@saldo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { AmountInput } from '../../components/AmountInput';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { IconBox } from '../../components/ListRow';
import { Screen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { Toggle } from '../../components/Toggle';
import { useRepositories } from '../../db/DatabaseProvider';
import {
  useAccounts,
  useCategories,
  useSettings,
  useTags,
  useTransactionsInRange,
} from '../../db/hooks';
import { useAppLocale } from '../../i18n/useAppLocale';
import { Text } from '../../theme/Text';
import { useTheme } from '../../theme/ThemeProvider';
import {
  canCreateTag,
  canSave,
  changeKind,
  dateChoices,
  type TransactionFormValues,
  tagSuggestions,
  topCategories,
} from './useTransactionForm';

export interface TransactionFormProps {
  /** Captured once by the caller so every screen agrees on the calendar day (§3.2). */
  today: string;
  values: TransactionFormValues;
  onChange: (values: TransactionFormValues) => void;
  /** Edit mode opens with the keypad closed and a full-width save button (§6.16). */
  mode: 'new' | 'edit';
  onSubmit: () => void;
  onDelete?: () => void;
  submitting?: boolean;
}

const KINDS = ['expense', 'income', 'transfer'] as const;

export function TransactionForm({
  today,
  values,
  onChange,
  mode,
  onSubmit,
  onDelete,
  submitting = false,
}: TransactionFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const repos = useRepositories();
  const settings = useSettings();
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const currency = settings?.currency ?? 'EUR';
  const { minorDigits } = getCurrency(currency);

  const [showAllCategories, setShowAllCategories] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');

  // Usage counts come from the last year of rows, which is enough to rank categories and tags.
  const recent = useTransactionsInRange('1970-01-01', values.date);
  const grid = useMemo(
    () =>
      showAllCategories
        ? categories.filter(
            (category) =>
              category.direction === (values.kind === 'income' ? 'income' : 'expense') &&
              category.archivedAt === null,
          )
        : topCategories(categories, recent, values.kind),
    [categories, recent, values.kind, showAllCategories],
  );
  const suggestions = useMemo(
    () => tagSuggestions(tags, recent, tagQuery, values.tagIds),
    [tags, recent, tagQuery, values.tagIds],
  );

  const liveAccounts = accounts.filter((account) => account.archivedAt === null);
  const _amount = amountBufferToMinor(values.buffer, minorDigits);
  const ready = canSave(values, minorDigits);

  const set = (patch: Partial<TransactionFormValues>) => onChange({ ...values, ...patch });

  const accountRow = (label: string, selectedId: string | null, onSelect: (id: string) => void) => (
    <View style={{ gap: 6 }}>
      <Text size="footnote" color="textMuted">
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {liveAccounts.map((account) => (
          <Chip
            key={account.id}
            label={account.name}
            active={account.id === selectedId}
            onPress={() => onSelect(account.id)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          <PrimaryButton
            label={mode === 'new' ? t('txForm.create') : t('txForm.save')}
            disabled={!ready}
            loading={submitting}
            onPress={onSubmit}
          />
          {onDelete === undefined ? null : (
            <SecondaryButton label={t('common.delete')} onPress={onDelete} />
          )}
        </View>
      }
    >
      <Text size="headline" weight="semibold" tracking="tight">
        {mode === 'new' ? t('txForm.newTitle') : t('txForm.editTitle')}
      </Text>

      <Segmented
        accessibilityLabel={t('txForm.amount')}
        options={KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
        value={values.kind}
        onChange={(kind) => onChange(changeKind(values, kind))}
      />

      <Card>
        <Text size="footnote" color="textMuted">
          {t('txForm.amount')}
        </Text>
        <View style={{ marginTop: 6 }}>
          <AmountInput
            buffer={values.buffer}
            onChange={(buffer: string) => set({ buffer })}
            currency={currency}
            locale={locale}
            autoFocus={mode === 'new'}
            doneLabel={t('common.done')}
          />
        </View>
      </Card>

      {values.kind === 'transfer' ? (
        <Card>
          <View style={{ gap: 14 }}>
            {accountRow(t('txForm.from'), values.accountId, (id) => set({ accountId: id }))}
            {accountRow(t('txForm.to'), values.toAccountId, (id) => set({ toAccountId: id }))}
          </View>
        </Card>
      ) : (
        <>
          <Card>
            <Text size="footnote" color="textMuted">
              {t('txForm.category')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {grid.map((category) => {
                const selected = category.id === values.categoryId;
                const colour = theme.categoryColor(category.colorIndex);
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={category.name}
                    onPress={() => set({ categoryId: category.id })}
                    style={{
                      width: '22%',
                      alignItems: 'center',
                      gap: 5,
                      paddingVertical: 10,
                      borderRadius: theme.radii.input,
                      borderWidth: 1,
                      borderColor: selected ? theme.palette.borderStrong : 'transparent',
                      backgroundColor: selected ? theme.tint(colour, 0.14) : 'transparent',
                    }}
                  >
                    <IconBox name={category.icon as IconName} colour={colour} small />
                    <Text size="caption" numberOfLines={1}>
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
              {showAllCategories ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllCategories(true)}
                  style={{
                    width: '22%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 10,
                  }}
                >
                  <Text size="caption" color="accent">
                    {t('txForm.otherCategory')}
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>
          <Card>
            {accountRow(t('txForm.account'), values.accountId, (id) => set({ accountId: id }))}
          </Card>
        </>
      )}

      <Card>
        <View style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text size="footnote" color="textMuted">
              {t('txForm.date')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              {dateChoices(today).map((choice) => (
                <Chip
                  key={choice.key}
                  label={t(`txForm.${choice.key}`)}
                  active={values.date === choice.date}
                  onPress={() => set({ date: choice.date })}
                />
              ))}
              <Chip
                label={formatLongDate(values.date, locale)}
                onPress={() => setDatePickerOpen(true)}
                chevron
              />
            </View>
          </View>
          <TextField
            label={t('txForm.description')}
            placeholder={
              values.kind === 'income'
                ? t('txForm.descriptionIncome')
                : t('txForm.descriptionExpense')
            }
            value={values.description}
            onChangeText={(description) => set({ description })}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: 10 }}>
          <TextField
            label={t('transactions.tags')}
            placeholder={t('txForm.tagsPlaceholder')}
            value={tagQuery}
            onChangeText={setTagQuery}
          />
          {values.tagIds.length === 0 ? null : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {values.tagIds.map((id) => {
                const tag = tags.find((candidate) => candidate.id === id);
                return (
                  <Chip
                    key={id}
                    label={tag?.name ?? id}
                    active
                    onPress={() => set({ tagIds: values.tagIds.filter((value) => value !== id) })}
                  />
                );
              })}
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                onPress={() => {
                  set({ tagIds: [...values.tagIds, tag.id] });
                  setTagQuery('');
                }}
              />
            ))}
            {canCreateTag(tags, tagQuery) ? (
              <Chip
                label={t('txForm.createTag', { name: tagQuery.trim() })}
                onPress={() => {
                  const created = repos.tags.create({ name: tagQuery.trim() });
                  set({ tagIds: [...values.tagIds, created.id] });
                  setTagQuery('');
                }}
              />
            ) : null}
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 14 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text>{t('txForm.attachments')}</Text>
            <Text size="footnote" color="textFaint">
              {t('txForm.attachmentsSoon')}
            </Text>
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text>{t('txForm.repeat')}</Text>
            <Toggle
              value={values.repeat}
              onChange={(repeat) => set({ repeat })}
              accessibilityLabel={t('txForm.repeat')}
            />
          </View>
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text>{t('txForm.exclude')}</Text>
              <Toggle
                value={values.excludeFromTotals}
                onChange={(excludeFromTotals) => set({ excludeFromTotals })}
                accessibilityLabel={t('txForm.exclude')}
              />
            </View>
            <Text size="caption" color="textFaint" style={{ marginTop: 4 }}>
              {t('txForm.excludeNote')}
            </Text>
          </View>
        </View>
      </Card>

      {datePickerOpen ? (
        <DateTimePicker
          value={new Date(`${values.date}T12:00:00`)}
          mode="date"
          onChange={(_event, selected) => {
            setDatePickerOpen(false);
            if (selected === undefined) return;
            const year = selected.getFullYear();
            const month = String(selected.getMonth() + 1).padStart(2, '0');
            const day = String(selected.getDate()).padStart(2, '0');
            set({ date: `${year}-${month}-${day}` });
          }}
        />
      ) : null}
    </Screen>
  );
}
```

- [x] **Step 6: New and edit routes, and the scope sheet (§6.21)**

```tsx
import { getCurrency } from '@saldo/core';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { db } from '../../src/db/client';
import { useDatabase } from '../../src/db/DatabaseProvider';
import { useAccounts, useSettings } from '../../src/db/hooks';
import { startRecurrence } from '../../src/db/recurrenceService';
import { usePeriod } from '../../src/features/period/PeriodProvider';
import { TransactionForm } from '../../src/features/transactions/TransactionForm';
import { emptyForm, toTransactionInput } from '../../src/features/transactions/useTransactionForm';

export default function NewTransaction() {
  const router = useRouter();
  const { repos } = useDatabase();
  const settings = useSettings();
  const accounts = useAccounts();
  const { today, cycleStartDay } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');
  const [values, setValues] = useState(() => emptyForm(today, accounts[0]?.id ?? null));
  const [saving, setSaving] = useState(false);

  return (
    <TransactionForm
      today={today}
      values={values}
      onChange={setValues}
      mode="new"
      submitting={saving}
      onSubmit={() => {
        setSaving(true);
        const created = repos.transactions.create({
          ...toTransactionInput(values, minorDigits),
          recurrenceId: null,
        });
        // "Ripeti" turns the saved row into the first occurrence of a new series (§5.9).
        if (values.repeat) startRecurrence(db, repos, created, today, cycleStartDay);
        router.back();
      }}
    />
  );
}
```

```tsx
import { getCurrency } from '@saldo/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../../src/components/Screen';
import { useDatabase } from '../../../src/db/DatabaseProvider';
import { useSettings } from '../../../src/db/hooks';
import { usePeriod } from '../../../src/features/period/PeriodProvider';
import { RecurrenceScopeSheet } from '../../../src/features/transactions/RecurrenceScopeSheet';
import { TransactionForm } from '../../../src/features/transactions/TransactionForm';
import {
  formFromTransaction,
  toTransactionInput,
} from '../../../src/features/transactions/useTransactionForm';
import { Text } from '../../../src/theme/Text';

export default function EditTransaction() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repos } = useDatabase();
  const settings = useSettings();
  const { today, cycleStartDay } = usePeriod();
  const { minorDigits } = getCurrency(settings?.currency ?? 'EUR');

  const [transaction] = useState(() => (id === undefined ? null : repos.transactions.byId(id)));
  const [values, setValues] = useState(() =>
    transaction === null ? null : formFromTransaction(transaction, minorDigits),
  );
  const [scopeOpen, setScopeOpen] = useState(false);

  if (transaction === null || values === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('transactions.empty')}</Text>
      </Screen>
    );
  }

  const save = () => {
    // A recurring occurrence must first ask which occurrences the edit applies to (§5.9).
    if (transaction.recurrenceId !== null) {
      setScopeOpen(true);
      return;
    }
    repos.transactions.update(transaction.id, toTransactionInput(values, minorDigits));
    router.back();
  };

  return (
    <>
      <TransactionForm
        today={today}
        values={values}
        onChange={setValues}
        mode="edit"
        onSubmit={save}
        onDelete={() => {
          repos.transactions.remove(transaction.id);
          router.back();
        }}
      />
      <RecurrenceScopeSheet
        visible={scopeOpen}
        onClose={() => setScopeOpen(false)}
        transaction={transaction}
        values={values}
        minorDigits={minorDigits}
        today={today}
        cycleStartDay={cycleStartDay}
        onDone={() => {
          setScopeOpen(false);
          router.back();
        }}
      />
    </>
  );
}
```

```tsx
import {
  type MinorDigits,
  planRecurrenceEdit,
  type RecurrenceEditScope,
  type Transaction,
} from '@saldo/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ListRow } from '../../components/ListRow';
import { Sheet } from '../../components/Sheet';
import { db } from '../../db/client';
import { useDatabase } from '../../db/DatabaseProvider';
import { applyRecurrenceEdit } from '../../db/recurrenceService';
import { Text } from '../../theme/Text';
import { type TransactionFormValues, toTransactionInput } from './useTransactionForm';

export interface RecurrenceScopeSheetProps {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction;
  values: TransactionFormValues;
  minorDigits: MinorDigits;
  today: string;
  cycleStartDay: number;
  onDone: () => void;
}

const SCOPES: readonly RecurrenceEditScope[] = ['only-this', 'this-and-following', 'all'];

const KEYS: Record<RecurrenceEditScope, { title: string; note: string }> = {
  'only-this': { title: 'recurrenceScope.onlyThis', note: 'recurrenceScope.onlyThisNote' },
  'this-and-following': {
    title: 'recurrenceScope.thisAndFollowing',
    note: 'recurrenceScope.thisAndFollowingNote',
  },
  all: { title: 'recurrenceScope.all', note: 'recurrenceScope.allNote' },
};

/** §6.21 / §5.9. The counts in the notes are real, computed by the core planner. */
export function RecurrenceScopeSheet({
  visible,
  onClose,
  transaction,
  values,
  minorDigits,
  today,
  cycleStartDay,
  onDone,
}: RecurrenceScopeSheetProps) {
  const { t } = useTranslation();
  const { repos } = useDatabase();

  const recurrence =
    transaction.recurrenceId === null ? null : repos.recurrences.byId(transaction.recurrenceId);

  const counts = useMemo(() => {
    if (recurrence === null) return null;
    const occurrences = repos.transactions
      .list()
      .filter((row) => row.recurrenceId === recurrence.id)
      .map((row) => ({ id: row.id, date: row.date }));
    return Object.fromEntries(
      SCOPES.map((scope) => [
        scope,
        planRecurrenceEdit(scope, {
          recurrence,
          occurrenceDate: transaction.date,
          occurrences,
          today,
        }),
      ]),
    ) as Record<RecurrenceEditScope, ReturnType<typeof planRecurrenceEdit>>;
  }, [recurrence, repos, transaction.date, today]);

  if (recurrence === null || counts === null) return null;

  const apply = (scope: RecurrenceEditScope) => {
    const input = toTransactionInput(values, minorDigits);
    applyRecurrenceEdit(db, repos, scope, {
      recurrence,
      occurrence: transaction,
      values: {
        kind: input.kind,
        amount: input.amount,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        categoryId: input.categoryId,
        description: input.description,
        tagIds: input.tagIds,
        excludeFromTotals: input.excludeFromTotals,
      },
      date: input.date,
      today,
      cycleStartDay,
    });
    onDone();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('recurrenceScope.title')}>
      <View>
        {SCOPES.map((scope) => {
          const plan = counts[scope];
          const count =
            scope === 'this-and-following'
              ? plan.tombstoneOccurrenceIds.length
              : scope === 'all'
                ? plan.updateOccurrenceIds.length
                : plan.unchangedCount;
          return (
            <ListRow
              key={scope}
              title={t(KEYS[scope].title)}
              subtitle={t(KEYS[scope].note, { count })}
              onPress={() => apply(scope)}
              chevron
            />
          );
        })}
        <Text size="caption" color="textFaint" style={{ paddingTop: 6 }}>
          {t('transactions.recurringEveryMonth')}
        </Text>
      </View>
    </Sheet>
  );
}
```

- [x] **Step 7: Detail (§6.6) and the tag filter sheet (§6.23)**

```tsx
import { formatLongDate } from '@saldo/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AmountText } from '../../src/components/AmountText';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Chip } from '../../src/components/Chip';
import { ListRow } from '../../src/components/ListRow';
import { Screen } from '../../src/components/Screen';
import { useRepositories } from '../../src/db/DatabaseProvider';
import { useAccounts, useCategories, useSettings, useTags } from '../../src/db/hooks';
import { useAppLocale } from '../../src/i18n/useAppLocale';
import { Text } from '../../src/theme/Text';
import { useTheme } from '../../src/theme/ThemeProvider';

/** §6.6. Attachments arrive in phase 08. */
export default function TransactionDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useAppLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repos = useRepositories();
  const settings = useSettings();
  const categories = useCategories();
  const accounts = useAccounts();
  const tags = useTags();

  const transaction = id === undefined ? null : repos.transactions.byId(id);
  if (transaction === null) {
    return (
      <Screen>
        <Text color="textMuted">{t('transactions.empty')}</Text>
      </Screen>
    );
  }

  const currency = settings?.currency ?? 'EUR';
  const category = categories.find((row) => row.id === transaction.categoryId);
  const account = accounts.find((row) => row.id === transaction.accountId);
  const toAccount = accounts.find((row) => row.id === transaction.toAccountId);
  const rowTags = tags.filter((tag) => transaction.tagIds.includes(tag.id));

  return (
    <Screen
      footer={
        <PrimaryButton
          label={t('common.edit')}
          onPress={() =>
            router.push({ pathname: '/transaction/edit/[id]', params: { id: transaction.id } })
          }
        />
      }
    >
      <AmountText
        minor={transaction.kind === 'income' ? transaction.amount : -transaction.amount}
        currency={currency}
        locale={locale}
        size="hero"
        weight="semibold"
        tracking="tightest"
        signDisplay={transaction.kind === 'income' ? 'always' : 'negative'}
      />
      <Text size="headline" color="textMuted">
        {transaction.description.length > 0 ? transaction.description : (category?.name ?? '—')}
      </Text>

      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding }}>
          {transaction.kind === 'transfer' ? null : (
            <ListRow
              title={t('transactions.detailCategory')}
              trailing={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.categoryColor(category?.colorIndex ?? 9),
                    }}
                  />
                  <Text color="textMuted">{category?.name ?? '—'}</Text>
                </View>
              }
            />
          )}
          <ListRow
            title={t('transactions.detailAccount')}
            trailing={
              <Text color="textMuted">
                {transaction.kind === 'transfer'
                  ? `${account?.name ?? '—'} → ${toAccount?.name ?? '—'}`
                  : (account?.name ?? '—')}
              </Text>
            }
          />
          <ListRow
            title={t('transactions.detailDate')}
            trailing={<Text color="textMuted">{formatLongDate(transaction.date, locale)}</Text>}
          />
          <ListRow
            title={t('transactions.detailNote')}
            trailing={
              <Text color="textMuted" numberOfLines={1} style={{ maxWidth: 200 }}>
                {transaction.note ??
                  (transaction.recurrenceId === null
                    ? t('transactions.manual')
                    : t('transactions.recurringEveryMonth'))}
              </Text>
            }
          />
          {transaction.excludeFromTotals ? (
            <ListRow
              title={t('transactions.excludedFromTotals')}
              trailing={<Text color="textMuted">✓</Text>}
            />
          ) : null}
        </View>
      </Card>

      {rowTags.length === 0 ? null : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {rowTags.map((tag) => (
            <Chip key={tag.id} label={tag.name} />
          ))}
        </View>
      )}
    </Screen>
  );
}
```

```tsx
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Sheet } from '../../components/Sheet';
import { useTags, useTransactionsInRange } from '../../db/hooks';
import { Text } from '../../theme/Text';

export interface TagFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  selected: readonly string[];
  onChange: (tagIds: string[]) => void;
}

/** §6.23: multi-select ordered by usage, with Azzera / Fatto. */
export function TagFilterSheet({ visible, onClose, selected, onChange }: TagFilterSheetProps) {
  const { t } = useTranslation();
  const tags = useTags();
  const rows = useTransactionsInRange('1970-01-01', '2999-12-31');

  const ordered = useMemo(() => {
    const usage = new Map<string, number>();
    for (const tx of rows) for (const id of tx.tagIds) usage.set(id, (usage.get(id) ?? 0) + 1);
    return [...tags].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
  }, [tags, rows]);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('transactions.tags')}>
      {ordered.length === 0 ? (
        <Text color="textMuted">{t('transactions.empty')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ordered.map((tag) => {
            const isSelected = selected.includes(tag.id);
            return (
              <Chip
                key={tag.id}
                label={tag.name}
                active={isSelected}
                onPress={() =>
                  onChange(
                    isSelected ? selected.filter((id) => id !== tag.id) : [...selected, tag.id],
                  )
                }
              />
            );
          })}
        </View>
      )}
      <View style={{ gap: 8, marginTop: 6 }}>
        <PrimaryButton label={t('common.done')} onPress={onClose} />
        <SecondaryButton label={t('common.reset')} onPress={() => onChange([])} />
      </View>
    </Sheet>
  );
}
```

- [x] **Step 8: Commit**

```bash
git add apps/mobile/app apps/mobile/src
git commit -m "feat(mobile): add transactions list, detail, form and recurrence editing"
```

---

### Task 7: Verify on a simulator

Roadmap acceptance: add/edit/delete/undo expense, income and transfer; recurring edit with all three
scopes; Home numbers match `@saldo/core` for demo data; component tests for the form rules.

- [x] **Step 1: The pipeline**

```bash
rtk proxy pnpm lint && rtk proxy pnpm typecheck && rtk proxy pnpm test
```

**Use `rtk proxy`.** The plain commands go through rtk's filters, and its lint filter was observed
to crash, swallow the output *and* return exit 0 — a file with an unused variable and broken
formatting passed. Its Jest filter has also reported `PASS` while a suite failed to run. Verify
through `rtk proxy`, or with `jest --json`.

- [x] **Step 2: Seed a simulator and look at it**

There is no way to drive onboarding from `simctl` (no tap command, and a deep link raises a system
"Open in Saldo?" dialog that also needs a tap), so seed the database directly:

```bash
pnpm --filter mobile exec expo run:ios
xcrun simctl get_app_container <device> io.github.saldo.app data   # → Documents/SQLite/saldo.db
pnpm --filter mobile seed:db <that path>
xcrun simctl terminate <device> io.github.saldo.app && xcrun simctl launch <device> io.github.saldo.app
```

Expected: Home shows the cycle range and "day N of M", "Left to spend" with the fraction at 50%
opacity, a progress bar with the pace tick, the trend chart with the grey `usual` line behind the
accent `current` one, and the Upcoming card with its 2px left border.

```bash
xcrun simctl ui <device> appearance dark   # check both palettes
```

- [x] **Step 3: Two bugs this step found**

Both were invisible to the test suite, which is the argument for doing it:

- **The boot router routed before the data arrived.** `useLiveQuery` starts with an empty array, so
  an already-onboarded user went to onboarding, and `<Redirect>` does not undo itself.
  `useSettingsQuery` now reports whether the first result has arrived and `Boot` waits for it.
- **The tab bar showed route names** (`index`, `transactions`) instead of the translated titles,
  because it read `route.name`. It now takes a label resolver.

- [ ] **Step 4: Android**

Not verified: no Android SDK on the machine this phase was built on.

---
