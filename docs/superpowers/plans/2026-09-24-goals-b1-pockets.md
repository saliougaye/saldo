# Goals B1 — pockets and goal rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The data and the rules of spec §5.14 (D24): an account of type `pocket` carrying a goal, its progress, pace and advice, the services that create and close a goal, and the places where a pocket must not appear.

**Architecture:** The goal lives on the pocket's account row (four new nullable columns, one migration). Every rule is a pure function in `@saldo/core` (`pockets.ts`, `goals.ts`, `goalTargets.ts`), unit-tested. The mobile app gets `goalService.ts` (create and close in one database transaction), an archive guard, and pocket-aware account chips. No new screen: those are Plan B2.

**Tech Stack:** TypeScript strict, Zod 4, Drizzle + drizzle-kit (expo-sqlite; better-sqlite3 in tests), Vitest, jest-expo.

**Order:** B1 before B2. B2 (the Obiettivi card on Home, the list, the detail, the wizard, the close sheet, the notification, the Conti nesting) builds on everything here.

**Decisions recorded here (AGENTS.md "spec silent → note it in the plan"):**

- **The four goal fields are optional in the schema** (`nullable().optional()`), not required-nullable: rows written before them parse on pull (§8.1), and the twenty existing `Account` literals in tests and seeds stay valid. A cross-field rule makes them required on a pocket and forbidden elsewhere.
- **`reachedOn` is computed, never stored** (§5.14): the first day of the latest run of days at or above the target.
- **`periodsLeft` counts the current period**, so on the last period the advice switches to days («Mancano X in N giorni»).
- **Archiving an account with open pockets is refused in the service** (it throws) and in the UI (a toast), so no caller can hide a goal's money from the totals.
- **`SYNC_SCHEMA_VERSION` does not move** (memory: frozen until Saldo is public; §5.14).

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/entities.ts` / `entities.test.ts` | `pocket` type, four goal fields, `refineAccountShape` |
| `apps/mobile/src/db/schema.ts`, `apps/mobile/drizzle/*` | four columns + generated migration |
| `apps/mobile/src/db/schema.test.ts` | a pocket round-trips |
| `apps/mobile/src/features/accounts/AccountTypeSheet.tsx`, `accountTypeIcon.ts` | pocket never offered as a type; its icon |
| `packages/i18n/src/locales/*.ts` | `accountTypes.pocket`, `goals.closeFirst` |
| `packages/core/src/pockets.ts` / `.test.ts` | `isPocket`, `pocketsOf`, `bankBalance`, `pocketParentCandidates`, `canArchiveAccount`, `accountChoices` |
| `packages/core/src/accounts.ts` / `.test.ts` | `paymentAccountCandidates` skips pockets |
| `packages/core/src/io/importPlan.ts` / `.test.ts` | import never maps to a pocket |
| `packages/core/src/goals.ts` / `.test.ts` | `goalProgress` |
| `packages/core/src/goalTargets.ts` / `.test.ts` | `rankGoal`, `goalEventIds`, `goalCardStatus`, `goalAdvice` |
| `apps/mobile/src/db/goalService.ts` / `.test.ts` | `createGoal`, `closeGoal` |
| `apps/mobile/src/db/adminService.ts` / `.test.ts` | archive guard |
| `apps/mobile/src/io/importService.ts` | the writer skips pockets too |
| `apps/mobile/src/features/transactions/TransactionForm.tsx` | chips via `accountChoices` |
| `apps/mobile/app/account/[id].tsx` | archive refused with a toast |

---

### Task 1: The `pocket` type and the goal fields

**Files:**
- Modify: `packages/core/src/entities.ts`
- Test: `packages/core/src/entities.test.ts`

- [ ] **Step 1: Write the failing tests**

In `entities.test.ts`, change the `accountTypeSchema` test to expect `'pocket'` last:

```ts
describe('accountTypeSchema', () => {
  it('knows a debit card, between a current account and a credit card, and ends with pockets', () => {
    expect(accountTypeSchema.options).toEqual([
      'cash',
      'checking',
      'debit_card',
      'credit_card',
      'savings',
      'investment',
      'pocket',
    ]);
  });
});
```

and append (add `accountSchema` to the import from `./entities`):

```ts
describe('accountSchema and pockets', () => {
  const base = {
    id: 'acc-1',
    createdAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '0000000000000-0000-a',
    deletedAt: null,
    name: 'Macchina',
    institution: null,
    openingBalance: 0,
    colorIndex: 5,
    icon: 'car',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  };
  const pocket = {
    ...base,
    type: 'pocket' as const,
    includeInSpendable: false,
    parentAccountId: 'acc-checking',
    goalTarget: 1_200_000,
    goalDeadline: '2027-06-30',
    goalStartDate: '2026-09-24',
  };

  it('accepts a pocket with its parent, target and start', () => {
    expect(accountSchema.safeParse(pocket).success).toBe(true);
  });

  it('accepts a pocket without a deadline', () => {
    expect(accountSchema.safeParse({ ...pocket, goalDeadline: null }).success).toBe(true);
  });

  it('refuses a pocket without a parent, a target or a start', () => {
    expect(accountSchema.safeParse({ ...pocket, parentAccountId: null }).success).toBe(false);
    expect(accountSchema.safeParse({ ...pocket, goalTarget: null }).success).toBe(false);
    expect(accountSchema.safeParse({ ...pocket, goalStartDate: null }).success).toBe(false);
  });

  it('refuses a spendable pocket and a deadline before the start', () => {
    expect(accountSchema.safeParse({ ...pocket, includeInSpendable: true }).success).toBe(false);
    expect(accountSchema.safeParse({ ...pocket, goalDeadline: '2026-09-01' }).success).toBe(false);
  });

  it('refuses goal fields on an account that is not a pocket', () => {
    const checking = { ...base, type: 'checking' as const, includeInSpendable: true };
    expect(accountSchema.safeParse({ ...checking, goalTarget: 1000 }).success).toBe(false);
    expect(accountSchema.safeParse({ ...checking, parentAccountId: 'acc-2' }).success).toBe(false);
  });

  it('parses a row written before the goal fields existed', () => {
    const checking = { ...base, type: 'checking' as const, includeInSpendable: true };
    expect(accountSchema.safeParse(checking).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- entities`
Expected: FAIL — the options list lacks `pocket`, and a pocket does not parse.

- [ ] **Step 3: Implement**

In `entities.ts`, replace the `accountTypeSchema` and `accountSchema` blocks with:

```ts
export const accountTypeSchema = z.enum([
  'cash',
  'checking',
  'debit_card',
  'credit_card',
  'savings',
  'investment',
  /** A goal (D24, §5.14): money set aside inside another account. Created by the goal wizard only. */
  'pocket',
]);

