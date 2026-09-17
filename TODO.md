# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list.

## Settle an account (analysis first)

- [x] Analyse how to bring an account's balance in line with the real one — see
      `docs/superpowers/analysis/2026-09-17-settle-an-account.md`.
- [ ] Decide between keeping the opening-balance edit (A) and a balance checkpoint (C), then plan it.

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

## CSV import ignores `excluded`

- [ ] Read the `excluded` column the Saldo CSV export writes (§11.2) when importing (§11.3).

A Saldo CSV round trip counts excluded rows again: `IMPORT_FIELDS` has no `excluded`, so every imported row gets
`excludeFromTotals: false`. Found during the settle analysis.
