# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — forecast,
shared finances, AI, web app, going public, releases — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Bugs

Something that works wrong today.

### Web app: a UI pass — navigation feels slow, motion is missing

Reported 2026-10-04 after using the web app on a real instance. Moving between pages feels slow, and the suspect is
how `next/link` is used: every page is a dynamic server render, so a click waits for the server with nothing on
screen to say so. Prefetch, `loading.tsx` boundaries, and keeping the shell mounted while the panel changes are the
first things to check, measured before and after. The animations the phone has (sheets, swaps, list changes, the
design's transitions) are mostly absent on the web too. Needs a full check of the web UI against the design and the
phone, then a plan for both.

Picked up in part on 2026-10-07 (`docs/superpowers/plans/2026-10-07-web-panel-feel.md`): on Transazioni,
«Nuova transazione» and the detail of a row open and close in the frame of the click, and the list makes room
in one movement. Still open:

- the production region (`fra1::iad1`: the function runs in Washington, Neon in Frankfurt);
- the four queries in a chain on every page;
- `loading.tsx` and `useLinkStatus` for the top-level pages;
- the edit form (still a navigation);
- the same pattern on Conti and Profilo;
- the motion the phone has that the web lacks.

### Web sign-in: closing the passkey prompt shows the generic error

Found by the Playwright suite (`auth.spec.ts`, kept as `test.fixme`). When a person closes the browser's passkey prompt,
the browser rejects with `NotAllowedError`. `@simplewebauthn/browser` wraps it as a `WebAuthnError` with the code
`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, and Better Auth's client passes that code on. The `CANCELLED` set in
`describeAuthError` holds `NotAllowedError` and not that code. The person sees the generic alert and never
`sync.cancelled`. Confirm it in the browser, add the code to the set, and turn the `fixme` into a test.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### End-to-end tests: a setting locked by the environment

The Playwright suite (`apps/web/e2e`) and the Maestro flows (`apps/mobile/maestro`) cover the flows decided on
2026-10-05. One web flow is open: a setting that the environment locks must show as locked and refuse a save. It stays a
`test.fixme` in `admin.spec.ts`, because one server cannot lock a setting that the other specs change. It needs a second
server with its own environment. The Maestro flows also lack a few `testID`s, so some steps select by text or position:
`keypad-key-sign` (hidden from the accessibility tree), the account name and balance fields of the account form, and
`appearance-icon-search`.

Three phone steps are not covered. The recap with hidden amounts: a seeded database is never due a recap, so the flow
needs a `run.sh` option that sets `lastRecapPeriod` and `amountsHidden`. Pull to refresh offline: with no session the app
has no refresh control, so it needs a signed-in device. «Add your email»: it needs a server and a passkey. The flows run
in English only (decided 2026-10-09), so the copy of the other languages has no end-to-end check.

### Profile: the period row shows the period, not only the cycle day

Found by the in-app guide analysis (2026-09-26). Profile's first row is «Inizio del ciclo · dal 27» whatever the
period kind, so a user tracking by calendar month reads about a cycle they never chose, and the kind itself can be
changed only from the period sheet. The row should read «Periodo · Mese solare» (or «Ciclo di stipendio · dal 27»)
and open a screen with the four kinds, the day grid under the cycle only — the onboarding step 1 layout.

### Change of a real email address, with verification

`POST /api/me/email` only fills a synthetic address and answers `email_already_set` for a real one, because replacing
it needs proof that the new address belongs to the person. SMTP and verification exist since 0.3f-3, so the change can
be built: ask for the new address, mail it a link, swap only when it is opened (and tell the old address), keep the old
one verified until then.

### Native review of the non-Italian translations of the 0.3f strings

The 0.3f strings (admin settings, SMTP, verification, recovery, `mail.*`) were written in Italian and translated into
English, German, Spanish, French, Portuguese and Swedish without a native reader. The six should be reviewed by
someone who speaks each, the mail texts first, since they are what a person reads in their inbox.

## Ideas

Directions worth keeping, not yet asked for as work. Most reopen a product decision.

### Fees on transfers between accounts

A transfer can cost money: PayPal charges to move a balance to a bank account, a card withdrawal has a
fee, a foreign transfer loses something on the exchange. Today a transfer moves the same amount out of
one account and into the other, so the fee has to be entered by hand as a separate expense — or it just
disappears, and the destination balance no longer matches the real one.

Open questions before this can be planned:

- Is the fee a field on the transfer (`feeMinor`, charged to the source account), or a separate expense
  transaction linked to the transfer?
- Which account pays it, and in which currency, when the two accounts differ?
- Does the fee show up in the expense totals and in the category breakdown (a "Commissioni" category?),
  or does it stay outside them like the transfer itself?
- Does it belong in the recurring transfers too (a monthly transfer with a fixed fee)?