const present = (value: unknown): boolean => value !== null && value !== undefined;

const GOAL_FIELDS = ['parentAccountId', 'goalTarget', 'goalDeadline', 'goalStartDate'] as const;

interface AccountShape {
  type: z.infer<typeof accountTypeSchema>;
  includeInSpendable: boolean;
  parentAccountId?: string | null;
  goalTarget?: number | null;
  goalDeadline?: string | null;
  goalStartDate?: string | null;
}

/**
 * §4.1, §5.14: a pocket needs its parent, its target and its start, is never spendable, and its
 * deadline (optional) is not before its start; every other account carries none of the four.
 */
function refineAccountShape(account: AccountShape, ctx: z.RefinementCtx): void {
  if (account.type !== 'pocket') {
    for (const field of GOAL_FIELDS) {
      if (present(account[field])) {
        ctx.addIssue({ code: 'custom', message: 'Only a pocket carries a goal', path: [field] });
      }
    }
    return;
  }
  for (const field of ['parentAccountId', 'goalTarget', 'goalStartDate'] as const) {
    if (!present(account[field])) {
      ctx.addIssue({ code: 'custom', message: 'A pocket needs this field', path: [field] });
    }
  }
  if (account.includeInSpendable) {
    ctx.addIssue({
      code: 'custom',
      message: 'A pocket is never spendable',
      path: ['includeInSpendable'],
    });
  }
  const { goalDeadline, goalStartDate } = account;
  if (
    typeof goalDeadline === 'string' &&
    typeof goalStartDate === 'string' &&
    goalDeadline < goalStartDate
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'The deadline comes after the start',
      path: ['goalDeadline'],
    });
  }
}

export const accountSchema = z
  .object({
    ...syncMeta,
    name: z.string().min(1).max(60),
    type: accountTypeSchema,
    institution: z.string().max(60).nullable(),
    openingBalance: minorUnits,
    includeInSpendable: z.boolean(),
    colorIndex,
    icon: z.string().min(1),
    creditCloseDay: z.number().int().min(1).max(28).nullable(),
    creditChargeDay: z.number().int().min(1).max(28).nullable(),
    creditPaymentAccountId: id.nullable(),
    archivedAt: isoTimestamp.nullable(),
    sortOrder: z.number().int(),
    /**
     * The four goal fields (§5.14). Optional as well as nullable: a row written before they
     * existed still parses on pull (§8.1). Widened before any public build, so
     * `SYNC_SCHEMA_VERSION` does not move.
     */
    parentAccountId: id.nullable().optional(),
    goalTarget: positiveMinorUnits.nullable().optional(),
    goalDeadline: localDate.nullable().optional(),
    goalStartDate: localDate.nullable().optional(),
  })
  .superRefine(refineAccountShape);
```

- [ ] **Step 4: Run them and see them pass**

Run: `rtk proxy pnpm --filter @saldo/core test`
Expected: all pass (the backup schema, `z.array(accountSchema)`, accepts both shapes).

- [ ] **Step 5: Commit**

```bash
rtk git add packages/core/src/entities.ts packages/core/src/entities.test.ts
rtk git commit -m "feat(core): pocket accounts carry a goal"
```

---

### Task 2: Columns, migration, type label and icon

**Files:**
- Modify: `apps/mobile/src/db/schema.ts`, `apps/mobile/src/db/schema.test.ts`
- Create: `apps/mobile/drizzle/0003_*.sql` (generated), modify `apps/mobile/drizzle/migrations.js` and `meta/*` (generated)
- Modify: `apps/mobile/src/features/accounts/AccountTypeSheet.tsx`, `apps/mobile/src/features/accounts/accountTypeIcon.ts`
- Modify: `packages/i18n/src/locales/{it,en,fr,de,sv,es,pt}.ts`

- [ ] **Step 1: Write the failing schema test**

Append to the `describe('schema', …)` block of `schema.test.ts`:

```ts
  it('round-trips a pocket with its goal fields', () => {
    const db = createTestDatabase();
    db.insert(accounts)
      .values({
        ...meta,
        id: 'goal-car',
        name: 'Macchina',
        type: 'pocket',
        institution: null,
        openingBalance: 0,
        includeInSpendable: false,
        colorIndex: 5,
        icon: 'car',
        creditCloseDay: null,
        creditChargeDay: null,
        creditPaymentAccountId: null,
        archivedAt: null,
        sortOrder: 0,
        parentAccountId: 'acc-1',
        goalTarget: 1_200_000,
        goalDeadline: '2027-06-30',
        goalStartDate: '2026-09-24',
      })
      .run();
    const [row] = db.select().from(accounts).where(eq(accounts.id, 'goal-car')).all();
    expect(row).toMatchObject({
      type: 'pocket',
      parentAccountId: 'acc-1',
      goalTarget: 1_200_000,
      goalDeadline: '2027-06-30',
      goalStartDate: '2026-09-24',
    });
  });
```

- [ ] **Step 2: Run it and see it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/db/schema.test.ts`
Expected: FAIL (TypeScript in jest is transpile-only, so it fails at runtime: `table accounts has no column named parent_account_id`).

- [ ] **Step 3: Add the columns**

In `schema.ts`, inside `accounts`, after `sortOrder: integer('sort_order').notNull(),`:

```ts
    /** §5.14: a pocket's parent and goal. Null on every other account. */
    parentAccountId: text('parent_account_id'),
    goalTarget: integer('goal_target'),
    goalDeadline: text('goal_deadline'),
    goalStartDate: text('goal_start_date'),
```

- [ ] **Step 4: Generate the migration**

Run: `cd apps/mobile && rtk proxy pnpm db:generate`
Expected: a new `drizzle/0003_<name>.sql` with four `ALTER TABLE \`accounts\` ADD …` statements, `migrations.js` importing it as `m0003`, and `meta/_journal.json` + `meta/0003_snapshot.json` updated. Open the SQL and check it adds exactly the four nullable columns and nothing else.

