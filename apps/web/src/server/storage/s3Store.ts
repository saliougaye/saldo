import type { AttachmentStore, ObjectMeta, PresignedTarget } from './types';
import { InvalidKeyError, isValidKey } from './types';

export interface S3StoreOptions {
  bucket: string;
  region: string;
  endpoint: string | null;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** Long enough for a 10 MB upload on a slow connection, short enough not to be worth stealing. */
const PRESIGN_SECONDS = 300;

/**
 * S3, and everything that speaks it: Cloudflare R2, MinIO, Backblaze B2 and Hetzner all work
 * through `endpoint` (§10).
 *
 * The SDK is imported inside the factory so a deployment that keeps blobs on a disk never loads
 * it — `getStore` only ever builds the one driver the environment asked for.
 */
export async function createS3Store(options: S3StoreOptions): Promise<AttachmentStore> {
  const { GetObjectCommand, HeadObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } =
    await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  const client = new S3Client({
    region: options.region,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    ...(options.endpoint === null ? {} : { endpoint: options.endpoint }),
    forcePathStyle: options.forcePathStyle,
  });

  const check = (key: string): string => {
    if (!isValidKey(key)) throw new InvalidKeyError(key);
    return key;
  };

  /** The SDK reports a missing object as one of several names depending on the operation. */
  const isNotFound = (error: unknown): boolean => {
    const name = error instanceof Error ? error.name : '';
    return name === 'NotFound' || name === 'NoSuchKey';
  };

  return {
    name: 's3',

    async put(key: string, bytes: Uint8Array, meta: ObjectMeta): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: check(key),
          Body: bytes,
          ContentType: meta.mimeType,
          ContentLength: meta.size,
        }),
      );
    },

    async get(key: string): Promise<Uint8Array | null> {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: options.bucket, Key: check(key) }),
        );
        const body = result.Body;
        if (body === undefined) return null;
        return new Uint8Array(await body.transformToByteArray());
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async head(key: string): Promise<number | null> {
      try {
        const result = await client.send(
          new HeadObjectCommand({ Bucket: options.bucket, Key: check(key) }),
        );
        return result.ContentLength ?? null;
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async delete(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: check(key) }));
    },

    async presignPut(key: string, meta: ObjectMeta): Promise<PresignedTarget> {
      // Size and type are signed into the URL: one that would accept any body is a bucket-sized
      // hole, since anybody who obtained it could fill the bucket.
      const command = new PutObjectCommand({
        Bucket: options.bucket,
        Key: check(key),
        ContentType: meta.mimeType,
        ContentLength: meta.size,
      });
      return {
        url: await getSignedUrl(client, command, { expiresIn: PRESIGN_SECONDS }),
        method: 'PUT',
        headers: { 'Content-Type': meta.mimeType, 'Content-Length': String(meta.size) },
        expiresIn: PRESIGN_SECONDS,
      };
    },

    async presignGet(key: string): Promise<string> {
      const command = new GetObjectCommand({ Bucket: options.bucket, Key: check(key) });
      return getSignedUrl(client, command, { expiresIn: PRESIGN_SECONDS });
    },
  };
}
