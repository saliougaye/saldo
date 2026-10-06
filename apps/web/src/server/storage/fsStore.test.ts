import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFsStore } from './fsStore';
import { InvalidKeyError } from './types';

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
  it('refuses a key that tries to climb out of the directory', async () => {
    const store = createFsStore(dir);
    await expect(store.put('../escape/att-1', bytes, meta)).rejects.toThrow(InvalidKeyError);
    await expect(store.put('user-1/../../escape', bytes, meta)).rejects.toThrow(InvalidKeyError);
    await expect(store.get('..%2fescape/att-1')).resolves.toBeNull();
  });
});
