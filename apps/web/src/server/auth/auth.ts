import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { bearer, oneTimeToken } from 'better-auth/plugins';
import { getDb } from '../db/client';
import { schema } from '../db/schema';
import { env } from '../env';
import { registrationAllowed } from './policy';

/** The handoff token lives just long enough to travel one deep link. */
const ONE_TIME_TOKEN_MINUTES = 1;

/**
 * The options, separate from the instance, because `@better-auth/cli` needs a module that exports
 * an eagerly-built instance (see `authForCli.ts`) while the app needs a lazily-built one.
 */
export function buildAuthOptions() {
  const { publicUrl, rpId, rpName, appRedirectSchemes, registration, secret } = env();
  const db = getDb();
  return {
    appName: 'Saldo',
    baseURL: publicUrl,
    secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    // A passkey is the only credential: no weaker path to the same account.
    emailAndPassword: { enabled: false },
    // The app talks to `saldo://`; every allowed scheme comes from §9.2's env var.
    trustedOrigins: appRedirectSchemes.flatMap((scheme) => [`${scheme}://`, `${scheme}://*`]),
    rateLimit: { enabled: true, window: 60, max: 20 },
    plugins: [
      passkey({
        rpID: rpId,
        rpName,
        origin: publicUrl,
        // §9.3: discoverable credentials, so login needs no identifier and cannot enumerate users.
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        registration: {
          requireSession: false,
          /**
           * Runs before the ceremony: it decides the WebAuthn user handle and is where the
           * registration policy is enforced. No row is written yet — the account is created in
           * `afterVerification`, so a ceremony the user abandons leaves nothing behind.
           */
          resolveUser: async ({ context }) => {
            if (!(await registrationAllowed(db, registration))) {
              throw new APIError('FORBIDDEN', {
                code: 'registration_closed',
                message: 'This server is not accepting new accounts',
              });
            }
            const name = (context ?? '').trim();
            if (name.length === 0) {
              throw new APIError('BAD_REQUEST', {
                code: 'display_name_required',
                message: 'Choose a name first',
              });
            }
            return { id: crypto.randomUUID(), name };
          },
          /**
           * The plugin never creates users — it needs `userId` to name one that already exists —
           * so the account is written here, with the same id the ceremony used as its handle.
           *
           * `email` is required and unique in Better Auth's schema, but a passkey-only account has
           * no email, so it gets a synthetic address in `.invalid`: RFC 2606 reserves that TLD, so
           * the value can never route anywhere.
           */
          afterVerification: async ({ ctx, user: resolved }) => {
            if (!(await registrationAllowed(db, registration))) {
              throw new APIError('FORBIDDEN', {
                code: 'registration_closed',
                message: 'This server is not accepting new accounts',
              });
            }
            const created = await ctx.context.internalAdapter.createUser(
              {
                id: resolved.id,
                name: resolved.name,
                email: `${resolved.id}@passkey.saldo.invalid`,
                emailVerified: false,
              },
              // The provisioning source Better Auth records for the account; `method` is an open
              // string, and "passkey" is what actually created this user.
              { method: 'passkey' },
            );
            return { userId: created.id };
          },
        },
      }),
      bearer(),
      oneTimeToken({ expiresIn: ONE_TIME_TOKEN_MINUTES, storeToken: 'hashed' }),
      expo(),
      // Must stay last (Better Auth's Next.js integration requires it).
      nextCookies(),
    ],
  };
}

function build() {
  return betterAuth(buildAuthOptions());
}

/**
 * One instance per process, built lazily so `env()` and the database handle are read after the
 * process has its configuration — a module-level instance would throw during `next build`.
 */
let instance: ReturnType<typeof build> | null = null;

export function auth(): ReturnType<typeof build> {
  instance ??= build();
  return instance;
}

/** Only tests reset it, after installing a PGlite handle. */
export function resetAuthForTests(): void {
  instance = null;
}
