# Change of a real email address, with verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an account that has a real email address can replace it with another one. The new address gets a link. The
address changes only when somebody opens that link and presses a button. The old address is told. Until then the old
address stays on the account, still verified. Without SMTP nothing changes: `POST /api/me/email` keeps answering
`email_already_set` for a real address.

**Architecture:** a small table `email_changes` (one pending change for each account) and one server module,
`src/server/auth/emailChange.ts`. The request is `POST /api/me/email` (the route that fills a synthetic address) and
Profilo → Account on the web. The link points to a public page that spends nothing; its button calls
`POST /api/email-change/confirm`. The mails use the 0.3f-3 sender, throttle and `mail.*` strings.

**Tech Stack:** as 0.3f-3 (Better Auth 1.7.7, Drizzle, PGlite for tests, Next.js server actions and routes).

Depends on 0.3f-3 (`sendMail`, `mailEnabled`, `mailThrottle`, `inBackground`, the `(auth)` pages).

---

## Decisions

1. **Better Auth's own `changeEmail` is not used.** The project rule since 06b is «let the library do auth», so this
   was checked first (`better-auth@1.7.7`, `dist/api/routes/update-user.mjs` and `email-verification.mjs`). Four facts
   decide against it:
   - **The pending change is a signed token, not a row.** `/change-email` mints a JWT `{ email: old, updateTo: new }`
     and stores nothing. The token is **not single-use**, and `/verify-email` finds the account by the **old
     address**. After the swap the old address is free. If another person registers it within the token's lifetime,
     the same link opened again changes **that person's** address to `updateTo`. This is an account takeover that
     needs only the old link. A table row that is deleted on use has no such replay.
   - **Opening the link signs a browser in.** When the request has no session, `/verify-email` creates a session and
     sets its cookie. 0.3f-3 decided the opposite (`autoSignInAfterVerification: false`, the confirm page of the
     recovery link). The library has no switch for this branch.
   - **No hook knows the old address.** `afterEmailVerification` gets the updated user only, so the notice to the old
     address cannot be sent from the library's flow. Also nothing can show or cancel a pending change, because it is
     not stored.
   - **The new address is not checked again when the link is opened.** A race gives a database error (500) and not a
     refusal.
   What we keep from the library: the session, the `admin` plugin's revocation, `emailVerified`, `user.email`, and the
   mailer, the throttle and the strings of 0.3f-3.
2. **One pending change for each account** (`email_changes.user_id` is the primary key). A new request replaces the
   old one, so the old link dies. The token is 32 random bytes, stored as a sha-256 hash, valid for 24 hours (the same
   as a verification link). It is single use: the confirm step deletes the row with `DELETE … RETURNING` and so two
   requests cannot both win.
3. **Who may ask:** a signed-in account (cookie or bearer) with a real address, on a server where `mailEnabled`.
   - Synthetic address → the existing fill path, unchanged (it does not need proof; the old address is not real).
   - Real address, mail off → `409 email_already_set`, unchanged.
   - Real address, mail on → `202 { pending: { email, expiresAt } }`.
   - The same address as the account's → `400 email_unchanged`. An invalid address → `400 invalid_email`.
4. **The new address belongs to another account: say nothing.** The answer is the same `202`, a row is written and the
   Profilo line is the same. No mail goes to anybody. This is the same rule as `/recover` (nobody learns which
   addresses have accounts). The confirm step checks the address again, so an address taken after the mail was sent
   is refused as a dead link. *Not changed here:* the synthetic fill path answers `409 email_taken`, as before.
5. **Confirm step** (`confirmEmailChange`): consume the row; refuse (all the same «link does not work») when it is
   unknown or expired, when the account is gone or revoked, when the account's address is no longer the one the
   request started from (`from_email`), or when the new address is now taken. Otherwise set `email` and
   `emailVerified = true`, and tell the old address. **No session is created or read.** The token is the proof that the
   person reads the new mailbox. A link opened in a mail app's browser works.
6. **The old-address notice** goes only to a **verified** real old address (an unverified one may belong to a stranger
   who never agreed to get mail). It names the new address in masked form (`a***@example.com`) and says to tell the
   admin if this was not the account's owner. It does **not** go through the per-address throttle: the throttle
   shares five messages an hour between all kinds, and anybody can fill it by asking for recovery links, which would
   silence the notice. The notice is bounded by the number of confirmed changes. *Not built:* a one-click undo. A
   thief of a session can still change the address; the notice, and the admin's `pnpm --filter web user …`, are the
   remedy. `SECURITY.md` says it.
