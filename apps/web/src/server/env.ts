import { z } from 'zod';

export const REGISTRATION_MODES = ['open', 'first-user', 'closed', 'invite'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

/** Where attachment blobs live (§10). `none` is supported: they stay on the phone. */
export const ATTACHMENT_STORAGE_KINDS = ['none', 'fs', 's3', 'vercel-blob'] as const;
export type AttachmentStorageKind = (typeof ATTACHMENT_STORAGE_KINDS)[number];

export type AttachmentStorageConfig =
  | { kind: 'none' }
  | { kind: 'fs'; dir: string }
  | {
      kind: 's3';
      bucket: string;
      region: string;
      /** What makes R2, MinIO, Backblaze and Hetzner work. */
      endpoint: string | null;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle: boolean;
    }
  | { kind: 'vercel-blob'; token: string };

/**
 * WebAuthn requires a secure context. Browsers make one exception — `http://localhost` — which is
 * what web development uses, so the check mirrors the browsers' own rule rather than banning http.
 */
function isSecureOrigin(url: URL): boolean {
  return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

const schema = z.object({
  PUBLIC_URL: z
    .string()
    .refine((value) => URL.canParse(value), 'must be an absolute URL')
    .refine(
      (value) => !URL.canParse(value) || isSecureOrigin(new URL(value)),
      'must be https (or http://localhost)',
    ),
  WEBAUTHN_RP_ID: z.string().min(1),
  WEBAUTHN_RP_NAME: z.string().min(1),
  // 32 bytes base64 is 44 characters; anything shorter is not worth signing with.
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  REGISTRATION: z.enum(REGISTRATION_MODES).default('first-user'),
  APP_REDIRECT_SCHEMES: z.string().default('saldo'),
  // Attachment storage (§10). Only the chosen driver's variables are required, so a deployment on
  // a disk is not asked for an S3 bucket and one on Vercel is not asked for a directory it has no
  // way to keep.
  ATTACHMENT_STORAGE: z.enum(ATTACHMENT_STORAGE_KINDS).default('none'),
  STORAGE_DIR: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
});

/** Reports every variable the chosen driver needs and did not get, by name. */
function requireFor(value: z.infer<typeof schema>, ctx: z.RefinementCtx): void {
  const missing = (name: string) => {
    ctx.addIssue({
      code: 'custom',
      path: [name],
      message: `is required when ATTACHMENT_STORAGE is ${value.ATTACHMENT_STORAGE}`,
    });
  };
  if (value.ATTACHMENT_STORAGE === 'fs' && value.STORAGE_DIR === undefined) missing('STORAGE_DIR');
  if (value.ATTACHMENT_STORAGE === 's3') {
    if (value.S3_BUCKET === undefined) missing('S3_BUCKET');
    if (value.S3_REGION === undefined) missing('S3_REGION');
    if (value.S3_ACCESS_KEY_ID === undefined) missing('S3_ACCESS_KEY_ID');
    if (value.S3_SECRET_ACCESS_KEY === undefined) missing('S3_SECRET_ACCESS_KEY');
  }
  if (value.ATTACHMENT_STORAGE === 'vercel-blob' && value.BLOB_READ_WRITE_TOKEN === undefined) {
    missing('BLOB_READ_WRITE_TOKEN');
  }
}

const envSchema = schema.superRefine(requireFor);

function storageConfig(value: z.infer<typeof schema>): AttachmentStorageConfig {
  switch (value.ATTACHMENT_STORAGE) {
    case 'fs':
      return { kind: 'fs', dir: value.STORAGE_DIR ?? '' };
    case 's3':
      return {
        kind: 's3',
        bucket: value.S3_BUCKET ?? '',
        region: value.S3_REGION ?? '',
        endpoint: value.S3_ENDPOINT ?? null,
        accessKeyId: value.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: value.S3_SECRET_ACCESS_KEY ?? '',
        forcePathStyle: value.S3_FORCE_PATH_STYLE,
      };
    case 'vercel-blob':
      return { kind: 'vercel-blob', token: value.BLOB_READ_WRITE_TOKEN ?? '' };
    default:
      return { kind: 'none' };
  }
}

export interface ServerEnv {
  publicUrl: string;
  rpId: string;
  rpName: string;
  /** Signs session and token material. Better Auth takes it as a string. */
  secret: string;
  databaseUrl: string;
  attachmentStorage: AttachmentStorageConfig;
  registration: RegistrationMode;
  appRedirectSchemes: string[];
}

export function readEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(`Invalid server environment:\n${lines.join('\n')}`);
  }
  const value = parsed.data;
  return {
    publicUrl: value.PUBLIC_URL.replace(/\/$/, ''),
    rpId: value.WEBAUTHN_RP_ID,
    rpName: value.WEBAUTHN_RP_NAME,
    secret: value.JWT_SECRET,
    databaseUrl: value.DATABASE_URL,
    attachmentStorage: storageConfig(value),
    registration: value.REGISTRATION,
    appRedirectSchemes: value.APP_REDIRECT_SCHEMES.split(',')
      .map((scheme) => scheme.trim())
      .filter((scheme) => scheme.length > 0),
  };
}

let cached: ServerEnv | null = null;

/** Read once per process. Route handlers call this; only tests reset it. */
export function env(): ServerEnv {
  if (cached === null) cached = readEnv(process.env);
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
