# Phase 09a — Export & restore

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user can get their data out — a JSON backup they can restore, and a CSV a spreadsheet can open — and
put a backup back.

**Architecture:** Everything that decides *what* the file contains is a pure function in `@saldo/core/io`, unit
tested without a database: the backup envelope and its validation, and the CSV serialiser of §11.2. `apps/mobile/src/io`
is the glue that reads rows, writes a file and hands it to `expo-sharing`. Restore is one SQLite transaction that
tombstones what is there and inserts the backup's rows with fresh HLC stamps, so the result wins on sync.

Attachments are **not** part of this phase (09b owns them), so the backup carries an empty `attachments` array and
there is no ZIP yet. The envelope has the field from the start, so 09b adds files, not a format version.

**Tech Stack:** `expo-file-system`, `expo-sharing`, `expo-document-picker`, existing Zod schemas.

**Spec:** §11.1, §11.2, §6.31 (profile rows only — the import wizard is 09c).

---

## File structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/io/backup.ts` (new) | `backupSchema`, `buildBackup`, `readBackup` — envelope, validation, per-row errors. |
| `packages/core/src/io/csv.ts` (new) | `toCsv` (RFC 4180 + BOM), `csvRows` — the §11.2 columns from entities. |
| `packages/core/src/io/index.ts` (new) | Re-exports; `packages/core/src/index.ts` re-exports `./io`. |
| `apps/mobile/src/io/exportService.ts` (new) | Reads every repository, writes the file, shares it. |
| `apps/mobile/src/io/restoreService.ts` (new) | Picks a file, validates, replaces everything in one transaction. |
| `apps/mobile/app/profile/export.tsx` (new) | §6.31: what to export, and the two formats. |
| `apps/mobile/app/profile.tsx` | The "Esporta dati" / "Ripristina backup" rows stop saying "soon". |
| `packages/i18n/src/locales/{it,en}.ts` | Strings for both screens and their results. |

---

### Task 1: The backup envelope

**Files:**
- Create: `packages/core/src/io/backup.ts`, `packages/core/src/io/backup.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildBackup, readBackup } from './backup';

const settings = {
  id: 'settings' as const,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '000000000000001-0000-dev',
  deletedAt: null,
  periodKind: 'cycle' as const,
  cycleStartDay: 27,
  currency: 'EUR' as const,
  language: 'it' as const,
  theme: 'system' as const,
  onboardingCompletedAt: '2026-09-01T10:00:00.000Z',
};

const account = {
  id: 'acc-1',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '000000000000001-0001-dev',
  deletedAt: null,
  name: 'Carta',
  type: 'checking' as const,
  institution: null,
  openingBalance: 10_000,
  includeInSpendable: true,
  colorIndex: 3,
  icon: 'card',
  creditCloseDay: null,
  creditChargeDay: null,
  creditPaymentAccountId: null,
  archivedAt: null,
  sortOrder: 0,
};

const empty = { accounts: [], categories: [], tags: [], transactions: [], recurrences: [], budgets: [], attachments: [] };

describe('buildBackup', () => {
  it('stamps the envelope and carries the rows', () => {
    const backup = buildBackup({
      exportedAt: '2026-09-11T08:00:00.000Z',
      appVersion: '0.1.0',
      data: { settings, ...empty, accounts: [account] },
    });
    expect(backup.format).toBe('saldo-backup');
    expect(backup.version).toBe(1);
    expect(backup.data.accounts).toHaveLength(1);
  });
});

describe('readBackup', () => {
  it('accepts what buildBackup produced', () => {
    const json = JSON.stringify(
      buildBackup({ exportedAt: '2026-09-11T08:00:00.000Z', appVersion: '0.1.0', data: { settings, ...empty } }),
    );
    const result = readBackup(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.data.settings.currency).toBe('EUR');
  });

  it('refuses a file that is not a Saldo backup', () => {
    expect(readBackup('{"format":"other","version":1}').ok).toBe(false);
    expect(readBackup('not json').ok).toBe(false);
  });

  it('refuses a newer format version, by name', () => {
    const result = readBackup('{"format":"saldo-backup","version":2,"exportedAt":"2026-09-11T08:00:00.000Z","app":{"version":"9"},"data":{}}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('version');
  });

  it('reports how many rows are invalid rather than dropping them', () => {
    const broken = {
      format: 'saldo-backup',
      version: 1,
      exportedAt: '2026-09-11T08:00:00.000Z',
      app: { version: '0.1.0' },
      data: { settings, ...empty, accounts: [{ ...account, name: '' }] },
    };
    const result = readBackup(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.entity).toBe('account');
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @saldo/core exec vitest run src/io/backup.test.ts`
Expected: FAIL, cannot resolve `./backup`.

