# Delete all data from Settings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Delete all data" row in Profile that deletes every synced row and attachment of the account — on this
phone, on the server and on every other phone signed in to it — keeps the user signed in, and sends them back to
onboarding.

**Architecture:** The server keeps a per-account **data epoch** (`data_epochs`, starts at 0). `DELETE /api/data`
deletes the account's `sync_rows`, queues its blobs for deletion and bumps the epoch, all in one transaction. Every
push and pull names the epoch the device holds; a mismatch answers `409 data_reset`. A device that gets it fetches the
new epoch (`GET /api/data`), empties its synced tables and attachment files, and runs the cycle again — so its pending
writes are dropped instead of resurrecting deleted data. The phone that asks for the deletion does it inside
`scheduler.exclusive`, so no cycle can interleave, and then returns to the boot router, which sees no settings and
opens onboarding.

**Tech Stack:** Next.js route handlers + Drizzle (Postgres, PGlite in tests, vitest); Expo Router + Drizzle SQLite
(better-sqlite3 in tests, jest-expo); `@saldo/core` Zod protocol; `@saldo/i18n` catalogs.

**Branch:** `feat/delete-all-data`. The item leaves `TODO.md` in the last commit.

---

## Decisions

**Decided with the user (2026-09-17):**

- "Everything" is **phone + server + every other device** of the account. The passkey account itself stays.
- Afterwards the user **stays signed in** and lands on **onboarding**.
- Confirmation is a **pushed screen** explaining what goes, with the button enabled only after typing a word
  (`ELIMINA` / `DELETE`).

**Why an epoch and not tombstones.** Tombstoning every row through normal sync needs no new route, but it keeps every
row's shell on the server forever, and a phone that was offline with pending writes pushes them with a *newer* HLC
afterwards — last-writer-wins brings the deleted data back. The epoch makes those writes refusable: they were written
against a generation of the account that no longer exists.

**Decisions where the spec is silent** (recorded here per AGENTS.md):

- `epoch` is **optional** in the push body and the pull query. A device that has never learned it (fresh sign-in)
  asks `GET /api/data` before its first push, so in practice every cycle sends it; the optional form only keeps the
  request schema readable by the existing route tests. `SYNC_SCHEMA_VERSION` stays at 1 (no public users yet).
- The push checks the epoch **under a share lock** on the `data_epochs` row, inside the same transaction as the
  upserts, and the deletion takes the row lock with its `UPDATE`. A push that started before a deletion therefore
  either commits before it (and its rows are deleted) or waits and is refused. The pull only reads the epoch: a page
  read just before a deletion is harmless, because the next cycle is refused and empties the phone.
- Blobs are not deleted inline. Their ids go into `deleted_blobs` with a `tombstoned_at` already past the grace period
  (nobody else can still need bytes whose rows are gone everywhere), and the route drains the queue in the background;
  later pushes finish anything left, exactly as §10 cleanup already does.
- Device-local keys that **survive** the deletion: `deviceId`, `hlc`, `accountId` (`DEVICE_ACCOUNT_KEY`) and
  `appLockEnabled` — they describe the phone and the session, not the data. `syncCursor` goes; `syncEpoch` is set to
  the new epoch. "Esci" keeps `syncEpoch`, so a phone that signed out before the deletion is still refused when it
  signs back in.
- The phone that was reset from elsewhere shows a toast ("All data was deleted from another device") and, if it has
  no settings left, returns to the boot router. The toast is carried by a `dataResetNotice` kv key, because the sync
  provider sits above the toast provider.
- A build with no server (`api === null`) deletes the phone only; there is no other copy.
- If the session has expired, the deletion is refused with a message asking to sign in again: deleting the phone
  alone would be undone by the next sign-in.
- The developer "Reset this phone" row stays as it is (it signs out and wipes `kv`).

**Found while executing:**

- A third `ApiClient` fake, in `src/sync/blobSync.test.ts`, also needed `delete` (Task 6), and the `Scheduler` fake in
  `src/sync/useSyncRefresh.test.tsx` needed `exclusive` (Task 8).
- `app/profile/delete-data.tsx` is a new route, so `router.push('/profile/delete-data')` fails `tsc` until Expo
  regenerates `.expo/types/router.d.ts` (it is git-ignored). Starting `expo start` once regenerates it.
- Passing a Drizzle transaction where `ServerDatabase` is expected typechecks as is; no fallback was needed.

---

## File map

| File | Change |
| --- | --- |
| `packages/core/src/sync/protocol.ts` (+ test) | `dataEpochSchema`, `dataEpochResponseSchema`, `DATA_RESET_CODE`, `epoch?` on `pushRequestSchema` |
| `apps/web/src/server/db/schema.ts`, `apps/web/drizzle/0003_*.sql` | `data_epochs` table + generated migration |
| `apps/web/src/server/test/harness.ts` | truncate `data_epochs` |
| `apps/web/src/server/sync/epoch.ts` (+ test) | `readEpoch`, `lockEpoch`, `assertEpoch`, `deleteAccountData` |
| `apps/web/app/api/sync/push/route.ts`, `apps/web/app/api/sync/pull/route.ts` | epoch check |
| `apps/web/app/api/data/route.ts` (+ test) | `GET` epoch, `DELETE` everything |
| `apps/mobile/src/db/wipe.ts` (+ test) | `wipeAccountData`, `SYNC_EPOCH_KEY`, `DATA_RESET_NOTICE_KEY` |
| `apps/mobile/src/net/apiClient.ts` (+ test) | `delete` method |
| `apps/mobile/src/sync/client.ts` (+ `client.test.ts`, `convergence.test.ts`) | send epoch, adopt a reset |
| `apps/mobile/src/sync/scheduler.ts` (+ test) | `exclusive` |
| `apps/mobile/src/sync/SyncProvider.tsx` | pass `deleteAttachmentFiles` |
| `apps/mobile/src/features/deleteData/deleteAllData.ts` (+ test) | the flow the screen runs |
| `apps/mobile/src/features/deleteData/confirmWord.ts` (+ test) | typed-word match |
| `apps/mobile/src/features/deleteData/useLeaveWhenDataGone.ts` | toast + back to boot when the data vanished |
| `apps/mobile/app/profile/delete-data.tsx` | confirmation screen |
| `apps/mobile/app/profile.tsx`, `apps/mobile/app/(tabs)/_layout.tsx` | row; mount the hook |
| `packages/i18n/src/locales/it.ts`, `en.ts` | `profile.deleteAllData`, `deleteData.*` |
| `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`, `TODO.md`, `docs/superpowers/plans/README.md` | docs |

---

### Task 1: Protocol — the epoch in `@saldo/core`

**Files:**
- Modify: `packages/core/src/sync/protocol.ts`
- Test: `packages/core/src/sync/protocol.test.ts`

- [x] **Step 1: Write the failing test**

Add `dataEpochResponseSchema` and `DATA_RESET_CODE` to the import list at the top of `protocol.test.ts`, then append:

```ts
describe('data epoch', () => {
  it('lets a push name the generation it was written against, and accepts one that does not', () => {
    const base = { schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'device-a', changes: [] };
    expect(pushRequestSchema.parse({ ...base, epoch: 3 }).epoch).toBe(3);
    expect(pushRequestSchema.parse(base).epoch).toBeUndefined();
    expect(pushRequestSchema.safeParse({ ...base, epoch: -1 }).success).toBe(false);
  });

  it('reads the epoch the server answers with', () => {
    expect(dataEpochResponseSchema.parse({ epoch: 0 })).toEqual({ epoch: 0 });
    expect(dataEpochResponseSchema.safeParse({ epoch: 1.5 }).success).toBe(false);
    expect(DATA_RESET_CODE).toBe('data_reset');
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter @saldo/core test -- src/sync/protocol.test.ts`
Expected: FAIL — `dataEpochResponseSchema` is not exported.

- [x] **Step 3: Implement**

In `protocol.ts`, directly above `pushRequestSchema`, add:

```ts
/**
 * §8.6. Which generation of an account's data a device holds. It starts at 0 and goes up by one
 * every time the account's data is deleted, so a device still holding the previous generation can
 * be told so instead of pushing deleted rows back.
 */
export const dataEpochSchema = z.number().int().nonnegative();

/** `GET /api/data` and `DELETE /api/data`. */
export const dataEpochResponseSchema = z.object({ epoch: dataEpochSchema });

export type DataEpochResponse = z.infer<typeof dataEpochResponseSchema>;

/** The 409 a push or a pull answers when the device holds an earlier generation (§8.6). */
export const DATA_RESET_CODE = 'data_reset';
```

and change `pushRequestSchema` to:

