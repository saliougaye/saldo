# Phase 09b-1 — Attachment storage on the server

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The server can hold attachment blobs wherever the person who runs it wants — a disk, S3 (or R2, MinIO,
Backblaze), Vercel Blob — or nowhere at all, and the app never learns which.

**Architecture:** One `AttachmentStore` interface, four implementations, chosen by `ATTACHMENT_STORAGE`. The client
asks `POST /api/attachments/{id}/upload-intent` and is told either "send them to me" or "send them to this URL",
because a serverless request body caps at ~4.5 MB against a 10 MB attachment. The SDKs are loaded with a dynamic
`import()` inside their factory, so a self-hosted deployment on a disk never pays for the AWS SDK.

**Tech Stack:** `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `@vercel/blob`, Zod, PGlite for the tests.

**Spec:** §10, §9.2 (env table), §15.

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/server/storage/types.ts` (new) | `AttachmentStore`, `PresignedTarget`, `StoredObject`, the key shape. |
| `apps/web/src/server/storage/fsStore.ts` (new) | Disk, atomic (temp file + rename). |
| `apps/web/src/server/storage/s3Store.ts` (new) | S3 and anything that speaks it; presigns both ways. |
| `apps/web/src/server/storage/vercelBlobStore.ts` (new) | Vercel Blob; presigns uploads via its client token. |
| `apps/web/src/server/storage/index.ts` (new) | `getStore()` — reads the env once, memoised like `getDb`. |
| `apps/web/src/server/env.ts` | `ATTACHMENT_STORAGE` and the per-driver variables, validated per driver. |
| `apps/web/app/api/health/route.ts` | `attachmentsEnabled`. |
| `apps/web/app/api/attachments/[id]/upload-intent/route.ts` (new) | Ownership, size, and which mode. |
| `apps/web/app/api/attachments/[id]/route.ts` (new) | `PUT` (direct upload) and `GET` (download or redirect). |
| `apps/web/app/api/attachments/[id]/complete/route.ts` (new) | After a presigned upload: the row is now backed. |
| `apps/web/src/server/attachments/cleanup.ts` (new) | Deletes blobs of rows tombstoned > 7 days ago. |

The attachment **rows** already sync: `attachment` is in `entitySchemas` and `syncRows` stores any entity. This phase
adds no table.

---

### Task 1: The interface and the disk

**Files:** `apps/web/src/server/storage/types.ts`, `fsStore.ts`, `fsStore.test.ts`

- [x] **Step 1: Write `types.ts`**

```ts
/** `{userId}/{attachmentId}` — the user's id is in the key so a bucket is one flat namespace. */
export function objectKey(userId: string, attachmentId: string): string {
  return `${userId}/${attachmentId}`;
}

export interface ObjectMeta {
  size: number;
  mimeType: string;
}

export interface PresignedTarget {
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  /** Seconds the URL stays usable. */
  expiresIn: number;
}

export interface AttachmentStore {
  readonly name: 'fs' | 's3' | 'vercel-blob';
  put(key: string, bytes: Uint8Array, meta: ObjectMeta): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  /** Size in bytes, or null when the object is not there. Used to confirm a presigned upload. */
  head(key: string): Promise<number | null>;
  delete(key: string): Promise<void>;
  presignPut?(key: string, meta: ObjectMeta): Promise<PresignedTarget>;
  presignGet?(key: string): Promise<string>;
}
```

`put` and `get` take a `Uint8Array` rather than a stream: the cap is 10 MB, every driver's SDK accepts bytes, and a
stream would have to be buffered to verify the hash anyway.

- [x] **Step 2: Tests for `fsStore`** — round-trip a small payload; `get` and `head` return null for a key that was
never written; `delete` is idempotent; a key containing `..` is refused (path traversal); two users' keys do not
collide.

- [x] **Step 3: Write `fsStore.ts`** — `put` writes `${dir}/${key}.tmp` then renames, so a crash never leaves a
half-written blob a `head` would accept. `mkdir` the user's directory first. Refuse any key that does not match
`/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/`. No `presignPut`/`presignGet`: a disk has no URLs.

- [x] **Step 4: Run the tests. Commit.**

---

### Task 2: The env

**Files:** `apps/web/src/server/env.ts`, `env.test.ts`, `apps/web/.env.example`

- [x] **Step 1: Tests first.** `ATTACHMENT_STORAGE` defaults to `none`; `fs` without `STORAGE_DIR` fails with a
message naming the variable; `s3` without a bucket fails; `s3` with bucket, region and credentials parses, and
`S3_ENDPOINT`/`S3_FORCE_PATH_STYLE` are optional; `vercel-blob` requires `BLOB_READ_WRITE_TOKEN`; `none` requires
nothing. **`STORAGE_DIR` stops being required**, which is the point: today it is, and a Vercel deployment has no
disk to point it at.

- [x] **Step 2: Implement** with a discriminated union so the driver config is typed:

```ts
export type AttachmentStorageConfig =
  | { kind: 'none' }
  | { kind: 'fs'; dir: string }
  | { kind: 's3'; bucket: string; region: string; endpoint: string | null;
      accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean }
  | { kind: 'vercel-blob'; token: string };
```

