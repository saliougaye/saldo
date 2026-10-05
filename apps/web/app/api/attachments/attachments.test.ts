import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { syncRows } from '../../../src/server/db/schema';
import { resetEnvCache } from '../../../src/server/env';
import { objectKey, resetStoreCache, setStoreForTesting } from '../../../src/server/storage';
import { createFsStore } from '../../../src/server/storage/fsStore';
import { createTestDatabase, type TestDatabase } from '../../../src/server/test/harness';
import { createTestSession } from '../../../src/server/test/session';
import { POST as complete } from './[id]/complete/route';
import { GET, PUT } from './[id]/route';
import { POST as intent } from './[id]/upload-intent/route';

let harness: TestDatabase;
let dir: string;
let session: Awaited<ReturnType<typeof createTestSession>>;

const BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const SHA256 = createHash('sha256').update(BYTES).digest('hex');
const ATTACHMENT_ID = 'att-1';

const params = (id = ATTACHMENT_ID) => ({ params: Promise.resolve({ id }) });

function request(body?: BodyInit | null, method = 'POST'): Request {
  return new Request('https://saldo.example.com/api/attachments/att-1', {
    method,
    headers: { authorization: `Bearer ${session.token}` },
    ...(body === undefined ? {} : { body }),
  });
}

async function seedRow(
  userId: string,
  overrides: Record<string, unknown> = {},
  id = ATTACHMENT_ID,
  deletedAt: Date | null = null,
) {
  await harness.db.insert(syncRows).values({
    userId,
    entity: 'attachment',
    id,
    updatedAt: '000000000000001-0000-dev',
    deletedAt,
    seq: 1,
    data: {
      id,
      createdAt: '2026-09-10T09:00:00.000Z',
      updatedAt: '000000000000001-0000-dev',
      deletedAt: deletedAt === null ? null : deletedAt.toISOString(),
      transactionId: 'tx-1',
      mimeType: 'image/jpeg',
      byteSize: BYTES.byteLength,
      sha256: SHA256,
      width: 100,
      height: 100,
      ...overrides,
    },
  });
}

beforeAll(async () => {
  harness = await createTestDatabase();
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'saldo-routes-'));
  resetEnvCache();
  resetStoreCache();
  setStoreForTesting(createFsStore(dir));
  session = await createTestSession(harness.db);
});

afterEach(async () => {
  await harness.reset();
  await rm(dir, { recursive: true, force: true });
  resetStoreCache();
  resetEnvCache();
});

afterAll(async () => {
  await harness.close();
});