```ts
export const pushRequestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  deviceId: z.string().min(1).max(128),
  /**
   * The generation these changes were written against. Optional only so a request that predates
   * §8.6 still parses; the app always sends it.
   */
  epoch: dataEpochSchema.optional(),
  changes: z.array(syncChangeEnvelopeSchema).max(MAX_CHANGES_PER_PUSH),
});
```

- [x] **Step 4: Run it and watch it pass**

Run: `rtk proxy pnpm --filter @saldo/core test -- src/sync/protocol.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/sync/protocol.ts packages/core/src/sync/protocol.test.ts
git commit -m "feat(core): a data epoch in the sync protocol"
```

---

### Task 2: Server table `data_epochs`

**Files:**
- Modify: `apps/web/src/server/db/schema.ts`
- Modify: `apps/web/src/server/test/harness.ts`
- Create: `apps/web/drizzle/0003_*.sql` (generated) and its `meta/` snapshot
- Test: `apps/web/src/server/db/schema.test.ts`

- [x] **Step 1: Write the failing test**

In `schema.test.ts`, import `dataEpochs` next to `invites, syncRows, user`, and add inside `describe('schema', …)`:

```ts
  it('keeps one epoch per account, gone with the account', async () => {
    const { db } = harness;
    const { userId } = await createTestSession(db);
    await db.insert(dataEpochs).values({ userId });

    const [row] = await db.select().from(dataEpochs).where(eq(dataEpochs.userId, userId));
    expect(row).toEqual({ userId, epoch: 0, resetAt: null });

    await db.delete(user).where(eq(user.id, userId));
    expect(await db.select().from(dataEpochs)).toEqual([]);
  });
```

- [x] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter web test -- src/server/db/schema.test.ts`
Expected: FAIL — `dataEpochs` is not exported.

- [x] **Step 3: Add the table**

In `schema.ts`, add `integer` to the `drizzle-orm/pg-core` import, and after `deletedBlobs`:

```ts
/**
 * §8.6. Which generation of its data an account is on. No row means generation 0: the row is
 * written the first time a push needs to lock it or the data is deleted.
 *
 * Its own table rather than a column on `user`, which Better Auth generates and owns.
 */
export const dataEpochs = pgTable('data_epochs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  epoch: integer('epoch').notNull().default(0),
  /** When the account's data was last deleted; null if it never was. */
  resetAt: timestamp('reset_at', { withTimezone: true }),
});
```

Add `dataEpochs,` to the `schema` object after `deletedBlobs,`.

In `harness.ts`, change the truncate statement to:

```ts
        sql`truncate table sync_rows, deleted_blobs, data_epochs, invites, passkey, session, account, verification, "user" cascade`,
```

- [x] **Step 4: Generate the migration**

Run: `pnpm --filter web db:generate`
Expected: a new `apps/web/drizzle/0003_<random>.sql` containing `CREATE TABLE "data_epochs"` and a foreign key to
`user` with `ON DELETE cascade`, plus `meta/0003_snapshot.json` and an updated `_journal.json`. Read the SQL; it must
contain nothing else.

- [x] **Step 5: Run it and watch it pass**

Run: `rtk proxy pnpm --filter web test -- src/server/db/schema.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/server/db/schema.ts apps/web/src/server/db/schema.test.ts apps/web/src/server/test/harness.ts apps/web/drizzle
git commit -m "feat(web): a data_epochs table for account data generations"
```

---

### Task 3: Server epoch service

**Files:**
- Create: `apps/web/src/server/sync/epoch.ts`
- Test: `apps/web/src/server/sync/epoch.test.ts`

- [x] **Step 1: Write the failing test**

Create `apps/web/src/server/sync/epoch.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { drainDeletedBlobs } from '../attachments/cleanup';
import { deletedBlobs, syncRows } from '../db/schema';
import { ApiError } from '../http/errors';
import { createFsStore } from '../storage/fsStore';
import { objectKey } from '../storage/types';
import { createTestDatabase, type TestDatabase } from '../test/harness';
import { createTestSession } from '../test/session';
import { assertEpoch, deleteAccountData, lockEpoch, readEpoch } from './epoch';

let harness: TestDatabase;
let dir: string;
let userId: string;

const NOW = new Date('2026-09-17T10:00:00.000Z');
const BYTES = new Uint8Array([1, 2, 3]);

async function insertRow(owner: string, entity: string, id: string): Promise<void> {
  await harness.db.insert(syncRows).values({
    userId: owner,
    entity,
    id,
    updatedAt: '001775000000000-0000-device-a',
    deletedAt: null,
    data: { id },
    seq: 1,
  });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'saldo-epoch-'));
  userId = (await createTestSession(harness.db)).userId;
});

afterEach(async () => {
  await harness.reset();
  await rm(dir, { recursive: true, force: true });
});

afterAll(async () => {
  await harness.close();
});

describe('readEpoch', () => {
  it('is 0 for an account whose data was never deleted', async () => {
    expect(await readEpoch(harness.db, userId)).toBe(0);
  });
});

describe('lockEpoch', () => {
  it('answers the current epoch inside a transaction, creating the row it locks', async () => {
    const epoch = await harness.db.transaction((tx) => lockEpoch(tx, userId));
    expect(epoch).toBe(0);
    await deleteAccountData(harness.db, userId, NOW);
    expect(await harness.db.transaction((tx) => lockEpoch(tx, userId))).toBe(1);
  });
});