- [ ] **Step 5: Run the test and see it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/db`
Expected: PASS (the test database replays every `drizzle/*.sql`).

- [ ] **Step 6: Never offer `pocket` as a type, and give it an icon**

In `AccountTypeSheet.tsx`, replace:

```ts
export const ACCOUNT_TYPES = accountTypeSchema.options;
```

with:

```ts
/** A pocket is a goal (§5.14): made by the goal wizard, never picked as a type. */
export const ACCOUNT_TYPES = accountTypeSchema.options.filter((type) => type !== 'pocket');
```

In `accountTypeIcon.ts`, add `pocket: 'target',` after `investment: 'trend',`.

- [ ] **Step 7: The label, and the refusal copy for Task 7**

In each catalog, inside `accountTypes: { … }`, add after the `investment` line:

| Locale | Line |
| --- | --- |
| `it.ts` | `pocket: 'Obiettivo',` |
| `en.ts` | `pocket: 'Goal',` |
| `fr.ts` | `pocket: 'Objectif',` |
| `de.ts` | `pocket: 'Ziel',` |
| `sv.ts` | `pocket: 'Mål',` |
| `es.ts` | `pocket: 'Objetivo',` |
| `pt.ts` | `pocket: 'Objetivo',` |

and after the `targets: { … },` block a new block:

| Locale | Block |
| --- | --- |
| `it.ts` | `goals: { closeFirst: 'Chiudi prima gli obiettivi in questo conto' },` |
| `en.ts` | `goals: { closeFirst: 'Close the goals in this account first' },` |
| `fr.ts` | `goals: { closeFirst: 'Ferme d’abord les objectifs de ce compte' },` |
| `de.ts` | `goals: { closeFirst: 'Schließe zuerst die Ziele in diesem Konto' },` |
| `sv.ts` | `goals: { closeFirst: 'Stäng först målen i det här kontot' },` |
| `es.ts` | `goals: { closeFirst: 'Cierra primero los objetivos de esta cuenta' },` |
| `pt.ts` | `goals: { closeFirst: 'Fecha primeiro os objetivos desta conta' },` |

(Biome will expand each block onto several lines.)

- [ ] **Step 8: Check**

Run: `rtk proxy pnpm --filter @saldo/i18n test`, `rtk proxy pnpm --filter mobile test -- src/features/accounts`, `rtk proxy pnpm typecheck`
Expected: all pass; the account type grid and sheet tests still list six types.

- [ ] **Step 9: Commit**

```bash
rtk git add apps/mobile/src/db/schema.ts apps/mobile/src/db/schema.test.ts apps/mobile/drizzle apps/mobile/src/features/accounts/AccountTypeSheet.tsx apps/mobile/src/features/accounts/accountTypeIcon.ts packages/i18n/src/locales
rtk git commit -m "feat(mobile): pocket columns, migration and label"
```

After merging, restart Metro with `--clear` and delete the simulator's `Documents/SQLite/saldo.db` (AGENTS.md: Metro caches the inlined migrations).

---

### Task 3: Pocket helpers, payment accounts, import

**Files:**
- Create: `packages/core/src/pockets.ts`, `packages/core/src/pockets.test.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/accounts.ts`, `packages/core/src/accounts.test.ts`, `packages/core/src/io/importPlan.ts`, `packages/core/src/io/importPlan.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/pockets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  accountChoices,
  bankBalance,
  canArchiveAccount,
  isPocket,
  pocketParentCandidates,
  pocketsOf,
} from './pockets';

type Row = {
  id: string;
  type: 'cash' | 'checking' | 'credit_card' | 'savings' | 'investment' | 'pocket';
  archivedAt: string | null;
  parentAccountId?: string | null;
};

const ROWS: Row[] = [
  { id: 'checking', type: 'checking', archivedAt: null },
  { id: 'car', type: 'pocket', archivedAt: null, parentAccountId: 'checking' },
  { id: 'card', type: 'credit_card', archivedAt: null },
  { id: 'deposit', type: 'savings', archivedAt: null },
  { id: 'trip', type: 'pocket', archivedAt: null, parentAccountId: 'deposit' },
  { id: 'sofa', type: 'pocket', archivedAt: '2026-09-01T10:00:00.000Z', parentAccountId: 'deposit' },
  { id: 'degiro', type: 'investment', archivedAt: null },
];

describe('pockets', () => {
  it('knows a pocket by its type', () => {
    expect(isPocket({ type: 'pocket' })).toBe(true);
    expect(isPocket({ type: 'savings' })).toBe(false);
  });

  it('lists the live pockets of a parent', () => {
    expect(pocketsOf(ROWS, 'deposit').map((row) => row.id)).toEqual(['trip']);
  });

  it('reads a parent like the bank: its own balance plus its live pockets', () => {
    const balances = new Map([
      ['checking', 207_989],
      ['car', 500_000],
      ['deposit', 0],
      ['trip', 298_000],
      ['sofa', 0],
    ]);
    expect(bankBalance(ROWS, balances, 'checking')).toBe(707_989);
    expect(bankBalance(ROWS, balances, 'deposit')).toBe(298_000);
    expect(bankBalance(ROWS, balances, 'card')).toBe(0);
  });

  it('offers cash, current, debit and savings accounts as parents, never cards, investments or pockets', () => {
    expect(pocketParentCandidates(ROWS).map((row) => row.id)).toEqual(['checking', 'deposit']);
  });

  it('refuses to archive an account that still holds open goals', () => {
    expect(canArchiveAccount(ROWS, 'checking')).toBe(false);
    expect(canArchiveAccount(ROWS, 'card')).toBe(true);
  });
});

describe('accountChoices', () => {
  it('leaves pockets out of an expense', () => {
    expect(
      accountChoices(ROWS, { includePockets: false, keepId: null }).map((row) => row.id),
    ).toEqual(['checking', 'card', 'deposit', 'degiro']);
  });

  it('puts each pocket right after its parent for a transfer', () => {
    expect(
      accountChoices(ROWS, { includePockets: true, keepId: null }).map((row) => row.id),
    ).toEqual(['checking', 'car', 'card', 'deposit', 'trip', 'sofa', 'degiro']);
  });

  it('keeps a pocket that is already selected, such as the expense a closing goal records', () => {
    expect(
      accountChoices(ROWS, { includePockets: false, keepId: 'car' }).map((row) => row.id),
    ).toEqual(['checking', 'car', 'card', 'deposit', 'degiro']);
  });
});
```

In `accounts.test.ts`, inside `describe('paymentAccountCandidates', …)` add:

```ts
  it('never charges a card to a pocket', () => {
    const pocket = { ...ACCOUNTS[1], id: 'acc-pocket', type: 'pocket' as const };
    expect(
      paymentAccountCandidates([...ACCOUNTS, pocket], 'acc-card').map((account) => account.id),
    ).not.toContain('acc-pocket');
  });