7. **Limits.** The mail to the new address uses the 0.3f-3 per-address throttle (new kind `emailChange`). A request
   also counts against a per-account limit of 10 an hour (`createFixedWindowLimiter`, in memory, per process, like
   the other limiters) → `429 rate_limited`. A mail that the throttle holds is not sent. The row has already been
   replaced, so the earlier link is dead; the Profilo form is locked for 60 s after a send to make this rare.
8. **Surfaces.**
   - Web: `/profile/account` gains a «Change email» form (only when mail is on and the address is real), the
     pending line «Waiting for the link sent to {email}» with «Cancel the change», both through server actions that
     call the same module. The link lands on `/email-change?token=…` in the `(auth)` group: a page that asks, with a
     button; the button posts to `POST /api/email-change/confirm`.
   - API: `POST /api/me/email` as in decision 3, and `DELETE /api/me/email` (cancel, `204`).
   - **Phone: no change.** The phone shows the email only for the «Add your email» row of an account whose address
     is synthetic (`apps/mobile/app/profile/server.tsx`, `needsEmail`). It never shows a real address and has no
     Profile → Account screen, so there is nowhere to put a change form. The phone's call (`saveEmail`) still gets
     `{ email, emailVerified }` for the fill. The change on the phone is a follow-up if Profile → Account gets an
     email row there.
9. **Mail text:** `mail.emailChange.*` (to the new address: subject, intro, expires) and `mail.emailChanged.*` (to the
   old one: subject, intro, warning) in the seven catalogs. `web.account.change*` and `web.auth.emailChange*` for the
   pages. Language: the account's `settings.language`, else the request's `Accept-Language`, else `en`
   (`messageFor`, as in 0.3f-3).
10. **Not here:** requiring a recent passkey ceremony for the change, an undo link, a change on the phone, a
    multi-step flow that asks the old mailbox first (it fails when the old mailbox is the reason for the change).

## Rules

As 0.3f-3: no test sends mail through a socket (`catchMail`); a test that needs mail on calls `enableMail`. Tests are
integration tests on PGlite through the real routes (`POST`/`DELETE` of `app/api/me/email/route.ts`, `POST` of
`app/api/email-change/confirm/route.ts`). Each test is written first and seen to fail.

## File structure

- Create `apps/web/src/server/auth/emailChange.ts` — request, confirm, cancel, read pending, mask.
- Create `apps/web/drizzle/0007_*.sql` (+ meta) — generated; `email_changes`.
- Modify `apps/web/src/server/db/schema.ts` — the table.
- Modify `apps/web/src/server/mail/throttle.ts`, `messages.ts`, `src/server/auth/mailCallbacks.ts` — kinds, two
  messages, `deliver` generalised.
- Modify `apps/web/app/api/me/email/route.ts` (+ test); create `app/api/email-change/confirm/route.ts` (+ test).
- Create `apps/web/app/(auth)/email-change/page.tsx` + `ConfirmForm.tsx`.
- Modify `apps/web/app/(app)/profile/account/page.tsx`; create `ChangeEmailForm.tsx`, `actions.ts`.
- Modify `packages/i18n/src/locales/{it,en,de,es,fr,pt,sv}.ts`.
- Docs: spec §9.1 / §17.1.4, `SECURITY.md`, `docs/self-hosting.md` if it lists the mails.

---

### Task 1: table, mail kinds, messages

**Files:** `apps/web/src/server/db/schema.ts`, `apps/web/drizzle/0007_*.sql`, `src/server/mail/throttle.ts`,
`src/server/mail/messages.ts`, `src/server/mail/messages.test.ts`, the seven catalogs.

- [ ] **Step 1: the table.** Add to `schema.ts` (before `schema`), and `emailChanges` to the `schema` object:

```ts
/**
 * Change of a real email address (`auth/emailChange.ts`). At most one pending change for each account.
 * The token is **never** stored, only its sha-256, so a database backup cannot be turned into an address.
 * The row is deleted when the link is used, cancelled, replaced or its account is deleted.
 */
export const emailChanges = pgTable(
  'email_changes',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The address the person asked for. Lower case. */
    newEmail: text('new_email').notNull(),
    /** The account's address when the request was made; the change dies if it is not that any more. */
    fromEmail: text('from_email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
);
```

- [ ] **Step 2: generate the migration.** Run `pnpm --filter web db:generate`. Expected: a new
  `drizzle/0007_*.sql` with `CREATE TABLE "email_changes"` and the foreign key with `ON DELETE cascade`, and an updated
  `drizzle/meta/_journal.json`. Read the SQL; commit it.
