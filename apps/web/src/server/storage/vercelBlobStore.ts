import type { AttachmentStore, ObjectMeta } from './types';
import { InvalidKeyError, isValidKey } from './types';

/**
 * Vercel Blob (§10).
 *
 * **Every object in a Blob store is world-readable at its URL** — the product has no private
 * access mode — so the only thing protecting a receipt is that the URL cannot be guessed. Hence
 * `addRandomSuffix: true`, which puts random bytes in the pathname, and hence the deliberate
 * absence of `presignGet`: the URL never leaves the server, and downloads are proxied by the route
 * that already checks who is asking. A stored object is found again by listing its prefix.
 *
 * There is no `presignPut` either: Blob's direct uploads are addressed by pathname rather than
 * signed URLs. Uploads therefore go through the server, and the platform's request body limit
 * applies — which is why a Vercel deployment that wants attachments larger than a few MB belongs
 * on `s3` instead.
 */
export async function createVercelBlobStore(token: string): Promise<AttachmentStore> {
  const { del, head, list, put } = await import('@vercel/blob');

  const check = (key: string): string => {
    if (!isValidKey(key)) throw new InvalidKeyError(key);
    return key;
  };

  /** The random suffix means the URL cannot be derived from the key, so it is looked up. */
  const urlFor = async (key: string): Promise<string | null> => {
    const prefix = check(key);
    const found = await list({ token, prefix, limit: 1 });
    const first = found.blobs[0];
    return first === undefined || !first.pathname.startsWith(prefix) ? null : first.url;
  };

  const remove = async (key: string): Promise<void> => {
    const url = await urlFor(key);
    if (url === null) return;
    await del(url, { token });
  };

  return {
    name: 'vercel-blob',

    async put(key: string, bytes: Uint8Array, meta: ObjectMeta): Promise<void> {
      // Replacing an object leaves the old one behind under its own suffix, so it goes first.
      await remove(key);
      await put(check(key), Buffer.from(bytes), {
        token,
        access: 'public',
        contentType: meta.mimeType,
        // Not for uniqueness — the key is already unique — but because the URL is public: random
        // bytes in the pathname are what stop it being guessable from a user id and a row id.
        addRandomSuffix: true,
      });
    },

    async get(key: string): Promise<Uint8Array | null> {
      const url = await urlFor(key);
      if (url === null) return null;
      const response = await fetch(url);
      if (!response.ok) return null;
      return new Uint8Array(await response.arrayBuffer());
    },

    async head(key: string): Promise<number | null> {
      const url = await urlFor(key);
      if (url === null) return null;
      const details = await head(url, { token }).catch(() => null);
      return details?.size ?? null;
    },

    delete: remove,
  };
}