describe('assertEpoch', () => {
  it('lets through a device on the current generation, or one that does not say', () => {
    expect(() => assertEpoch(2, 2)).not.toThrow();
    expect(() => assertEpoch(undefined, 2)).not.toThrow();
  });

  it('refuses a device on an earlier generation with 409 data_reset', () => {
    try {
      assertEpoch(1, 2);
      expect.unreachable('assertEpoch should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 409, code: 'data_reset' });
    }
  });
});

describe('deleteAccountData', () => {
  it("deletes the account's rows, and nobody else's", async () => {
    const other = (await createTestSession(harness.db, 'Bob')).userId;
    await insertRow(userId, 'tag', 'tag-1');
    await insertRow(userId, 'transaction', 'tx-1');
    await insertRow(other, 'tag', 'tag-2');

    await deleteAccountData(harness.db, userId, NOW);

    expect(await harness.db.select().from(syncRows).where(eq(syncRows.userId, userId))).toEqual(
      [],
    );
    expect(await harness.db.select().from(syncRows).where(eq(syncRows.userId, other))).toHaveLength(
      1,
    );
  });

  it('moves the epoch up by one each time', async () => {
    expect(await deleteAccountData(harness.db, userId, NOW)).toBe(1);
    expect(await deleteAccountData(harness.db, userId, NOW)).toBe(2);
    expect(await readEpoch(harness.db, userId)).toBe(2);
  });

  it('queues the attachment bytes so the next drain deletes them', async () => {
    const store = createFsStore(dir);
    const meta = { size: BYTES.byteLength, mimeType: 'image/jpeg' };
    await store.put(objectKey(userId, 'att-1'), BYTES, meta);
    await insertRow(userId, 'attachment', 'att-1');
    await insertRow(userId, 'tag', 'tag-1');

    await deleteAccountData(harness.db, userId, NOW);

    const queued = await harness.db.select().from(deletedBlobs);
    expect(queued.map((row) => row.attachmentId)).toEqual(['att-1']);
    // No grace period: the rows are gone everywhere, so no device can still need the bytes.
    expect(await drainDeletedBlobs(harness.db, store, NOW)).toBe(1);
    expect(await store.head(objectKey(userId, 'att-1'))).toBeNull();
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter web test -- src/server/sync/epoch.test.ts`
Expected: FAIL — cannot resolve `./epoch`.

- [x] **Step 3: Implement**

Create `apps/web/src/server/sync/epoch.ts`:

```ts
import { DATA_RESET_CODE } from '@saldo/core';
import { eq, sql } from 'drizzle-orm';
import { BLOB_GRACE_DAYS } from '../attachments/cleanup';
import { dataEpochs, syncRows } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { ApiError } from '../http/errors';

/** §8.6. The generation the account's data is on; 0 for an account that never deleted it. */
export async function readEpoch(db: ServerDatabase, userId: string): Promise<number> {
  const [row] = await db
    .select({ epoch: dataEpochs.epoch })
    .from(dataEpochs)
    .where(eq(dataEpochs.userId, userId))
    .limit(1);
  return row?.epoch ?? 0;
}

/**
 * The epoch, read under a share lock that holds until the surrounding transaction ends. A push
 * takes it before writing, and `deleteAccountData` needs the row lock to bump the epoch, so the
 * two cannot interleave: a push either lands before the deletion, and is deleted with the rest, or
 * waits for it and is refused.
 *
 * The row is created first because `FOR SHARE` on a row that does not exist locks nothing.
 */
export async function lockEpoch(tx: ServerDatabase, userId: string): Promise<number> {
  await tx.insert(dataEpochs).values({ userId }).onConflictDoNothing();
  const [row] = await tx
    .select({ epoch: dataEpochs.epoch })
    .from(dataEpochs)
    .where(eq(dataEpochs.userId, userId))
    .for('share');
  return row?.epoch ?? 0;
}

/**
 * Refuses a device holding an earlier generation. `undefined` is a device that has not said which
 * one it holds — a request from before §8.6 — and is let through.
 */
export function assertEpoch(expected: number | undefined, current: number): void {
  if (expected === undefined || expected === current) return;
  throw new ApiError(
    409,
    DATA_RESET_CODE,
    `This device holds generation ${expected} of the account's data; the server is on ${current}.`,
  );
}

/**
 * §8.6. Deletes every synced row of the account and moves its epoch up by one, in one transaction.
 * Returns the new epoch.
 *
 * The attachment bytes are queued rather than deleted here: the store may be slow or remote, and a
 * failure there must not keep the rows. They are queued as already past the grace period of §10,
 * which exists so other devices can converge — and after this there is nothing left to converge on.
 */
export async function deleteAccountData(
  db: ServerDatabase,
  userId: string,
  now: Date,
): Promise<number> {
  const due = new Date(now.getTime() - BLOB_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    const [bumped] = await tx
      .insert(dataEpochs)
      .values({ userId, epoch: 1, resetAt: now })
      .onConflictDoUpdate({
        target: dataEpochs.userId,
        set: { epoch: sql`${dataEpochs.epoch} + 1`, resetAt: now },
      })
      .returning({ epoch: dataEpochs.epoch });
    if (bumped === undefined) throw new Error('data_epochs upsert returned no row');

    // One statement, not a values list: an account may hold more attachments than a single
    // statement can take parameters.
    await tx.execute(sql`
      insert into deleted_blobs (user_id, attachment_id, tombstoned_at)
      select user_id, id, ${due.toISOString()}::timestamptz
      from sync_rows
      where user_id = ${userId} and entity = 'attachment'
      on conflict (user_id, attachment_id) do update set tombstoned_at = excluded.tombstoned_at
    `);
    await tx.delete(syncRows).where(eq(syncRows.userId, userId));
    return bumped.epoch;
  });
}
```

If `tsc` rejects passing `tx` where `ServerDatabase` is expected (drizzle's `PgTransaction` extends `PgDatabase`, so
it should not), widen the parameter of `lockEpoch` to
`Pick<ServerDatabase, 'insert' | 'select'>` and record the change in this plan.

- [x] **Step 4: Run it and watch it pass**

Run: `rtk proxy pnpm --filter web test -- src/server/sync/epoch.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add apps/web/src/server/sync/epoch.ts apps/web/src/server/sync/epoch.test.ts
git commit -m "feat(web): delete an account's data and move its epoch"
```

---

### Task 4: Server routes — `/api/data` and the epoch check on sync

**Files:**
- Create: `apps/web/app/api/data/route.ts`
- Modify: `apps/web/app/api/sync/push/route.ts`
- Modify: `apps/web/app/api/sync/pull/route.ts`
- Test: `apps/web/app/api/data/route.test.ts`

- [x] **Step 1: Write the failing test**

Create `apps/web/app/api/data/route.test.ts`:

```ts
import { SYNC_SCHEMA_VERSION } from '@saldo/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';
import { GET as pull } from '../sync/pull/route';
import { POST as push } from '../sync/push/route';
import { DELETE as deleteData, GET as readData } from './route';

let harness: TestDatabase;
let bearer: string;
const WALL = String(Date.now()).padStart(15, '0');

function tagChange(id: string) {
  const updatedAt = `${WALL}-0000-device-a`;
  return {
    entity: 'tag',
    id,
    updatedAt,
    deletedAt: null,
    data: { id, createdAt: '2026-09-17T09:00:00.000Z', updatedAt, deletedAt: null, name: id },
  };
}

function pushAs(auth: string, body: Record<string, unknown>): Promise<Response> {
  return push(
    new Request('http://localhost/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ schemaVersion: SYNC_SCHEMA_VERSION, deviceId: 'device-a', ...body }),
      headers: { 'content-type': 'application/json', authorization: auth },
    }),
  );
}

function pullAs(auth: string, query: string): Promise<Response> {
  return pull(
    new Request(`http://localhost/api/sync/pull?${query}`, { headers: { authorization: auth } }),
  );
}

function dataRequest(method: 'GET' | 'DELETE', auth?: string): Request {
  return new Request('http://localhost/api/data', {
    method,
    headers: auth === undefined ? {} : { authorization: auth },
  });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  bearer = (await createTestSession(harness.db)).bearer;
});

afterEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

describe('/api/data', () => {
  it('requires a bearer', async () => {
    expect((await readData(dataRequest('GET'))).status).toBe(401);
    expect((await deleteData(dataRequest('DELETE'))).status).toBe(401);
  });

  it('answers epoch 0 for an account whose data was never deleted', async () => {
    const response = await readData(dataRequest('GET', bearer));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ epoch: 0 });
  });

  it('deletes everything and answers the new epoch', async () => {
    await pushAs(bearer, { epoch: 0, changes: [tagChange('tag-1')] });

    const deleted = await deleteData(dataRequest('DELETE', bearer));
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ epoch: 1 });

    await expect((await readData(dataRequest('GET', bearer))).json()).resolves.toEqual({
      epoch: 1,
    });
    const page = await pullAs(bearer, 'since=0&epoch=1');
    await expect(page.json()).resolves.toMatchObject({ changes: [], hasMore: false });
  });

  it("leaves another account's data alone", async () => {
    const other = await createTestSession(harness.db, 'Bob');
    await pushAs(other.bearer, { epoch: 0, changes: [tagChange('tag-bob')] });

    await deleteData(dataRequest('DELETE', bearer));

    const page = await pullAs(other.bearer, 'since=0&epoch=0');
    const body = (await page.json()) as { changes: { id: string }[] };
    expect(body.changes.map((change) => change.id)).toEqual(['tag-bob']);
  });
});

