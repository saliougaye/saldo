import { isTimeZone } from '@saldo/i18n';
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

/** `KEY=` in a compose file or a `.env` is «not set»: an empty string must not fail a mode or a host. */
function blankIsUnset(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

const SETTINGS_KEY_BYTES = 32;

/** Base64 that decodes to exactly 32 bytes. `Buffer.from` alone would shrug at garbage. */
function isSettingsKey(value: string): boolean {
  return (
    /^[A-Za-z0-9+/]+={0,2}$/.test(value) &&
    Buffer.from(value, 'base64').length === SETTINGS_KEY_BYTES
  );
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
  // Encrypts the secrets kept in `server_settings` (§17.1.8). Losing it loses those secrets, nothing else.
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .refine(isSettingsKey, 'must be base64 of exactly 32 bytes (openssl rand -base64 32)'),
  // Optional: set, it wins over the admin panel and locks it; unset, the panel chooses (default first-user).
  REGISTRATION: z.preprocess(blankIsUnset, z.enum(REGISTRATION_MODES).optional()),
  INSTANCE_NAME: z.preprocess(blankIsUnset, z.string().trim().min(1).max(60).optional()),
  // Set SMTP_HOST and the whole group comes from here and locks the panel (`requireSmtpGroup`).
  SMTP_HOST: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  SMTP_PORT: z.preprocess(
    blankIsUnset,
    z
      .string()
      .regex(/^\d+$/, 'must be a whole number')
      .transform(Number)
      .refine((port) => port >= 1 && port <= 65535, 'must be between 1 and 65535')
      .default(587),
  ),
  SMTP_USER: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  SMTP_PASSWORD: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  SMTP_FROM: z.preprocess(blankIsUnset, z.string().min(1).optional()),
  APP_REDIRECT_SCHEMES: z.string().default('saldo'),
  // Rate limiting keys on the caller's IP (§18). Better Auth resolves that from `X-Forwarded-For`,
  // which only holds one address it can trust unless it also knows which addresses are *its own*
  // reverse proxy — everything else in that header is whatever the caller sent. Empty means "no
  // reverse proxy", the same as a bare `pnpm --filter web dev`.
  TRUSTED_PROXIES: z.string().default(''),
  // The time zone for a user whose settings carry none (§17.1.5). Not `TZ`: Vercel reserves that
  // name, and in Node it would also move the process's own local time.
  DEFAULT_TIME_ZONE: z.string().default('UTC').refine(isTimeZone, 'must be an IANA time zone'),
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

/** With a host, the group is the environment's: a sender is needed, and credentials come as a pair. */
function requireSmtpGroup(value: z.infer<typeof schema>, ctx: z.RefinementCtx): void {
  if (value.SMTP_HOST === undefined) return;
  const issue = (name: string, message: string) => {
    ctx.addIssue({ code: 'custom', path: [name], message });
  };
  if (value.SMTP_FROM === undefined) issue('SMTP_FROM', 'is required when SMTP_HOST is set');
  if (value.SMTP_USER !== undefined && value.SMTP_PASSWORD === undefined) {
    issue('SMTP_PASSWORD', 'is required when SMTP_USER is set');
  }
  if (value.SMTP_PASSWORD !== undefined && value.SMTP_USER === undefined) {
    issue('SMTP_USER', 'is required when SMTP_PASSWORD is set');
  }
}

const envSchema = schema.superRefine(requireFor).superRefine(requireSmtpGroup);

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

/** The SMTP group as the environment gives it. Whole or absent: never a mix with the database row. */
export interface SmtpEnv {
  host: string;
  port: number;
  user: string | null;
  password: string | null;
  from: string;
}

function smtpConfig(value: z.infer<typeof schema>): SmtpEnv | null {
  if (value.SMTP_HOST === undefined) return null;
  return {
    host: value.SMTP_HOST,
    port: value.SMTP_PORT,
    user: value.SMTP_USER ?? null,
    password: value.SMTP_PASSWORD ?? null,
    // `requireSmtpGroup` has already refused a host without a sender.
    from: value.SMTP_FROM ?? '',
  };
}

export interface ServerEnv {
  publicUrl: string;
  rpId: string;
  rpName: string;
  /** Signs session and token material. Better Auth takes it as a string. */
  secret: string;
  databaseUrl: string;
  attachmentStorage: AttachmentStorageConfig;
  /** AES-256-GCM key for the secrets in `server_settings`: exactly 32 bytes. */
  settingsKey: Buffer;
  /** `null` when `REGISTRATION` is unset: the admin panel chooses, and `first-user` is the default. */
  registration: RegistrationMode | null;
  /** `INSTANCE_NAME`, or `null`: then the panel's value, then `rpName`. */
  instanceName: string | null;
  /** The `SMTP_*` group when `SMTP_HOST` is set, else `null`. */
  smtp: SmtpEnv | null;
  appRedirectSchemes: string[];
  trustedProxies: string[];
  /** For users whose settings carry no time zone (§17.1.5). */
  defaultTimeZone: string;
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
    settingsKey: Buffer.from(value.SETTINGS_ENCRYPTION_KEY, 'base64'),
    registration: value.REGISTRATION ?? null,
    instanceName: value.INSTANCE_NAME ?? null,
    smtp: smtpConfig(value),
    appRedirectSchemes: value.APP_REDIRECT_SCHEMES.split(',')
      .map((scheme) => scheme.trim())
      .filter((scheme) => scheme.length > 0),
    trustedProxies: value.TRUSTED_PROXIES.split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
    defaultTimeZone: value.DEFAULT_TIME_ZONE,
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
