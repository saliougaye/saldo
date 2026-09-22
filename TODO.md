# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — forecast,
shared ledger, AI, web app, going public, releases — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Bugs

Something that works wrong today.

None open.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### A better sign switch on the balance field

- [ ] Asked for on 2026-09-22. Design pass first, then plan.

A balance can be negative (an overdrawn account, a card), so the balance field carries a sign switch: the `±` button
of `AmountInput` (`apps/mobile/src/components/AmountInput.tsx:75`, `allowNegative`). It is used by the account form
(`src/features/accounts/AccountForm.tsx:155`), the onboarding balance (`app/(onboarding)/balance.tsx`) and the
imported balances (`app/(onboarding)/import-balances.tsx`). What it is today: a 36pt square with a `±` glyph left of
the currency symbol, filled with the accent when the amount is negative, which toggles the `-` in the buffer.

What to improve: `±` names the action, not the state, so the only cue for "this is negative" is the fill colour and
the `−` in the figure; the button sits far from the digits it changes and looks like a stray key. Options to weigh in
the design pass: a two-segment control ("Positivo / Negativo" or "+ / −") under the figure, a chip that reads the
current state, or a `−` key in the iOS accessory bar next to "Fine". Keep the switch role and `negativeLabel` for
VoiceOver, and the test in `a11y.test.tsx`.

## Ideas

Directions worth keeping, not yet asked for as work. Most reopen a product decision.

None open.