- [ ] **Step 3: Write `backup.ts`**

```ts
import { z } from 'zod';
import {
  accountSchema,
  attachmentSchema,
  budgetSchema,
  categorySchema,
  recurrenceSchema,
  settingsSchema,
  tagSchema,
  transactionSchema,
} from '../entities';

/** Bumped only when a backup written by an older app can no longer be read (§11.1). */
export const BACKUP_VERSION = 1;

const dataSchema = z.object({
  settings: settingsSchema,
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  tags: z.array(tagSchema),
  transactions: z.array(transactionSchema),
  recurrences: z.array(recurrenceSchema),
  budgets: z.array(budgetSchema),
  attachments: z.array(attachmentSchema),
});

export type BackupData = z.infer<typeof dataSchema>;

export const backupSchema = z.object({
  format: z.literal('saldo-backup'),
  version: z.number().int(),
  exportedAt: z.iso.datetime(),
  app: z.object({ version: z.string() }),
  data: dataSchema,
});

export type Backup = z.infer<typeof backupSchema>;

export interface BackupRowError {
  entity: string;
  index: number;
  message: string;
}

export type ReadBackupResult =
  | { ok: true; backup: Backup }
  | { ok: false; reason: 'unreadable' | 'not-a-backup' | 'version'; errors: BackupRowError[] }
  | { ok: false; reason: 'invalid'; errors: BackupRowError[] };

export function buildBackup(input: {
  exportedAt: string;
  appVersion: string;
  data: BackupData;
}): Backup {
  return {
    format: 'saldo-backup',
    version: BACKUP_VERSION,
    exportedAt: input.exportedAt,
    app: { version: input.appVersion },
    data: input.data,
  };
}

/**
 * Parses and validates a backup file (§11.1). Every row is checked, and the errors are *counted*
 * rather than skipped: a restore replaces everything on the phone, so it must be all-or-nothing.
 */
export function readBackup(text: string): ReadBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'unreadable', errors: [] };
  }
  const envelope = z
    .object({ format: z.literal('saldo-backup'), version: z.number().int() })
    .safeParse(parsed);
  if (!envelope.success) return { ok: false, reason: 'not-a-backup', errors: [] };
  // A newer file may hold entities this app has never heard of; saying so beats a wall of errors.
  if (envelope.data.version > BACKUP_VERSION) {
    return { ok: false, reason: 'version', errors: [] };
  }
  const result = backupSchema.safeParse(parsed);
  if (result.success) return { ok: true, backup: result.data };
  return { ok: false, reason: 'invalid', errors: rowErrors(result.error) };
}

/** Zod issue paths look like `data.accounts.3.name`; the first two segments name the row. */
function rowErrors(error: z.ZodError): BackupRowError[] {
  const seen = new Map<string, BackupRowError>();
  for (const issue of error.issues) {
    const [root, collection, index] = issue.path;
    if (root !== 'data' || typeof collection !== 'string') continue;
    const at = typeof index === 'number' ? index : 0;
    const key = `${collection}:${at}`;
    if (seen.has(key)) continue;
    seen.set(key, { entity: singular(collection), index: at, message: issue.message });
  }
  return [...seen.values()];
}

function singular(collection: string): string {
  if (collection === 'settings') return 'settings';
  return collection.endsWith('ies')
    ? `${collection.slice(0, -3)}y`
    : collection.replace(/s$/, '');
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm --filter @saldo/core exec vitest run src/io/backup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/io
git commit -m "feat(core): backup envelope with per-row validation"
```