```

(`ACCOUNTS[1]` is `acc-checking` in `__tests__/fixtures.ts`; if the index differs, spread the checking fixture by id.)

In `io/importPlan.test.ts`, after the test `'matches an account that already exists, whatever its casing'`:

```ts
  it('never maps a row to a pocket, even one with the same name', () => {
    const pocket: Account = {
      ...account('My Money'),
      type: 'pocket',
      includeInSpendable: false,
      parentAccountId: 'acc-checking',
      goalTarget: 100_000,
      goalDeadline: null,
      goalStartDate: '2026-09-01',
    };
    const plan = planImport(body, spendee(), context({ accounts: [pocket] }));
    expect(plan.newAccounts).toEqual(['My Money']);
  });
```

- [ ] **Step 2: Run them and see them fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- pockets accounts importPlan`
Expected: FAIL — `./pockets` missing, the pocket offered as payment account, the pocket matched by the import.

- [ ] **Step 3: Implement**

Create `packages/core/src/pockets.ts`:

```ts
import type { Account } from './entities';
import type { MinorUnits } from './money';

/** Where a pocket's money can sit (§5.14). Investments are out: their returns land on the parent. */
export const POCKET_PARENT_TYPES: readonly Account['type'][] = [
  'cash',
  'checking',
  'debit_card',
  'savings',
];

type PocketFields = Pick<Account, 'id' | 'type' | 'archivedAt'> & {
  parentAccountId?: string | null;
};

export function isPocket(account: Pick<Account, 'type'>): boolean {
  return account.type === 'pocket';
}

/** The live (open) pockets inside `parentId`, in the given order. */
export function pocketsOf<T extends PocketFields>(accounts: readonly T[], parentId: string): T[] {
  return accounts.filter(
    (account) =>
      isPocket(account) && account.archivedAt === null && account.parentAccountId === parentId,
  );
}

/** What the bank shows for an account: its own balance plus its open pockets' (§5.14). */
export function bankBalance(
  accounts: readonly PocketFields[],
  balances: ReadonlyMap<string, MinorUnits>,
  accountId: string,
): MinorUnits {
  let total = balances.get(accountId) ?? 0;
  for (const pocket of pocketsOf(accounts, accountId)) total += balances.get(pocket.id) ?? 0;
  return total;
}

/** Accounts a new goal may live in: live cash, current, debit and savings accounts. */
export function pocketParentCandidates<T extends PocketFields>(accounts: readonly T[]): T[] {
  return accounts.filter(
    (account) => account.archivedAt === null && POCKET_PARENT_TYPES.includes(account.type),
  );
}

/** An account holding open goals cannot be archived: their money would leave the totals. */
export function canArchiveAccount(accounts: readonly PocketFields[], accountId: string): boolean {
  return pocketsOf(accounts, accountId).length === 0;
}

/**
 * The account chips of the transaction form (§5.14): pockets only where money moves by transfer,
 * each right after its parent — plus a pocket already selected, as when closing a goal records
 * its expense from the pocket.
 */
export function accountChoices<T extends PocketFields>(
  accounts: readonly T[],
  options: { includePockets: boolean; keepId: string | null },
): T[] {
  const out: T[] = [];
  for (const account of accounts) {
    if (isPocket(account)) continue;
    out.push(account);
    for (const pocket of accounts) {
      if (!isPocket(pocket) || pocket.parentAccountId !== account.id) continue;
      if (options.includePockets || pocket.id === options.keepId) out.push(pocket);
    }
  }
  const kept = accounts.find(
    (account) => account.id === options.keepId && isPocket(account) && !out.includes(account),
  );
  if (kept !== undefined) out.push(kept);
  return out;
}
```

Add `export * from './pockets';` to `packages/core/src/index.ts` (after `./permissions`).

In `accounts.ts`, `paymentAccountCandidates`:

```ts
/** Where a card may be charged (§6.22): live accounts that hold money, never a card, a pocket or itself. */
export function paymentAccountCandidates<T extends Pick<AccountRef, 'id' | 'type' | 'archivedAt'>>(
  accounts: readonly T[],
  cardId: string | null,
): T[] {
  return accounts.filter(
    (account) =>
      account.type !== 'credit_card' &&
      account.type !== 'pocket' &&
      account.archivedAt === null &&
      account.id !== cardId,
  );
}
```

In `io/importPlan.ts`, `planImport`, replace:

```ts
  const accounts = new NameRegistry(context.accounts);
```

with:

```ts
  // A pocket is a goal, not a wallet (§5.14): an imported row never lands in one.
  const accounts = new NameRegistry(context.accounts.filter((account) => account.type !== 'pocket'));
```

- [ ] **Step 4: Run them and see them pass**

Run: `rtk proxy pnpm --filter @saldo/core test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/core/src
rtk git commit -m "feat(core): pocket helpers; cards and imports never use a pocket"
```

---

### Task 4: `goalProgress`