- [ ] **Step 3: throttle kinds.** In `throttle.ts` change `MailKind` to
  `'verification' | 'recovery' | 'emailChange'`.
- [ ] **Step 4: strings.** Add to every catalog, under `mail` (English shown; Italian is the source, the other five
  follow it):

```ts
    emailChange: {
      subject: 'Confirm your new email address on {{instance}}',
      intro:
        'You asked to use this email address for your account on {{instance}} ({{host}}). Open the link below to confirm it:',
      expires:
        'The link is valid for 24 hours and works once. Until you use it, the account keeps its current address.',
    },
    emailChanged: {
      subject: 'The email address of your account on {{instance}} has changed',
      intro:
        'The email address of your account on {{instance}} ({{host}}) was changed to {{newEmail}}. From now on this address gets no more messages from the account.',
      warning:
        'If this was not you, tell the person who runs {{host}} now: they can restore the account.',
    },
```

- [ ] **Step 5: messages.** In `messages.ts` add:

```ts
export const emailChangeMessage = (t: Translate, details: MessageDetails): Message =>
  compose(t, 'emailChange', details);

/** The notice to the old address. No link: nothing in it can be opened by somebody who is not the owner. */
export function emailChangedMessage(
  t: Translate,
  details: { instance: string; host: string; newEmail: string },
): Message {
  const vars = { instance: oneLine(details.instance), host: details.host, newEmail: details.newEmail };
  return {
    subject: t('mail.emailChanged.subject', vars),
    text: [t('mail.emailChanged.intro', vars), '', t('mail.emailChanged.warning', vars)].join('\n'),
  };
}
```

  and widen `compose`'s `kind` to `'verification' | 'recovery' | 'emailChange'`.
- [ ] **Step 6: gates, commit.** `rtk proxy pnpm --filter @saldo/i18n test`, `rtk proxy pnpm --filter web typecheck`.
  Commit: `feat(web): email_changes table and the two mail texts`.

### Task 2: the module, test first

**Files:** create `apps/web/src/server/auth/emailChange.ts`, `apps/web/app/api/email-change/confirm/route.ts`;
modify `app/api/me/email/route.ts`, `src/server/auth/mailCallbacks.ts`; tests in `app/api/me/email/route.test.ts` and
`app/api/email-change/confirm/route.test.ts`.

- [ ] **Step 1: tests first.** In `app/api/me/email/route.test.ts` add a `describe('changing a real address')`
  (with `enableMail` and a session whose row has `email: 'ada@old.example'`, `emailVerified: true`). Cases, each seen
  red before the code:
  1. mail off → `409 email_already_set` (the existing test stays and passes).
  2. request → `202`, `{ pending: { email: 'ada@new.example' } }`; **one** mail, to the new address, whose link is
     `…/email-change?token=…`; the row still has `ada@old.example` and `emailVerified: true`.
  3. same address (any case) → `400 email_unchanged`; bad address → `400 invalid_email`.
  4. address of another account → the **same** `202` body shape, **no mail**, no change; the other account is untouched.
  5. a second request for another address → the first link is dead (confirm answers `410`).
  6. `DELETE` → `204`; the link is dead; a second `DELETE` is `204` as well.
  7. eleven requests in an hour → the eleventh is `429 rate_limited`.
  In `app/api/email-change/confirm/route.test.ts`:
  8. token from the mail → `200`; `email` is the new one, `emailVerified` true; **no `set-cookie`** in the answer and
     no new `session` row.
  9. the notice: one mail to the **old** address, it contains `a***@new.example`-style masking and not the full new
     address, and no link.
  10. no notice when the old address was not verified.
  11. the notice is sent even when the old address' throttle is full (five mails already sent to it).
  12. the same token twice → second is `410`, email unchanged after the first swap.
  13. expired (`expires_at` moved into the past) → `410`, email unchanged.
  14. address taken **after** the request (another account inserted it) → `410`, email unchanged, no notice.
  15. account revoked after the request → `410`, email unchanged.
  16. `from_email` no longer the account's address (changed by hand) → `410`.
  17. garbled token, empty token, a token of 64 `a` → `410`; body without `token` → `400`.
  18. a failing SMTP (`failWith`) → the request still answers `202` and the swap still works for a row created
      before; the notice failure does not undo the swap.
