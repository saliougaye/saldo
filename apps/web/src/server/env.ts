import { z } from 'zod';

export const REGISTRATION_MODES = ['open', 'first-user', 'closed'] as const;
export type RegistrationMode = (typeof REGISTRATION_MODES)[number];

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
  STORAGE_DIR: z.string().min(1),
  REGISTRATION: z.enum(REGISTRATION_MODES).default('first-user'),
  APP_REDIRECT_SCHEMES: z.string().default('saldo'),
});

export interface ServerEnv {
  publicUrl: string;
  rpId: string;
  rpName: string;
  jwtSecret: Uint8Array;
  databaseUrl: string;
  storageDir: string;
  registration: RegistrationMode;
  appRedirectSchemes: string[];
}

export function readEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = schema.safeParse(source);
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
    jwtSecret: new TextEncoder().encode(value.JWT_SECRET),
    databaseUrl: value.DATABASE_URL,
    storageDir: value.STORAGE_DIR,
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
