# TODO

Work that has been asked for but not planned yet. When an item is picked up it gets a plan under
`docs/superpowers/plans/` like any other piece of work, and leaves this list.

## Negative account balances

- [ ] Let an account's balance be entered below zero, in the account sheet (§6.22) and in onboarding
      step 3.

A balance can already be negative — a credit card's is by design (§5.3) — but neither form offers a
way to type a minus sign. Entry points: `apps/mobile/src/features/accounts/AccountForm.tsx`,
`apps/mobile/app/(onboarding)/balance.tsx`, and the keypad buffer conversion
`amountBufferToMinor` in `packages/core/src/money.ts`.

## Settle an account (analysis first)

- [ ] Analyse how to bring an account's balance in line with the real one.

Use case: the history comes from a Spendee export, but the bank says the account holds a different
amount. The import creates unknown accounts with `openingBalance 0` (§11.3), so afterwards the
balance is only the sum of the imported rows.

Editing the balance in the account sheet already stores `openingBalance = entered − Σ(transaction
effects)` (§6.22), which shifts every past balance by the difference. Compare it with an adjustment
transaction dated today, visible in the list, before building anything:

- which one keeps statistics and budgets honest — an adjustment must not count as spending or income;
- how it syncs, and what happens when two devices settle the same account;
- whether it should be offered straight after an import.

## Offer an import during onboarding

- [ ] Ask during onboarding whether the user wants to import an existing export.

Onboarding (§6.29) is four steps — period, account details, balance, categories — and the import
wizard is reachable only from Profile (`apps/mobile/app/profile/import.tsx`, §11.3).

To decide:

- Where the question goes: before the account steps, so the import can create the accounts itself,
  or after "Inizia".
- How it meets the settle item above: an imported account starts from 0, so the balance asked in
  step 3 and the imported history have to agree.
- A Saldo JSON backup (§11.1) is a restore, not an import, and may deserve its own path.