---

### Task 2: CSV export

**Files:**
- Create: `packages/core/src/io/csv.ts`, `packages/core/src/io/csv.test.ts`

- [ ] **Step 1: Write the failing test**

Cover, at minimum:
- the header row of §11.2, in order;
- `\r\n` endings and a leading BOM;
- a description containing `"`, `,` and a newline is quoted and its quotes doubled;
- amount is positive with a `.` separator and no grouping, for both an expense and an income;
- a transfer names both accounts and has no category;
- tags joined with `|`, and a row with no tags leaves the field empty;
- `excluded` and `recurring` are `true`/`false`;
- a category with a parent fills `parent_category`.

```ts
import { describe, expect, it } from 'vitest';
import { csvRows, toCsv } from './csv';

// …fixtures: one expense with two tags, one income, one transfer…

describe('toCsv', () => {
  it('writes RFC 4180 with a BOM and CRLF', () => {
    const csv = toCsv([['date', 'type'], ['2026-04-18', 'expense']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿date,type\r\n2026-04-18,expense\r\n');
  });

  it('quotes a field that holds a comma, a quote or a newline', () => {
    expect(toCsv([['a,b', 'say "hi"', 'two\nlines']])).toBe(
      '﻿"a,b","say ""hi""","two\nlines"\r\n',
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Write `csv.ts`**

```ts
import type { Account, Category, Tag, Transaction } from '../entities';
import { formatMinorUnits } from '../money';

const HEADER = [
  'date',
  'type',
  'amount',
  'currency',
  'account',
  'to_account',
  'category',
  'parent_category',
  'description',
  'note',
  'tags',
  'excluded',
  'recurring',
  'id',
] as const;

/** RFC 4180: `"` doubles, and a field holding `,`, `"` or a newline is quoted. */
function field(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * §11.2. The BOM is what makes Excel read the file as UTF-8; `\r\n` is what RFC 4180 asks for and
 * what Windows spreadsheets expect.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return `﻿${rows.map((row) => row.map(field).join(',')).join('\r\n')}\r\n`;
}

export interface CsvContext {
  currency: string;
  accounts: readonly Account[];
  categories: readonly Category[];
  tags: readonly Tag[];
}

