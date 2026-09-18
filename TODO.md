# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list.

## Settle an account (analysis first)

- [x] Analyse how to bring an account's balance in line with the real one — see
      `docs/superpowers/analysis/2026-09-17-settle-an-account.md`.
- [x] Decide between keeping the opening-balance edit (A) and a balance checkpoint (C): **C**, decided with the
      user on 2026-09-18.
- [ ] Answer the open questions below, then plan it.

Use case: the history comes from a Spendee export, but the bank says the account holds a different
amount. The import creates unknown accounts with `openingBalance 0` (§11.3), so afterwards the
balance is only the sum of the imported rows.

Editing the balance in the account sheet already stores `openingBalance = entered − Σ(transaction
effects)` (§6.22), which shifts every past balance by the difference. Compare it with an adjustment
transaction dated today, visible in the list, before building anything:

- which one keeps statistics and budgets honest — an adjustment must not count as spending or income;
- how it syncs, and what happens when two devices settle the same account;
- whether it should be offered straight after an import. Onboarding's import path already asks each imported
  account's current balance and stores it as an opening balance (§6.29), so this is about an import from
  Profile, or a balance that drifts later.

### Proposal: "Controlla il saldo" (not agreed yet)

A checkpoint says "on this date the bank said X", so imported rows dated on or before an account's latest
checkpoint do not move today's balance. Only these accounts need checking after an import from Profile:

- accounts the import **created** (they start at 0, with no checkpoint);
- existing accounts with **no checkpoint**;
- existing accounts that received imported rows dated **after** their latest checkpoint.

The app can work that out itself, so the step lists only accounts whose figure may be wrong.

1. **Where:** in the import's done state, under "Importate N · Saltate M", a "Controlla il saldo" card with one row
   per account to check (name + computed balance). Tapping a row opens a small sheet with the balance field (with
   the `±` switch); saving writes a checkpoint for today. Not blocking: "Vedi le transazioni" stays, the step can be
   skipped, and checked rows get a tick.
2. **The field starts at the computed balance.** Saving it unchanged still writes a checkpoint — the user is
   confirming the figure. Skipping writes nothing.
3. **Checkpoint date: today.** The bank figure is today's even when the file ends last week; what happened between
   the end of the file and today is the user's to add, and the checkpoint does not hide it.
4. **Onboarding uses the same thing.** Import step 4 writes a checkpoint for today instead of changing the opening
   balance, so there is one way to set a verified balance and the account detail shows "Saldo verificato il …" from
   day one.

Open questions:

- **A. The account sheet's balance field.** Does typing a balance there create a checkpoint for today? Suggested:
  yes — one mental model, and the sync hole goes away for every balance edit, not only after an import.
- **B. Past dates.** "The statement on 31 August said X": allowed? Suggested: yes from the account detail (a date
  picker in the sheet, nothing changes in the maths), but "Controlla il saldo" stays fixed to today.
- **C. Scope of the list.** Only the three cases above, or every account the import touched? Suggested: the three
  cases.
- **D. Elsewhere.** A "not checked since…" hint on accounts without a checkpoint, on Home or Accounts? Suggested:
  not now.

## CSV import ignores `excluded`

- [ ] Read the `excluded` column the Saldo CSV export writes (§11.2) when importing (§11.3).

A Saldo CSV round trip counts excluded rows again: `IMPORT_FIELDS` has no `excluded`, so every imported row gets
`excludeFromTotals: false`. Found during the settle analysis.