- [ ] **Step 2: see them fail.** `rtk proxy pnpm --filter web exec vitest run app/api/me/email app/api/email-change`.
  Expected: the new cases FAIL (module and route not found, or 409).
- [ ] **Step 3: generalise `deliver` in `mailCallbacks.ts`.** `deliver` becomes exported and takes a builder and a
  throttle flag, and `messageFor` returns the translator and the instance:

```ts
export type MessageBuilder = (
  t: Translate,
  instance: { instance: string; host: string },
) => Message;

/** Throttles (unless told not to), builds and sends; a failure is logged without an address and never thrown. */
export async function deliver(
  db: ServerDatabase,
  kind: MailKind,
  recipient: { id: string; email: string },
  acceptLanguage: string | null,
  build: MessageBuilder,
  options: { throttled?: boolean } = {},
): Promise<void> {
  if ((options.throttled ?? true) && !mailThrottle.allow(kind, recipient.email, Date.now())) {
    log('mail', 'held by the per-address throttle', { kind });
    return;
  }
  const message = await messageFor(db, recipient.id, acceptLanguage, build);
  const result = await sendMail(db, { to: recipient.email, ...message });
  if (!result.ok) log('mail', 'a message was not sent', { kind, reason: result.error });
}
```

  The three existing callers pass `(t, d) => verificationMessage(t, { ...d, url })` and the recovery equivalent.
  `import type { Translate } from '@saldo/i18n'`. Existing `mailCallbacks.test.ts` must stay green.
- [ ] **Step 4: `emailChange.ts`.**

```ts
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { inBackground } from '../background';
import { emailChanges, user } from '../db/schema';
import type { ServerDatabase } from '../db/types';
import { env } from '../env';
import { log, shortId } from '../log';
import { mailEnabled } from '../mail/mailer';
import { emailChangedMessage, emailChangeMessage } from '../mail/messages';
import { createFixedWindowLimiter } from '../mcp/rateLimit';
import { isRevoked } from './admin';
import { emailIsTaken, isSyntheticEmail } from './email';
import { deliver, VERIFICATION_TTL_SECONDS } from './mailCallbacks';

/** Where the mailed link points: a public page that asks and spends nothing. */
export const EMAIL_CHANGE_PATH = '/email-change';

const REQUESTS_PER_HOUR = 10;
const requestLimiter = createFixedWindowLimiter({ max: REQUESTS_PER_HOUR, windowMs: 60 * 60_000 });

/** Tests only. */
export function resetEmailChangeLimitForTests(): void {
  requestLimiter.reset();
}

const hashToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

/** `ada@example.com` → `a***@example.com`. Enough for the owner to know it, not for a stranger to use. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export interface PendingChange {
  email: string;
  expiresAt: Date;
}

export type RequestResult =
  | { ok: true; pending: PendingChange }
  | { ok: false; reason: 'rate_limited' };

/**
 * Stores the pending change and mails the new address — unless it belongs to another account, in which
 * case the row is stored all the same and nothing is mailed, so the answer cannot tell. The caller has
 * checked that the account has a real address, that the new one differs and that mail is enabled.
 */
export async function requestEmailChange(
  db: ServerDatabase,
  input: {
    userId: string;
    currentEmail: string;
    newEmail: string;
    acceptLanguage: string | null;
    now: Date;
  },
): Promise<RequestResult> {
  if (!requestLimiter.allow(input.userId, input.now.getTime()).allowed) {
    return { ok: false, reason: 'rate_limited' };
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(input.now.getTime() + VERIFICATION_TTL_SECONDS * 1000);
  const row = {
    userId: input.userId,
    newEmail: input.newEmail,
    fromEmail: input.currentEmail.toLowerCase(),
    tokenHash: hashToken(token),
    createdAt: input.now,
    expiresAt,
  };
  await db
    .insert(emailChanges)
    .values(row)
    .onConflictDoUpdate({ target: emailChanges.userId, set: row });
  const taken = await emailIsTaken(db, input.newEmail, input.userId);
  inBackground(async () => {
    if (taken || !(await mailEnabled(db))) return;
    const url = new URL(EMAIL_CHANGE_PATH, env().publicUrl);
    url.searchParams.set('token', token);
    await deliver(
      db,
      'emailChange',
      { id: input.userId, email: input.newEmail },
      input.acceptLanguage,
      (t, instance) => emailChangeMessage(t, { ...instance, url: url.toString() }),
    );
  });
  return { ok: true, pending: { email: input.newEmail, expiresAt } };
}

export async function pendingEmailChange(
  db: ServerDatabase,
  userId: string,
  now: Date,
): Promise<PendingChange | null> {
  const [row] = await db
    .select({ email: emailChanges.newEmail, expiresAt: emailChanges.expiresAt })
    .from(emailChanges)
    .where(and(eq(emailChanges.userId, userId), gt(emailChanges.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export async function cancelEmailChange(db: ServerDatabase, userId: string): Promise<void> {
  await db.delete(emailChanges).where(eq(emailChanges.userId, userId));
}

/** One answer for every way the link can fail: nothing tells why. */
export type ConfirmResult = { ok: true } | { ok: false };

export async function confirmEmailChange(
  db: ServerDatabase,
  input: { token: string; acceptLanguage: string | null; now: Date },
): Promise<ConfirmResult> {
  // Atomic: of two requests with the same token, one gets the row and the other gets nothing.
  const [change] = await db
    .delete(emailChanges)
    .where(
      and(eq(emailChanges.tokenHash, hashToken(input.token)), gt(emailChanges.expiresAt, input.now)),
    )
    .returning();
  if (change === undefined) return { ok: false };
  const [account] = await db
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, change.userId))
    .limit(1);
  if (account === undefined || (await isRevoked(db, account.id))) return { ok: false };
  if (isSyntheticEmail(account.email) || account.email.toLowerCase() !== change.fromEmail) {
    return { ok: false };
  }
  if (await emailIsTaken(db, change.newEmail, account.id)) return { ok: false };
  try {
    await db
      .update(user)
      .set({ email: change.newEmail, emailVerified: true, updatedAt: input.now })
      .where(eq(user.id, account.id));
  } catch {
    // The unique index is the real guard (see `emailIsTaken`): a race with a registration ends here.
    log('auth', 'an email change lost a race for the address', { user: shortId(account.id) });
    return { ok: false };
  }
  log('auth', 'an account changed its email', { user: shortId(account.id) });
  if (account.emailVerified) {
    const old = { id: account.id, email: account.email };
    inBackground(async () => {
      if (!(await mailEnabled(db))) return;
      await deliver(
        db,
        'emailChange',
        old,
        input.acceptLanguage,
        (t, instance) => emailChangedMessage(t, { ...instance, newEmail: maskEmail(change.newEmail) }),
        { throttled: false },
      );
    });
  }
  return { ok: true };
}
```

  (`sql` is not needed; drop the import if unused. `user.updatedAt` is a column of the Better Auth schema — check
  `authSchema.ts` and drop the field if it is absent.)
