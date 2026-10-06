import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createS3Store } from './s3Store';
import { objectKey } from './types';

/**
 * The S3 driver against a real S3 API — Floci, from the local development stack
 * (`apps/web/docker/docker-compose.dev.yml`). Everything else about `s3Store` is exercised only
 * through its interface, so this is the one place a signature, a presigned URL or a 404 mapping is
 * actually put to an S3 implementation.
 *
 * It **skips** when the emulator is not running, so CI and a developer without Docker are not made
 * to care. Bring it up with:
 *   docker compose -f apps/web/docker/docker-compose.dev.yml up -d
 */
const ENDPOINT = process.env.S3_TEST_ENDPOINT ?? 'http://localhost:4566';
const BUCKET = process.env.S3_TEST_BUCKET ?? 'saldo-attachments';

async function reachable(): Promise<boolean> {
  return fetch(`${ENDPOINT}/_localstack/health`, { signal: AbortSignal.timeout(500) })
    .then((response) => response.ok)
    .catch(() => false);
}

const available = await reachable();

describe.skipIf(!available)('createS3Store against a local S3 emulator', () => {
  const bytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1]);
  const meta = { size: bytes.byteLength, mimeType: 'image/jpeg' };
  let store: Awaited<ReturnType<typeof createS3Store>>;

  beforeAll(async () => {
    store = await createS3Store({
      bucket: BUCKET,
      region: 'us-east-1',
      endpoint: ENDPOINT,
      accessKeyId: 'test',
      secretAccessKey: 'test',
      // Required by every S3 clone, which is what makes one endpoint cover R2, MinIO and Floci.
      forcePathStyle: true,
    });
  });

  it('round-trips an object and reports its size', async () => {
    const key = objectKey('user-int', `att-${Date.now()}`);
    await store.put(key, bytes, meta);
    expect(await store.head(key)).toBe(bytes.byteLength);
    expect(await store.get(key)).toEqual(bytes);
    await store.delete(key);
    expect(await store.head(key)).toBeNull();
  });

  it('signs an upload URL that accepts exactly the bytes it was signed for', async () => {
    const key = objectKey('user-int', `presigned-${Date.now()}`);
    const target = await store.presignPut?.(key, meta);
    expect(target).toBeDefined();
    if (target === undefined) return;

    const response = await fetch(target.url, {
      method: target.method,
      headers: target.headers,
      body: bytes.buffer as ArrayBuffer,
    });
    expect(response.ok).toBe(true);
    // What the server checks after a presigned upload: the object is there, and it is whole.
    expect(await store.head(key)).toBe(bytes.byteLength);

    const stored = await store.get(key);
    expect(stored).not.toBeNull();
    if (stored !== null) {
      expect(createHash('sha256').update(stored).digest('hex')).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );
    }
    await store.delete(key);
  });

  it('signs a download URL that needs no credentials of its own', async () => {
    const key = objectKey('user-int', `download-${Date.now()}`);
    await store.put(key, bytes, meta);
    const url = await store.presignGet?.(key);
    expect(url).toBeDefined();
    if (url === undefined) return;

    const response = await fetch(url);
    expect(response.ok).toBe(true);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    await store.delete(key);
  });
});
