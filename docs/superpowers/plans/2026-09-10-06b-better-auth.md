# Phase 06b — Move authentication onto Better Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled authentication of phase 06 with Better Auth 1.7, keeping the same product behaviour:
passkey sign-in and sign-up on a self-hosted server, a bearer credential the app can use for sync, and a registration
policy that closes after the first account.

**Why:** the user asked for it. It also deletes the part of this repository most likely to be wrong: the phase 06
review already found an off-by-one on every expiry and a rate limit keyed on a client-controlled header, in code
whose only job was to re-implement what an auth library does.

**Architecture:** one `betterAuth()` instance over the existing Drizzle/Postgres handle, mounted at
`/api/auth/[...all]`. Plugins: `passkey` (the ceremony), `bearer` (the app's credential), `oneTimeToken` (the
browser→app handoff), `expo` (scheme handling), `nextCookies`. Better Auth owns users, passkeys, sessions,
verification and revocation; `sync_rows` keeps pointing at its `user` table.

**Tech Stack:** better-auth 1.7.4, @better-auth/passkey 1.7.4, @better-auth/expo 1.7.4, Drizzle adapter from
`better-auth/adapters/drizzle`.

---

## Decisions taken while planning

- **The handoff uses the `one-time-token` plugin, not the Expo plugin's redirect.** The user chose "Better Auth's
  Expo flow", and reading `@better-auth/expo`'s client settles what that can be: it hooks
  `signIn`/`link-social` responses that carry `{redirect, url}`, opens `openAuthSessionAsync`, and reads the session
  out of `?cookie=` on the deep link. A passkey sign-in has no redirect — the ceremony has to run in a browser, where
  `navigator.credentials` exists — so that path does not apply to passkeys at all. `oneTimeToken` is Better Auth's own
  primitive for this handoff: the page mints a token bound to the browser session, the app exchanges it for the
  session. Stored hashed, one minute TTL, single use.
- **Only a one-time token is exposed in the deep link, never the session.** The user accepted the risk of a credential
  travelling in a `saldo://` URL, which any app on the device can claim. This shape keeps that exposure to a
  single-use, one-minute token. The real fix is a verified app link (`webcredentials`/`assetlinks.json`), which needs
  a paid Apple Developer account — §9.4 already records that; `docs/self-hosting.md` gains a note.
- **The migration history is squashed.** No instance of this server has ever been deployed, and phase 06's migrations
  create four tables this phase drops. `apps/web/drizzle` is regenerated from scratch as a single `0000`.
- **`REGISTRATION` survives** as a policy in the passkey plugin's `resolveUser`: Better Auth has no notion of
  "first user only", and it is the setting that keeps a public self-hosted instance from being open to strangers.
- **No email/password, ever.** `emailAndPassword` stays disabled: a passkey is the only credential, so there is no
  weaker path to the same account.

---

## Task 1: The Better Auth instance

**Files:**
- Create: `apps/web/src/server/auth/auth.ts`, `apps/web/src/server/auth/policy.ts`
- Modify: `apps/web/package.json`, `apps/web/src/server/env.ts`

- [x] **Step 1: Install**

```bash
pnpm --filter web add better-auth @better-auth/passkey @better-auth/expo
```

- [x] **Step 2: Write `apps/web/src/server/auth/policy.ts`**

Move the `first-user` rule off the old `registration.ts` and onto Better Auth's `user` table:

```ts
import { sql } from 'drizzle-orm';
import { user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import type { RegistrationMode } from '../env';

/**
 * §9.2 `REGISTRATION`. Better Auth has no concept of a closed instance, so this is checked in the
 * passkey plugin's `resolveUser` hook — the last moment before a user row would be created.
 */
export async function registrationAllowed(
  db: ServerDatabase,
  mode: RegistrationMode,
): Promise<boolean> {
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(user);
  return (row?.count ?? 0) === 0;
}
```

- [x] **Step 3: Write `apps/web/src/server/auth/auth.ts`**

```ts
import { expo } from '@better-auth/expo';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { bearer, oneTimeToken } from 'better-auth/plugins';
import { APIError } from 'better-auth/api';
import { getDb } from '../db/client';
import { schema } from '../db/schema';
import { env } from '../env';
import { registrationAllowed } from './policy';

/** The handoff token lives just long enough to travel one deep link. */
const ONE_TIME_TOKEN_MINUTES = 1;

/**
 * One instance per process, built lazily so `env()` is read after the process has its
 * configuration — a module-level instance would throw during `next build`.
 */
let instance: ReturnType<typeof build> | null = null;

function build() {
  const { publicUrl, rpId, rpName, appRedirectSchemes, registration, jwtSecret } = env();
  const db = getDb();
  return betterAuth({
    appName: 'Saldo',
    baseURL: publicUrl,
    secret: Buffer.from(jwtSecret).toString('utf8'),
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
            // The id is minted here and the row is created by Better Auth on verification, so a
            // ceremony the user abandons leaves no account behind.
            return { id: crypto.randomUUID(), name };
          },
        },
      }),
      bearer(),
      oneTimeToken({ expiresIn: ONE_TIME_TOKEN_MINUTES, storeToken: 'hashed' }),
      expo(),
      // Must stay last (Better Auth's Next.js integration requires it).
      nextCookies(),
    ],
  });
}

export function auth(): ReturnType<typeof build> {
  instance ??= build();
  return instance;
}

/** Only tests reset it, after they install a PGlite handle. */
export function resetAuthForTests(): void {
  instance = null;
}
```

