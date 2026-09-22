# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list. The big directions — forecast,
shared ledger, AI, web app, going public, releases — live in [`ROADMAP.md`](ROADMAP.md), not here.

## Bugs

Something that works wrong today.

None open.

## Features

Asked for and shaped enough to plan, or one decision away from it.

### Five more languages: French, German, Swedish, Spanish, Portuguese

- [ ] Asked for on 2026-09-21. Scope the catalogs and the formatting tables, then plan.

Today the app speaks `it` and `en` only (`SUPPORTED_LOCALES` in
`packages/i18n/src/format.ts:13`). A language is more than a catalog:

- **The catalog.** `packages/i18n/src/locales/{fr,de,sv,es,pt}.ts`, ~760 keys each, registered in `resources`
  (`packages/i18n/src/index.ts`). The parity test (`locales.test.ts`) only compares `it` against `en`; it has to
  check every catalog against `it`, keys and `{{variables}}` both.
- **The formatting tables.** `format.ts` hand-writes, per locale, the separators, short and long months and short and
  long weekdays (`Record<AppLocale, …>`, no `Intl`). Each new locale fills all five, and the separators differ:
  `de`/`es`/`pt` `.` and `,`, `fr` and `sv` a (narrow) no-break space and `,`. Pin them with `format.test.ts` cases.
- **The setting.** `language` is `z.enum(['system', 'it', 'en'])` in `packages/core/src/entities.ts:50`, a synced
  field, plus the column type in `apps/mobile/src/db/schema.ts:33` and `seed.ts`. Widening the enum means an older
  build rejects a settings row written by a newer one — acceptable before release (see the frozen
  `SYNC_SCHEMA_VERSION`), worth a line in the changelog after. `resolveLocale` must map `pt-BR`/`pt-PT`, `es-*`
  etc. to the base language.
- **The Language screen** (`app/profile/language.tsx`) grows from three rows to seven; each language named in its
  own tongue, not translated.
- **Quality.** Machine-drafted text is fine for a start, but the Italian copy is written with care (tone, short
  labels that fit the design). Each catalog needs a native read before it ships, and German will overflow some
  buttons and chips — check the longest strings on the simulator.

Open point: `pt` as one catalog, or `pt-PT` and `pt-BR` separately (they differ in vocabulary more than in grammar).
Suggested: one `pt` (European) for now.

### Credit cards: settle the card from its payment account

- [ ] Asked for on 2026-09-22, shaped the same day. Ready to plan.

How it works today, and why it stays: a card's balance is debt, negative by design (§5.3), counted in net worth and,
by default, in spendable. Card expenses hit the card; the payment is a **transfer** from the main account to the card.
That is the right model: the money was spent when you swiped, and the payment only moves it. Recording the payment as
an expense would count every purchase twice in stats and budgets. So the model does not change; the manual work
around it does.

What is missing:

- **The payment account.** `creditPaymentAccountId` is in the schema (§4, `entities.ts:75`) but no screen sets it:
  `new.tsx` and the import always write `null`. The account sheet (§6.22) gets an "Addebitata su" picker next to the
  close and charge days, limited to non-card, non-archived accounts.
- **What is owed at the charge date.** Today the card box shows the whole balance ("Da rimborsare") and the running
  cycle ("Maturato"). The bank charges the *closed statement*: the balance at the last `creditCloseDay`, minus what
  was already paid after it. A pure function in `@saldo/core` (`creditStatementDue(account, txs, today)`), TDD, with
  cases for a payment made early, a partial payment, a refund and a card in credit.
- **"Salda carta" on the card box.** Opens the transfer sheet already filled in: from the payment account, to the
  card, the **closed statement** amount (decided), dated at the next charge day, with a default description (decided;
  e.g. "Saldo {card} · {month}", an i18n key in `it` and `en`). Every field stays editable, and nothing is written
  until the user saves: the charge day is when the card *should* settle, the confirmation is the user's. The
  transfer preview (§6.16) already tells you if the payment account can cover it. The card box also shows the
  expected settlement ("Da saldare il {date}: {amount}") so the date is visible before the reminder fires.
- **A reminder on the charge day.** A local notification (`expo-notifications`, same permission as the budget alerts
  of §5.8, `BudgetAlertsGate.tsx`): "Carta {name}: {amount} da saldare oggi". Tapping it opens the card detail, not
  a pre-saved transfer. Scheduled with a date trigger, one per card, so it has to be kept honest: re-scheduled when
  the card, its transactions or its close/charge days change, and skipped when the statement is already paid
  (`creditStatementDue === 0`). The time of day is an open point (suggested 09:00). A card with no charge day gets no
  reminder.

What I would not do:

- **Clamp the card at 0.** A refund or an overpayment puts a real card in credit, and the bank will show it. The
  detail already handles it (the hero goes back to "Saldo" when `balance ≥ 0`). A soft warning when a transfer would
  take the card above 0 — like `transferOverdrawsSource` does the other way — is enough.
- **Charge the card automatically on the charge day** (decided: no). The amount changes every month, so a recurring
  transfer does not fit, and a row the app writes on its own is wrong whenever the bank charges a different day or a
  different amount (revolving, partial payment). The button and the reminder cover it; the user confirms.

Open points: the reminder's time of day; whether the sheet offers the whole balance as a second amount (one tap)
next to the statement.

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
