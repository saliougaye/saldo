import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { admin, bearer, oneTimeToken } from 'better-auth/plugins';
import { getDb } from '../db/client';
import { schema } from '../db/schema';
import { env } from '../env';
import { ADMIN_ROLE, claimRoleForNewUser, MEMBER_ROLE } from './admin';
import { attributeInvite, burnInvite, inviteIsUsable, releaseInvite } from './invites';
import { registrationAllowed, registrationRequiresInvite } from './policy';
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
  const requiresInvite = registrationRequiresInvite(registration);
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
          /**
           * Runs before the ceremony: it decides the WebAuthn user handle and is where the
           * registration policy is enforced. No row is written yet — the account is created in
           * `afterVerification`, so a ceremony the user abandons leaves nothing behind.
           *
           * The invite is only **checked** here, never spent, for the same reason: an abandoned
           * ceremony must not cost the person their code.
           */
          resolveUser: async ({ context }) => {
            if (!(await registrationAllowed(db, registration))) {
              throw new APIError('FORBIDDEN', {
                code: 'registration_closed',
                message: 'This server is not accepting new accounts',
              });
            }
            const { name, invite } = readRegistrationContext(context);
            if (name.length === 0) {
              throw new APIError('BAD_REQUEST', {
                code: 'display_name_required',
                message: 'Choose a name first',
              });
            }
            if (requiresInvite && !(await inviteIsUsable(db, invite ?? '', new Date()))) {
              // One answer for unknown, spent, revoked and expired: the form must not be usable
              // to find out which codes exist.
              throw new APIError('FORBIDDEN', {
                code: 'invalid_invite',
                message: 'That invite code is not valid',
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
          afterVerification: async ({ ctx, context, user: resolved }) => {
            if (!(await registrationAllowed(db, registration))) {
              throw new APIError('FORBIDDEN', {
                code: 'registration_closed',
                message: 'This server is not accepting new accounts',
              });
            }
            const { invite } = readRegistrationContext(context);
            /**
             * Spend the code **before** writing the account. Two ceremonies holding the same code
             * reach this line together; the burn is a conditional UPDATE, so exactly one of them
             * gets an id and the other is refused. Doing it the other way round would create both
             * accounts and then refuse one of them, leaving an orphan.
             */
            let burnedInviteId: string | null = null;
            if (requiresInvite) {
              burnedInviteId = await burnInvite(db, invite ?? '', new Date());
              if (burnedInviteId === null) {
                throw new APIError('FORBIDDEN', {
                  code: 'invalid_invite',
                  message: 'That invite code is not valid',
                });
              }
            }
            try {
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
              /**
               * §9.5: the first account on the instance is the admin, and under `invite` it can
               * only exist because somebody with shell access minted its code. Every later one is
               * a member. This runs **after** the row exists, because the claim is decided by
               * "is the earliest account mine" rather than by the table being empty — see
               * `claimRoleForNewUser`, which takes a lock so two ceremonies finishing together
               * cannot both win, and cannot both lose either.
               */
              await claimRoleForNewUser(db, created.id);
              // Now that the row exists, the invite can say whose it was. Last, and on purpose:
              // `used_by` points at `user`, and it is a record rather than a decision, so nothing
              // above this line waits on it.
              if (burnedInviteId !== null) await attributeInvite(db, burnedInviteId, created.id);
              return { userId: created.id };
            } catch (error) {
              // The account was not created, so the code was not really used: give it back rather
              // than leave the person holding one that never worked.
              if (burnedInviteId !== null) await releaseInvite(db, burnedInviteId);
              throw error;
            }
          },
        },
      }),
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