- [x] **Step 4: Rename the secret in `env.ts`**

`JWT_SECRET` becomes Better Auth's `secret`. Keep the variable name — every deployment already sets it, and it is
still exactly "32+ random bytes that sign session material" — but change its type from `Uint8Array` to `string` and
update `.env.example`'s comment to say "signs session and token material".

- [x] **Step 5: Verify it constructs**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: clean. If `APIError`'s import path differs, read `better-auth`'s exports (`package.json` → `exports`) and
fix this plan in the same commit.

- [x] **Step 6: Commit** — `feat(web): better auth instance with passkey, bearer and one-time-token`

---

## Task 2: Schema, squashed migration and the sync foreign key

**Files:**
- Modify: `apps/web/src/server/db/schema.ts`, `apps/web/drizzle/**` (regenerated)
- Delete: `apps/web/src/server/db/schema.ts`'s `users`, `passkeys`, `webauthnChallenges`, `authCodes`,
  `refreshTokens`

- [x] **Step 1: Generate Better Auth's schema**

```bash
cd apps/web && pnpm dlx @better-auth/cli@latest generate --config src/server/auth/auth.ts --output src/server/db/authSchema.ts -y
```

Read what it produced. Expect `user`, `session`, `account`, `verification` and `passkey` tables.

- [x] **Step 2: Merge it into `src/server/db/schema.ts`**

Re-export Better Auth's tables from the one schema module the app already imports, delete the five hand-rolled auth
tables, and repoint `syncRows.userId` at `user.id`:

```ts
export * from './authSchema';
…
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
```

Note the type change: Better Auth's ids are `text`, not `uuid`.

- [x] **Step 3: Squash the migrations**

```bash
rm -rf apps/web/drizzle && pnpm --filter web db:generate
```

Then append the sequence again (drizzle-kit does not emit it):

```sql
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "sync_seq" AS bigint START 1;
```

- [x] **Step 4: Fix the test harness truncation list**

`apps/web/src/server/test/harness.ts` truncates by name; update it to Better Auth's tables plus `sync_rows`.

- [x] **Step 5: Verify**

Run: `pnpm --filter web test sync`
Expected: the sync service tests still pass once their user fixtures insert into `user` (Task 4 rewrites the bearer
fixture).

- [x] **Step 6: Commit** — `feat(web): better auth schema, squashed migration`

---

## Task 3: Routes

**Files:**
- Create: `apps/web/app/api/auth/[...all]/route.ts`
- Delete: `apps/web/app/api/auth/{register,login,token,logout}/**`,
  `apps/web/src/server/auth/{webauthn,challenges,codes,tokens,rateLimit,registration}.ts` and their tests
- Modify: `apps/web/src/server/http/requireUser.ts`, `apps/web/app/api/health/route.ts`,
  `apps/web/app/api/me/route.ts`

- [x] **Step 1: Mount Better Auth**

```ts
// apps/web/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '../../../../src/server/auth/auth';

export const runtime = 'nodejs';

export const { GET, POST } = toNextJsHandler(auth().handler);
```

- [x] **Step 2: Rewrite `requireUser`**

```ts
import { ApiError } from './errors';
import { auth } from '../auth/auth';

export interface AuthenticatedUser {
  id: string;
  displayName: string;
}

/**
 * Every bearer route starts here. The `bearer` plugin lets `getSession` read the token out of the
 * Authorization header, so this is the same call a cookie-based caller would make.
 */
export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const session = await auth().api.getSession({ headers: request.headers });
  if (session === null) throw new ApiError(401, 'unauthorized', 'A bearer token is required');
  return { id: session.user.id, displayName: session.user.name };
}
```

Drop the `now: Date` parameter: expiry is Better Auth's business now, and passing a clock we do not use would be a
lie. Update both call sites (`/api/me`, both sync routes).

- [x] **Step 3: Delete the hand-rolled auth**