- [ ] **Step 5: the routes.** `app/api/me/email/route.ts`: after the synthetic check, replace the 409 by

```ts
    if (!isSyntheticEmail(account.email)) {
      const db = getDb();
      if (!(await mailEnabled(db))) {
        throw new ApiError(409, 'email_already_set', 'This account already has an email address');
      }
      if (email === account.email.toLowerCase()) {
        throw new ApiError(400, 'email_unchanged', 'That is already the address of this account');
      }
      const result = await requestEmailChange(db, {
        userId: account.id,
        currentEmail: account.email,
        newEmail: email,
        acceptLanguage: request.headers.get('accept-language'),
        now: new Date(),
      });
      if (!result.ok) throw new ApiError(429, 'rate_limited', 'Too many requests: try again later');
      return Response.json({ pending: result.pending }, { status: 202 });
    }
```

  and add `DELETE`: `requireUser`, `cancelEmailChange`, `new Response(null, { status: 204 })`, inside `handle`.
  `app/api/email-change/confirm/route.ts`: `POST`, `readJson` with `z.object({ token: z.string().min(1).max(200) })`,
  `confirmEmailChange(...)`, `{ ok: true }` → `Response.json({ status: 'changed' })`, else
  `new ApiError(410, 'link_invalid', 'This link no longer works')`. No `requireUser`: the token is the proof.
  Export `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` as the neighbours do. Call
  `resetEmailChangeLimitForTests()` in the test `afterEach`.
- [ ] **Step 6: run the tests.** Same command as step 2. Expected: all PASS. Read the output.
- [ ] **Step 7: commit.** `feat(web): change a real email address with a link to the new one`.

### Task 3: the web pages

**Files:** `apps/web/app/(auth)/email-change/page.tsx`, `ConfirmForm.tsx`;
`apps/web/app/(app)/profile/account/{page.tsx,ChangeEmailForm.tsx,actions.ts}`; the seven catalogs.

