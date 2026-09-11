import { type AttachmentStorageConfig, env } from '../env';
import { createFsStore } from './fsStore';
import type { AttachmentStore } from './types';

export * from './types';

async function build(config: AttachmentStorageConfig): Promise<AttachmentStore | null> {
  switch (config.kind) {
    case 'none':
      return null;
    case 'fs':
      return createFsStore(config.dir);
    case 's3': {
      const { createS3Store } = await import('./s3Store');
      return createS3Store(config);
    }
    case 'vercel-blob': {
      const { createVercelBlobStore } = await import('./vercelBlobStore');
      return createVercelBlobStore(config.token);
    }
  }
}

let cached: Promise<AttachmentStore | null> | null = null;

/**
 * The store this server was configured with, or **null when it was configured without one** —
 * a supported state (§10), not a failure: attachments then stay on the phone.
 *
 * Memoised like `getDb`, and the driver's SDK is only imported when that driver is the one asked
 * for, so a self-hosted deployment on a disk never loads the AWS SDK.
 */
export function getStore(): Promise<AttachmentStore | null> {
  if (cached === null) cached = build(env().attachmentStorage);
  return cached;
}

export function resetStoreCache(): void {
  cached = null;
}