describe('POST /api/attachments/:id/upload-intent', () => {
  it('asks for the bytes directly when the store has no URLs', async () => {
    await seedRow(session.userId);
    const response = await intent(
      request(JSON.stringify({ size: BYTES.byteLength, mimeType: 'image/jpeg' })),
      params(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: 'direct' });
  });

  it('refuses bytes for a row the server has never been told about', async () => {
    const response = await intent(
      request(JSON.stringify({ size: BYTES.byteLength, mimeType: 'image/jpeg' })),
      params(),
    );
    expect(response.status).toBe(404);
  });

  it("cannot reach another user's attachment", async () => {
    const other = await createTestSession(harness.db, 'Bob');
    await seedRow(other.userId);
    const response = await intent(
      request(JSON.stringify({ size: BYTES.byteLength, mimeType: 'image/jpeg' })),
      params(),
    );
    expect(response.status).toBe(404);
  });

  it('refuses a size or a type that disagrees with the row', async () => {
    await seedRow(session.userId);
    const big = await intent(
      request(JSON.stringify({ size: BYTES.byteLength + 1, mimeType: 'image/jpeg' })),
      params(),
    );
    expect(big.status).toBe(413);
    const wrongType = await intent(
      request(JSON.stringify({ size: BYTES.byteLength, mimeType: 'application/pdf' })),
      params(),
    );
    expect(wrongType.status).toBe(415);
  });

  it('says so when the server keeps no attachments', async () => {
    await seedRow(session.userId);
    setStoreForTesting(null);
    const response = await intent(
      request(JSON.stringify({ size: BYTES.byteLength, mimeType: 'image/jpeg' })),
      params(),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'no_storage' } });
  });

  it('refuses a declared Content-Length over its 1 KB cap, before reading the body', async () => {
    await seedRow(session.userId);
    // The body itself is a perfectly valid intent; only the declared length lies. If this were
    // read anyway, the request would succeed — so a 413 here proves the header was checked first.
    const oversized = new Request('https://saldo.example.com/api/attachments/att-1', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.token}`,
        'content-length': '999999',
      },
      body: JSON.stringify({ size: BYTES.byteLength, mimeType: 'image/jpeg' }),
    });
    const response = await intent(oversized, params());
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'payload_too_large' } });
  });

  it('still refuses an oversized body with no Content-Length header (the backstop)', async () => {
    await seedRow(session.userId);
    const big = request(
      JSON.stringify({ size: BYTES.byteLength, mimeType: `image/${'x'.repeat(2000)}` }),
    );
    expect(big.headers.get('content-length')).toBeNull();
    const response = await intent(big, params());
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'payload_too_large' } });
  });
});

describe('PUT /api/attachments/:id', () => {
  it('stores bytes that match the row', async () => {
    await seedRow(session.userId);
    const response = await PUT(request(BYTES, 'PUT'), params());
    expect(response.status).toBe(204);
    expect(await createFsStore(dir).head(objectKey(session.userId, ATTACHMENT_ID))).toBe(
      BYTES.byteLength,
    );
  });

  it('refuses a body whose hash is not the one the row recorded', async () => {
    await seedRow(session.userId);
    const response = await PUT(request(new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9]), 'PUT'), params());
    expect(response.status).toBe(422);
    expect(await createFsStore(dir).head(objectKey(session.userId, ATTACHMENT_ID))).toBeNull();
  });

  it('refuses a body of the wrong length', async () => {
    await seedRow(session.userId);
    const response = await PUT(request(new Uint8Array([1, 2, 3]), 'PUT'), params());
    expect(response.status).toBe(413);
  });

  it("refuses a declared Content-Length over the row's size, before reading the body", async () => {
    await seedRow(session.userId);
    // A body that would otherwise be accepted; only the declared length is a lie. A 413 here means
    // the header was checked before the bytes were.
    const oversized = new Request('https://saldo.example.com/api/attachments/att-1', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${session.token}`,
        'content-length': String(BYTES.byteLength + 1_000_000),
      },
      body: BYTES,
    });
    const response = await PUT(oversized, params());
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'payload_too_large' } });
  });

  it('still refuses an oversized body with no Content-Length header (the backstop)', async () => {
    await seedRow(session.userId);
    const big = request(new Uint8Array(BYTES.byteLength + 1).fill(9), 'PUT');
    expect(big.headers.get('content-length')).toBeNull();
    const response = await PUT(big, params());
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'size_mismatch' } });
  });

  it('refuses bytes for a tombstoned row', async () => {
    await seedRow(session.userId, {}, ATTACHMENT_ID, new Date('2026-09-10T10:00:00.000Z'));
    expect((await PUT(request(BYTES, 'PUT'), params())).status).toBe(404);
  });
});

describe('POST /api/attachments/:id/complete', () => {
  it('accepts once the object is there with the right size', async () => {
    await seedRow(session.userId);
    await createFsStore(dir).put(objectKey(session.userId, ATTACHMENT_ID), BYTES, {
      size: BYTES.byteLength,
      mimeType: 'image/jpeg',
    });
    expect((await complete(request(), params())).status).toBe(204);
  });

  it('tells the client to retry when nothing arrived', async () => {
    await seedRow(session.userId);
    const response = await complete(request(), params());
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_uploaded' } });
  });

  it('tells the client to retry when the upload was cut short', async () => {
    await seedRow(session.userId);
    await createFsStore(dir).put(objectKey(session.userId, ATTACHMENT_ID), new Uint8Array([1, 2]), {
      size: 2,
      mimeType: 'image/jpeg',
    });
    expect((await complete(request(), params())).status).toBe(409);
  });
});

describe('GET /api/attachments/:id', () => {
  it('streams the bytes back', async () => {
    await seedRow(session.userId);
    await PUT(request(BYTES, 'PUT'), params());
    const response = await GET(request(null, 'GET'), params());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it('is a 404 when the row exists but the bytes never arrived', async () => {
    await seedRow(session.userId);
    expect((await GET(request(null, 'GET'), params())).status).toBe(404);
  });

  it("never serves another user's bytes", async () => {
    const other = await createTestSession(harness.db, 'Bob');
    await seedRow(other.userId);
    await createFsStore(dir).put(objectKey(other.userId, ATTACHMENT_ID), BYTES, {
      size: BYTES.byteLength,
      mimeType: 'image/jpeg',
    });
    expect((await GET(request(null, 'GET'), params())).status).toBe(404);
  });
});