**Files:**
- Create: `packages/core/src/goals.ts`, `packages/core/src/goals.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/goals.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tx } from './__tests__/fixtures';
import { type GoalAccount, goalProgress } from './goals';
import type { PeriodDef } from './period';

const MONTH: PeriodDef = { kind: 'month', startDay: 1 };

const goal = (overrides: Partial<GoalAccount> = {}): GoalAccount => ({
  id: 'goal',
  openingBalance: 0,
  goalTarget: 1_300_000,
  goalDeadline: '2026-12-31',
  goalStartDate: '2026-01-01',
  ...overrides,
});

const into = (date: string, amount: number) =>
  tx({ date, amount, kind: 'transfer', accountId: 'checking', toAccountId: 'goal', categoryId: null });
const out = (date: string, amount: number) =>
  tx({ date, amount, kind: 'transfer', accountId: 'goal', toAccountId: 'checking', categoryId: null });

describe('goalProgress', () => {
  it('saves what went in, minus what went out and what was spent, up to today', () => {
    const progress = goalProgress(
      goal(),
      [
        into('2026-01-01', 100_000),
        into('2026-03-01', 500_000),
        out('2026-04-01', 20_000),
        tx({ date: '2026-05-01', amount: 30_000, accountId: 'goal', categoryId: 'cat-home' }),
        into('2026-08-01', 99_000),
      ],
      '2026-07-02',
      MONTH,
    );
    expect(progress.saved).toBe(550_000);
    expect(progress.missing).toBe(750_000);
  });

  it('measures the pace from what was already aside on the first day', () => {
    // Day 183 of 365; 100 000 aside at the start, 1 300 000 by the end: 701 643.8 expected.
    const progress = goalProgress(
      goal(),
      [into('2026-01-01', 100_000), into('2026-03-01', 500_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.pace).toBeCloseTo(183 / 365, 10);
    expect(progress.gap).toBe(-101_644);
    expect(progress.state).toBe('behind');
  });

  it('does not read a goal created with money already aside as far ahead', () => {
    const progress = goalProgress(
      goal({ goalStartDate: '2026-07-01', goalTarget: 1_200_000 }),
      [into('2026-07-01', 600_000)],
      '2026-07-02',
      MONTH,
    );
    // Day 2 of 184 from 600 000 towards 1 200 000.
    expect(progress.gap).toBe(-6_522);
  });

  it('asks for the rest spread over the periods left, current one included, rounding up', () => {
    const progress = goalProgress(
      goal(),
      [into('2026-01-01', 100_000), into('2026-03-01', 500_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.periodsLeft).toBe(6);
    expect(progress.perPeriod).toBe(116_667);
  });

  it('counts days instead once the deadline is in the current period', () => {
    const progress = goalProgress(
      goal({ goalDeadline: '2026-07-20' }),
      [into('2026-01-01', 100_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.periodsLeft).toBe(1);
    expect(progress.daysLeft).toBe(18);
  });

  it('has no pace and no advice per period without a deadline', () => {
    const progress = goalProgress(
      goal({ goalDeadline: null }),
      [into('2026-01-01', 100_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.state).toBe('open');
    expect(progress.pace).toBeNull();
    expect(progress.gap).toBeNull();
    expect(progress.perPeriod).toBeNull();
  });

  it('expires a goal past its deadline that is not reached', () => {
    const progress = goalProgress(
      goal({ goalDeadline: '2026-06-30' }),
      [into('2026-01-01', 100_000)],
      '2026-07-02',
      MONTH,
    );
    expect(progress.state).toBe('expired');
  });

  it('dates the reach to the first day of the latest run at or above the target', () => {
    const progress = goalProgress(
      goal({ goalTarget: 300_000 }),
      [
        into('2026-03-10', 300_000),
        out('2026-04-01', 50_000),
        into('2026-05-05', 60_000),
      ],
      '2026-07-02',
      MONTH,
    );
    expect(progress.state).toBe('reached');
    expect(progress.reachedOn).toBe('2026-05-05');
    expect(progress.ratio).toBe(1);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- goals`
Expected: FAIL — `Cannot find module './goals'`.

- [ ] **Step 3: Implement**

Create `packages/core/src/goals.ts`:

```ts
import { cycleLength, elapsedDays } from './cycle';
import { diffDays, type LocalDate } from './dates';
import type { LedgerTx } from './ledger';
import type { MinorUnits } from './money';
import { type PeriodDef, periodContaining, shiftPeriod } from './period';

/** The pocket fields a goal is measured with (§5.14). */
export interface GoalAccount {
  id: string;
  openingBalance: MinorUnits;
  goalTarget: MinorUnits;
  goalDeadline: LocalDate | null;
  goalStartDate: LocalDate;
}

/** `open` = no deadline, so no pace; `onTrack` = at or ahead of the pace. */
export type GoalState = 'reached' | 'expired' | 'behind' | 'onTrack' | 'open';

export interface GoalProgress {
  saved: MinorUnits;
  target: MinorUnits;
  /** saved / target, clamped to 0..1. */
  ratio: number;
  missing: MinorUnits;
  state: GoalState;
  /** First day of the latest run at or above the target; null unless reached. */
  reachedOn: LocalDate | null;
  /** elapsed / length from the start to the deadline; null without a deadline. */
  pace: number | null;
  /** saved − expected, rounded; negative = behind. Null without a deadline. */
  gap: MinorUnits | null;
  /** App periods from today's to the deadline's, both included. */
  periodsLeft: number | null;
  /** ⌈missing / periodsLeft⌉. */
  perPeriod: MinorUnits | null;
  /** Days from today to the deadline. */
  daysLeft: number | null;
}

/** The pocket's own movements up to today, as signed amounts per date, in date order. */
function movements(goalId: string, txs: readonly LedgerTx[], today: LocalDate) {
  const byDate = new Map<LocalDate, MinorUnits>();
  for (const tx of txs) {
    if (tx.date > today) continue;
    let delta = 0;
    if (tx.accountId === goalId) delta += tx.kind === 'income' ? tx.amount : -tx.amount;
    if (tx.kind === 'transfer' && tx.toAccountId === goalId) delta += tx.amount;
    if (delta !== 0) byDate.set(tx.date, (byDate.get(tx.date) ?? 0) + delta);
  }
  return [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Where a goal stands today (§5.14). Pure: `today` and the period definition are injected.
 */
export function goalProgress(
  goal: GoalAccount,
  txs: readonly LedgerTx[],
  today: LocalDate,
  def: PeriodDef,
): GoalProgress {
  const target = goal.goalTarget;
  let saved = goal.openingBalance;
  let startSaved = goal.openingBalance;
  let runStart: LocalDate | null = saved >= target ? goal.goalStartDate : null;
  for (const [date, delta] of movements(goal.id, txs, today)) {
    saved += delta;
    if (date <= goal.goalStartDate) startSaved = saved;
    if (saved >= target) runStart ??= date;
    else runStart = null;
  }

  const missing = Math.max(0, target - saved);
  const ratio = target > 0 ? Math.min(1, Math.max(0, saved / target)) : 0;
  const deadline = goal.goalDeadline;
  const reached = saved >= target;

  let pace: number | null = null;
  let gap: MinorUnits | null = null;
  let periodsLeft: number | null = null;
  let perPeriod: MinorUnits | null = null;
  let daysLeft: number | null = null;
  if (deadline !== null) {
    const range = { start: goal.goalStartDate, end: deadline };
    const length = cycleLength(range);
    pace = length === 0 ? 1 : elapsedDays(range, today) / length;
    gap = Math.round(saved - (startSaved + (target - startSaved) * pace));
    daysLeft = Math.max(0, diffDays(today, deadline));
    let period = periodContaining(def, today);
    periodsLeft = 1;
    while (period.end < deadline) {
      period = shiftPeriod(def, period, 1);
      periodsLeft += 1;
    }
    perPeriod = Math.ceil(missing / periodsLeft);
  }

  const state: GoalState = reached
    ? 'reached'
    : deadline === null
      ? 'open'
      : deadline < today
        ? 'expired'
        : gap !== null && gap < 0
          ? 'behind'
          : 'onTrack';

  return {
    saved,
    target,
    ratio,
    missing,
    state,
    reachedOn: reached ? runStart : null,
    pace,
    gap,
    periodsLeft,
    perPeriod,
    daysLeft,
  };
}
```