describe('sync after a deletion', () => {
  it('refuses a push written against the previous generation, and writes nothing', async () => {
    await deleteData(dataRequest('DELETE', bearer));

    const refused = await pushAs(bearer, { epoch: 0, changes: [tagChange('tag-offline')] });
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: 'data_reset' } });

    const page = await pullAs(bearer, 'since=0&epoch=1');
    await expect(page.json()).resolves.toMatchObject({ changes: [] });
  });

  it('refuses a pull from the previous generation', async () => {
    await deleteData(dataRequest('DELETE', bearer));
    const refused = await pullAs(bearer, 'since=0&epoch=0');
    expect(refused.status).toBe(409);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: 'data_reset' } });
  });

  it('accepts a push on the new generation, and one that names none', async () => {
    await deleteData(dataRequest('DELETE', bearer));
    expect((await pushAs(bearer, { epoch: 1, changes: [tagChange('tag-new')] })).status).toBe(200);
    expect((await pushAs(bearer, { changes: [tagChange('tag-unnamed')] })).status).toBe(200);
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter web test -- app/api/data/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [x] **Step 3: Create the route**

Create `apps/web/app/api/data/route.ts`:

```ts
import { drainDeletedBlobs, MAX_DELETIONS_PER_PUSH } from '../../../src/server/attachments/cleanup';
import { getDb } from '../../../src/server/db/client';
import { handle } from '../../../src/server/http/errors';
import { requireUser } from '../../../src/server/http/requireUser';
import { log, shortId } from '../../../src/server/log';
import { getStore } from '../../../src/server/storage';
import { deleteAccountData, readEpoch } from '../../../src/server/sync/epoch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** §8.6: which generation of its data the account is on. */
export function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser(request);
    return Response.json({ epoch: await readEpoch(getDb(), user.id) });
  });
}

/** §8.6: deletes every synced row and attachment of the account. The account itself stays. */
export function DELETE(request: Request): Promise<Response> {
  return handle(async () => {
    const now = new Date();
    const user = await requireUser(request);
    const epoch = await deleteAccountData(getDb(), user.id, now);
    log('sync', `deleted all data of ${shortId(user.id)}`, { epoch });

    // The bytes go after the answer, and their failures stay here, as on push (§10): the rows are
    // already gone, and whatever is left in the queue is drained by later pushes.
    void (async () => {
      const store = await getStore();
      if (store === null) return;
      let deleted = MAX_DELETIONS_PER_PUSH;
      while (deleted === MAX_DELETIONS_PER_PUSH) {
        deleted = await drainDeletedBlobs(getDb(), store, now);
      }
    })().catch((error: unknown) => {
      console.error('[saldo] blob cleanup after a data deletion failed', error);
    });

    return Response.json({ epoch });
  });
}
```

- [x] **Step 4: Check the epoch on push**

In `apps/web/app/api/sync/push/route.ts`, add the import:

```ts
import { assertEpoch, lockEpoch } from '../../../../src/server/sync/epoch';
```

and replace `const results = await applyPush(getDb(), user.id, body, now);` with:

```ts
    // §8.6: under the epoch's share lock, so a deletion cannot land between the check and the
    // writes and leave rows of the previous generation behind.
    const results = await getDb().transaction(async (tx) => {
      assertEpoch(body.epoch, await lockEpoch(tx, user.id));
      return applyPush(tx, user.id, body, now);
    });
```

- [x] **Step 5: Check the epoch on pull**

In `apps/web/app/api/sync/pull/route.ts`, add the import:

```ts
import { assertEpoch, readEpoch } from '../../../../src/server/sync/epoch';
```

extend `querySchema`:

```ts
const querySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(MAX_CHANGES_PER_PULL).default(MAX_CHANGES_PER_PULL),
  /** §8.6. Absent only on a request from before the epoch existed. */
  epoch: z.coerce.number().int().nonnegative().optional(),
});
```

pass it in the `safeParse` call:

```ts
    const parsed = querySchema.safeParse({
      since: url.searchParams.get('since') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      epoch: url.searchParams.get('epoch') ?? undefined,
    });
```

and, right after the `invalid_query` check, before `const startedAt`:

```ts
    // A read, not a lock: a page read just before a deletion is harmless, because the device's
    // next request is refused and it empties itself (§8.6).
    assertEpoch(parsed.data.epoch, await readEpoch(getDb(), user.id));
```

Also update the `invalid_query` message to `'since, limit and epoch must be non-negative integers'`.

- [x] **Step 6: Run the route tests**

Run: `rtk proxy pnpm --filter web test -- app/api`
Expected: PASS, including the existing `sync/push/route.test.ts` and `attachments.test.ts`.

- [x] **Step 7: Typecheck the server**

Run: `rtk proxy pnpm --filter web typecheck`
Expected: no errors. If `applyPush(tx, …)` is rejected, apply the fallback noted in Task 3 to `applyPush` and
`nextSeq` too, and record it here.

- [x] **Step 8: Commit**

```bash
git add apps/web/app/api/data apps/web/app/api/sync/push/route.ts apps/web/app/api/sync/pull/route.ts
git commit -m "feat(web): DELETE /api/data, and sync refuses a deleted generation"
```

---

### Task 5: Mobile — `wipeAccountData`

**Files:**
- Modify: `apps/mobile/src/db/wipe.ts`
- Test: `apps/mobile/src/db/wipe.test.ts`

- [x] **Step 1: Write the failing test**

In `wipe.test.ts`, change the imports to:

```ts
import type { Account, Settings } from '@saldo/core';
import { DEVICE_ACCOUNT_KEY } from '../auth/deviceOwner';
import { schema, syncedTables } from './schema';
import { createTestContext, type TestContext } from './testing';
import { hasLocalData, SYNC_EPOCH_KEY, wipeAccountData, wipeDevice } from './wipe';
```

and append:

```ts
describe('wipeAccountData', () => {
  it('empties every synced table and forgets the cursor', () => {
    const context = createTestContext();
    fill(context);

    wipeAccountData(context.db, 4);

    for (const table of Object.values(syncedTables)) {
      expect(context.db.select().from(table).all()).toEqual([]);
    }
    expect(context.kv.get('syncCursor')).toBeNull();
    expect(context.kv.get(SYNC_EPOCH_KEY)).toBe('4');
  });

  it('keeps what belongs to the phone and the session', () => {
    const context = createTestContext();
    fill(context);
    context.kv.set(DEVICE_ACCOUNT_KEY, 'account-1');
    context.clock.now();
    const deviceId = context.kv.deviceId();
    const hlc = context.kv.get('hlc');

    wipeAccountData(context.db, 1);

    // The user stays signed in (§8.6): the phone is the same phone, on the same account, with the
    // same lock — only the data is new.
    expect(context.kv.deviceId()).toBe(deviceId);
    expect(context.kv.get('hlc')).toBe(hlc);
    expect(context.kv.get(DEVICE_ACCOUNT_KEY)).toBe('account-1');
    expect(context.kv.get('appLockEnabled')).toBe('true');
  });

  it('forgets the epoch when there is no server to have one', () => {
    const context = createTestContext();
    fill(context);
    context.kv.set(SYNC_EPOCH_KEY, '2');

    wipeAccountData(context.db, null);

    expect(context.kv.get(SYNC_EPOCH_KEY)).toBeNull();
  });

  it('leaves no settings, which is what sends boot to onboarding', () => {
    const context = createTestContext();
    fill(context);

    wipeAccountData(context.db, 1);

    expect(context.repos.settings.get()).toBeNull();
    context.repos.settings.create(SETTINGS_INPUT);
    expect(context.repos.settings.get()).not.toBeNull();
  });
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/db/wipe.test.ts`
Expected: FAIL — `wipeAccountData` is not exported.

- [x] **Step 3: Implement**

In `wipe.ts`, change the imports to:

```ts
import { inArray } from 'drizzle-orm';
import type { RepositoryDatabase } from './repositories/support';
import { kv, schema, syncedTables } from './schema';
```

and append:

```ts
/** Device-local: the generation of the account's data this phone holds (§8.6). */
export const SYNC_EPOCH_KEY = 'syncEpoch';

/**
 * Set when a sync found the account's data deleted on another device, and read once by the tabs to
 * say so. A key rather than an event because the sync provider sits above the toast provider.
 */
export const DATA_RESET_NOTICE_KEY = 'dataResetNotice';

/**
 * §8.6. Empties the account's data from this phone and records which generation it now holds —
 * `null` on a build with no server, where there is no generation to hold.
 *
 * Unlike `wipeDevice` this keeps the device's identity, its HLC, the account it is signed in to
 * and the lock: the user stays signed in, and only the data starts again. The cursor goes, because
 * the rows it counted past no longer exist.
 */
export function wipeAccountData(db: RepositoryDatabase, epoch: number | null): void {
  db.transaction((tx) => {
    for (const table of Object.values(syncedTables)) tx.delete(table).run();
    tx.delete(kv)
      .where(inArray(kv.key, ['syncCursor', SYNC_EPOCH_KEY]))
      .run();
    if (epoch !== null) tx.insert(kv).values({ key: SYNC_EPOCH_KEY, value: String(epoch) }).run();
  });
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/db/wipe.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/db/wipe.ts apps/mobile/src/db/wipe.test.ts
git commit -m "feat(mobile): empty the account data and keep the session"
```

---

### Task 6: Mobile — `ApiClient.delete`

**Files:**
- Modify: `apps/mobile/src/net/apiClient.ts`
- Modify: `apps/mobile/src/sync/client.test.ts`, `apps/mobile/src/sync/convergence.test.ts`, `apps/mobile/src/sync/blobSync.test.ts` (fakes only)
- Test: `apps/mobile/src/net/apiClient.test.ts`

- [x] **Step 1: Write the failing test**

Read `apiClient.test.ts` first and follow its existing fake `fetchImpl` pattern. Add a test that:

```ts
  it('sends a DELETE with the session and parses the answer', async () => {
    const seen: Request[] = [];
    const client = createApiClient({
      serverUrl: 'https://saldo.example',
      getAuthHeaders: async () => ({ cookie: 'session=1' }),
      fetchImpl: async (request) => {
        seen.push(request);
        return Response.json({ epoch: 2 });
      },
    });

    await expect(client.delete('/api/data', z.object({ epoch: z.number() }))).resolves.toEqual({
      epoch: 2,
    });
    expect(seen[0]?.method).toBe('DELETE');
    expect(seen[0]?.url).toBe('https://saldo.example/api/data');
    expect(seen[0]?.headers.get('cookie')).toBe('session=1');
  });
```

(Import `z` from `zod` if the file does not already.)

- [x] **Step 2: Run it and watch it fail**

Run: `rtk proxy pnpm --filter mobile test -- src/net/apiClient.test.ts`
Expected: FAIL — `client.delete is not a function`.

- [x] **Step 3: Implement**

In the `ApiClient` interface, after `post`:

```ts
  delete<T>(path: string, schema: z.ZodType<T>): Promise<T>;
```

In the returned object of `createApiClient`, after `post`:

```ts
    delete: (path, schema) => send(path, { method: 'DELETE' }, schema),
```

In the two fakes, add a member after `post`, so they still satisfy the interface:

- `client.test.ts`, inside `fakeApi`: `delete: async () => { throw new Error('not used by the cycle'); },`
- `convergence.test.ts`, inside `apiFor`: `delete: async () => { throw new Error('not used by the cycle'); },`

- [x] **Step 4: Run it and watch it pass**

Run: `rtk proxy pnpm --filter mobile test -- src/net src/sync`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/net apps/mobile/src/sync/client.test.ts apps/mobile/src/sync/convergence.test.ts
git commit -m "feat(mobile): the api client can send a DELETE"
```

---

### Task 7: Mobile sync — send the epoch, adopt a deletion

**Files:**
- Modify: `apps/mobile/src/sync/client.ts`
- Modify: `apps/mobile/src/sync/SyncProvider.tsx`
- Test: `apps/mobile/src/sync/client.test.ts`, `apps/mobile/src/sync/convergence.test.ts`

- [x] **Step 1: Teach the `client.test.ts` fake the epoch**

Change the imports at the top:

```ts
import { type PullResponse, type PushResponse, SYNC_SCHEMA_VERSION } from '@saldo/core';
import { createTestContext } from '../db/testing';
import { DATA_RESET_NOTICE_KEY, SYNC_EPOCH_KEY } from '../db/wipe';
import { type ApiClient, ApiClientError } from '../net/apiClient';
import { runSyncCycle } from './client';
import { errorCount, pendingCount } from './localStore';
```

Replace `PushBody`, `FakeServer` and `fakeApi` with:

```ts
interface PushBody {
  epoch?: number;
  changes: { entity: string; id: string }[];
}

interface FakeServer {
  pushes: PushBody[];
  pushResponse: (body: PushBody) => PushResponse;
  pages: PullResponse[];
  /** The account's data generation; 0 unless a test deletes it. */
  epoch?: number;
  /** How many times the cycle asked `GET /api/data`. */
  epochReads?: number;
}

const refused = () => new ApiClientError(409, 'data_reset', 'deleted elsewhere');

function fakeApi(server: FakeServer): ApiClient {
  let pulls = 0;
  const current = () => server.epoch ?? 0;
  return {
    hasSession: async () => true,
    // Blobs have their own tests; these fakes only move rows.
    putBinary: async () => undefined,
    getBinary: async () => new Uint8Array(),
    post: async (_path, body, schema) => {
      const typed = body as PushBody;
      if (typed.epoch !== undefined && typed.epoch !== current()) throw refused();
      server.pushes.push(typed);
      return schema.parse(server.pushResponse(typed));
    },
    delete: async () => {
      throw new Error('not used by the cycle');
    },
    get: async (path, schema) => {
      const url = new URL(path, 'http://server.invalid');
      if (url.pathname === '/api/data') {
        server.epochReads = (server.epochReads ?? 0) + 1;
        return schema.parse({ epoch: current() });
      }
      const epoch = url.searchParams.get('epoch');
      if (epoch !== null && Number(epoch) !== current()) throw refused();
      const page = server.pages[pulls] ?? EMPTY_PAGE;
      pulls += 1;
      return schema.parse(page);
    },
  };
}
```

(This replaces the `delete` member added in Task 6.)

- [x] **Step 2: Write the failing tests**

Append inside `describe('runSyncCycle', …)`:

```ts
  it('learns the epoch once and sends it with every push and pull', async () => {
    const { db, kv, clock, repos } = createTestContext();
    repos.tags.create({ name: 'Rimborsabile' });
    const server: FakeServer = { pushes: [], pushResponse: appliedTo, pages: [], epoch: 3 };
    const deps = { db, kv, clock, api: fakeApi(server), deviceId: 'device-a' };

    await runSyncCycle(deps);
    repos.tags.create({ name: 'Trasloco' });
    await runSyncCycle(deps);

    expect(kv.get(SYNC_EPOCH_KEY)).toBe('3');
    expect(server.epochReads).toBe(1);
    expect(server.pushes.map((body) => body.epoch)).toEqual([3, 3]);
  });

  it('empties the phone and starts over when the data was deleted on another device', async () => {
    const { db, kv, clock, repos } = createTestContext();
    kv.set(SYNC_EPOCH_KEY, '0');
    kv.set('syncCursor', '40');
    // Written offline, against the generation that was deleted: it must not reach the server.
    repos.tags.create({ name: 'Scritto offline' });
    let filesDeleted = 0;
    const server: FakeServer = {
      pushes: [],
      pushResponse: appliedTo,
      epoch: 1,
      pages: [
        { schemaVersion: SYNC_SCHEMA_VERSION, changes: [row('tag-new', 1)], nextSince: 1, hasMore: false },
      ],
    };

    const outcome = await runSyncCycle({
      db,
      kv,
      clock,
      api: fakeApi(server),
      deviceId: 'device-a',
      deleteAttachmentFiles: () => {
        filesDeleted += 1;
      },
    });

    expect(server.pushes).toEqual([]);
    expect(repos.tags.list().map((tag) => tag.id)).toEqual(['tag-new']);
    expect(outcome.pulled).toBe(1);
    expect(filesDeleted).toBe(1);
    expect(kv.get(SYNC_EPOCH_KEY)).toBe('1');
    expect(kv.get('syncCursor')).toBe('1');
    expect(kv.get(DATA_RESET_NOTICE_KEY)).toBe('true');
  });
```

If `repos.tags.list()` filters or orders in a way that hides `tag-new`, select from the `tags` table directly
(`db.select().from(tags).all()`, importing `tags` from `../db/schema`).

- [x] **Step 3: Run them and watch them fail**

Run: `rtk proxy pnpm --filter mobile test -- src/sync/client.test.ts`
Expected: FAIL — the two new tests (no epoch is sent; the 409 escapes the cycle).

- [x] **Step 4: Implement in `client.ts`**

Change the `@saldo/core` import to add `DATA_RESET_CODE` and `dataEpochResponseSchema`, and add:

```ts
import { DATA_RESET_NOTICE_KEY, SYNC_EPOCH_KEY, wipeAccountData } from '../db/wipe';
```

Add to `SyncDeps`, after `syncBlobs`:

```ts
  /**
   * Deletes this phone's attachment files. Called when the account's data turns out to have been
   * deleted on another device (§8.6); absent in tests that have no files.
   */
  deleteAttachmentFiles?: () => void;
```

Add above `runSyncCycle`:

```ts
/**
 * The generation of the account's data this phone holds (§8.6). Asked of the server once — on the
 * first cycle after signing in — and remembered, so every later push and pull can be refused if
 * the data has been deleted since.
 */
async function knownEpoch(deps: SyncDeps): Promise<number> {
  const stored = Number.parseInt(deps.kv.get(SYNC_EPOCH_KEY) ?? '', 10);
  if (Number.isInteger(stored) && stored >= 0) return stored;
  const { epoch } = await deps.api.get('/api/data', dataEpochResponseSchema);
  deps.kv.set(SYNC_EPOCH_KEY, String(epoch));
  return epoch;
}
```

Rename the existing `export async function runSyncCycle(deps: SyncDeps)` to `async function runOnce(deps: SyncDeps)`
(keep its doc comment on the new `runSyncCycle` below), and inside it:

- right after `log('sync', 'cycle started', …)`, add `const epoch = await knownEpoch(deps);`
- change the push body to `{ schemaVersion: SYNC_SCHEMA_VERSION, deviceId: deps.deviceId, epoch, changes: batch }`
- change the pull path to `` `/api/sync/pull?since=${since}&limit=${MAX_CHANGES_PER_PULL}&epoch=${epoch}` ``

Then add:

```ts
/**
 * One cycle (§8.5): push everything pending in batches, then pull until the server says there is
 * nothing left. Push first, so a row this device just wrote wins its own conflict instead of being
 * overwritten by the copy the server still holds.
 *
 * §8.6: if the server says the account's data was deleted since this phone last synced, the phone
 * drops everything it holds — pending writes included, since they belong to the deleted data — and
 * runs the cycle again from nothing. Once, so a server that keeps refusing surfaces as an error.
 */
export async function runSyncCycle(deps: SyncDeps): Promise<SyncOutcome> {
  try {
    return await runOnce(deps);
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.code !== DATA_RESET_CODE) throw error;
    log('sync', 'the account data was deleted on another device, emptying this phone');
    const { epoch } = await deps.api.get('/api/data', dataEpochResponseSchema);
    // Before the wipe: the tabs react to the rows disappearing and read this as they do.
    deps.kv.set(DATA_RESET_NOTICE_KEY, 'true');
    deps.deleteAttachmentFiles?.();
    wipeAccountData(deps.db, epoch);
    return runOnce(deps);
  }
}
```

- [x] **Step 5: Wire the files in `SyncProvider.tsx`**

Change `import { readBytes, storeBytes } from '../attachments/localFiles';` to
`import { deleteAllAttachmentFiles, readBytes, storeBytes } from '../attachments/localFiles';` and add to the object
returned by `deps`, after `syncBlobs`:

```ts
        deleteAttachmentFiles: deleteAllAttachmentFiles,
```

- [x] **Step 6: Run the client tests**

Run: `rtk proxy pnpm --filter mobile test -- src/sync/client.test.ts`
Expected: PASS, old tests included.

- [x] **Step 7: Teach the convergence server the epoch, and add the two-device test**

In `convergence.test.ts`, add imports:

```ts
import { DATA_RESET_CODE } from '@saldo/core';
import { wipeAccountData } from '../db/wipe';
import { type ApiClient, ApiClientError } from '../net/apiClient';
```

(replace the existing `import type { ApiClient } …` line). Add `epoch?: number;` to `PushBody`. In
`createMemoryServer`, add `let epoch = 0;` next to `let seq = 0;`, and to the returned object:

```ts
    epoch: () => epoch,
    /** What `DELETE /api/data` does (§8.6). */
    deleteAll() {
      rows.clear();
      epoch += 1;
    },
```

At the top of `push(body)` add:

```ts
      if (body.epoch !== undefined && body.epoch !== epoch) {
        throw new ApiClientError(409, DATA_RESET_CODE, 'deleted elsewhere');
      }
```

Give `pull` a third parameter `requested: number | null` and start it with:

```ts
      if (requested !== null && requested !== epoch) {
        throw new ApiClientError(409, DATA_RESET_CODE, 'deleted elsewhere');
      }
```

Replace `get` in `apiFor` with:

```ts
    get: async (path, schema) => {
      const url = new URL(path, 'http://server.invalid');
      if (url.pathname === '/api/data') return schema.parse({ epoch: server.epoch() });
      const since = Number.parseInt(url.searchParams.get('since') ?? '0', 10);
      const limit = Number.parseInt(url.searchParams.get('limit') ?? '500', 10);
      const epoch = url.searchParams.get('epoch');
      return schema.parse(server.pull(since, limit, epoch === null ? null : Number(epoch)));
    },
```

Append inside `describe('two devices against one server', …)`:

```ts
  it('empty the other phone when one deletes everything, without its offline writes', async () => {
    const server = createMemoryServer();
    const a = createDevice('device-a', server);
    const b = createDevice('device-b', server);
    a.repos.tags.create({ name: 'Condiviso' });
    await a.sync();
    await b.sync();
    b.repos.tags.create({ name: 'Scritto offline' });

    // Device A deletes everything: the server first, then its own copy, then a fresh start.
    server.deleteAll();
    wipeAccountData(a.db, server.epoch());
    a.repos.tags.create({ name: 'Da capo' });
    await a.sync();
    await b.sync();

    expect(snapshot(b)).toEqual(snapshot(a));
    expect(b.repos.tags.list().map((tag) => tag.name)).toEqual(['Da capo']);
    expect([...server.rows.values()]).toHaveLength(1);
  });
```

- [x] **Step 8: Run all sync tests**

Run: `rtk proxy pnpm --filter mobile test -- src/sync`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add apps/mobile/src/sync
git commit -m "feat(mobile): sync sends the data epoch and empties a phone whose data was deleted"
```

---

### Task 8: Scheduler — `exclusive`

**Files:**
- Modify: `apps/mobile/src/sync/scheduler.ts`
- Test: `apps/mobile/src/sync/scheduler.test.ts`

- [x] **Step 1: Write the failing tests**

Append to `scheduler.test.ts`:

```ts
describe('exclusive', () => {
  it('waits for the cycle in flight before running the task', async () => {
    const cycle = deferred<typeof NO_OUTCOME>();
    const scheduler = createScheduler({ deps: () => NO_DEPS, runCycle: () => cycle.promise });
    const order: string[] = [];
    void scheduler.syncNow().then(() => order.push('cycle'));

    const task = scheduler.exclusive(async () => {
      order.push('task');
      return 7;
    });
    await Promise.resolve();
    expect(order).toEqual([]);

    cycle.resolve(NO_OUTCOME);
    await expect(task).resolves.toBe(7);
    expect(order).toEqual(['cycle', 'task']);
  });

  it('starts no cycle while the task runs, and syncs normally afterwards', async () => {
    let cycles = 0;
    const scheduler = createScheduler({
      deps: () => NO_DEPS,
      runCycle: async () => {
        cycles += 1;
        return NO_OUTCOME;
      },
    });
    const gate = deferred<void>();
    const running = scheduler.exclusive(() => gate.promise);

    const joined = scheduler.syncNow();
    gate.resolve();
    await running;

    await expect(joined).resolves.toBeNull();
    expect(cycles).toBe(0);
    await scheduler.syncNow();
    expect(cycles).toBe(1);
  });

  it('lets cycles run again when the task fails', async () => {
    let cycles = 0;
    const scheduler = createScheduler({
      deps: () => NO_DEPS,
      runCycle: async () => {
        cycles += 1;
        return NO_OUTCOME;
      },
    });

    await expect(
      scheduler.exclusive(async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');

    await scheduler.syncNow();
    expect(cycles).toBe(1);
  });
});
```

- [x] **Step 2: Run them and watch them fail**

Run: `rtk proxy pnpm --filter mobile test -- src/sync/scheduler.test.ts`
Expected: FAIL — `scheduler.exclusive is not a function`.

- [x] **Step 3: Implement**

In the `Scheduler` interface, after `requestSync()`:

```ts
  /**
   * Runs `task` with no cycle beside it (§8.6): waits for the cycle in flight, and any `syncNow`
   * asked for meanwhile joins the task instead of starting one. A cycle interleaved with a data
   * deletion could pull rows of the deleted generation back after the phone was emptied.
   */
  exclusive<T>(task: () => Promise<T>): Promise<T>;
```

In `createScheduler`, next to `let inFlight …`:

```ts
  let exclusiveTask: Promise<unknown> | null = null;
```

Change `syncNow` to:

```ts
    syncNow() {
      if (stopped) return Promise.resolve(null);
      if (exclusiveTask !== null) return exclusiveTask.then(noOutcome, noOutcome);
      inFlight ??= cycle().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
```

add after `requestSync`:

```ts
    exclusive(task) {
      const before = exclusiveTask ?? inFlight ?? Promise.resolve(null);
      const run = before.then(task, task);
      exclusiveTask = run;
      const release = (): void => {
        if (exclusiveTask === run) exclusiveTask = null;
      };
      run.then(release, release);
      return run;
    },
```

and above `const scheduler: Scheduler = {`:

```ts
  const noOutcome = (): null => null;
```

- [x] **Step 4: Run them and watch them pass**

Run: `rtk proxy pnpm --filter mobile test -- src/sync/scheduler.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/sync/scheduler.ts apps/mobile/src/sync/scheduler.test.ts
git commit -m "feat(mobile): the scheduler can run a task with no cycle beside it"
```

---

### Task 9: Mobile — `deleteAllData` and the typed word

**Files:**
- Create: `apps/mobile/src/features/deleteData/deleteAllData.ts`
- Create: `apps/mobile/src/features/deleteData/confirmWord.ts`
- Test: `apps/mobile/src/features/deleteData/deleteAllData.test.ts`, `apps/mobile/src/features/deleteData/confirmWord.test.ts`

- [x] **Step 1: Write the failing tests**

Create `confirmWord.test.ts`:

```ts
import { matchesConfirmWord } from './confirmWord';

describe('matchesConfirmWord', () => {
  it('accepts the word whatever its case, with stray spaces', () => {
    expect(matchesConfirmWord('ELIMINA', 'ELIMINA')).toBe(true);
    expect(matchesConfirmWord(' elimina ', 'ELIMINA')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(matchesConfirmWord('', 'ELIMINA')).toBe(false);
    expect(matchesConfirmWord('ELIMIN', 'ELIMINA')).toBe(false);
    expect(matchesConfirmWord('ELIMINA TUTTO', 'ELIMINA')).toBe(false);
  });
});
```

Create `deleteAllData.test.ts`:

```ts
import { createTestContext } from '../../db/testing';
import { SYNC_EPOCH_KEY } from '../../db/wipe';
import { type ApiClient, ApiClientError } from '../../net/apiClient';
import { createScheduler } from '../../sync/scheduler';
import { deleteAllData } from './deleteAllData';

function apiDeleting(answer: () => Promise<unknown>, paths: string[]): ApiClient {
  const unused = async (): Promise<never> => {
    throw new Error('not used');
  };
  return {
    hasSession: async () => true,
    get: unused,
    post: unused,
    putBinary: unused,
    getBinary: unused,
    delete: async (path, schema) => {
      paths.push(path);
      return schema.parse(await answer());
    },
  };
}

describe('deleteAllData', () => {
  it('deletes the server copy, then the files, then the rows', async () => {
    const context = createTestContext();
    context.repos.tags.create({ name: 'Trasloco' });
    const paths: string[] = [];
    let filesDeleted = 0;

    await deleteAllData({
      db: context.db,
      api: apiDeleting(async () => ({ epoch: 2 }), paths),
      scheduler: createScheduler({ deps: () => null }),
      deleteAttachmentFiles: () => {
        filesDeleted += 1;
      },
    });

    expect(paths).toEqual(['/api/data']);
    expect(filesDeleted).toBe(1);
    expect(context.repos.tags.list()).toEqual([]);
    expect(context.kv.get(SYNC_EPOCH_KEY)).toBe('2');
  });

  it('touches nothing on the phone when the server refuses', async () => {
    const context = createTestContext();
    context.repos.tags.create({ name: 'Trasloco' });
    context.kv.set(SYNC_EPOCH_KEY, '0');
    let filesDeleted = 0;

    await expect(
      deleteAllData({
        db: context.db,
        api: apiDeleting(async () => {
          throw new ApiClientError(401, 'session_expired', 'Sign in again');
        }, []),
        scheduler: createScheduler({ deps: () => null }),
        deleteAttachmentFiles: () => {
          filesDeleted += 1;
        },
      }),
    ).rejects.toMatchObject({ code: 'session_expired' });

    // Deleting the phone alone would be undone by the next sign-in: all or nothing.
    expect(context.repos.tags.list()).toHaveLength(1);
    expect(filesDeleted).toBe(0);
    expect(context.kv.get(SYNC_EPOCH_KEY)).toBe('0');
  });

  it('deletes the phone alone on a build with no server', async () => {
    const context = createTestContext();
    context.repos.tags.create({ name: 'Trasloco' });

    await deleteAllData({
      db: context.db,
      api: null,
      scheduler: null,
      deleteAttachmentFiles: () => undefined,
    });

    expect(context.repos.tags.list()).toEqual([]);
    expect(context.kv.get(SYNC_EPOCH_KEY)).toBeNull();
  });
});
```

- [x] **Step 2: Run them and watch them fail**

Run: `rtk proxy pnpm --filter mobile test -- src/features/deleteData`
Expected: FAIL — cannot resolve `./confirmWord` and `./deleteAllData`.

- [x] **Step 3: Implement**

Create `confirmWord.ts`:

```ts
/**
 * Whether the user typed the confirmation word. Case and surrounding spaces do not count — the
 * word is there to make the deletion deliberate, not to test typing.
 */
export function matchesConfirmWord(typed: string, word: string): boolean {
  return typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
}
```

Create `deleteAllData.ts`:

```ts
import { dataEpochResponseSchema } from '@saldo/core';
import type { RepositoryDatabase } from '../../db/repositories/support';
import { wipeAccountData } from '../../db/wipe';
import { log } from '../../log';
import type { ApiClient } from '../../net/apiClient';
import type { Scheduler } from '../../sync/scheduler';

export interface DeleteAllDataDeps {
  db: RepositoryDatabase;
  /** Null on a build with no server: there is no other copy to delete. */
  api: ApiClient | null;
  scheduler: Scheduler | null;
  deleteAttachmentFiles: () => void;
}

/**
 * §8.6 "Elimina tutti i dati". The server copy goes first, and the phone is emptied only once the
 * server has said yes: deleting the phone alone would be undone by the next pull.
 *
 * Runs inside `scheduler.exclusive`, so no cycle can pull rows of the deleted generation back
 * after the phone has been emptied. Afterwards there are no settings, which the boot router reads
 * as onboarding.
 */
export async function deleteAllData(deps: DeleteAllDataDeps): Promise<void> {
  const erase = async (): Promise<void> => {
    let epoch: number | null = null;
    if (deps.api !== null) {
      ({ epoch } = await deps.api.delete('/api/data', dataEpochResponseSchema));
      log('sync', 'the server deleted the account data', { epoch });
    }
    deps.deleteAttachmentFiles();
    wipeAccountData(deps.db, epoch);
  };
  if (deps.scheduler === null) await erase();
  else await deps.scheduler.exclusive(erase);
}
```

- [x] **Step 4: Run them and watch them pass**

Run: `rtk proxy pnpm --filter mobile test -- src/features/deleteData`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/features/deleteData
git commit -m "feat(mobile): delete all data, server first"
```

---

### Task 10: Strings

**Files:**
- Modify: `packages/i18n/src/locales/it.ts`, `packages/i18n/src/locales/en.ts`

- [x] **Step 1: Add the keys**

In `it.ts`, inside `profile`, after `version`:

```ts
    deleteAllData: 'Elimina tutti i dati',
```

and after the whole `profile` block:

```ts
  deleteData: {
    title: 'Elimina tutti i dati',
    bodyServer:
      'Elimina conti, transazioni, budget, categorie, tag e allegati: su questo telefono, sul server e su ogni altro telefono collegato a questo account. Resti connesso e ricominci dalla configurazione iniziale. Non si può annullare: se potresti volerli indietro, esporta prima i dati.',
    bodyLocal:
      'Elimina conti, transazioni, budget, categorie, tag e allegati da questo telefono e ricominci dalla configurazione iniziale. Non si può annullare: se potresti volerli indietro, esporta prima i dati.',
    confirmWord: 'ELIMINA',
    typeToConfirm: 'Scrivi {{word}} per confermare',
    confirm: 'Elimina tutto',
    signInFirst:
      'La sessione è scaduta. Accedi di nuovo da Server e sincronizzazione e riprova: anche la copia sul server va eliminata.',
    failed: 'Impossibile raggiungere il server. Non è stato eliminato nulla.',
    deletedElsewhere: 'Tutti i dati sono stati eliminati da un altro dispositivo',
  },
```

In `en.ts`, inside `profile`, after `version`:

```ts
    deleteAllData: 'Delete all data',
```

and after the whole `profile` block:

```ts
  deleteData: {
    title: 'Delete all data',
    bodyServer:
      'Deletes accounts, transactions, budgets, categories, tags and attachments: on this phone, on the server and on every other phone signed in to this account. You stay signed in and start again from the setup. This cannot be undone: export your data first if you might want it back.',
    bodyLocal:
      'Deletes accounts, transactions, budgets, categories, tags and attachments from this phone, and you start again from the setup. This cannot be undone: export your data first if you might want it back.',
    confirmWord: 'DELETE',
    typeToConfirm: 'Type {{word}} to confirm',
    confirm: 'Delete everything',
    signInFirst:
      'Your session has expired. Sign in again from Server and sync, then try again: the server copy has to go too.',
    failed: 'Could not reach the server. Nothing was deleted.',
    deletedElsewhere: 'All data was deleted from another device',
  },
```

Use the same key order in both files.

- [x] **Step 2: Run the parity test**

Run: `rtk proxy pnpm --filter @saldo/i18n test`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add packages/i18n/src/locales
git commit -m "feat(i18n): strings for deleting all data"
```

---

### Task 11: Screens — the row, the confirmation, leaving the tabs

**Files:**
- Create: `apps/mobile/app/profile/delete-data.tsx`
- Create: `apps/mobile/src/features/deleteData/useLeaveWhenDataGone.ts`
- Modify: `apps/mobile/app/profile.tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [x] **Step 1: The confirmation screen**

Create `apps/mobile/app/profile/delete-data.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteAllAttachmentFiles } from '../../src/attachments/localFiles';
import { useServer } from '../../src/auth/ServerProvider';
import { PrimaryButton } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { TextField } from '../../src/components/TextField';
import { db } from '../../src/db/client';
import { matchesConfirmWord } from '../../src/features/deleteData/confirmWord';
import { deleteAllData } from '../../src/features/deleteData/deleteAllData';
import { SettingScreen } from '../../src/features/profile/SettingScreen';
import { startOver } from '../../src/navigation/history';
import { ApiClientError } from '../../src/net/apiClient';
import { useSync } from '../../src/sync/SyncProvider';
import { Text } from '../../src/theme/Text';

