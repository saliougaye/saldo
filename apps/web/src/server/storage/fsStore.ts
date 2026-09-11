import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type AttachmentStore, InvalidKeyError, isValidKey, type ObjectMeta } from './types';

/**
 * Blobs on a disk, for the self-hosted case (§10). No presigning: a filesystem has no URLs, so
 * uploads to this store go through the server, which is fine — it is not running on a platform
 * that caps request bodies.
 */
export function createFsStore(dir: string): AttachmentStore {
  const pathFor = (key: string): string => {
    // A key reaching the filesystem is the one place traversal would matter, so it is checked
    // here as well as where keys are built.
    if (!isValidKey(key)) throw new InvalidKeyError(key);
    return join(dir, key);
  };

  return {
    name: 'fs',

    async put(key: string, bytes: Uint8Array, _meta: ObjectMeta): Promise<void> {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      // Written aside and renamed: a crash halfway must not leave a short file that `head` would
      // happily report as complete.
      const temporary = `${path}.tmp`;
      await writeFile(temporary, bytes);
      await rename(temporary, path);
    },

    async get(key: string): Promise<Uint8Array | null> {
      try {
        return new Uint8Array(await readFile(pathFor(key)));
      } catch {
        return null;
      }
    },

    async head(key: string): Promise<number | null> {
      try {
        return (await stat(pathFor(key))).size;
      } catch {
        return null;
      }
    },

    async delete(key: string): Promise<void> {
      await rm(pathFor(key), { force: true });
    },
  };
}