- [ ] **Step 1: strings** (`web.account.*`, `web.auth.*`; grep both first so no key is repeated), English shown:

```ts
// web.account
changeTitle: 'Change email',
changeLabel: 'New email address',
changeSend: 'Send the confirmation link',
changeSent:
  'If {{email}} can be used for this account, we sent a link to it. Your address changes only when you open it.',
changePending: 'Waiting for the link sent to {{email}}',
changeCancel: 'Cancel the change',
changeInvalid: 'That is not an email address.',
changeSame: 'This is already your address.',
// web.auth
emailChangeTitle: 'Confirm the new address',
emailChangeBody: 'Press the button to use this address for your account. Until you do, nothing changes.',
emailChangeButton: 'Confirm',
emailChangeDoneTitle: 'Email changed',
emailChangeDoneBody: 'Your account now uses this address. You can close this page.',
```

  A failed link reuses `web.auth.emailLinkInvalidTitle` and `emailLinkInvalidBody`.
- [ ] **Step 2: `/email-change`.** A server component like `app/(auth)/recover/confirm/page.tsx`: reads `?token=`,
  redirects nothing, shows `Brand`, title, lede and `ConfirmForm`. It consumes nothing. `ConfirmForm` (client) posts
  `{ token }` to `/api/email-change/confirm` with `fetch`; `200` → the done state (check icon, title, body, link to
  `/home`); anything else → `Alert` with the invalid-link strings. Strings are props.
- [ ] **Step 3: server actions** (`actions.ts`, `'use server'`): `requestEmailChangeAction(email)` and
  `cancelEmailChangeAction()`. Both start with `requireWebUser()`. The first normalises (`normaliseEmail`), checks
  `mailEnabled`, returns `{ ok: false, reason: 'invalid' | 'same' | 'failed' }` or `{ ok: true }`, calls
  `requestEmailChange`, then `revalidatePath('/profile/account')`. The rules are the route's; the module is shared.
- [ ] **Step 4: `/profile/account`.** Read `pendingEmailChange`. Below the email row, when `state` is `verified` or
  `canVerify` (a real address and mail on): the pending line with a cancel button, or `ChangeEmailForm` (input,
  button, 60 s lock after a send, the `changeSent` line). Reuse `Button` and the `.verify` / `.meta` classes already in
  `app.module.css`; add no colour, radius or size.
- [ ] **Step 5: gates, commit.** `feat(web): Profilo › Account changes the email, and /email-change confirms it`.

### Task 4: look at it, docs, close

- [ ] **Step 1: key check.** `rtk proxy pnpm --filter web test` includes `keysResolve.test.ts`: every new key is in
  Italian. The i18n parity test checks the other six.
- [ ] **Step 2: browser run** on an own port, both widths (1280, 390), light and dark, Mailpit as in 0.3f-3: request
  from Profilo → the mail arrives → the link shows the confirm page → «Confirm» → Profilo shows the new address,
  verified; the old mailbox has the notice; the same link again → the invalid-link alert; a request for an address of
  another account → the same sentence and no mail; cancel. Record under «As built». If a browser cannot be run in this
  environment, say so in the record; do not claim it was done.
- [ ] **Step 3: docs.** Spec §9.1 and §17.1.4 «As built»; `SECURITY.md` (the change of address: what bounds it, and that
  a stolen session can still change it — the notice is the remedy); `docs/self-hosting.md` if it lists the mails.
  Write in STE. Do **not** touch `TODO.md`, `ROADMAP.md` or `plans/README.md`: the parent thread does.
- [ ] **Step 4: gates** through `rtk proxy`: `pnpm lint` (no `lint/` line, no «Some errors»), `pnpm typecheck`,
  `pnpm test`. Read the output.
- [ ] **Step 5: review** (`requesting-code-review`, security first): enumeration, replay, session creation, the
  throttle bypass of the notice, secrets in logs. Fix Important+ test first.

## Self-review

- Spec asks: request → mail to new address (T2), swap only on open (T2 cases 2, 8), tell the old address (9–11), old
  stays verified until then (2), expiry (13), used link (12), another account's address (4, 14), rate limit (7, and the
  throttle), no SMTP unchanged (1), phone (decision 8), i18n in all locales (T1, T3).
- Names used across tasks: `requestEmailChange`, `confirmEmailChange`, `cancelEmailChange`, `pendingEmailChange`,
  `maskEmail`, `deliver`, `emailChangeMessage`, `emailChangedMessage`, `EMAIL_CHANGE_PATH`, `emailChanges`.