Add `export * from './goals';` to `index.ts` (after `./filters`).

- [ ] **Step 4: Run them and see them pass**

Run: `rtk proxy pnpm --filter @saldo/core test -- goals`
Expected: PASS, 8 tests. If `pace` on 2026-07-02 is not 183/365, check `elapsedDays` counts today (it does, §5.2) and fix the implementation, not the expectation.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/core/src/goals.ts packages/core/src/goals.test.ts packages/core/src/index.ts
rtk git commit -m "feat(core): goalProgress measures saved, pace and what is left per period"
```

---

### Task 5: Goals on a target card

**Files:**
- Create: `packages/core/src/goalTargets.ts`, `packages/core/src/goalTargets.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/goalTargets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GoalProgress } from './goals';
import { goalAdvice, goalCardStatus, goalEventIds, rankGoal } from './goalTargets';

function progress(overrides: Partial<GoalProgress>): GoalProgress {
  return {
    saved: 0,
    target: 100_000,
    ratio: 0,
    missing: 100_000,
    state: 'onTrack',
    reachedOn: null,
    pace: 0.5,
    gap: 0,
    periodsLeft: 6,
    perPeriod: 16_667,
    daysLeft: 180,
    ...overrides,
  };
}

const item = (id: string, overrides: Partial<GoalProgress>) => ({ id, progress: progress(overrides) });

describe('rankGoal', () => {
  it('puts an expired goal on top, by what is missing', () => {
    expect(rankGoal(item('a', { state: 'expired', missing: 11_000 }))).toEqual({
      id: 'a',
      tier: 4,
      score: 11_000,
      margin: 5_000,
    });
  });

  it('then the goals behind, furthest behind first', () => {
    const ranked = rankGoal(item('b', { state: 'behind', gap: -20_000 }));
    expect(ranked.tier).toBe(3);
    expect(ranked.score).toBeCloseTo(0.2, 10);
  });

  it('then those on track, least ahead first, then those without a deadline, lowest first', () => {
    expect(rankGoal(item('c', { state: 'onTrack', gap: 10_000 }))).toMatchObject({
      tier: 2,
      score: -0.1,
    });
    expect(rankGoal(item('d', { state: 'open', ratio: 0.3 }))).toMatchObject({
      tier: 1,
      score: -0.3,
    });
  });

  it('keeps the reached ones last, the most recent first', () => {
    expect(rankGoal(item('e', { state: 'reached', reachedOn: '2026-09-20' }))).toMatchObject({
      tier: 0,
      score: 20260920,
    });
  });
});

describe('goalEventIds', () => {
  it('lists expired goals, then reached ones, most recent first, featured left out, three at most', () => {
    const items = [
      item('exp1', { state: 'expired', missing: 5_000 }),
      item('exp2', { state: 'expired', missing: 9_000 }),
      item('old', { state: 'reached', reachedOn: '2026-09-02' }),
      item('new', { state: 'reached', reachedOn: '2026-09-20' }),
      item('behind', { state: 'behind', gap: -1 }),
    ];
    expect(goalEventIds(items, 'exp2')).toEqual(['exp1', 'new', 'old']);
    expect(goalEventIds(items, null)).toEqual(['exp2', 'exp1', 'new']);
  });
});

describe('goalCardStatus', () => {
  it('counts expired, behind and reached goals', () => {
    expect(
      goalCardStatus([
        item('a', { state: 'expired' }),
        item('b', { state: 'behind' }),
        item('c', { state: 'reached' }),
        item('d', { state: 'onTrack' }),
      ]),
    ).toEqual({ expired: 1, behind: 1, reached: 1 });
  });
});

