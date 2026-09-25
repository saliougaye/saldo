# Transfer sheet: fill the amount with the source's whole balance

**Goal.** On a transfer (§6.16) one tap fills the amount with what the **Da** account holds, instead of reading the
balance and retyping it (ROADMAP «Transfers: a button to fill the amount with the source's whole balance»).

**Decisions (2026-09-25).**

- A chip under the figure, «Tutto il saldo · {amount}» (the label «Salda carta» already uses).
- Into an open goal that still lacks money, a second chip «Quanto manca · {amount}»: target − saved, capped at the
  source's balance, shown only when smaller than the whole balance (one option is not a choice). It follows the
  **A** picker, so «Accantona» gets it without a route param.
- «Preleva» gets the chip for free (Da = the pocket); «Riporta in {parent}» keeps its own prefill.
- Offered only for a balance > 0. A credit card therefore offers it only while in credit, with the credit.
- The row being edited is left out of the balance, so re-editing a transfer offers the same total it did.
- Towards a credit card there are no chips: paying a card, what counts is its debt, and «Salda carta» already
  offers it as «Tutto il saldo». Two «Tutto il saldo» with different figures would contradict each other.

## Steps

- [x] **Core, test first.** `transferFillAmounts(accounts, txs, today, { id, fromAccountId, toAccountId })` in
      `packages/core/src/accounts.ts` → `{ key: 'balance' | 'missing'; minor }[]`. Tests in `accounts.test.ts`:
      positive source; zero/negative source; card in debt, card in credit; towards a card; edited row excluded; future rows
      ignored; no source; missing chip into a goal, capped, hidden when ≥ balance, hidden for a reached or archived
      goal or a non-pocket destination.
- [x] **i18n.** `txForm.fillBalance`, `txForm.fillMissing` (`{{amount}}`) in every locale.
- [x] **Sheet.** `TransactionForm.tsx` renders the chips under the figure on a transfer, active while the field holds
      their amount.
- [x] Spec §6.16, ROADMAP entry ticked.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test` clean.