```bash
git rm -r apps/web/app/api/auth/register apps/web/app/api/auth/login apps/web/app/api/auth/token \
  apps/web/app/api/auth/logout
git rm apps/web/src/server/auth/webauthn.ts apps/web/src/server/auth/challenges.ts \
  apps/web/src/server/auth/challenges.test.ts apps/web/src/server/auth/codes.ts \
  apps/web/src/server/auth/codes.test.ts apps/web/src/server/auth/tokens.ts \
  apps/web/src/server/auth/tokens.test.ts apps/web/src/server/auth/rateLimit.ts \
  apps/web/src/server/auth/rateLimit.test.ts apps/web/src/server/auth/registration.ts \
  apps/web/src/server/auth/registration.test.ts
```

`policy.ts` replaces `registration.ts`; move its two tests over rather than losing the coverage.

- [x] **Step 4: Health** — keep the shape, sourcing `registrationAllowed` from `policy.ts`.

- [x] **Step 5: Commit** — `feat(web): mount better auth, drop the hand-rolled auth routes`

---

## Task 4: Tests for the new surface

**Files:**
- Create: `apps/web/src/server/test/session.ts`, `apps/web/src/server/auth/policy.test.ts`,
  `apps/web/app/api/auth/handoff.test.ts`
- Modify: `apps/web/app/api/me/route.test.ts`, `apps/web/app/api/sync/push/route.test.ts`

- [x] **Step 1: A test helper that produces a real signed-in user**

```ts
// apps/web/src/server/test/session.ts
import { auth } from '../auth/auth';
import { session, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';

export interface TestSession {
  userId: string;
  token: string;
  bearer: string;
}

/**
 * Inserts a user and a session row directly, then hands back the bearer. Going through the passkey
 * endpoints would mean driving a WebAuthn ceremony; the `bearer` plugin only cares that the token
 * matches a live session row, which is exactly what this creates.
 */
export async function createTestSession(
  db: ServerDatabase,
  displayName = 'Ada',
): Promise<TestSession> {
  const [created] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: displayName,
      email: `${crypto.randomUUID()}@example.invalid`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (created === undefined) throw new Error('insert returned no row');
  const token = crypto.randomUUID();
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId: created.id,
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // Touch `auth()` so a misconfigured instance fails here rather than inside a route.
  auth();
  return { userId: created.id, token, bearer: `Bearer ${token}` };
}
```

Check the generated `authSchema.ts` for the exact column set before writing this; add whatever Better Auth marks
`notNull`.

- [x] **Step 2: Point the existing bearer tests at it** — `/api/me` and both sync route tests replace
      `issueAccessToken(...)` with `createTestSession(harness.db)`.

- [x] **Step 3: A test for the handoff** — `apps/web/app/api/auth/handoff.test.ts`:

```ts
// Generates a one-time token for a session through `auth().api`, verifies it, and asserts:
//   * the verify answers with the same user
//   * a second verify with the same token fails (single use)
//   * a token generated for one session cannot be verified twice
```

Use `auth().api.generateOneTimeToken({ headers })` and `auth().api.verifyOneTimeToken({ body: { token } })`, reading
their exact names off the plugin's types.

- [x] **Step 4: Run the suite** — `pnpm --filter web test`, everything green.

- [x] **Step 5: Commit** — `test(web): cover the better auth surface`

---

## Task 5: The `/auth/mobile` page

**Files:**
- Modify: `apps/web/app/auth/mobile/page.tsx`, `apps/web/app/auth/mobile/MobileAuth.tsx`
- Create: `apps/web/src/client/authClient.ts`

- [x] **Step 1: The browser client**

```ts
// apps/web/src/client/authClient.ts
'use client';

import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';
import { oneTimeTokenClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [passkeyClient(), oneTimeTokenClient()],
});
```

- [x] **Step 2: Rewrite the page's parameters**

