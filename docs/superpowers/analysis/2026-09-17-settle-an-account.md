# Settle an account — analysis

**Status:** analysis, nothing built. Picked up from `TODO.md` on 2026-09-17.

**Question:** when Saldo says an account holds one amount and the bank says another, how does the user bring them
in line — and which way keeps statistics, budgets, history and sync honest?

**Scope now:** onboarding's import path already asks each imported account's current balance and stores it as an
opening balance (§6.29). What is left is an **import from Profile** into an existing database, and a balance that
**drifts later** (a forgotten cash expense, a bank fee, a typo nobody finds).

---

## 1. What the code does today

- **Balance** (`accountBalances`, `packages/core/src/accounts.ts`): `openingBalance + Σ effects` over every live
  transaction dated `≤ today`. `excludeFromTotals` rows still count.
- **Settling exists, implicitly.** The account sheet edits the *current* balance and stores
  `openingBalance = entered − Σ effects` (`openingBalanceForCurrent`, `accountSeries.ts`; §6.22). No trace is left:
  no date, no previous value, no undo.
- **Account history** (`monthEndBalances`, the §6.10 sparkline) starts from `openingBalance`, so changing it moves
  **every** past point by the same difference.
- **Totals, statistics, budgets** use `countsInTotals` (`ledger.ts`): `kind ≠ transfer && !excludeFromTotals &&
  date ≤ today`. `stats.ts:93` and `groupByDay` (`filters.ts:142`) apply the same rule by hand.
- **Rules that ignore `excludeFromTotals`:** `creditStatementAccrued` ("Maturato nel ciclo", `accounts.ts:83`) sums
  every card expense in the statement; `topCategories` (`recents.ts`) ranks categories over every row; `totalsOf`
  (`ledger.ts`) counts excluded rows on purpose, for the line above a filtered list.
- **Every expense and income needs a category** (`refineTransactionShape`, `entities.ts`); a transfer needs two
  different accounts.
- **Sync is whole-row last-writer-wins** (`sync/merge.ts`): there is no field-level merge, and an account row holds
  name, type, colour, days *and* `openingBalance`.
- **CSV:** the export writes `excluded` (`io/csv.ts`); the import does not read it (`IMPORT_FIELDS` has no
  `excluded`), so a re-imported excluded row comes back counted.

---

## 2. Options

### A. Keep editing the opening balance (what exists)

The user types the bank's figure in the account sheet; the difference goes into `openingBalance`.

| | |
| --- | --- |
| Statistics and budgets | **Untouched.** No transaction exists. |
| Account history | **Rewritten.** Every past month moves by the difference, as if it had always been there. Right for missing old history (an export that starts in 2024), wrong for a fee charged last week. |
| Visibility | **None.** No row, no date, no undo. After a mistake the only fix is typing again. |
| Sync, same account edited twice | **One edit is lost.** Device A settles the balance while device B renames the account: whichever row has the later HLC wins whole, so either the rename or the settle silently disappears. |
| Sync, stale device | A device that has not yet pulled a transaction from another phone computes the opening balance without it. Once the row arrives, today's balance is off by exactly that amount — and the bank figure already included it. |
| Later edits | Fixing an old transaction's amount changes today's balance, pulling it away from the figure the user just checked. |
| Cost | Nothing to build. |

### B. An adjustment transaction dated today

Saving a settle writes an `income` or `expense` row for the difference, `excludeFromTotals: true`, in a system
category ("Rettifica saldo"), dated today, visible in the list.

| | |
| --- | --- |
| Statistics and budgets | **Mostly kept out** by `excludeFromTotals` (budget suggestions and §5.5 baselines go through `summarizePeriod` / `spendingByCategory`, so they are fine). Three leaks: it is an expense in "Maturato nel ciclo" on a credit card, it ranks in the category tiles, and it is counted in the filtered list's "N voci · X di uscite" (`totalsOf`). Each needs an explicit exception. |
| Account history | **Kept.** The past is as recorded; the difference shows up today as a jump. Right for drift, wrong for missing old history. |
| Visibility | **Full.** A row with a date, deletable, searchable. |
| Category | Needs a **system category**: seeded, hidden from pickers and from the category grid, protected from archive and delete, and excluded from stats category lists. Alternatively a new `kind: 'adjustment'`, which touches every exhaustive `kind` switch, the server schema, the CSV format and the forms. |
| Sync, same account edited twice | **No conflict with account edits** — it is its own row. |
| Sync, two devices settle | **Double correction.** Each writes its own row for the same gap. Avoidable with a deterministic id per `(account, date)`, so both writes are the same row and LWW keeps one. |
| Sync, stale device | Same problem as A: the amount is computed against a ledger that is missing a row. |
| CSV | A Saldo export → re-import turns the adjustment into counted spending, because the import ignores `excluded`. That gap exists today for every excluded row. |
| Rules | It is not "spending", but it has the shape of spending: every rule written later that reads `kind` without `excludeFromTotals` counts it. |
| Cost | Medium: system category + guards + UI to settle + tests for each leak. |