/** Codes that mean the server copy cannot be deleted until the user signs in again. */
const SESSION_CODES = new Set(['session_expired', 'no_session']);

/**
 * §6.8 "Elimina tutti i dati". A screen rather than a dialog because what goes has to be read,
 * and a typed word rather than a second tap because nothing here can be undone (§8.6).
 */
export default function DeleteDataScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { api } = useServer();
  const { scheduler } = useSync();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = t('deleteData.confirmWord');

  const onDelete = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await deleteAllData({ db, api, scheduler, deleteAttachmentFiles: deleteAllAttachmentFiles });
      // No settings now: the boot router sends the user to onboarding, with nothing underneath.
      startOver(router, '/');
    } catch (caught) {
      const code = caught instanceof ApiClientError ? caught.code : null;
      setError(
        code !== null && SESSION_CODES.has(code)
          ? t('deleteData.signInFirst')
          : t('deleteData.failed'),
      );
      setBusy(false);
    }
  };

  return (
    <SettingScreen
      title={t('deleteData.title')}
      subtitle={api === null ? t('deleteData.bodyLocal') : t('deleteData.bodyServer')}
      card={false}
    >
      <Card>
        <TextField
          label={t('deleteData.typeToConfirm', { word })}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />
      </Card>
      {error === null ? null : (
        <Text size="footnote" color="accent">
          {error}
        </Text>
      )}
      <PrimaryButton
        label={t('deleteData.confirm')}
        disabled={!matchesConfirmWord(typed, word)}
        loading={busy}
        onPress={() => void onDelete()}
      />
    </SettingScreen>
  );
}
```

- [x] **Step 2: The Profile row**

In `apps/mobile/app/profile.tsx`, directly above `{__DEV__ ? (`:

```tsx
      <Card padded={false}>
        <View style={{ paddingHorizontal: theme.layout.cardPadding, paddingVertical: 8 }}>
          <ListRow
            title={t('profile.deleteAllData')}
            leading={lead('trash')}
            onPress={() => router.push('/profile/delete-data')}
            chevron
          />
        </View>
      </Card>
```

- [x] **Step 3: The hook that leaves the tabs**

Create `apps/mobile/src/features/deleteData/useLeaveWhenDataGone.ts`:

```ts
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../components/Toast';
import { useDatabase } from '../../db/DatabaseProvider';
import { useSettingsQuery } from '../../db/hooks';
import { DATA_RESET_NOTICE_KEY } from '../../db/wipe';
import { startOver } from '../../navigation/history';

/**
 * §8.6. A sync can empty this phone because the account's data was deleted on another device.
 * The tabs are then showing data that no longer exists: say why, and — if no settings are left —
 * hand back to the boot router, which waits for the cycle and opens onboarding or the tabs.
 *
 * Runs on every settings change rather than only when they vanish: if the other device has
 * already started again, the wipe and the pull of its new settings can land together, and the
 * toast is still owed.
 */
export function useLeaveWhenDataGone(): void {
  const router = useRouter();
  const { kv } = useDatabase();
  const toast = useToast();
  const { t } = useTranslation();
  const { settings, loaded } = useSettingsQuery();

  useEffect(() => {
    if (kv.get(DATA_RESET_NOTICE_KEY) !== null) {
      kv.remove(DATA_RESET_NOTICE_KEY);
      toast.show(t('deleteData.deletedElsewhere'));
    }
    if (loaded && settings === null) startOver(router, '/');
  }, [settings, loaded, kv, toast, t, router]);
}
```

In `apps/mobile/app/(tabs)/_layout.tsx`, import it and call it under `useAppLock();`:

```tsx
import { useLeaveWhenDataGone } from '../../src/features/deleteData/useLeaveWhenDataGone';
```

```tsx
  useAppLock();
  useLeaveWhenDataGone();
```

- [x] **Step 4: Gates**

Run: `rtk proxy pnpm typecheck` and `rtk proxy pnpm --filter mobile test`
Expected: no type errors; all mobile tests PASS (the a11y and Screen tests included).

- [x] **Step 5: Commit**

```bash
git add apps/mobile/app/profile/delete-data.tsx apps/mobile/app/profile.tsx "apps/mobile/app/(tabs)/_layout.tsx" apps/mobile/src/features/deleteData/useLeaveWhenDataGone.ts
git commit -m "feat(mobile): Delete all data in Profile"
```

---

### Task 12: Docs and verification

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-saldo-poc-spec.md`
- Modify: `TODO.md`
- Modify: `docs/superpowers/plans/README.md`

- [x] **Step 1: Spec**

1. §6.8 row: after "Blocco con Face ID/biometria toggle;" insert
   `**Elimina tutti i dati** (NEW → \`profile/delete-data\`, §8.6);`.
2. §7, the `kv` key list: add `syncEpoch`, `dataResetNotice` after `syncCursor`.
3. After §8.5, add:

```markdown
### 8.6 Deleting all data

Profile → **Elimina tutti i dati** opens a screen that says what goes and enables its button only once the user types
`ELIMINA` (`DELETE` in English). It deletes every synced row and attachment of the account, on every device; the
passkey account stays, and so does the session.

- **Server.** `data_epochs (user_id pk → user on delete cascade, epoch int default 0, reset_at timestamptz)`.
  `DELETE /api/data` bumps the epoch, deletes the account's `sync_rows` and queues its attachment blobs in
  `deleted_blobs` as already past the grace period, in one transaction, and answers `{ epoch }`. `GET /api/data`
  answers the current `{ epoch }`.
- **Sync.** The push body carries `epoch` and the pull query `&epoch=`. A different value answers
  `409 data_reset`. The push compares under a `FOR SHARE` lock on the epoch row, inside the transaction that writes
  the rows, so it cannot interleave with a deletion.
- **The deleting phone** runs the request inside `scheduler.exclusive`. Only once the server has answered does it
  delete the attachment files and the synced tables, drop `syncCursor` and store the new `syncEpoch`. It keeps
  `deviceId`, `hlc`, `accountId` and `appLockEnabled`, then returns to the boot router, which opens onboarding. With
  an expired session it refuses and asks to sign in again. A build with no server deletes the phone only.
- **Every other phone** learns on its next push or pull. On `data_reset` it asks `GET /api/data`, empties itself the
  same way (pending writes included) and runs the cycle again. The tabs then toast "Tutti i dati sono stati eliminati
  da un altro dispositivo" and return to the boot router if no settings are left.
- A phone that has never synced asks `GET /api/data` once, before its first push. "Esci" keeps `syncEpoch`, so a
  phone that signed out before the deletion is still refused when it signs back in.
```

4. §14 endpoints table: add the row `| GET/DELETE | \`/api/data\` | bearer |` after the sync row.

- [x] **Step 2: TODO and roadmap**

Delete the whole `## Delete all data from Settings` section from `TODO.md`. In `docs/superpowers/plans/README.md`,
above `## Future (not POC)`, add:

```markdown
### Picked up from `TODO.md` on 2026-09-17

**Plan:** `2026-09-17-delete-all-data.md` · **Spec:** §6.8, §8.6, §14

- **Delete all data.** Profile → "Elimina tutti i dati" deletes the account's rows and attachments on the server
  (`DELETE /api/data`) and on every phone, keeps the session and returns to onboarding. A per-account data epoch
  makes other phones empty themselves on their next sync instead of pushing deleted data back.
```

- [x] **Step 3: Run every gate, and read the output**

```bash
rtk proxy pnpm lint
rtk proxy pnpm typecheck
rtk proxy pnpm test
```

Expected: no `lint/…` lines and no `× Some errors were emitted`; no type errors; every package green. Fix anything
found before going on.

- [x] **Step 4: Check on the simulator** — *done by the user after execution (2026-09-17): working.*

After the `data_epochs` migration, apply it to the dev database (`pnpm --filter web db:migrate`) and run the server
and the app. Sign in, load demo data, open Profile → Elimina tutti i dati. The button stays disabled until `ELIMINA`
is typed. Deleting lands on onboarding step 1, and the server log shows `deleted all data of …`. Finish onboarding and
confirm the new data syncs (no `data_reset` in the log).

- [x] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-09-10-saldo-poc-spec.md TODO.md docs/superpowers/plans/README.md docs/superpowers/plans/2026-09-17-delete-all-data.md
git commit -m "docs: delete all data (§8.6), and the item leaves TODO.md"
```

- [x] **Step 6: Review** — self-review; it found the notice shown to a phone that held no data (fixed).

Use **requesting-code-review** on `feat/delete-all-data` against `main` before merging.
