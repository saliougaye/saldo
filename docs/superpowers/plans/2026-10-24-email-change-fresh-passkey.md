# A fresh passkey to change the email address

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a change of a real email address needs a session that a passkey ceremony created in the last 5 minutes. A
thief with an old session cannot start the change.

**Spec:** `docs/superpowers/specs/2026-10-24-email-change-fresh-passkey.html`. On this topic it wins over this plan.

**Architecture:** one pure function, `isFreshSession`, in `src/server/auth/freshSession.ts`. `authenticate` returns the
`createdAt` of the session. `startEmailChange` refuses with the reason `reauth` when the session is not fresh. The route
answers `403 reauth_required`. The Profile form shows a sentence and a button. The button runs `authClient.signIn.passkey()`.
Better Auth then creates a new session, and the form sends the request again.

**Tech Stack:** as the plan `2026-10-19-change-email.md` (Better Auth 1.7.7, Drizzle, PGlite, Next.js server actions).

---

## Decisions

1. **The age comes from `session.createdAt`, not from `updatedAt`.** The session slides: `updateAge` renews
   `expiresAt` and `updatedAt` on use. `createdAt` never moves. A session that a person uses for months is never fresh.
2. **The window is 300 seconds** (`FRESH_SESSION_SECONDS`). A person needs the time to read the form and use the passkey.
   A thief needs a session that is younger than that.
3. **Order of the checks in `startEmailChange`:** mail off, then not fresh, then unchanged, then rate limit. A request
   that is not fresh spends no rate-limit slot and stores nothing.
4. **Not covered:** cancel of a pending change (it only removes a row), opening the mailed link (the token is the
   proof), and the fill of a synthetic address (no real address to protect). The spec lists the last one under Limits.
5. **The button starts the ceremony, not the form.** Safari refuses a WebAuthn prompt that no click started.
6. **Other sessions stay valid.** Better Auth does not revoke them when a new one starts. Out of scope; the spec says so.

## Files

| File | Change |
|---|---|
| `apps/web/src/server/auth/freshSession.ts` | new: `FRESH_SESSION_SECONDS`, `isFreshSession` |
| `apps/web/src/server/auth/freshSession.test.ts` | new |
| `apps/web/src/server/auth/session.ts` | `AuthenticatedUser.sessionCreatedAt` |
| `apps/web/src/server/auth/emailChange.ts` | `startEmailChange` takes `sessionCreatedAt`, returns `reauth` |
| `apps/web/app/api/me/email/route.ts` | `403 reauth_required` |
| `apps/web/app/api/me/email/route.test.ts` | the tests of Task 3 |
| `apps/web/src/server/test/session.ts` | `createTestSession` takes `createdAt` |
| `apps/web/app/(app)/profile/account/actions.ts` | reason `reauth` |
| `apps/web/app/(app)/profile/account/ChangeEmailForm.tsx` | the step-up |
| the page that builds `ChangeEmailStrings` | three new strings |
| `packages/i18n/src/locales/*.ts` (7 files) | `changeReauth`, `changeReauthButton`, `changeReauthFailed` |
| `apps/web/e2e/change-email.spec.ts`, `e2e/support/sessions.ts` | the flow of Task 6 |
| `TODO.md` | remove the item «Safer change of email» |

---

## Task 1 — The rule

**Files:** `apps/web/src/server/auth/freshSession.ts`, `freshSession.test.ts`

- [x] **Step 1: Write the failing test.** Cases: a session of 299 seconds is fresh. A session of 300 seconds is fresh.
  A session of 301 seconds is not fresh. A `createdAt` in the future is not fresh (a clock fault must not open the door).
- [x] **Step 2: Run it.** `pnpm --filter web exec vitest run src/server/auth/freshSession.test.ts`. Expect: fails, no module.
- [x] **Step 3: Write the code.**

```ts
/** How long after a passkey ceremony a session may start a change of the email address. */
export const FRESH_SESSION_SECONDS = 300;

/**
 * A session is fresh when a passkey ceremony created it a short time ago. `createdAt` is the right
 * clock: the session slides, so `updatedAt` and `expiresAt` move on every use and say nothing about
 * the ceremony. A `createdAt` in the future is a clock fault and is not fresh.
 */
export function isFreshSession(createdAt: Date, now: Date): boolean {
  const age = now.getTime() - createdAt.getTime();
  return age >= 0 && age <= FRESH_SESSION_SECONDS * 1000;
}
```

- [x] **Step 4: Run the test.** Expect: passes.
- [x] **Step 5: Commit.** `feat(web): the rule of a fresh session`

## Task 2 — The session says when it began

**Files:** `apps/web/src/server/auth/session.ts`, `apps/web/src/server/test/session.ts`

- [x] **Step 1:** add `sessionCreatedAt: Date` to `AuthenticatedUser`, with a comment that says why it exists.
- [x] **Step 2:** in `authenticate`, set it from `session.session.createdAt`.
- [x] **Step 3:** in `createTestSession`, add an option `createdAt` (default: now) and write it to the session row.
- [x] **Step 4:** run `pnpm --filter web typecheck`. Fix every place that builds an `AuthenticatedUser` by hand.
- [x] **Step 5: Commit.** `feat(web): the session carries the time of its ceremony`

