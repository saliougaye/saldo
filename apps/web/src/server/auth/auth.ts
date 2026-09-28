import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin, bearer, oneTimeToken } from 'better-auth/plugins';
import { getDb } from '../db/client';
import { schema } from '../db/schema';
import { env } from '../env';
import { ADMIN_ROLE, MEMBER_ROLE } from './admin';
import { invitePlugin } from './invitePlugin';
import { completeRegistration, resolveRegistration } from './registration';
import { readRegistrationContext } from './registrationContext';

/** The handoff token lives just long enough to travel one deep link. */
const ONE_TIME_TOKEN_MINUTES = 1;

/**
 * §18. There is no refresh token — phase 06b replaced that design with one opaque, server-revocable
 * session token in the OS keychain/keystore — so this number *is* "how long before you have to sign
 * in again", with nothing behind it to renew silently.
 *
 * The thing this defends against is a lost or stolen phone, and the actual control for that is
 * `revokeUser`: it deletes the session row outright, so a revoked device is refused on its very
 * next request, at any time, regardless of this number. Given that, a short expiry buys little
 * safety and costs real harm — Saldo works offline, and a session that lapses mid-trip locks its
 * owner out of *their own already-downloaded data* until they can reach this server again. So the
 * session is long and sliding: it renews on every use, at most this often, and only a stretch with
 * *no* contact with the server longer than the expiry forces a fresh passkey ceremony.
 */
const SESSION_UPDATE_AGE_DAYS = 14;
const SESSION_EXPIRES_IN_DAYS = 180;

/**
 * The options, separate from the instance, because `@better-auth/cli` needs a module that exports
 * an eagerly-built instance (see `authForCli.ts`) while the app needs a lazily-built one.
 */
export function buildAuthOptions() {
  const { publicUrl, rpId, rpName, appRedirectSchemes, registration, secret, trustedProxies } =
    env();
  const db = getDb();
  return {
    appName: 'Saldo',
    baseURL: publicUrl,
    secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    // A passkey is the only credential: no weaker path to the same account.
    emailAndPassword: { enabled: false },
    session: {
      expiresIn: 60 * 60 * 24 * SESSION_EXPIRES_IN_DAYS,
      updateAge: 60 * 60 * 24 * SESSION_UPDATE_AGE_DAYS,
    },
    // The app talks to `saldo://`; every allowed scheme comes from §9.2's env var.
    trustedOrigins: appRedirectSchemes.flatMap((scheme) => [`${scheme}://`, `${scheme}://*`]),
    // §18: sliding, in-memory (see the note on `rateLimit.storage` in `docs/self-hosting.md` — a
    // second replica or a Vercel deployment gets its own bucket, silently raising the real limit).
    rateLimit: { enabled: true, window: 60, max: 20 },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['x-forwarded-for'],
        /**
         * Without this, `getIPFromHeader` trusts `x-forwarded-for` only when it holds exactly one
         * address. Caddy's `reverse_proxy` (docker/Caddyfile.example) *appends* the connecting
         * peer rather than replacing the header, so a request that already carries its own
         * `X-Forwarded-For` — trivial for any caller to send — arrives with two, resolves to no
         * IP, and every caller then shares the one `no-trusted-ip|<path>` bucket: on `/sign-in*`
         * that is 3 requests per 10s for the entire server, so one attacker can lock everyone out.
         * `TRUSTED_PROXIES` names the reverse proxy so the real, right-most address can be told
         * apart from whatever the caller put in front of it.
         */
        trustedProxies,
      },
    },
    plugins: [
      passkey({
        rpID: rpId,
        rpName,
        origin: publicUrl,
        // §9.3: discoverable credentials, so login needs no identifier and cannot enumerate users.
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        registration: {
          requireSession: false,
          /** Before the ceremony: the policy, the name, the email and the invite. See `registration.ts`. */
          resolveUser: async ({ context }) =>
            resolveRegistration(db, {
              mode: registration,
              context: readRegistrationContext(context),
              now: new Date(),
            }),
          /** After it: the account row, the role, the invite — or nothing at all when it exists. */
          afterVerification: async ({ ctx, context, user: resolved }) =>
            completeRegistration(db, {
              mode: registration,
              context: readRegistrationContext(context),
              resolved: { id: resolved.id, name: resolved.name },
              store: {
                findUserById: async (id) => {
                  const found = await ctx.context.internalAdapter.findUserById(id);
                  return found === null || found === undefined
                    ? null
                    : { id: found.id, email: found.email };
                },
                createUser: async (input) =>
                  ctx.context.internalAdapter.createUser(
                    { ...input, emailVerified: false },
                    // The provisioning source Better Auth records; `method` is an open string, and
                    // "passkey" is what actually created this user.
                    { method: 'passkey' },
                  ),
              },
              now: new Date(),
            }),
        },
      }),
      invitePlugin(registration),
      admin({ defaultRole: MEMBER_ROLE, adminRoles: [ADMIN_ROLE] }),
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