validated with `superRefine` so each missing variable is reported by name.

- [x] **Step 3: Update `.env.example`** with every variable, commented by driver, and `ATTACHMENT_STORAGE=none` as
the default. **Never commit real credentials** (AGENTS.md).

- [x] **Step 4: Commit.**

---

### Task 3: S3 and Vercel Blob

**Files:** `s3Store.ts`, `vercelBlobStore.ts`, `index.ts`

- [x] **Step 1: Install**

```bash
pnpm --filter web add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @vercel/blob
```

- [x] **Step 2: `s3Store.ts`** — the client is built inside the factory behind
`const { S3Client } = await import('@aws-sdk/client-s3')`, so a disk deployment never loads it. `presignPut` signs a
`PutObjectCommand` with `ContentLength` and `ContentType` pinned (a URL that would accept any size is a bucket-sized
hole), 5 minutes. `presignGet` signs a `GetObjectCommand`, 5 minutes. `head` is `HeadObjectCommand`, mapping a 404 to
null.

- [x] **Step 3: `vercelBlobStore.ts`** — `put`/`get`/`delete` through `@vercel/blob`. Its uploads are presigned
through a *client token*, so `presignPut` returns the upload URL with the token in the headers; keep `expiresIn`
short.

- [x] **Step 4: `index.ts`**

```ts
let cached: AttachmentStore | null | undefined;

/** null when the server was configured without storage (§10). Memoised like `getDb`. */
export async function getStore(): Promise<AttachmentStore | null> { … }
```

- [x] **Step 5: Tests.** The S3 and Vercel drivers are not exercised against a real bucket; what *is* tested is the
selection (`getStore` returns null for `none`, the right `name` otherwise) and that `objectKey` and the key
validation are shared. Say so in the plan and in the phase notes rather than implying coverage that does not exist.

- [x] **Step 6: Commit.**

---

### Task 4: `/api/health` tells the app

**Files:** `apps/web/app/api/health/route.ts`, `apps/mobile/src/auth/session.ts`

- [x] **Step 1:** add `attachmentsEnabled: (await getStore()) !== null` to the payload.

- [x] **Step 2:** the mobile `healthSchema` gains `attachmentsEnabled: z.boolean().default(false)` — a default, not a
requirement, so an older server stays readable.

- [x] **Step 3:** a route test asserting both values. Commit.

---

### Task 5: Upload

**Files:** `apps/web/app/api/attachments/[id]/upload-intent/route.ts`, `[id]/route.ts`, `[id]/complete/route.ts`

- [x] **Step 1: `upload-intent`** — `POST`, authenticated. Body `{ size: number; mimeType: string }`.
  - 404 when no live `attachment` row with that id belongs to the user. **The row must be pushed first**, and this
    is what enforces it: bytes for a row the server does not know are refused.
  - 409 `no_storage` when `getStore()` is null.
  - 413 when `size` exceeds `MAX_ATTACHMENT_BYTES`, or disagrees with the row's `byteSize`.
  - 415 when `mimeType` disagrees with the row's.
  - Then `{ mode: 'presigned', … }` if the store presigns, else `{ mode: 'direct' }`.

- [x] **Step 2: `PUT /api/attachments/{id}`** — the direct mode. Same checks, plus: read the body, verify its length
and its SHA-256 against the row (`X-Content-SHA256` must match both the header and the row's `sha256`), then `put`.
204.

- [x] **Step 3: `POST /api/attachments/{id}/complete`** — the presigned mode. `head` the key: if it is absent or its
size disagrees with the row, 409 `not_uploaded`, and the client retries. The server cannot verify the hash of bytes
it never saw — that is the trade for presigning, and the downloader verifies instead.

- [x] **Step 4: Tests** against PGlite with an in-memory store: every refusal above, and the happy path for both
modes. A second user's id must never reach another's blob.

- [x] **Step 5: Commit.**

---

### Task 6: Download

**Files:** `apps/web/app/api/attachments/[id]/route.ts`

- [x] **Step 1: `GET /api/attachments/{id}`** — 404 unless the row is the user's, then either a 302 to
`presignGet(key)` or the bytes with `Content-Type` and `Content-Length`. Never `Content-Disposition: attachment`
with a filename from user input.

- [x] **Step 2: Commit.**

**Blob cleanup moved to 09b-3.** The plan had it scanning tombstoned rows on every push, which is wrong: the rows
are tombstones and stay forever, so every push would re-delete every blob ever deleted — one network call per row
per push on S3. It needs a persistent work queue (a row written when a tombstone arrives, removed once its blob is
gone), which belongs with the upload queue of 09b-3 rather than here.

---

### Task 7: Verification

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` — read the output, not the exit code. Tests run under **Node 22**.
- [x] `pnpm --filter web build` — the dynamic imports must not break `next build`.
- [x] Update `docs/self-hosting.md`: the storage choice, with a worked example for a disk and for R2.
- [x] State plainly what is **not** verified: no test touches a real S3 bucket or Vercel Blob; the drivers are
  exercised through their interface and their selection only.