describe('goalAdvice', () => {
  it('asks for an amount per period while there are several left', () => {
    expect(goalAdvice(progress({ state: 'behind', gap: -43_600, perPeriod: 73_100 }))).toEqual({
      kind: 'perPeriod',
      perPeriod: 73_100,
      gap: 43_600,
      behind: true,
    });
  });

  it('counts days on the last period', () => {
    expect(goalAdvice(progress({ periodsLeft: 1, missing: 25_000, daysLeft: 21 }))).toEqual({
      kind: 'lastPeriod',
      missing: 25_000,
      days: 21,
    });
  });

  it('only says what is missing without a deadline', () => {
    expect(goalAdvice(progress({ state: 'open', missing: 350_000 }))).toEqual({
      kind: 'noDeadline',
      missing: 350_000,
    });
  });

  it('says what is missing past the deadline, and what was reached', () => {
    expect(goalAdvice(progress({ state: 'expired', missing: 11_000 }))).toEqual({
      kind: 'expired',
      missing: 11_000,
    });
    expect(goalAdvice(progress({ state: 'reached', target: 120_000 }))).toEqual({
      kind: 'reached',
      target: 120_000,
    });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- goalTargets`
Expected: FAIL — `Cannot find module './goalTargets'`.

- [ ] **Step 3: Implement**

Create `packages/core/src/goalTargets.ts`:

```ts
import type { GoalProgress } from './goals';
import { FEATURE_MARGIN, MAX_TARGET_EVENTS, type RankedTarget } from './targets';

/** A goal as the target card sees it (§5.13). */
export interface GoalTargetInput {
  id: string;
  progress: GoalProgress;
}

const dateScore = (date: string | null): number => (date === null ? 0 : Number(date.replaceAll('-', '')));

/**
 * Expired (missing, money) → behind (−gap ÷ target) → on track (least ahead first) → no deadline
 * (lowest ratio first) → reached (most recently reached first).
 */
export function rankGoal({ id, progress }: GoalTargetInput): RankedTarget {
  const target = Math.max(1, progress.target);
  const gap = progress.gap ?? 0;
  switch (progress.state) {
    case 'expired':
      return { id, tier: 4, score: progress.missing, margin: FEATURE_MARGIN * progress.target };
    case 'behind':
      return { id, tier: 3, score: -gap / target, margin: FEATURE_MARGIN };
    case 'onTrack':
      return { id, tier: 2, score: -gap / target, margin: FEATURE_MARGIN };
    case 'open':
      return { id, tier: 1, score: -progress.ratio, margin: FEATURE_MARGIN };
    case 'reached':
      return { id, tier: 0, score: dateScore(progress.reachedOn), margin: 0 };
  }
}

/** The exceptions that get a row: expired (most missing first), then reached (newest first). */
export function goalEventIds(items: readonly GoalTargetInput[], featuredId: string | null): string[] {
  const others = items.filter((item) => item.id !== featuredId);
  const expired = others
    .filter((item) => item.progress.state === 'expired')
    .sort((a, b) => b.progress.missing - a.progress.missing);
  const reached = others
    .filter((item) => item.progress.state === 'reached')
    .sort((a, b) => dateScore(b.progress.reachedOn) - dateScore(a.progress.reachedOn));
  return [...expired, ...reached].slice(0, MAX_TARGET_EVENTS).map((item) => item.id);
}

export interface GoalCardStatus {
  expired: number;
  behind: number;
  reached: number;
}

export function goalCardStatus(items: readonly GoalTargetInput[]): GoalCardStatus {
  const count = (state: GoalProgress['state']) =>
    items.filter((item) => item.progress.state === state).length;
  return { expired: count('expired'), behind: count('behind'), reached: count('reached') };
}

export type GoalAdvice =
  | { kind: 'perPeriod'; perPeriod: number; gap: number; behind: boolean }
  | { kind: 'lastPeriod'; missing: number; days: number }
  | { kind: 'noDeadline'; missing: number }
  | { kind: 'expired'; missing: number }
  | { kind: 'reached'; target: number };

/** What the goal's sentence says (§5.14). */
export function goalAdvice(progress: GoalProgress): GoalAdvice {
  switch (progress.state) {
    case 'reached':
      return { kind: 'reached', target: progress.target };
    case 'expired':
      return { kind: 'expired', missing: progress.missing };
    case 'open':
      return { kind: 'noDeadline', missing: progress.missing };
    default:
      if (progress.periodsLeft === null || progress.periodsLeft <= 1) {
        return { kind: 'lastPeriod', missing: progress.missing, days: progress.daysLeft ?? 0 };
      }
      return {
        kind: 'perPeriod',
        perPeriod: progress.perPeriod ?? progress.missing,
        gap: Math.abs(progress.gap ?? 0),
        behind: progress.state === 'behind',
      };
  }
}
```

Add `export * from './goalTargets';` to `index.ts` (after `./goals`).

- [ ] **Step 4: Run them and see them pass**

Run: `rtk proxy pnpm --filter @saldo/core test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
rtk git add packages/core/src/goalTargets.ts packages/core/src/goalTargets.test.ts packages/core/src/index.ts
rtk git commit -m "feat(core): rank, list and advise goals for the target card"
```

---

### Task 6: Create and close a goal, guard the parent

**Files:**
- Create: `apps/mobile/src/db/goalService.ts`, `apps/mobile/src/db/goalService.test.ts`
- Modify: `apps/mobile/src/db/adminService.ts`, `apps/mobile/src/db/adminService.test.ts`
- Modify: `apps/mobile/src/io/importService.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/db/goalService.test.ts`:

```ts
import { archiveAccount } from './adminService';
import { closeGoal, createGoal } from './goalService';
import { createRepositories } from './repositories';
import { createTestDatabase } from './testing';

const NOW = '2026-09-24T10:00:00.000Z';
const TODAY = '2026-09-24';

function setup() {
  const db = createTestDatabase();
  const repos = createRepositories(db, () => NOW);
  const checking = repos.accounts.create({
    id: 'checking',
    name: 'Conto corrente',
    type: 'checking',
    institution: null,
    openingBalance: 700_000,
    includeInSpendable: true,
    colorIndex: 0,
    icon: 'landmark',
    creditCloseDay: null,
    creditChargeDay: null,
    creditPaymentAccountId: null,
    archivedAt: null,
    sortOrder: 0,
  });
  return { db, repos, checking };
}

const input = {
  name: 'Macchina',
  icon: 'car',
  colorIndex: 5,
  parentAccountId: 'checking',
  goalTarget: 1_200_000,
  goalDeadline: '2027-06-30',
  alreadySaved: 500_000,
  today: TODAY,
  sortOrder: 1,
};

describe('createGoal', () => {
  it('opens an empty, unspendable pocket and moves what is already aside into it', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    expect(pocket).toMatchObject({
      type: 'pocket',
      openingBalance: 0,
      includeInSpendable: false,
      parentAccountId: 'checking',
      goalTarget: 1_200_000,
      goalDeadline: '2027-06-30',
      goalStartDate: TODAY,
    });
    const [transfer] = repos.transactions.list();
    expect(transfer).toMatchObject({
      kind: 'transfer',
      amount: 500_000,
      date: TODAY,
      accountId: 'checking',
      toAccountId: pocket.id,
      description: 'Macchina',
    });
  });

  it('writes no transfer when nothing is aside yet', () => {
    const { db, repos } = setup();
    createGoal(db, repos, { ...input, alreadySaved: 0 });
    expect(repos.transactions.list()).toEqual([]);
  });
});

describe('closeGoal', () => {
  it('returns what is left to the parent, then archives the pocket at zero', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, input);
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    const back = repos.transactions.list().find((row) => row.accountId === pocket.id);
    expect(back).toMatchObject({
      kind: 'transfer',
      amount: 500_000,
      toAccountId: 'checking',
    });
    expect(repos.accounts.byId(pocket.id)?.archivedAt).toBe(NOW);
  });

  it('only archives a pocket that is already empty', () => {
    const { db, repos } = setup();
    const pocket = createGoal(db, repos, { ...input, alreadySaved: 0 });
    closeGoal(db, repos, pocket.id, TODAY, NOW);
    expect(repos.transactions.list()).toEqual([]);
    expect(repos.accounts.byId(pocket.id)?.archivedAt).toBe(NOW);
  });
});

describe('archiveAccount', () => {
  it('refuses a parent that still holds an open goal', () => {
    const { db, repos } = setup();
    createGoal(db, repos, input);
    expect(() => archiveAccount(repos, 'checking', NOW)).toThrow(/open goals/);
    expect(repos.accounts.byId('checking')?.archivedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `rtk proxy pnpm --filter mobile test -- src/db/goalService.test.ts`
Expected: FAIL — `Cannot find module './goalService'`.

- [ ] **Step 3: Implement the service**

Create `apps/mobile/src/db/goalService.ts`:

```ts
import { type Account, accountBalances, type LocalDate } from '@saldo/core';
import type { Repositories } from './repositories';
import type { RepositoryDatabase } from './repositories/support';

export interface NewGoalInput {
  name: string;
  icon: string;
  colorIndex: number;
  parentAccountId: string;
  goalTarget: number;
  goalDeadline: LocalDate | null;
  /** «Già da parte»: moved from the parent on creation, never an opening balance. */
  alreadySaved: number;
  today: LocalDate;
  sortOrder: number;
}

/**
 * Creates a goal (§5.14): an empty, unspendable pocket inside its parent, plus — when something is
 * already aside — the transfer that moves it there. One database transaction: a pocket without its
 * money, or money without its pocket, would both misstate the totals.
 *
 * An opening balance would count the same money twice in Patrimonio complessivo, which is why the
 * money arrives by transfer.
 */
export function createGoal(
  db: RepositoryDatabase,
  repos: Repositories,
  input: NewGoalInput,
): Account {
  return db.transaction(() => {
    const pocket = repos.accounts.create({
      name: input.name,
      type: 'pocket',
      institution: null,
      openingBalance: 0,
      includeInSpendable: false,
      colorIndex: input.colorIndex,
      icon: input.icon,
      creditCloseDay: null,
      creditChargeDay: null,
      creditPaymentAccountId: null,
      archivedAt: null,
      sortOrder: input.sortOrder,
      parentAccountId: input.parentAccountId,
      goalTarget: input.goalTarget,
      goalDeadline: input.goalDeadline,
      goalStartDate: input.today,
    });
    if (input.alreadySaved > 0) {
      repos.transactions.create({
        kind: 'transfer',
        amount: input.alreadySaved,
        date: input.today,
        accountId: input.parentAccountId,
        toAccountId: pocket.id,
        categoryId: null,
        description: input.name,
        note: null,
        tagIds: [],
        excludeFromTotals: false,
        recurrenceId: null,
      });
    }
    return pocket;
  });
}

/**
 * Closes a goal (§5.14): whatever the pocket still holds goes back to the parent, then the pocket
 * is archived. An archived pocket always has a zero balance, so archiving never hides money from
 * the totals. The expense «Registra la spesa» records is saved before this runs.
 */
export function closeGoal(
  db: RepositoryDatabase,
  repos: Repositories,
  goalId: string,
  today: LocalDate,
  nowIso: string,
): void {
  db.transaction(() => {
    const pocket = repos.accounts.byId(goalId);
    if (pocket === null || pocket.type !== 'pocket' || pocket.parentAccountId == null) {
      throw new Error(`No open goal ${goalId}`);
    }
    const balance = accountBalances([pocket], repos.transactions.list(), today).get(goalId) ?? 0;
    if (balance > 0) {
      repos.transactions.create({
        kind: 'transfer',
        amount: balance,
        date: today,
        accountId: goalId,
        toAccountId: pocket.parentAccountId,
        categoryId: null,
        description: pocket.name,
        note: null,
        tagIds: [],
        excludeFromTotals: false,
        recurrenceId: null,
      });
    }
    repos.accounts.update(goalId, { archivedAt: nowIso });
  });
}
```

(`== null` covers both `null` and a missing field; Biome's `noDoubleEquals` allows comparisons with `null`.)

In `adminService.ts`, replace `archiveAccount` with:

```ts
/**
 * Archives an account; its transactions stay, as they still describe money that moved. An account
 * that still holds open goals is refused (§5.14): their pockets' money would vanish from the totals.
 */
export function archiveAccount(repos: Repositories, accountId: string, nowIso: string): void {
  if (!canArchiveAccount(repos.accounts.list(), accountId)) {
    throw new Error(`Account ${accountId} still holds open goals`);
  }
  repos.accounts.update(accountId, { archivedAt: nowIso });
}
```

and change the first import line to `import { type Category, canArchiveAccount, type Tag } from '@saldo/core';`.

In `io/importService.ts`, `writeImport`, replace:

```ts
  const accounts = new Map(
    repos.accounts.list().map((account) => [normalizeText(account.name), account.id]),
  );
```

with:

```ts
  // Never into a pocket (§5.14), the same rule `planImport` applies.
  const accounts = new Map(
    repos.accounts
      .list()
      .filter((account) => account.type !== 'pocket')
      .map((account) => [normalizeText(account.name), account.id]),
  );
```

- [ ] **Step 4: Run them and see them pass**

Run: `rtk proxy pnpm --filter mobile test -- src/db src/io`
Expected: PASS, including the existing `adminService` and `importService` tests.

- [ ] **Step 5: Commit**

```bash
rtk git add apps/mobile/src/db/goalService.ts apps/mobile/src/db/goalService.test.ts apps/mobile/src/db/adminService.ts apps/mobile/src/io/importService.ts
rtk git commit -m "feat(mobile): create and close goals; a parent with open goals cannot be archived"
```

---

### Task 7: Pockets in the transaction form, the refusal on the account detail

**Files:**
- Modify: `apps/mobile/src/features/transactions/TransactionForm.tsx`
- Modify: `apps/mobile/app/account/[id].tsx`

- [ ] **Step 1: Chips through `accountChoices`**

In `TransactionForm.tsx`, add `accountChoices` to the `@saldo/core` import. In `accountRow`, replace:

```tsx
        {liveAccounts.map((account, index) => (
```

with:

```tsx
        {accountChoices(liveAccounts, {
          // Money reaches a pocket by transfer only (§5.14); an expense from one arrives
          // pre-selected when a goal is closed.
          includePockets: values.kind === 'transfer',
          keepId: selectedId,
        }).map((account, index) => (
```

- [ ] **Step 2: Refuse to archive a parent with open goals**

In `app/account/[id].tsx`, add `canArchiveAccount` to the `@saldo/core` import and replace:

```tsx
        <SecondaryButton label={t('accounts.archive')} onPress={() => setConfirmArchive(true)} />
```

with:

```tsx
        <SecondaryButton
          label={t('accounts.archive')}
          onPress={() =>
            canArchiveAccount(accounts, account.id)
              ? setConfirmArchive(true)
              : toast.show(t('goals.closeFirst'))
          }
        />
```

- [ ] **Step 3: Check**

Run: `rtk proxy pnpm --filter mobile test -- src/features/transactions` and `rtk proxy pnpm typecheck`
Expected: pass; `TransactionForm.test.tsx` has no pocket, so its chips are unchanged.

- [ ] **Step 4: Commit**

```bash
rtk git add apps/mobile/src/features/transactions/TransactionForm.tsx apps/mobile/app/account/[id].tsx
rtk git commit -m "feat(mobile): pockets only in transfer chips; archive refused while goals are open"
```

---

### Task 8: Verify

- [ ] **Step 1:** `rtk proxy pnpm lint` — no `lint/…` lines, no `×`. Fix formatting with `pnpm exec biome check --write <paths>`.
- [ ] **Step 2:** `rtk proxy pnpm typecheck` — every task successful.
- [ ] **Step 3:** `CI=1 rtk proxy pnpm test` — read each package's summary line.
- [ ] **Step 4:** Commit any formatting: `rtk git commit -m "style: biome formatting for goals B1"`.