The page no longer needs `code_challenge`: PKCE was ours, and the handoff is a one-time token now. It keeps
`redirect_uri` (still allow-listed by scheme, still server-side) and `state` (still echoed back so the app can tell
its own request from someone else's). Registration is offered only when `registrationAllowed`.

- [x] **Step 3: Rewrite the ceremonies in `MobileAuth.tsx`**

```tsx
const finish = async () => {
  // Session established by the ceremony; mint the token that crosses into the app.
  const { data, error } = await authClient.oneTimeToken.generate();
  if (error !== null || data === null) throw new Error(error?.message ?? 'Could not finish sign-in');
  const url = new URL(redirectUri);
  url.searchParams.set('ott', data.token);
  url.searchParams.set('state', state);
  window.location.href = url.toString();
};

const login = () => run(async () => {
  const { error } = await authClient.signIn.passkey();
  if (error !== null) throw new Error(error.message ?? 'Could not sign you in');
  await finish();
});

const register = () => run(async () => {
  const name = displayName.trim();
  if (name.length === 0) throw new Error('Choose a name first');
  // `context` is the plugin's passthrough: it reaches `resolveUser` on the server, which is where
  // the registration policy and the name are enforced.
  const { error } = await authClient.passkey.addPasskey({ context: name, createSession: true });
  if (error !== null) throw new Error(error.message ?? 'Could not create the account');
  await finish();
});
```

Read the client plugin's types for the exact option names before writing this.

- [x] **Step 4: Check the build** — `pnpm --filter web exec next build`, `/auth/mobile` still listed.

- [x] **Step 5: Commit** — `feat(web): passkey ceremony page on better auth`

---

## Task 6: The app side

**Files:**
- Create: `apps/mobile/src/auth/authClient.ts`
- Modify: `apps/mobile/src/net/apiClient.ts`, `apps/mobile/src/auth/session.ts`,
  `apps/mobile/src/auth/tokenStore.ts` (deleted), `apps/mobile/src/auth/pkce.ts` (trimmed)
- Delete: `apps/mobile/src/net/apiClient.test.ts`'s refresh tests (Better Auth renews sessions itself)

- [x] **Step 1: Install and configure the client**

```bash
pnpm --filter mobile add better-auth @better-auth/expo @better-auth/passkey
pnpm --filter mobile exec expo install expo-network
```

```ts
// apps/mobile/src/auth/authClient.ts
import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { oneTimeTokenClient } from 'better-auth/client/plugins';
import * as SecureStore from 'expo-secure-store';

/**
 * One client per server URL: the session lives in SecureStore under a prefix that includes the
 * server, so pointing the app at a second server cannot reuse the first one's session.
 */
export function createServerAuthClient(serverUrl: string) {
  return createAuthClient({
    baseURL: serverUrl,
    plugins: [
      expoClient({
        scheme: 'saldo',
        storagePrefix: `saldo_${serverUrl.replace(/[^A-Za-z0-9]/g, '_')}`,
        storage: SecureStore,
      }),
      oneTimeTokenClient(),
    ],
  });
}
```

- [x] **Step 2: Sign-in becomes: open the page, exchange the token**

`signIn()` keeps its shape — normalise the URL, `checkServer()`, open `openAuthSessionAsync`, check `state` — but the
callback now carries `ott`, and the exchange is `authClient.oneTimeToken.verify({ token })`, which stores the session
in SecureStore itself. `pkce.ts` loses `createPkceChallenge` and keeps `normaliseServerUrl`, `authorizeUrl`
(without `code_challenge`) and `callbackParams` (reading `ott` and `state`); its tests follow.

- [x] **Step 3: `apiClient` loses the refresh dance**

It keeps the shape the sync client depends on (`get`/`post`/`hasSession`) but takes a `getBearer: () => Promise<string | null>`
instead of a token store, and on a 401 it reports `session-expired` rather than refreshing: Better Auth renews the
session on use, and there is no separate refresh credential to rotate. Delete the two refresh tests and add one
asserting a 401 surfaces `session_expired`. **This is the point of the migration** — the refresh chain, its reuse
detection and its single-flight lock are all gone.

- [ ] **Step 4: `ServerProvider`** builds the auth client per server URL, exposes
      `session`/`connect`/`disconnect` over it, and hands the sync layer a `getBearer()` that reads the stored
      session token.

- [x] **Step 5: Run the mobile suite** — `pnpm --filter mobile test`.

- [x] **Step 6: Commit** — `feat(mobile): sign in through better auth`

---

## Task 7: Verification

- [x] **Step 1:** `pnpm lint`, `pnpm typecheck`, `pnpm test` — through `rtk proxy`.
- [x] **Step 2:** Real Postgres: migrate, start the dev server, then
      `curl /api/health`, `curl /api/me` (401), `curl /api/auth/ok` (Better Auth's own probe) and
      `curl -i '/auth/mobile?redirect_uri=saldo://auth/callback&state=x'` — the page must render and carry the CSP.
      A rejected `redirect_uri` must still render "This link is not usable".
- [x] **Step 3:** Docs: update `docs/self-hosting.md` (Better Auth replaces the token table; the deep-link note),
      the spec §9 (Better Auth's tables and endpoints instead of §9.1's five tables; the handoff instead of §9.3's
      PKCE steps 2–6), and the roadmap's phase 06 status.
- [ ] **Step 4:** Code review on the branch diff, then merge.

---

## Self-review notes

- **What is deleted, and why that is the win:** `webauthn.ts`, `challenges.ts`, `codes.ts`, `tokens.ts`,
  `rateLimit.ts`, four database tables, the mobile token store and its refresh single-flight — about 600 lines whose
  job was to re-implement a library. Both defects the phase 06 review found lived in that code.
- **What is kept:** the product behaviour (§6.30 screen, the registration policy, the health probe the app uses to
  recognise a server), the sync protocol, and the redirect-scheme allow-list.
- **What the user accepted:** a credential in the deep link. Narrowed to a one-minute single-use token, with the
  verified-app-link fix recorded as the real remedy.
