import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFsStore } from './fsStore';
import { InvalidKeyError, objectKey } from './types';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'saldo-blobs-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const bytes = new Uint8Array([1, 2, 3, 4, 5]);
const meta = { size: bytes.byteLength, mimeType: 'image/jpeg' };

describe('createFsStore', () => {
  it('round-trips an object', async () => {
    const store = createFsStore(dir);
    const key = objectKey('user-1', 'att-1');
    await store.put(key, bytes, meta);
    expect(await store.get(key)).toEqual(bytes);
    expect(await store.head(key)).toBe(5);
  });

  it('answers null for an object that was never written', async () => {
    const store = createFsStore(dir);
    expect(await store.get(objectKey('user-1', 'nope'))).toBeNull();
    expect(await store.head(objectKey('user-1', 'nope'))).toBeNull();
  });

  it('deletes, and deleting twice is not an error', async () => {
    const store = createFsStore(dir);
    const key = objectKey('user-1', 'att-1');
    await store.put(key, bytes, meta);
    await store.delete(key);
    await store.delete(key);
    expect(await store.head(key)).toBeNull();
  });

  it('leaves no temporary file behind', async () => {
    const store = createFsStore(dir);
    await store.put(objectKey('user-1', 'att-1'), bytes, meta);
    expect(await readdir(join(dir, 'user-1'))).toEqual(['att-1']);
  });

  it('keeps two users apart', async () => {
    const store = createFsStore(dir);
    await store.put(objectKey('user-1', 'att-1'), bytes, meta);
    expect(await store.get(objectKey('user-2', 'att-1'))).toBeNull();
  });

  it('refuses a key that tries to climb out of the directory', async () => {
    const store = createFsStore(dir);
    await expect(store.put('../escape/att-1', bytes, meta)).rejects.toThrow(InvalidKeyError);
    await expect(store.put('user-1/../../escape', bytes, meta)).rejects.toThrow(InvalidKeyError);
    await expect(store.get('..%2fescape/att-1')).resolves.toBeNull();
  });

  it('overwrites an object that is already there', async () => {
    const store = createFsStore(dir);
    const key = objectKey('user-1', 'att-1');
    await store.put(key, bytes, meta);
    const longer = new Uint8Array([9, 9, 9, 9, 9, 9]);
    await store.put(key, longer, { ...meta, size: 6 });
    expect(await store.head(key)).toBe(6);
  });
});
