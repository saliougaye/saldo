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

## Features

Asked for and shaped enough to plan, or one decision away from it.

### End-to-end tests: Playwright for the web app, Maestro for the phone

Decided 2026-10-05. The test suite keeps unit tests only for complex logic, security guards and real bug regressions.
Integration and end-to-end tests cover the rest. The prune removed the component, view-model and copy tests, so the
flows below are now covered by nobody. Write them before the next UI change on each screen.

The web app has no end-to-end tests. Add Playwright, and use its virtual WebAuthn authenticator for passkeys:

1. Auth and onboarding: the setup wizard, register with an invite (errors on the right step), passkey sign-in,
   recovery, the passkey list (the last passkey cannot be deleted).
2. Shell and PWA: the nav tabs (Admin only for an admin), the `/budgets` redirect keeps its query, the manifest and
   its icons, the offline page, the language from the browser.
3. Transactions: day groups and totals, «In arrivo», filter chips, detail panel, create, edit and delete, the
   stale-version conflict, and the panel flows of the 2026-10-07 plan: the panel
   opens and closes with no server request; Back and Forward through panels; `N`, Esc and ↑ ↓ with no motion;
   a new draft on each opening; a reversal during the exit; the hidden form does not block `N` and ↑ ↓.
4. Home and Statistiche: the summary, the featured budget and goal, the split by category and tag, period stepping.
5. Accounts and goals: groups, pockets, archive and restore, the card statement, a goal from creation to close.
6. Budgets, categories and tags: budget states, category archive with a move, reorder, tag merge and delete.
7. Profile: the preference panels, currency change, time zone, email states.
8. Admin, MCP and OAuth: accounts, invites, settings locked by the environment, connectors, the consent page.

The phone has two Maestro flows (`apps/mobile/maestro/`). Add:

1. Hidden amounts on Home, Statistiche, the forecast and the recap; the setting survives a relaunch.
2. The amount keypad and a negative opening balance on a credit card.
3. A transfer between accounts and a credit card settlement.
4. A goal: create, top up, close with an expense.
5. A budget from the Home card, then overspend it.
6. Tags: create (empty and duplicate names refused), rename, merge, delete.
7. Categories: create with icon and colour, archive with a move.
8. Period navigation: the header stops at the current period, a custom range, the sheets still take taps.
9. The guide: the intro shows once, the info buttons, an unknown deep link.
10. Settings: time zone search, permissions, pull to refresh offline, add an email.

Run the flows in Italian and in English, because the copy tests are gone too.

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
