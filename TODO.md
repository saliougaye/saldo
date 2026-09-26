# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — forecast,
shared ledger, AI, web app, going public, releases — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Bugs

Something that works wrong today.

None open.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### Profile: the period row shows the period, not only the cycle day

Found by the in-app guide analysis (2026-09-26). Profile's first row is «Inizio del ciclo · dal 27» whatever the
period kind, so a user tracking by calendar month reads about a cycle they never chose, and the kind itself can be
changed only from the period sheet. The row should read «Periodo · Mese solare» (or «Ciclo di stipendio · dal 27»)
and open a screen with the four kinds, the day grid under the cycle only — the onboarding step 1 layout.

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