### C. A balance checkpoint

A new synced entity `balanceCheckpoint { accountId, date, balance }`: "on this date the bank said this". The balance
on any day is the latest checkpoint on or before it plus the effects of the transactions dated **after** it; before
the first checkpoint, the opening balance applies as today.

| | |
| --- | --- |
| Statistics and budgets | **Untouched.** Not a transaction. |
| Account history | **Honest for both cases.** Before the first checkpoint the history is recomputed back from it (like A — right for missing old history); between checkpoints each one resets the line (like B — drift appears on the day it was found). |
| Visibility | A dated marker in the account detail ("Saldo verificato il 17 set"), deletable. Not in the transaction list, not in totals. |
| Sync, same account edited twice | **No conflict** — its own row. |
| Sync, two devices settle | Deterministic id per `(account, date)`: both are the same row, the later write wins. |
| Sync, stale device | **Solved for the common case.** A transaction dated on or before the checkpoint arrives late → it does not move today's balance, because the bank figure already contained it. |
| Later edits | Editing a transaction dated before the latest checkpoint no longer changes today's balance. That is correct (the bank is the truth) but **surprising** and needs to be said where it happens. |
| CSV | Nothing to export; the JSON backup gains a collection. |
| Cost | Largest: SQLite table + migration, server table + migration, `entitySchemas`, `SYNCED_TABLES`, backup format, every balance function (`accountBalances`, `monthEndBalances`, `openingBalanceForCurrent`, `transferBalancePreview` via `accountBalances`), account detail UI. `SYNC_SCHEMA_VERSION` stays at 1 (no public users). |

---

## 3. The three questions from `TODO.md`

**Which keeps statistics and budgets honest?** A and C by construction — neither is a transaction. B only with
`excludeFromTotals` plus explicit exceptions ("Maturato", category tiles, `totalsOf`, CSV re-import), and every future rule has
to know about it.

**How does it sync; what if two devices settle the same account?** A shares a row with every other account edit, so
concurrent edits lose one side silently. B and C are separate rows; with a deterministic id per `(account, date)`
two settles converge on one. Only C is also right when the settling device was missing another phone's transactions.

**Offer it straight after an import?** Yes, whichever option: the Profile import's done state lists the accounts it
touched with "Controlla il saldo" per account. It is the moment the user knows the number is wrong, and onboarding
already does the same.

---

## 4. Recommendation

**C, the checkpoint**, if settling is going to be a feature people use more than once: it is the only option that
keeps statistics out of it by construction, keeps history honest in both use cases, and survives the multi-device
cases this app is built around.

**A, as it is**, if settling stays a rare correction: it is already built, and only the post-import "Controlla il
saldo" prompt is missing. Its sync hole has **no cheap fix**: leaving `openingBalance` out of a rename's patch does
not help, because the repository writes the whole row and the whole row wins (`sync/merge.ts`). Closing it means
field-level merge for accounts, or moving the balance out of the account row — which is most of the way to C. So A
is a choice to accept that a rename on one phone can undo a settle on another.

**Not B.** It looks simplest, but it is a transaction that must not behave like one: a system category, a set of
exceptions in rules that already exist, and a standing trap for every rule written later.

## 5. Decisions needed

1. A as it is, or C?
2. With C: may a checkpoint be dated in the past ("the statement on 31 August said…"), or only today?
3. With C: does a checkpoint replace the account sheet's balance field (typing a balance = a checkpoint today), or
   sit beside it?
4. Either way: add the "Controlla il saldo" step after a Profile import?

Unrelated gap found on the way: the CSV import ignores the `excluded` column the export writes, so a Saldo CSV
round trip counts excluded rows again. It has its own `TODO.md` item.