/** Header row plus one row per transaction, in the order given. */
export function csvRows(
  transactions: readonly Transaction[],
  context: CsvContext,
): string[][] {
  const accountName = new Map(context.accounts.map((a) => [a.id, a.name]));
  const category = new Map(context.categories.map((c) => [c.id, c]));
  const tagName = new Map(context.tags.map((t) => [t.id, t.name]));
  const rows: string[][] = [[...HEADER]];
  for (const tx of transactions) {
    const own = tx.categoryId === null ? undefined : category.get(tx.categoryId);
    const parent = own?.parentId === null || own?.parentId === undefined
      ? undefined
      : category.get(own.parentId);
    rows.push([
      tx.date,
      tx.kind,
      // Always positive: the `type` column carries the sign, which is what §11.2 specifies.
      formatMinorUnits(Math.abs(tx.amount)),
      context.currency,
      accountName.get(tx.accountId) ?? '',
      tx.toAccountId === null ? '' : (accountName.get(tx.toAccountId) ?? ''),
      own?.name ?? '',
      parent?.name ?? '',
      tx.description ?? '',
      tx.note ?? '',
      tx.tagIds.map((id) => tagName.get(id) ?? '').filter((name) => name !== '').join('|'),
      String(tx.excludeFromTotals),
      String(tx.recurrenceId !== null),
      tx.id,
    ]);
  }
  return rows;
}
```

If `formatMinorUnits` (plain `12345` → `123.45`, no grouping, no symbol) does not exist in `money.ts`, add it there
with its own test rather than formatting inline: money formatting belongs in one place.

- [ ] **Step 4: Run the tests, then export the module.**

`packages/core/src/io/index.ts`:
```ts
export * from './backup';
export * from './csv';
```
and add `export * from './io';` to `packages/core/src/index.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): CSV export of transactions"
```

---

### Task 3: Writing and sharing the file

**Files:**
- Create: `apps/mobile/src/io/exportService.ts`
- Modify: `apps/mobile/package.json` (`expo-sharing`, `expo-file-system`, `expo-document-picker`)

- [ ] **Step 1: Install**

```bash
pnpm --filter mobile exec npx expo install expo-sharing expo-file-system expo-document-picker
```

- [ ] **Step 2: Write the service**

It exposes two functions, both taking the repositories and returning the path they wrote:

```ts
export async function exportBackup(repos: Repositories, now: Date): Promise<string>;
export async function exportCsv(
  repos: Repositories,
  range: DateRange | null,
  now: Date,
): Promise<string>;
```

- Filenames: `saldo-backup-YYYY-MM-DD.json`, `saldo-transactions-YYYY-MM-DD.csv` (§11.1).
- Written under `Paths.cache` — a file the user has shared does not belong in the app's documents.
- `range === null` means everything; otherwise transactions are filtered on `date` before `csvRows`.
- Rows come from the repositories' `list()`, which already excludes tombstones.
- Sharing is the caller's job (the screen), so the service stays testable.

- [ ] **Step 3: Commit.**

---

### Task 4: Restore

**Files:**
- Create: `apps/mobile/src/io/restoreService.ts`

- [ ] **Step 1: Write `applyRestore`**

```ts
export function applyRestore(
  db: RepositoryDatabase,
  repos: Repositories,
  backup: Backup,
): { replaced: number };
```

- One `db.transaction`: tombstone every existing row through the repositories (so each gets a fresh
  HLC and syncs as a deletion), then insert the backup's rows.
- Inserted rows keep their **own ids** — a restore onto the same account must converge, not duplicate — but get
  fresh HLC stamps, so they beat whatever the server still holds (§11.1).
- Settings are updated, not inserted: the row id is fixed (`'settings'`).
- Order matters for foreign keys: accounts → categories → tags → recurrences → transactions → budgets.

- [ ] **Step 2: Test it against better-sqlite3**

`apps/mobile/src/io/restoreService.test.ts`, in the `db` jest project: seed two accounts and a transaction, build a
backup of a *different* shape, restore it, and assert the old rows are tombstones and the new ones are present with
`syncState = PENDING`.

- [ ] **Step 3: Commit.**

---

### Task 5: The screens

**Files:**
- Create: `apps/mobile/app/profile/export.tsx`
- Modify: `apps/mobile/app/profile.tsx`

- [ ] **Step 1: Export screen** — a Card with three rows: "Backup completo (JSON)", "Transazioni del periodo (CSV)",
"Tutte le transazioni (CSV)". Each writes its file, then `Sharing.shareAsync(path)`. Errors show in a `Text` with
`color="accent"`, successes in a toast.

- [ ] **Step 2: Restore** — a row on the same screen: `DocumentPicker.getDocumentAsync({ type: 'application/json' })`
→ read → `readBackup` → on failure show the reason and, for `invalid`, "N righe non valide" → on success a
`ConfirmDialog` whose body says it replaces everything on this phone → `applyRestore` → toast with the count →
`router.replace('/')`.

- [ ] **Step 3: Wire the profile rows** — "Esporta dati" and "Ripristina backup" navigate to `/profile/export`
instead of showing the "soon" badge. "Importa CSV" keeps its badge: that is 09c.

- [ ] **Step 4: Strings** in both locales.

- [ ] **Step 5: Commit.**

---

### Task 6: Verification

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` — read the output, not the exit code.
- [ ] Round-trip test (the roadmap's acceptance): export a backup from a seeded database, wipe it, restore, and
  assert every entity matches what was exported.
- [ ] On the simulator: export a CSV and check the file opens with the columns of §11.2.
- [ ] Update the roadmap: 09a done.