## Task 3 — `startEmailChange` and the route

**Files:** `emailChange.ts`, `app/api/me/email/route.ts`, `route.test.ts`

- [x] **Step 1: Write the failing tests** in `describe('changing a real address')`, with a session that is 10 minutes old:
  - the route answers `403` with the code `reauth_required`;
  - nothing is stored in `email_changes`, and no mail is sent;
  - the refusal spends no slot: after 10 refused requests, a fresh session can still ask;
  - a server without SMTP still answers `409 email_already_set` with the old session (mail off comes first);
  - the same session can still `DELETE` a pending change;
  - the fill of a synthetic address works with the old session (regression: Decision 4).
  The existing tests use a fresh session and must stay green.
- [x] **Step 2: Run them.** Expect: the new ones fail.
- [x] **Step 3:** add `sessionCreatedAt: Date` to the input of `startEmailChange` and `'reauth'` to `StartResult`. Check
  `isFreshSession(input.sessionCreatedAt, input.now)` after the mail check and before the `unchanged` check.
- [x] **Step 4:** in the route, pass `account.sessionCreatedAt` and map `reauth` to `new ApiError(403, 'reauth_required', ...)`.
  Update the comment above `POST`.
- [x] **Step 5: Run the tests.** Expect: all pass.
- [x] **Step 6: Commit.** `feat(web): a change of the email address needs a fresh passkey`

## Task 4 — Strings

**Files:** `packages/i18n/src/locales/{de,en,es,fr,it,pt,sv}.ts`

- [x] **Step 1:** add three keys next to `changeSame`: `changeReauth`, `changeReauthButton`, `changeReauthFailed`.
  English text: «To protect your account, confirm with your passkey before you change your email.», «Confirm with my
  passkey», «The passkey was not confirmed. Nothing changed.» Write the six other locales in the voice of the keys beside them.
- [x] **Step 2:** run `pnpm --filter @saldo/i18n test`. The parity test must pass.
- [x] **Step 3: Commit.** `feat(i18n): the strings of the fresh passkey for the email change`

## Task 5 — The form

**Files:** `actions.ts`, `ChangeEmailForm.tsx`, the page that builds `ChangeEmailStrings`

- [x] **Step 1:** in `requestEmailChangeAction`, pass `sessionCreatedAt` and add the reason `reauth` to `ChangeEmailResult`.
- [x] **Step 2:** in `ChangeEmailForm`, add a state `reauth` (the address stays in the field). When the action answers
  `reauth`, show `changeReauth` and a button with `changeReauthButton` in place of the send button.
- [x] **Step 3:** the button calls `authClient.signIn.passkey()`. On success it sends the same address once more. On an
  error or a cancel it shows `changeReauthFailed` and goes back to the normal form. No loop: one retry only.
- [x] **Step 4:** pass the three strings from the page.
- [x] **Step 5:** run `pnpm lint`, `pnpm typecheck`, `pnpm test`. Read the output; do not trust the exit code of lint.
- [x] **Step 6: Commit.** `feat(web): the Profile form asks for the passkey again`

## Task 6 — E2E

**Files:** `apps/web/e2e/change-email.spec.ts`, `apps/web/e2e/support/sessions.ts`

The mail sink already exists (`startMailSink`, `configureSmtp`), so the flow reuses it.

- [x] **Step 1:** add `ageSessions(userId, minutes)`. It moves `session.created_at` back, through `pg`, on the e2e database.
- [x] **Step 2:** add a Playwright flow to `change-email.spec.ts`: register, age the session by 10 minutes, ask for a new
  address. Expect the sentence and the button. Press the button (the virtual authenticator answers). Expect the
  «Waiting for you to confirm» line and the mail with the link.
- [x] **Step 3:** run `pnpm --filter web e2e` without a filter. Read the result.

## Task 7 — Docs

- [x] **Step 1:** in `docs/self-hosting.md`, where the change of email is described, add one sentence: a change needs a
  passkey confirmation in the last 5 minutes. Write it in STE.
- [x] **Step 2:** remove «Safer change of email» from `TODO.md`. Remove «`POST /api/me/email` tells a signed-in user…» too,
  and add a line in the plans README under the 2026-10-19 block: the item stays open as «will not fix», with the reason.
  The reason: the legacy fill path serves accounts from before D32; the registration answers `email_taken` by decision 7 of
  the plan `2026-09-27-0.3b-web-auth.md`; a false 200 would make the phone think that the address is saved.
- [x] **Step 3: Commit.** `docs: the fresh passkey for the email change, and the closed TODO items`

## Acceptance

- A session older than 5 minutes cannot start the change, on the route and in the Profile form. It gets a clear answer
  and nothing is stored.
- After the passkey button, the same request works. The new address gets its link.
- Cancel, the mailed link and the synthetic fill work as before.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass, and the Playwright suite passes.
